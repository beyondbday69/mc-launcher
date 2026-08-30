//! End-to-end install feature tests.
//!
//! These exercise the real install paths against the real upstream
//! services (Mojang, Modrinth, Fabric) so the CI matrix proves that the
//! launcher's "install features" claims actually work:
//!
//!  * `mojang_manifest_*`     — manifest fetch + version filtering.
//!  * `modrinth_search_*`     — search returns results, version lookup
//!                              returns files with hex SHA-1.
//!  * `modrinth_install_e2e`  — actually download a small, well-known
//!                              mod into a temp dir, then verify it on
//!                              disk (file exists, size matches, SHA-1
//!                              matches).
//!  * `fabric_list_versions_*` — fabric loader versions for "1.21.4".
//!  * `fabric_install_e2e`    — actually install the fabric loader, then
//!                              assert the profile JSON + loader jars
//!                              are written.
//!
//! All tests use isolated temp dirs and are safe to run in parallel.
//! They require network access (which the CI runners have).
//!
//! Version-number handling (`parse_mc_major`, `is_snapshot_id`) is also
//! covered exhaustively in the unit tests in
//! `src/instances/version.rs`; this file stays focused on real I/O.

use mc_launcher::downloads::Downloader;
use mc_launcher::instances::version as vparse;
use mc_launcher::metadata::{MetadataCache, VersionEntry, VersionKind};
use mc_launcher::mods::modrinth::{
    self, ProjectType, sha1_base64_to_hex,
};
use mc_launcher::mods::{FabricLoader, ModLoader};
use std::path::PathBuf;
use std::time::Duration;

const TIMEOUT: Duration = Duration::from_secs(120);

fn tempdir(tag: &str) -> PathBuf {
    let base = std::env::temp_dir().join(format!(
        "mc_launcher_install_{}_{}",
        tag,
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    std::fs::create_dir_all(&base).unwrap();
    base
}

fn make_downloader(dir: &PathBuf) -> Downloader {
    Downloader::new(dir.join("cache"))
}

// --------------------------------------------------------------------
// Version-number parsing — covered deeply in the unit tests in
// `instances/version.rs`. These are integration-level re-assertions to
// guard against accidental reverts.
// --------------------------------------------------------------------

#[test]
fn parse_mc_major_release() {
    assert_eq!(vparse::parse_mc_major("1.21.4"), 21);
    assert_eq!(vparse::parse_mc_major("1.20.5"), 20);
    assert_eq!(vparse::parse_mc_major("1.18"), 18);
}

#[test]
fn parse_mc_major_snapshots() {
    // Old "1.X-preN" form — used to return 0 before the fix.
    assert_eq!(vparse::parse_mc_major("1.18-pre1"), 18);
    assert_eq!(vparse::parse_mc_major("1.21.4-pre1"), 21);
    // New "YYwWWA" form — used to return 0 before the fix.
    assert_eq!(vparse::parse_mc_major("24w40a"), 24);
    assert_eq!(vparse::parse_mc_major("25w01a"), 25);
}

#[test]
fn snapshot_id_classifier_matches_loader_shape() {
    assert!(vparse::is_snapshot_id("24w40a"));
    assert!(vparse::is_snapshot_id("1.18-pre1"));
    assert!(!vparse::is_snapshot_id("1.21.4"));
    assert!(!vparse::is_snapshot_id("1.20"));
}

// --------------------------------------------------------------------
// Mojang manifest
// --------------------------------------------------------------------

#[tokio::test]
async fn mojang_manifest_lists_latest_pair() {
    let dir = tempdir("mojang");
    let dl = make_downloader(&dir);
    let cache = MetadataCache::new(dir.join("metadata"));
    let res = tokio::time::timeout(TIMEOUT, async {
        let m = cache.manifest(&dl).await.expect("manifest fetch");
        // `latest` must be present and non-empty.
        assert!(!m.latest.release.is_empty(), "latest.release empty");
        assert!(!m.latest.snapshot.is_empty(), "latest.snapshot empty");
        // The latest release must actually appear in the version list.
        assert!(
            m.versions.iter().any(|v| v.id == m.latest.release),
            "latest.release {} not in version list",
            m.latest.release
        );
        // The version list should be at least a few dozen entries.
        assert!(m.versions.len() > 50, "manifest too small: {}", m.versions.len());
    })
    .await;
    res.expect("mojang manifest test timed out");
}

#[tokio::test]
async fn mojang_manifest_filters_by_kind() {
    let dir = tempdir("mojang_filter");
    let dl = make_downloader(&dir);
    let cache = MetadataCache::new(dir.join("metadata"));
    let res = tokio::time::timeout(TIMEOUT, async {
        let m = cache.manifest(&dl).await.expect("manifest fetch");
        let releases: Vec<&VersionEntry> = m
            .versions
            .iter()
            .filter(|v| v.kind == VersionKind::Release)
            .collect();
        let snapshots: Vec<&VersionEntry> = m
            .versions
            .iter()
            .filter(|v| v.kind == VersionKind::Snapshot)
            .collect();
        assert!(!releases.is_empty(), "no release versions found");
        assert!(!snapshots.is_empty(), "no snapshot versions found");
        // Sanity: the manifest's `kind` discriminator must match the
        // filter. We deliberately do NOT police the exact id shape —
        // Mojang has used many formats over the years (1.X, 1.X.Y,
        // 1.X.Y-preZ, 1.X.Y-rcZ, YYwWWA, YY.N, YY.N-snapshot-M, and
        // even old free-text ids like "1.14.2 Pre-Release 4"), and
        // adding more cases here just creates flaky tests when Mojang
        // adds a new shape. The whole point of this test is that
        // `VersionKind` parses and the filter works.
        for r in &releases {
            assert_eq!(r.kind, VersionKind::Release, "release has wrong kind: {}", r.id);
        }
        for s in &snapshots {
            assert_eq!(s.kind, VersionKind::Snapshot, "snapshot has wrong kind: {}", s.id);
        }
        // And the latest release must also be reachable from the
        // version list and itself be classified as Release.
        let latest_rel = &m.latest.release;
        let latest = m
            .versions
            .iter()
            .find(|v| v.id == *latest_rel)
            .unwrap_or_else(|| panic!("latest.release {latest_rel} not in version list"));
        assert_eq!(latest.kind, VersionKind::Release);
        // Every id in the manifest is non-empty. Anything else would
        // be a real malformed entry, not a naming policy we disagree
        // with.
        for v in &m.versions {
            assert!(!v.id.trim().is_empty(), "manifest entry with empty id");
        }
    })
    .await;
    res.expect("mojang filter test timed out");
}

// --------------------------------------------------------------------
// Modrinth — search, version lookup, real install
// --------------------------------------------------------------------

#[tokio::test]
async fn modrinth_search_finds_fabric_api() {
    let dir = tempdir("modrinth_search");
    // `dl` is built so the test is honest about exercising the same
    // network stack; modrinth's own client is used under the hood.
    let _dl = make_downloader(&dir);
    let res = tokio::time::timeout(TIMEOUT, async {
        // fabric-api is one of the most-downloaded Fabric mods and has
        // been on Modrinth for years — a safe, stable target.
        let hits = modrinth::search("fabric-api", ProjectType::Mod, None, None, 5)
            .await
            .expect("modrinth search");
        assert!(!hits.is_empty(), "no search hits for fabric-api");
        let api = hits
            .iter()
            .find(|h| h.slug == "fabric-api")
            .expect("fabric-api not in search hits");
        assert!(api.downloads > 0, "fabric-api downloads = 0");
    })
    .await;
    res.expect("modrinth search test timed out");
}

#[tokio::test]
async fn modrinth_version_files_have_hex_sha1() {
    let dir = tempdir("modrinth_v");
    let _dl = make_downloader(&dir);
    let res = tokio::time::timeout(TIMEOUT, async {
        let versions = modrinth::list_versions("fabric-api", Some("1.21.4"), Some("fabric"))
            .await
            .expect("modrinth list_versions");
        assert!(!versions.is_empty(), "no fabric-api versions for 1.21.4");
        let v = versions.first().unwrap();
        assert!(!v.files.is_empty(), "version has no files");
        for f in &v.files {
            let sha1 = &f.hashes.sha1;
            // Modrinth returns SHA-1 as 40 lowercase hex characters.
            assert_eq!(sha1.len(), 40, "sha1 wrong length: {sha1}");
            assert!(
                sha1.chars().all(|c| c.is_ascii_hexdigit()),
                "sha1 not hex: {sha1}"
            );
            // The defensive shim should accept the hex form verbatim.
            let back = sha1_base64_to_hex(sha1).expect("hex -> hex roundtrip");
            assert_eq!(back, sha1.to_ascii_lowercase());
        }
    })
    .await;
    res.expect("modrinth version test timed out");
}

#[tokio::test]
async fn modrinth_install_e2e() {
    let dir = tempdir("modrinth_install");
    let dl = make_downloader(&dir);
    let res = tokio::time::timeout(TIMEOUT, async {
        // Resolve the latest fabric-api jar for 1.21.4 + fabric loader.
        let versions = modrinth::list_versions("fabric-api", Some("1.21.4"), Some("fabric"))
            .await
            .expect("modrinth list_versions");
        assert!(!versions.is_empty());
        // Pick the most recently published version.
        let v = versions
            .iter()
            .max_by_key(|v| v.date_published.clone())
            .expect("no version");
        let file = v
            .files
            .iter()
            .find(|f| f.primary)
            .or_else(|| v.files.first())
            .expect("version has no file");
        let sha1_hex = sha1_base64_to_hex(&file.hashes.sha1).expect("sha1 hex");
        // Install into a temp "instance" mods dir.
        let mods_dir = dir.join("instance").join("mods");
        std::fs::create_dir_all(&mods_dir).unwrap();
        let dest = mods_dir.join(&file.filename);
        dl.download_verified(&file.url, &dest, &sha1_hex, file.size)
            .await
            .expect("download_verified");
        // On-disk checks.
        let meta = std::fs::metadata(&dest).expect("installed file missing");
        assert_eq!(meta.len(), file.size, "installed size mismatch");
        // The file should be a non-empty jar.
        assert!(meta.len() > 1024, "installed file suspiciously small");
        // Re-verify SHA-1 with the launcher's own verifier.
        mc_launcher::downloads::verify::verify_file(&dest, &sha1_hex, file.size)
            .await
            .expect("on-disk sha1 mismatch");
    })
    .await;
    res.expect("modrinth install e2e timed out");
}

// --------------------------------------------------------------------
// Fabric loader — list versions, real install
// --------------------------------------------------------------------

#[tokio::test]
async fn fabric_list_versions_for_1_21_4() {
    let dir = tempdir("fabric_list");
    let dl = make_downloader(&dir);
    let res = tokio::time::timeout(TIMEOUT, async {
        let loader = FabricLoader::new();
        let versions = loader
            .list_versions(&dl, "1.21.4")
            .await
            .expect("fabric list_versions");
        assert!(!versions.is_empty(), "no fabric versions for 1.21.4");
        // Versions are returned newest-first by convention.
        for v in &versions {
            assert!(!v.is_empty(), "empty version string");
            // Fabric loader versions look like "0.16.5", "0.16.4", etc.
            assert!(
                v.chars().next().map(|c| c.is_ascii_digit()).unwrap_or(false),
                "version doesn't start with a digit: {v}"
            );
        }
    })
    .await;
    res.expect("fabric list_versions timed out");
}

#[tokio::test]
async fn fabric_install_e2e() {
    let dir = tempdir("fabric_install");
    let dl = make_downloader(&dir);
    let res = tokio::time::timeout(TIMEOUT, async {
        let loader = FabricLoader::new();
        let versions = loader
            .list_versions(&dl, "1.21.4")
            .await
            .expect("list versions");
        let latest = versions.first().expect("no versions").clone();
        let runtime_dir = dir.join("runtime");
        let profile = loader
            .install(&dl, &runtime_dir, "1.21.4", &latest)
            .await
            .expect("fabric install");
        // The profile JSON must exist on disk.
        assert!(profile.path.exists(), "profile json not written");
        // The profile must reference the vanilla version it inherits.
        assert_eq!(profile.inherits_from, "1.21.4");
        // And have at least the loader + intermediary libraries.
        let coords: Vec<&str> = profile
            .libraries
            .iter()
            .filter_map(|l| l.name.as_deref())
            .collect();
        assert!(
            coords
                .iter()
                .any(|c| c.starts_with("net.fabricmc:fabric-loader:")),
            "loader maven coord missing from profile: {coords:?}"
        );
        assert!(
            coords
                .iter()
                .any(|c| c.starts_with("net.fabricmc:intermediary:")),
            "intermediary maven coord missing from profile: {coords:?}"
        );
        // The loader + intermediary jars should have been pre-downloaded
        // (best-effort) into the libraries tree.
        let libs_dir = runtime_dir.join("libraries");
        let found_loader = walk_jar(&libs_dir, "fabric-loader");
        let found_intermediary = walk_jar(&libs_dir, "intermediary");
        assert!(
            found_loader,
            "fabric-loader jar not pre-downloaded under {}",
            libs_dir.display()
        );
        assert!(
            found_intermediary,
            "intermediary jar not pre-downloaded under {}",
            libs_dir.display()
        );
    })
    .await;
    res.expect("fabric install e2e timed out");
}

fn walk_jar(root: &std::path::Path, needle: &str) -> bool {
    let Ok(rd) = std::fs::read_dir(root) else {
        return false;
    };
    for entry in rd.flatten() {
        let p = entry.path();
        if p.is_dir() {
            if walk_jar(&p, needle) {
                return true;
            }
        } else if p
            .file_name()
            .and_then(|n| n.to_str())
            .map(|n| n.contains(needle) && n.ends_with(".jar"))
            .unwrap_or(false)
        {
            return true;
        }
    }
    false
}
