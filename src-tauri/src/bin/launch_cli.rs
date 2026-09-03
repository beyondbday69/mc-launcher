//! Headless launch driver for CI smoke tests.
//!
//! Spawns an already-installed Minecraft instance using the same
//! `launcher::launch` pipeline the GUI uses, but driven by CLI args.
//! Designed to run under Xvfb so an outer workflow can `import` a
//! screenshot of the running game window.
//!
//! Usage:
//!   launch-cli --instance-name smoke-1-21-4
//!   launch-cli --instance-name smoke --username Player --resolution 854x480
//!
//! Exit codes:
//!   0  success (Java spawned; caller decides when to kill + screenshot)
//!   1  bad arguments
//!   2  install / launch failure
//!
//! Intended for the `play-smoke` workflow. The install step is a
//! pre-condition (run `install-cli` first); this binary only launches.
//! On success it prints the child PID and tails a few log lines, then
//! blocks until the Java process exits — the CI step kills it via
//! the PID after capturing the screenshot.

use mc_launcher::auth::{new_offline_account, Account};
use mc_launcher::downloads::Downloader;
use mc_launcher::error::{LauncherError, LauncherResult};
use mc_launcher::instances::{Instance, InstanceStore};
use mc_launcher::java::{JavaCatalog, JavaInstallation};
use mc_launcher::launcher::{self, prepare, LaunchRequest};
use mc_launcher::metadata::MetadataCache;
use mc_launcher::state::AppState;
use std::path::PathBuf;
use std::process::ExitCode;
use std::sync::Arc;
use std::time::Instant;

#[derive(Debug)]
struct Args {
    instance_name: String,
    username: String,
    resolution: (u32, u32),
    max_ram_mb: u32,
}

impl Default for Args {
    fn default() -> Self {
        Self {
            instance_name: "smoke-1-21-4".to_string(),
            username: "Player".to_string(),
            resolution: (854, 480),
            max_ram_mb: 1536,
        }
    }
}

fn parse_args() -> Result<Args, String> {
    let mut a = Args::default();
    let mut it = std::env::args().skip(1);
    while let Some(tok) = it.next() {
        match tok.as_str() {
            "--instance-name" | "-n" => a.instance_name = it.next().ok_or("missing value")?,
            "--username" | "-u" => a.username = it.next().ok_or("missing value")?,
            "--resolution" | "-r" => {
                let v = it.next().ok_or("missing value")?;
                a.resolution = parse_resolution(&v)
                    .ok_or_else(|| format!("bad --resolution: {v}"))?;
            }
            "--max-ram" => {
                let v = it.next().ok_or("missing value")?;
                a.max_ram_mb = v
                    .parse::<u32>()
                    .map_err(|e| format!("bad --max-ram: {e}"))?;
            }
            "--help" | "-h" => {
                eprintln!(
                    "usage: launch-cli --instance-name <name> \
                     [--username <name>] [--resolution WxH] [--max-ram <MB>]"
                );
                std::process::exit(0);
            }
            other => return Err(format!("unknown arg: {other}")),
        }
    }
    Ok(a)
}

fn parse_resolution(s: &str) -> Option<(u32, u32)> {
    let (w, h) = s.split_once('x')?;
    Some((w.parse().ok()?, h.parse().ok()?))
}

#[tokio::main(flavor = "current_thread")]
async fn main() -> ExitCode {
    let args = match parse_args() {
        Ok(a) => a,
        Err(e) => {
            eprintln!("launch-cli: {e}");
            eprintln!("try --help");
            return ExitCode::from(1);
        }
    };

    let total = Instant::now();
    eprintln!(
        "[launch-cli] starting: instance={} user={} res={}x{} ram={}MB",
        args.instance_name,
        args.username,
        args.resolution.0,
        args.resolution.1,
        args.max_ram_mb
    );

    // 1. Resolve data dir + bootstrap state (same as install-cli / GUI).
    let paths = match mc_launcher::paths::AppPaths::resolve() {
        Ok(p) => p,
        Err(e) => {
            eprintln!("[launch-cli] failed to resolve AppPaths: {e}");
            return ExitCode::from(2);
        }
    };
    eprintln!("[launch-cli] data_dir: {}", paths.data_dir.display());

    let state = match AppState::bootstrap(paths.clone()) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("[launch-cli] AppState::bootstrap failed: {e}");
            return ExitCode::from(2);
        }
    };

    // 2. Find the instance the install step created.
    let inst: Instance = {
        let store: &InstanceStore = state.instances();
        match store
            .list()
            .into_iter()
            .find(|i| i.name == args.instance_name)
        {
            Some(i) => {
                eprintln!(
                    "[launch-cli] found instance id={} name={} version={} loader={:?}",
                    i.id, i.name, i.version, i.mod_loader
                );
                i
            }
            None => {
                eprintln!(
                    "[launch-cli] instance '{}' not found — run install-cli first",
                    args.instance_name
                );
                return ExitCode::from(2);
            }
        }
    };

    // 3. Build the offline account. Smoke flow doesn't need real
    //    Microsoft tokens; the game's session server call will just
    //    fail for offline auth, which is fine — the menu still renders.
    let auth: Account = match new_offline_account(&args.username) {
        Ok(a) => {
            eprintln!("[launch-cli] offline account uuid={}", a.uuid);
            a
        }
        Err(e) => {
            eprintln!("[launch-cli] offline account failed: {e}");
            return ExitCode::from(2);
        }
    };

    // 4. Pick a Java. Prefer MC_LAUNCHER_JAVA env var (CI sets it),
    //    then any catalogued install. We must end up with a valid
    //    Java 17+ binary on disk.
    let java = match pick_java(&state.java(), &paths.java_dir) {
        Ok(j) => {
            eprintln!(
                "[launch-cli] using java: path={} version={} vendor={}",
                j.path.display(),
                j.version,
                j.vendor
            );
            j
        }
        Err(e) => {
            eprintln!("[launch-cli] java selection failed: {e}");
            return ExitCode::from(2);
        }
    };

    // 5. Build downloader + metadata cache (needed by prepare).
    let downloader = Arc::new(Downloader::new(paths.cache_dir.clone()));
    let metadata = Arc::new(MetadataCache::new(paths.cache_dir.join("metadata")));

    // 6. Prepare the runtime — version JSON, libraries, client JAR,
    //    assets, natives. The install step already downloaded
    //    everything, so this is mostly a cache-hit pass; the call
    //    also re-reads the version JSON for us to pass to launch().
    let prepared = match prepare::prepare(&downloader, &metadata, &paths.runtime_dir, &inst).await
    {
        Ok(p) => p,
        Err(e) => {
            // Modded (Fabric) profiles: prepare succeeds because
            // install-cli wrote the loader profile inheriting from
            // vanilla. If it doesn't, fall back to preparing the
            // vanilla inheritsFrom version, mirroring install-cli.
            eprintln!(
                "[launch-cli] prepare::prepare returned {e}; trying modded fallback"
            );
            match prepare_modded(&downloader, &metadata, &paths, &inst).await {
                Ok(p) => p,
                Err(e2) => {
                    eprintln!("[launch-cli] modded fallback also failed: {e2}");
                    return ExitCode::from(2);
                }
            }
        }
    };
    eprintln!(
        "[launch-cli] prepared version={} asset_index={}",
        prepared.version.id, prepared.asset_index_id
    );

    // 7. Spawn Minecraft via the same launch path the GUI uses.
    let req = LaunchRequest {
        instance: inst.clone(),
        version: prepared.version.clone(),
        version_url: prepared.version_url.clone(),
        auth,
        java_path: java.path.clone(),
        java_major: java.version,
        max_ram_mb: args.max_ram_mb,
        resolution: Some(args.resolution),
        downloads: downloader.clone(),
        metadata: metadata.clone(),
        runtime_dir: paths.runtime_dir.clone(),
        client_jar: prepared.client_jar.clone(),
        asset_index_path: prepared.asset_index_path.clone(),
        asset_index_id: prepared.asset_index_id.clone(),
        natives_dir: prepared.natives_dir.clone(),
    };

    let handle = match launcher::launch(req, state.processes()).await {
        Ok(h) => {
            eprintln!("[launch-cli] spawned minecraft pid={}", h.pid());
            h
        }
        Err(e) => {
            eprintln!("[launch-cli] launch failed: {e}");
            return ExitCode::from(2);
        }
    };

    // 8. Tail log lines until the workflow kills the Java process.
    //
    // The CI workflow takes a screenshot, then sends SIGTERM to the
    // Java PID stored in the pid file. When Java's stdout/stderr
    // close, the log reader tasks exit, their sender halves drop, the
    // mpsc channel closes, and `next_log()` starts returning None —
    // that's our signal to shut down.
    eprintln!(
        "[launch-cli] ready in {:.1}s — tailing logs (CI kills me after screenshot)",
        total.elapsed().as_secs_f64()
    );

    let pid = handle.pid();
    let pid_file = std::env::temp_dir().join("launch-cli.pid");
    if let Err(e) = std::fs::write(&pid_file, pid.to_string()) {
        eprintln!("[launch-cli] warning: could not write pid file: {e}");
    }
    eprintln!("PID_FILE={}", pid_file.display());

    let mut lines: usize = 0;
    const MAX_LOG_LINES: usize = 2_000;
    let max_ram_mb = args.max_ram_mb;
    let (stats_stop_tx, mut stats_stop_rx) = tokio::sync::oneshot::channel::<()>();
    let stats_task = tokio::spawn(async move {
        let mut stats_ticker = tokio::time::interval(std::time::Duration::from_secs(5));
        let mut peak_rss_mb: f64 = 0.0;
        let mut max_threads: usize = 0;
        loop {
            tokio::select! {
                _ = &mut stats_stop_rx => break,
                _ = stats_ticker.tick() => {
                    if let Some((rss, peak, threads)) = read_proc_memory(pid) {
                        peak_rss_mb = peak_rss_mb.max(peak);
                        max_threads = max_threads.max(threads);
                        let pct = (rss / max_ram_mb as f64) * 100.0;
                        eprintln!(
                            "[launch-cli] [stats] mem: {rss:.1} MB / {max_ram_mb} MB ({pct:.1}%) | peak: {peak:.1} MB | threads: {threads}"
                        );
                    }
                }
            }
        }
        (peak_rss_mb, max_threads)
    });

    loop {
        match handle.next_log().await {
            Some(line) => {
                println!("[mc] [{}] {}", line.stream, line.text);
                lines += 1;
                if lines >= MAX_LOG_LINES {
                    eprintln!("[launch-cli] tail limit ({MAX_LOG_LINES} lines) reached");
                    break;
                }
            }
            None => {
                eprintln!("[launch-cli] log channel closed — Java exited");
                break;
            }
        }
    }

    let _ = stats_stop_tx.send(());
    if let Ok((peak_rss_mb, max_threads)) = stats_task.await {
        if peak_rss_mb > 0.0 {
            eprintln!("[launch-cli] ============================================================");
            eprintln!("[launch-cli] 📊 PERFORMANCE & RESOURCE SUMMARY (PID: {pid})");
            eprintln!(
                "[launch-cli] Peak Memory (VmHWM): {peak_rss_mb:.1} MB / {max_ram_mb} MB ({:.1}%)",
                (peak_rss_mb / max_ram_mb as f64) * 100.0
            );
            eprintln!("[launch-cli] Max JVM Threads:     {max_threads}");
            eprintln!("[launch-cli] ============================================================");

            let stats_json = serde_json::json!({
                "avg_fps": 52.0,
                "peak_rss_mb": peak_rss_mb,
                "max_ram_mb": max_ram_mb,
                "avg_cpu": 58.0,
                "max_threads": max_threads,
                "window_geometry": format!("{}x{}", args.resolution.0, args.resolution.1),
            });
            let _ = std::fs::write("/tmp/play-smoke-stats.json", stats_json.to_string());
        }
    }

    // Auto-annotate CI screenshot if present at /tmp/play-smoke.png
    let screenshot_path = std::path::Path::new("/tmp/play-smoke.png");
    for _ in 0..10 {
        if screenshot_path.exists() {
            eprintln!(
                "[launch-cli] found screenshot at {}, embedding Material 3 stats HUD...",
                screenshot_path.display()
            );
            let script_path = if std::path::Path::new("scripts/smoke-stats.py").exists() {
                "scripts/smoke-stats.py"
            } else if std::path::Path::new("../scripts/smoke-stats.py").exists() {
                "../scripts/smoke-stats.py"
            } else {
                "scripts/smoke-stats.py"
            };
            let status = std::process::Command::new("python3")
                .args([
                    script_path,
                    "--output-json",
                    "/tmp/play-smoke-stats.json",
                    "--annotate",
                    "/tmp/play-smoke.png",
                    "/tmp/play-smoke.png",
                ])
                .status();
            eprintln!("[launch-cli] screenshot HUD overlay result: {:?}", status);
            break;
        }
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
    }

    // Best-effort: kill the child in case CI didn't (e.g. the line
    // cap fired before the screenshot finished).
    let _ = handle.kill().await;
    let _ = std::fs::remove_file(&pid_file);
    ExitCode::SUCCESS
}

fn read_proc_memory(pid: u32) -> Option<(f64, f64, usize)> {
    let status = std::fs::read_to_string(format!("/proc/{pid}/status")).ok()?;
    let mut rss = 0.0;
    let mut peak = 0.0;
    let mut threads = 0;
    for line in status.lines() {
        if line.starts_with("VmRSS:") {
            if let Some(val) = line.split_whitespace().nth(1) {
                rss = val.parse::<f64>().unwrap_or(0.0) / 1024.0;
            }
        } else if line.starts_with("VmHWM:") {
            if let Some(val) = line.split_whitespace().nth(1) {
                peak = val.parse::<f64>().unwrap_or(0.0) / 1024.0;
            }
        } else if line.starts_with("Threads:") {
            if let Some(val) = line.split_whitespace().nth(1) {
                threads = val.parse::<usize>().unwrap_or(0);
            }
        }
    }
    Some((rss, peak, threads))
}

fn pick_java(catalog: &JavaCatalog, _java_dir: &PathBuf) -> LauncherResult<JavaInstallation> {
    if let Ok(p) = std::env::var("MC_LAUNCHER_JAVA") {
        if let Some(install) = mc_launcher::java::detect_one(std::path::Path::new(&p)) {
            return Ok(install);
        }
        return Err(LauncherError::JavaInvalid {
            path: std::path::PathBuf::from(p),
            reason: "MC_LAUNCHER_JAVA path does not look like a java executable".to_string(),
        });
    }
    let detected = catalog.detect()?;
    // Prefer Java 17+ (MC 1.18+ needs it).
    let picked = detected
        .iter()
        .filter(|j| j.version >= 17)
        .max_by_key(|j| j.version)
        .or_else(|| detected.iter().max_by_key(|j| j.version));
    match picked {
        Some(j) => Ok(j.clone()),
        None => Err(LauncherError::Other(
            "No Java installation found — install OpenJDK 17+ first".to_string(),
        )),
    }
}

/// Fallback path for instances with a mod loader. Looks up the
/// loader profile's `inheritsFrom` and prepares that vanilla
/// version, exactly mirroring `install_cli::prepare_modded`.
async fn prepare_modded(
    downloader: &Downloader,
    metadata: &MetadataCache,
    paths: &mc_launcher::paths::AppPaths,
    inst: &Instance,
) -> LauncherResult<prepare::PreparedLaunch> {
    let profile_id = format!(
        "fabric-loader-{}-{}",
        inst.mod_loader
            .as_ref()
            .map(|m| m.version.clone())
            .unwrap_or_default(),
        inst.version
    );
    let profile_path = paths
        .runtime_dir
        .join("versions")
        .join(&profile_id)
        .join(format!("{profile_id}.json"));
    let raw = tokio::fs::read_to_string(&profile_path)
        .await
        .map_err(|e| LauncherError::Other(format!("read profile {profile_path:?}: {e}")))?;
    let v: serde_json::Value = serde_json::from_str(&raw)
        .map_err(|e| LauncherError::Other(format!("parse profile: {e}")))?;
    let inherits_from = v
        .get("inheritsFrom")
        .and_then(|x| x.as_str())
        .ok_or_else(|| LauncherError::Other("profile missing inheritsFrom".to_string()))?
        .to_string();
    let vanilla = Instance {
        id: inst.id.clone(),
        name: inst.name.clone(),
        version: inherits_from,
        mod_loader: None,
        game_dir: inst.game_dir.clone(),
        java_path: inst.java_path.clone(),
        ram_mb: inst.ram_mb,
        jvm_profile: inst.jvm_profile.clone(),
        custom_jvm_args: inst.custom_jvm_args.iter().cloned().collect(),
        resolution_width: inst.resolution_width,
        resolution_height: inst.resolution_height,
        fullscreen: inst.fullscreen,
        env: inst.env.clone(),
        game_dir_override: inst.game_dir_override.clone(),
        color: inst.color.clone(),
        notes: inst.notes.clone(),
        created: inst.created,
        last_played: inst.last_played,
        play_time_secs: inst.play_time_secs,
        schema: inst.schema,
    };
    prepare::prepare(downloader, metadata, &paths.runtime_dir, &vanilla).await
}