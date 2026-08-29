//! End-to-end launch test.
//!
//! Spins up a tiny local HTTP server, downloads a fake "client JAR" through
//! the real `Downloader`, then uses a shell script as a mock Java to drive
//! the real `launcher::launch` pipeline. The test verifies:
//!
//!   1. `Downloader` fetches a file with the correct SHA-1.
//!   2. A second call is a cache hit (no HTTP roundtrip).
//!   3. `launcher::launch` actually spawns the mock Java with the right
//!      JVM args, captures its stdout, and registers the process.
//!   4. Killing the handle terminates the child.
//!   5. Relaunching does NOT redownload — the cached file is reused.
//!
//! No real Minecraft / Mojang / Microsoft endpoints are touched.

use chrono::{Duration, Utc};
use mc_launcher_core::auth::Account;
use mc_launcher_core::downloads::Downloader;
use mc_launcher_core::instances::Instance;
use mc_launcher_core::launcher::{self, LaunchRequest};
use mc_launcher_core::metadata::version::VersionMeta;
use mc_launcher_core::process::ProcessRegistry;
use serde_json::json;
use sha1_smol::Sha1;
use std::collections::HashMap;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration as StdDuration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

static PORT: AtomicU16 = AtomicU16::new(0);

/// Tiny single-shot HTTP server: GET /<name> serves a fixed in-memory byte
/// payload with a known SHA-1. Counts how many times each path is hit.
async fn spawn_server(payload: Vec<u8>) -> (SocketAddr, Arc<std::sync::Mutex<Vec<String>>>) {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let hits = Arc::new(std::sync::Mutex::new(Vec::<String>::new()));
    let hits_clone = hits.clone();
    tokio::spawn(async move {
        loop {
            let (mut sock, _) = match listener.accept().await {
                Ok(p) => p,
                Err(_) => return,
            };
            let mut buf = [0u8; 1024];
            let n = match sock.read(&mut buf).await {
                Ok(n) if n > 0 => n,
                _ => continue,
            };
            let req = String::from_utf8_lossy(&buf[..n]).into_owned();
            // Parse the first line: "GET /path HTTP/1.1".
            let path = req
                .lines()
                .next()
                .and_then(|l| l.split_whitespace().nth(1))
                .unwrap_or("/")
                .trim_start_matches('/')
                .to_string();
            hits_clone.lock().unwrap().push(path.clone());
            let body = payload.clone();
            let header = format!(
                "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nContent-Type: application/octet-stream\r\nConnection: close\r\n\r\n",
                body.len()
            );
            let _ = sock.write_all(header.as_bytes()).await;
            let _ = sock.write_all(&body).await;
            let _ = sock.shutdown().await;
        }
    });
    (addr, hits)
}

fn make_account() -> Account {
    Account {
        id: "test-account".into(),
        username: "PlayerOne".into(),
        uuid: "00000000-0000-0000-0000-000000000001".into(),
        access_token: "test-access-token-not-real".into(),
        refresh_token: "test-refresh-token-not-real".into(),
        expires_at: Utc::now() + Duration::hours(1),
        is_msa: true,
    }
}

fn make_instance(name: &str, version: &str, game_dir: PathBuf) -> Instance {
    Instance {
        id: "inst-e2e-001".into(),
        name: name.into(),
        version: version.into(),
        game_dir: game_dir.clone(),
        ram_mb: Some(1024),
        jvm_profile: "default".into(),
        custom_jvm_args: vec![],
        resolution_width: Some(854),
        resolution_height: Some(480),
        fullscreen: false,
        env: Default::default(),
        mods: Default::default(),
        resourcepacks: Default::default(),
        shaderpacks: Default::default(),
        notes: "".into(),
        color: "".into(),
        show_log_on_launch: true,
        close_on_launch: false,
        java_path: None,
        game_dir_override: Some(game_dir),
    }
}

fn make_version_meta(java_major: u32) -> VersionMeta {
    serde_json::from_value(json!({
        "id": "1.21.4",
        "type": "release",
        "mainClass": "net.minecraft.client.main.Main",
        "assetIndex": {
            "id": "1.21",
            "sha1": "0000000000000000000000000000000000000000",
            "size": 0,
            "url": "http://invalid/asset-index.json"
        },
        "assets": "1.21",
        "downloads": {
            "client": {
                "sha1": "0000000000000000000000000000000000000000",
                "size": 0,
                "url": "http://invalid/client.jar"
            }
        },
        "libraries": [],
        "javaVersion": {
            "majorVersion": java_major,
            "component": "JRE"
        }
    }))
    .unwrap()
}

/// Build a shell script that pretends to be `java`. It records the
/// arguments, env, and CWD, then waits so the test can verify a kill
/// terminates it, then exits cleanly on second invocation.
fn write_mock_java(dir: &std::path::Path) -> PathBuf {
    let path = dir.join("java");
    let body = r#"#!/bin/sh
echo "MOCK_JAVA_START"
echo "args: $@"
echo "cwd: $(pwd)"
echo "INST_NAME=${INST_NAME}"
echo "INST_ID=${INST_ID}"
echo "GAME_DIR=${GAME_DIR}"
echo "MOCK_JAVA_READY"
# Wait for the parent to send SIGTERM, or 5 seconds, whichever comes first.
trap 'echo MOCK_JAVA_KILLED; exit 143' TERM INT
i=0
while [ $i -lt 50 ]; do
  sleep 0.1
  i=$((i+1))
done
echo "MOCK_JAVA_EXIT"
exit 0
"#;
    std::fs::write(&path, body).unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut p = std::fs::metadata(&path).unwrap().permissions();
        p.set_mode(0o755);
        std::fs::set_permissions(&path, p).unwrap();
    }
    path
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn end_to_end_launch_with_mock_java() {
    // -------- 1. Set up a temp workspace --------
    let workspace = tempdir();
    let cache_dir = workspace.join("cache");
    let runtime_dir = workspace.join("runtime");
    let game_dir = workspace.join("game");
    let java_dir = workspace.join("java");
    tokio::fs::create_dir_all(&cache_dir).await.unwrap();
    tokio::fs::create_dir_all(&runtime_dir).await.unwrap();
    tokio::fs::create_dir_all(&game_dir).await.unwrap();
    tokio::fs::create_dir_all(&java_dir).await.unwrap();

    // -------- 2. Mock Java --------
    let java_path = write_mock_java(&java_dir);

    // -------- 3. Spin up a fake Mojang-like server and download the "client JAR" --------
    let payload = b"FAKE_MINECRAFT_CLIENT_JAR_BYTES".to_vec();
    let expected_sha1 = Sha1::from(&payload).digest().to_string();
    let expected_size = payload.len() as u64;
    let (addr, hits) = spawn_server(payload.clone()).await;
    let url = format!("http://{addr}/client.jar");
    let client_dest = runtime_dir.join("versions").join("1.21.4").join("1.21.4.jar");
    let downloader = Arc::new(Downloader::new(cache_dir.clone()));

    // First download — should hit the network.
    downloader
        .download_verified(&url, &client_dest, &expected_sha1, expected_size)
        .await
        .expect("first download should succeed");
    assert!(client_dest.exists());
    assert_eq!(hits.lock().unwrap().len(), 1, "expected exactly 1 HTTP hit");

    // Second download — should be a cache hit, no HTTP traffic.
    downloader
        .download_verified(&url, &client_dest, &expected_sha1, expected_size)
        .await
        .expect("second download should be cache hit");
    assert_eq!(hits.lock().unwrap().len(), 1, "expected no extra HTTP hit on cache hit");

    // Corruption test: rewrite the file with wrong contents, ensure redownload.
    tokio::fs::write(&client_dest, b"corrupted")
        .await
        .unwrap();
    downloader
        .download_verified(&url, &client_dest, &expected_sha1, expected_size)
        .await
        .expect("corrupt file should be redownloaded");
    assert_eq!(hits.lock().unwrap().len(), 2, "expected a redownload on corruption");
    let final_bytes = tokio::fs::read(&client_dest).await.unwrap();
    assert_eq!(final_bytes, payload, "file should match original after redownload");

    // -------- 4. Launch via the real launcher pipeline with a mock java --------
    let version = make_version_meta(17);
    let instance = make_instance("E2E Test", "1.21.4", game_dir.clone());
    let natives_dir = runtime_dir.join("natives").join("1.21.4");
    tokio::fs::create_dir_all(&natives_dir).await.unwrap();
    let asset_index_path = runtime_dir.join("assets/indexes/1.21.json");
    tokio::fs::create_dir_all(asset_index_path.parent().unwrap()).await.unwrap();
    tokio::fs::write(&asset_index_path, b"{}").await.unwrap();

    let req = LaunchRequest {
        instance: instance.clone(),
        version: version.clone(),
        version_url: url.clone(),
        auth: make_account(),
        java_path: java_path.clone(),
        java_major: 17,
        max_ram_mb: 1024,
        resolution: Some((854, 480)),
        downloads: downloader.clone(),
        metadata: Arc::new(mc_launcher_core::metadata::MetadataCache::new(
            cache_dir.join("metadata"),
        )),
        runtime_dir: runtime_dir.clone(),
        asset_index_path: asset_index_path.clone(),
        asset_index_id: "1.21".into(),
        natives_dir: natives_dir.clone(),
    };

    let registry = ProcessRegistry::new();
    let handle = launch::launch(req, &registry)
        .await
        .expect("launch should succeed");

    assert!(handle.pid() > 0, "spawned process should have a valid PID");
    assert!(registry.get(&instance.id).is_some(), "process should be in registry");
    assert_eq!(registry.list().len(), 1);

    // Give the mock java a moment to print its startup banner.
    tokio::time::sleep(StdDuration::from_millis(500)).await;

    // -------- 5. Read at least one log line from the captured stdout --------
    let mut captured_lines: Vec<String> = Vec::new();
    let deadline = std::time::Instant::now() + StdDuration::from_secs(3);
    while std::time::Instant::now() < deadline {
        match tokio::time::timeout(StdDuration::from_millis(500), handle.next_log()).await {
            Ok(Some(line)) => {
                captured_lines.push(format!("[{}] {}", line.stream, line.text));
                if captured_lines.iter().any(|l| l.contains("MOCK_JAVA_READY")) {
                    break;
                }
            }
            Ok(None) => break,
            Err(_) => continue,
        }
    }
    assert!(
        captured_lines.iter().any(|l| l.contains("MOCK_JAVA_START")),
        "expected to capture MOCK_JAVA_START, got: {captured_lines:?}"
    );
    assert!(
        captured_lines.iter().any(|l| l.contains("MOCK_JAVA_READY")),
        "expected to capture MOCK_JAVA_READY, got: {captured_lines:?}"
    );
    // The launcher should have set per-instance env vars before spawning.
    assert!(
        captured_lines.iter().any(|l| l.contains("INST_NAME=E2E Test")),
        "expected INST_NAME env var, got: {captured_lines:?}"
    );
    assert!(
        captured_lines.iter().any(|l| l.contains("INST_ID=") && l.contains("inst-e2e-001")),
        "expected INST_ID env var, got: {captured_lines:?}"
    );

    // -------- 6. Kill the process and confirm exit --------
    handle.kill().await.expect("kill should succeed");
    let status = tokio::time::timeout(StdDuration::from_secs(3), handle.wait())
        .await
        .expect("process should exit within 3s of kill")
        .expect("wait should succeed");
    assert!(!status.success(), "killed process should not report success");
    registry.unregister(&instance.id);

    // -------- 7. Relaunch: must NOT redownload (cache hit) --------
    let req2 = LaunchRequest {
        instance: instance.clone(),
        version: version.clone(),
        version_url: url.clone(),
        auth: make_account(),
        java_path: java_path.clone(),
        java_major: 17,
        max_ram_mb: 1024,
        resolution: Some((854, 480)),
        downloads: downloader.clone(),
        metadata: Arc::new(mc_launcher_core::metadata::MetadataCache::new(
            cache_dir.join("metadata"),
        )),
        runtime_dir: runtime_dir.clone(),
        asset_index_path: asset_index_path.clone(),
        asset_index_id: "1.21".into(),
        natives_dir: natives_dir.clone(),
    };
    let hits_before = hits.lock().unwrap().len();
    let handle2 = launch::launch(req2, &registry)
        .await
        .expect("relaunch should succeed");
    tokio::time::sleep(StdDuration::from_millis(300)).await;
    handle2.kill().await.expect("kill 2 should succeed");
    let _ = tokio::time::timeout(StdDuration::from_secs(3), handle2.wait()).await;
    registry.unregister(&instance.id);

    let hits_after = hits.lock().unwrap().len();
    assert_eq!(
        hits_before, hits_after,
        "relaunch must not trigger any new HTTP traffic; hits went {hits_before} -> {hits_after}"
    );

    // The cached client JAR should still be the correct bytes (untouched).
    let bytes = tokio::fs::read(&client_dest).await.unwrap();
    assert_eq!(sha1_of(&bytes), expected_sha1, "cache integrity preserved across relaunch");
}

fn sha1_of(bytes: &[u8]) -> String {
    Sha1::from(bytes).digest().to_string()
}

fn tempdir() -> PathBuf {
    let base = std::env::temp_dir().join(format!(
        "mc_launcher_e2e_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    std::fs::create_dir_all(&base).unwrap();
    base
}
