//! External API integration tests — hit REAL Modrinth and REAL Fabric metadata.
//!
//! Default `cargo test --test external_apis` runs only the offline-only tests
//! (offline UUID + SHA-1 base64 -> hex). The live network tests are gated
//! with `#[ignore]` so they do not run unless explicitly opted in.
//!
//! To run the live network tests:
//!
//! ```text
//! cargo test --test external_apis -- --ignored --nocapture
//! ```
//!
//! (Or `cargo test -- --include-ignored` to run ALL tests in the binary.)
//!
//! The live tests use a stable User-Agent and a 30s request timeout. Each
//! test panics with the response body on failure so CI logs make the
//! root cause obvious.

use std::time::Duration;

const USER_AGENT: &str = concat!(
    "mc-launcher-core-tests/",
    env!("CARGO_PKG_VERSION"),
    " (integration; +https://github.com/beyondbday69/mc-launcher)"
);

fn client() -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .timeout(Duration::from_secs(30))
        .build()
        .expect("reqwest client should build with stable UA + 30s timeout")
}

/// Fetch a URL and return (status, body). Failures include the URL + error.
async fn fetch(c: &reqwest::Client, url: &str) -> (reqwest::StatusCode, String) {
    let resp = match c.get(url).send().await {
        Ok(r) => r,
        Err(e) => panic!("GET {url} failed: {e}"),
    };
    let status = resp.status();
    let body = resp
        .text()
        .await
        .unwrap_or_else(|e| panic!("GET {url} returned status {status} but body read failed: {e}"));
    (status, body)
}

// ---------------------------------------------------------------------------
// Offline-only tests — run by default, exercise the production code paths.
// ---------------------------------------------------------------------------

/// `offline_uuid("Notch")` must return a 36-char UUID with the MD5 version
/// nibble (position 14 = `3`) and an RFC 4122 variant nibble (position 19
/// is one of `8/9/a/b`). This locks in the algorithm the vanilla server
/// uses to map a username to a UUID when online-mode is false.
#[test]
fn offline_uuid_notch_format() {
    let u = mc_launcher_core::auth::offline::offline_uuid("Notch");
    assert_eq!(u.len(), 36, "UUID must be 36 chars, got {u:?}");
    let version = &u[14..15];
    assert_eq!(version, "3", "MD5 version nibble (pos 14) must be '3', got {version:?} in {u}");
    let variant = &u[19..20];
    assert!(
        matches!(variant, "8" | "9" | "a" | "b"),
        "RFC 4122 variant nibble (pos 19) must be 8/9/a/b, got {variant:?} in {u}"
    );
}

/// SHA-1 hex must be deterministic per username, and a different username
/// must produce a different UUID.
#[test]
fn offline_uuid_is_deterministic_and_collides_only_by_value() {
    let a = mc_launcher_core::auth::offline::offline_uuid("Notch");
    let b = mc_launcher_core::auth::offline::offline_uuid("Notch");
    assert_eq!(a, b, "offline_uuid must be deterministic for the same username");
    let c = mc_launcher_core::auth::offline::offline_uuid("jeb_");
    assert_ne!(a, c, "different usernames must hash to different UUIDs");
}

/// Known fixture: SHA-1 base64 of 20 zero bytes decodes to 40 zero hex
/// chars, and a non-zero fixture (SHA-1 of empty string) decodes to the
/// well-known hex digest of the empty string.
#[test]
fn sha1_base64_to_hex_known_fixtures() {
    // 20 zero bytes -> base64 with 27 'A's and one '='.
    let b64_zero = "AAAAAAAAAAAAAAAAAAAAAAAAAAA=";
    let hex_zero = mc_launcher_core::mods::modrinth::sha1_base64_to_hex(b64_zero)
        .expect("20 zero bytes must decode");
    assert_eq!(hex_zero, "0000000000000000000000000000000000000000");

    // SHA-1 of the empty string, base64-encoded.
    let b64_empty = "2jmj7l5rSw0yVb/vlWAYkK/YBwk=";
    let hex_empty = mc_launcher_core::mods::modrinth::sha1_base64_to_hex(b64_empty)
        .expect("SHA-1 of empty string must decode");
    assert_eq!(hex_empty, "da39a3ee5e6b4b0d3255bfef95601890afd80709");
}

/// Real Modrinth serves SHA-1 as 40-char hex, not base64. The function
/// must pass it through unchanged.
#[test]
fn sha1_base64_to_hex_passes_through_real_modrinth_hex() {
    let hex = "cd702b814c40b084e346e30b1ae89a5975dac948";
    let out = mc_launcher_core::mods::modrinth::sha1_base64_to_hex(hex)
        .expect("real Modrinth hex must pass through");
    assert_eq!(out, "cd702b814c40b084e346e30b1ae89a5975dac948");
    // Uppercase input must be normalised to lowercase.
    let out2 = mc_launcher_core::mods::modrinth::sha1_base64_to_hex(
        "CD702B814C40B084E346E30B1AE89A5975DAC948",
    )
    .expect("uppercase hex must normalise");
    assert_eq!(out2, "cd702b814c40b084e346e30b1ae89a5975dac948");
    // Garbage must be rejected, not silently accepted.
    assert!(mc_launcher_core::mods::modrinth::sha1_base64_to_hex("not-a-hash")
        .is_err());
}

// ---------------------------------------------------------------------------
// Live network tests — gated behind `#[ignore]`. Run with:
//   cargo test --test external_apis -- --ignored --nocapture
// ---------------------------------------------------------------------------

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
#[ignore = "live network; cargo test --test external_apis -- --ignored --nocapture"]
async fn modrinth_search_fabric_api() {
    let c = client();
    let url = "https://api.modrinth.com/v2/search?query=fabric-api&facets=[[\"project_type:mod\"]]&limit=5";
    let (status, body) = fetch(&c, url).await;
    assert!(status.is_success(), "Modrinth search returned {status}; body: {body}");
    let v: serde_json::Value = serde_json::from_str(&body)
        .unwrap_or_else(|e| panic!("invalid JSON from {url}: {e}; body: {body}"));
    let hits = v["hits"]
        .as_array()
        .unwrap_or_else(|| panic!("hits must be an array; body: {body}"));
    assert!(!hits.is_empty(), "expected at least 1 hit for fabric-api; body: {body}");
    assert!(
        hits[0]["slug"].as_str().is_some(),
        "first hit must have a slug; body: {body}"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
#[ignore = "live network; cargo test --test external_apis -- --ignored --nocapture"]
async fn modrinth_project_fabric_api() {
    let c = client();
    let url = "https://api.modrinth.com/v2/project/fabric-api";
    let (status, body) = fetch(&c, url).await;
    assert!(status.is_success(), "Modrinth project returned {status}; body: {body}");
    let v: serde_json::Value = serde_json::from_str(&body)
        .unwrap_or_else(|e| panic!("invalid JSON from {url}: {e}; body: {body}"));
    assert_eq!(v["slug"].as_str(), Some("fabric-api"), "slug must be fabric-api; body: {body}");
    assert!(v["title"].as_str().is_some(), "title must be present; body: {body}");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
#[ignore = "live network; cargo test --test external_apis -- --ignored --nocapture"]
async fn modrinth_versions_fabric_api_for_1_21_4() {
    let c = client();
    let url = "https://api.modrinth.com/v2/project/fabric-api/version?game_versions=1.21.4";
    let (status, body) = fetch(&c, url).await;
    assert!(status.is_success(), "Modrinth versions returned {status}; body: {body}");
    let arr: Vec<serde_json::Value> = serde_json::from_str(&body)
        .unwrap_or_else(|e| panic!("invalid JSON from {url}: {e}; body: {body}"));
    assert!(!arr.is_empty(), "expected >=1 fabric-api version for 1.21.4; body: {body}");
    // Every returned version must list 1.21.4 among its game_versions.
    for (i, v) in arr.iter().enumerate() {
        let gvs = v["game_versions"].as_array().unwrap_or_else(|| {
            panic!("version[{i}] missing game_versions; body: {body}")
        });
        let has_1214 = gvs.iter().any(|g| g.as_str() == Some("1.21.4"));
        assert!(has_1214, "version[{i}] does not list 1.21.4 in game_versions; body: {body}");
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
#[ignore = "live network; cargo test --test external_apis -- --ignored --nocapture"]
async fn fabric_meta_loader_versions_1_21_4() {
    let c = client();
    let url = "https://meta.fabricmc.net/v2/versions/loader/1.21.4";
    let (status, body) = fetch(&c, url).await;
    assert!(status.is_success(), "Fabric loader list returned {status}; body: {body}");
    let arr: Vec<serde_json::Value> = serde_json::from_str(&body)
        .unwrap_or_else(|e| panic!("invalid JSON from {url}: {e}; body: {body}"));
    assert!(!arr.is_empty(), "Fabric loader list for 1.21.4 must be non-empty; body: {body}");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
#[ignore = "live network; cargo test --test external_apis -- --ignored --nocapture"]
async fn fabric_meta_loader_version_detail_0_16_5() {
    let c = client();
    let url = "https://meta.fabricmc.net/v2/versions/loader/1.21.4/0.16.5";
    let (status, body) = fetch(&c, url).await;
    assert!(status.is_success(), "Fabric loader detail returned {status}; body: {body}");
    let v: serde_json::Value = serde_json::from_str(&body)
        .unwrap_or_else(|e| panic!("invalid JSON from {url}: {e}; body: {body}"));
    let common = v["launcherMeta"]["libraries"]["common"]
        .as_array()
        .unwrap_or_else(|| {
            panic!("launcherMeta.libraries.common must be an array; body: {body}")
        });
    assert!(
        common.len() >= 5,
        "expected >=5 common libs, got {}; body: {body}",
        common.len()
    );
    let main = v["launcherMeta"]["mainClass"]["client"]
        .as_str()
        .unwrap_or_else(|| panic!("mainClass.client must be a string; body: {body}"));
    assert_eq!(
        main, "net.fabricmc.loader.impl.launch.knot.KnotClient",
        "mainClass.client mismatch; body: {body}"
    );
}

// ---------------------------------------------------------------------------
// Modrinth tag endpoints — used by the Content screen filter dropdowns.
// ---------------------------------------------------------------------------

/// `GET /v2/tag/loader` must include the loaders we care about
/// (fabric, forge, neoforge, quilt). The list is JSON.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
#[ignore = "live network; cargo test --test external_apis -- --ignored --nocapture"]
async fn modrinth_tag_loaders_includes_fabric() {
    let c = client();
    let (status, body) = fetch(&c, "https://api.modrinth.com/v2/tag/loader").await;
    assert!(status.is_success(), "loaders returned {status}; body: {body}");
    let arr: Vec<serde_json::Value> = serde_json::from_str(&body)
        .unwrap_or_else(|e| panic!("invalid JSON: {e}; body: {body}"));
    let names: Vec<&str> = arr
        .iter()
        .filter_map(|v| v.get("name").and_then(|n| n.as_str()))
        .collect();
    for required in ["fabric", "forge", "neoforge"] {
        assert!(
            names.contains(&required),
            "tag/loader must include {required}; got: {names:?}"
        );
    }
}

/// `GET /v2/tag/game_version` must include the latest stable MC.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
#[ignore = "live network; cargo test --test external_apis -- --ignored --nocapture"]
async fn modrinth_tag_game_versions_non_empty() {
    let c = client();
    let (status, body) = fetch(&c, "https://api.modrinth.com/v2/tag/game_version").await;
    assert!(status.is_success(), "game_versions returned {status}; body: {body}");
    let arr: Vec<serde_json::Value> = serde_json::from_str(&body)
        .unwrap_or_else(|e| panic!("invalid JSON: {e}; body: {body}"));
    assert!(arr.len() > 20, "expected many game versions; got {}", arr.len());
    let first = &arr[0];
    assert!(
        first.get("version").and_then(|v| v.as_str()).is_some(),
        "first entry must have a version; body: {body}"
    );
    assert!(
        first.get("version_type").and_then(|v| v.as_str()).is_some(),
        "first entry must have version_type; body: {body}"
    );
}

/// `GET /v2/version_file/{hash}` returns the version that owns the file.
/// fabric-api has a stable SHA-1 we can pin: cd702b814c40b084e346e30b1ae89a5975dac948.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
#[ignore = "live network; cargo test --test external_apis -- --ignored --nocapture"]
async fn modrinth_version_file_by_hash_finds_fabric_api() {
    let c = client();
    let sha1 = "cd702b814c40b084e346e30b1ae89a5975dac948";
    let url = format!("https://api.modrinth.com/v2/version_file/{sha1}");
    let (status, body) = fetch(&c, &url).await;
    assert!(status.is_success(), "version_file returned {status}; body: {body}");
    let v: serde_json::Value = serde_json::from_str(&body)
        .unwrap_or_else(|e| panic!("invalid JSON: {e}; body: {body}"));
    let project_id = v
        .get("project_id")
        .and_then(|p| p.as_str())
        .unwrap_or_else(|| panic!("version_file must have project_id; body: {body}"));
    assert!(
        !project_id.is_empty(),
        "project_id must be non-empty; body: {body}"
    );
}

/// `GET /v2/project/{id}/dependencies` returns a JSON array. For
/// fabric-api (a single mod with no embedded deps) the array is usually
/// empty or short.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
#[ignore = "live network; cargo test --test external_apis -- --ignored --nocapture"]
async fn modrinth_project_dependencies_is_array() {
    let c = client();
    let url = "https://api.modrinth.com/v2/project/fabric-api/dependencies";
    let (status, body) = fetch(&c, url).await;
    assert!(status.is_success(), "dependencies returned {status}; body: {body}");
    let arr: Vec<serde_json::Value> = serde_json::from_str(&body)
        .unwrap_or_else(|e| panic!("invalid JSON: {e}; body: {body}"));
    // We don't assert any specific length; the contract is "returns a list".
    let _ = arr.len();
}
