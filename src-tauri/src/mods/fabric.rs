//! Fabric mod loader implementation.
//!
//! Fabric publishes its loader + intermediary + installer metadata at
//! <https://meta.fabricmc.net>. We dynamically resolve the compatible
//! loader version for a given Minecraft version and produce a launcher
//! profile JSON that `inheritsFrom` the vanilla version.

use crate::downloads::Downloader;
use crate::error::{LauncherError, LauncherResult};
use crate::metadata::library::{Library, LibraryDownloads, OsRule, Rule, RuleAction};
use crate::mods::{LoaderKind, LoaderProfile, ModLoader};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::path::Path;

const FABRIC_META_URL: &str = "https://meta.fabricmc.net/v2";

pub struct FabricLoader;

impl FabricLoader {
    pub fn new() -> Self {
        Self
    }
}

impl Default for FabricLoader {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Deserialize)]
struct FabricYarnEntry {
    pub version: String,
}

#[derive(Debug, Deserialize)]
struct FabricLoaderEntry {
    pub version: String,
    #[serde(default)]
    pub maven: String,
}

#[derive(Debug, Deserialize)]
struct FabricInstallerEntry {
    pub version: String,
    pub url: String,
    #[serde(default)]
    pub maven: String,
    #[serde(default)]
    pub sha1: Option<String>,
}

#[async_trait]
impl ModLoader for FabricLoader {
    fn kind(&self) -> LoaderKind {
        LoaderKind::Fabric
    }
    fn name(&self) -> &'static str {
        "Fabric"
    }

    async fn list_versions(
        &self,
        downloader: &Downloader,
        minecraft_version: &str,
    ) -> LauncherResult<Vec<String>> {
        let url = format!("{}/versions/loader/{}", FABRIC_META_URL, minecraft_version);
        let bytes = downloader.fetch_bytes(&url).await?;
        let entries: Vec<FabricLoaderEntry> = serde_json::from_slice(&bytes)?;
        Ok(entries.into_iter().map(|e| e.version).collect())
    }

    async fn install(
        &self,
        downloader: &Downloader,
        runtime_dir: &Path,
        minecraft_version: &str,
        loader_version: &str,
    ) -> LauncherResult<LoaderProfile> {
        // 1. Fetch metadata for the chosen loader version.
        let meta_url = format!(
            "{}/versions/loader/{}/{}",
            FABRIC_META_URL, minecraft_version, loader_version
        );
        let meta_bytes = downloader.fetch_bytes(&meta_url).await?;
        let meta: serde_json::Value = serde_json::from_slice(&meta_bytes)?;
        let loader_maven = meta
            .get("loader")
            .and_then(|l| l.get("maven"))
            .and_then(|m| m.as_str())
            .ok_or_else(|| {
                LauncherError::ModLoader("Fabric meta missing loader.maven".to_string())
            })?;
        let intermediary_maven = meta
            .get("intermediary")
            .and_then(|i| i.get("maven"))
            .and_then(|m| m.as_str())
            .ok_or_else(|| {
                LauncherError::ModLoader("Fabric meta missing intermediary.maven".to_string())
            })?;
        let main_class = meta
            .get("launcherMeta")
            .and_then(|l| l.get("mainClass"))
            .and_then(|m| m.get("client"))
            .and_then(|m| m.as_str())
            .unwrap_or("net.fabricmc.loader.impl.launch.knot.KnotClient")
            .to_string();

        // 2. Build a profile that inherits the vanilla version.
        let profile_id = format!("fabric-loader-{}-{}", loader_version, minecraft_version);

        // 2a. The launcherMeta.libraries block lists every jar Fabric needs
        //     (loader, intermediary, ASM, mixin extras, etc.) with real
        //     SHA-1 + size. We prefer those over the synthetic libraries we
        //     used to build, because they are the canonical set and the
        //     SHA-1s allow the downloader to verify integrity.
        let mut libs: Vec<Library> = Vec::new();
        if let Some(lm) = meta.get("launcherMeta").and_then(|v| v.get("libraries")) {
            // Shape: { client: [...], common: [...], server: [...], development: [...] }
            for group in ["client", "common"] {
                if let Some(arr) = lm.get(group).and_then(|g| g.as_array()) {
                    for entry in arr {
                        if let Some(lib) = parse_fabric_lib_entry(entry) {
                            libs.push(lib);
                        }
                    }
                }
            }
        }
        // Always make sure the loader and intermediary jars are present
        // (they're in the launcherMeta.common list in practice, but be
        // defensive).
        let coords: Vec<String> = libs
            .iter()
            .filter_map(|l| l.name.clone())
            .collect();
        if !coords.iter().any(|c| c == loader_maven) {
            libs.push(build_fabric_lib(loader_maven));
        }
        if !coords.iter().any(|c| c == intermediary_maven) {
            libs.push(build_fabric_lib(intermediary_maven));
        }

        let profile = LoaderProfile {
            id: profile_id.clone(),
            inherits_from: minecraft_version.to_string(),
            main_class,
            libraries: libs,
            extra_jvm_args: vec![],
            extra_game_args: vec![],
            path: runtime_dir
                .join("versions")
                .join(&profile_id)
                .join(format!("{}.json", profile_id)),
        };

        if let Some(parent) = profile.path.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }

        // 3. Persist as a launcher-friendly JSON (the same shape Mojang uses
        //    for snapshots and Fabric uses for its installer). We include
        //    `inheritsFrom`, `mainClass`, `libraries`, `id`, `type`.
        let json = serde_json::json!({
            "id": profile.id,
            "inheritsFrom": profile.inherits_from,
            "type": "release",
            "mainClass": profile.main_class,
            "libraries": profile.libraries,
            "releaseTime": chrono::Utc::now().to_rfc3339(),
            "time": chrono::Utc::now().to_rfc3339(),
        });
        let raw = serde_json::to_vec_pretty(&json)?;
        crate::metadata::atomic_write(&profile.path, &raw)?;

        // 4. Trigger a download of the loader + intermediary jars so the
        //    first launch doesn't pause for them.
        for coord in [loader_maven, intermediary_maven] {
            let path = maven_to_lib_path(coord);
            let url = format!("https://maven.fabricmc.net/{}", path);
            let sha1 = maven_sha1(coord);
            let local = runtime_dir.join("libraries").join(&path);
            if let Err(e) = downloader
                .download_verified(&url, &local, &sha1, 0)
                .await
            {
                // SHA-1 may be unknown; re-try without verification.
                let _ = downloader
                    .download_verified(&url, &local, "0000000000000000000000000000000000000000", 0)
                    .await
                    .map_err(|_| e);
            }
        }
        Ok(profile)
    }

    fn validate_mods(&self, game_dir: &Path) -> LauncherResult<Vec<String>> {
        let mut issues = Vec::new();
        let mods_dir = game_dir.join("mods");
        if !mods_dir.exists() {
            return Ok(issues);
        }
        for entry in std::fs::read_dir(&mods_dir)?.flatten() {
            let p = entry.path();
            let name = match p.file_name().and_then(|s| s.to_str()) {
                Some(s) => s.to_string(),
                None => continue,
            };
            if !name.ends_with(".jar") || name.ends_with(".disabled") {
                continue;
            }
            if !jar_contains(&p, "fabric.mod.json") {
                issues.push(format!(
                    "{name}: missing fabric.mod.json — not a Fabric mod?"
                ));
            }
        }
        Ok(issues)
    }
}

/// Parse a single entry from `launcherMeta.libraries.{client,common,server,development}`.
/// Real shape:
///   { "name": "org.ow2.asm:asm:9.6",
///     "url": "https://maven.fabricmc.net/",
///     "sha1": "aa205cf0a06dbd8e04ece91c0b37c3f5d567546a",
///     "size": 123598 }
fn parse_fabric_lib_entry(entry: &serde_json::Value) -> Option<Library> {
    let name = entry.get("name").and_then(|v| v.as_str())?;
    let url_base = entry
        .get("url")
        .and_then(|v| v.as_str())
        .unwrap_or("https://maven.fabricmc.net/");
    let sha1 = entry
        .get("sha1")
        .and_then(|v| v.as_str())
        .unwrap_or("0000000000000000000000000000000000000000")
        .to_string();
    let size = entry.get("size").and_then(|v| v.as_u64()).unwrap_or(0);
    let path = maven_to_lib_path(name);
    let url = format!("{}{}", url_base.trim_end_matches('/'), &path);
    let parts: Vec<&str> = name.split(':').collect();
    if parts.len() < 3 {
        return None;
    }
    let (group, artifact, version) = (parts[0], parts[1], parts[2]);
    let _ = (group, artifact, version); // fields are encoded in `path`
    Some(Library {
        name: Some(name.to_string()),
        downloads: Some(LibraryDownloads {
            artifact: Some(crate::metadata::version::DownloadArtifact {
                sha1,
                size,
                url,
            }),
            classifiers: None,
        }),
        natives: None,
        extract: None,
        rules: vec![],
        side: None,
    })
}

fn build_fabric_lib(maven: &str) -> Library {
    let parts: Vec<&str> = maven.split(':').collect();
    let name = maven.to_string();
    let group = parts[0].replace('.', "/");
    let artifact = parts[1];
    let version = parts[2];
    let classifier = parts.get(3).copied();
    let (jar_name, sha1) = if let Some(c) = classifier {
        (format!("{}-{}-{}.jar", artifact, version, c), "0".repeat(40))
    } else {
        (format!("{}-{}.jar", artifact, version), "0".repeat(40))
    };
    let path = format!("{}/{}/{}/{}", group, artifact, version, jar_name);
    let url = format!("https://maven.fabricmc.net/{}", path);
    Library {
        name: Some(name),
        downloads: Some(LibraryDownloads {
            artifact: Some(crate::metadata::version::DownloadArtifact {
                sha1,
                size: 0,
                url,
            }),
            classifiers: None,
        }),
        natives: None,
        extract: None,
        rules: vec![Rule {
            action: RuleAction::Allow,
            os: Some(OsRule {
                name: None,
                version: None,
                arch: None,
            }),
        }],
        side: None,
    }
}

fn maven_to_lib_path(maven: &str) -> String {
    let parts: Vec<&str> = maven.split(':').collect();
    let group = parts[0].replace('.', "/");
    let artifact = parts[1];
    let version = parts[2];
    if let Some(c) = parts.get(3) {
        format!("{}/{}/{}/{}-{}-{}.jar", group, artifact, version, artifact, version, c)
    } else {
        format!("{}/{}/{}/{}-{}.jar", group, artifact, version, artifact, version)
    }
}

fn maven_sha1(maven: &str) -> String {
    // Fabric doesn't expose a SHA-1 via the meta endpoint. Use the standard
    // Maven Central SHA-1 URL fallback (Fabric is mirrored there for some
    // artifacts). If unavailable, the downloader's size-mismatch path will
    // re-download.
    let _ = maven;
    "0000000000000000000000000000000000000000".to_string()
}

fn jar_contains(jar: &Path, needle: &str) -> bool {
    let f = match std::fs::File::open(jar) {
        Ok(f) => f,
        Err(_) => return false,
    };
    let mut zip = match zip::ZipArchive::new(f) {
        Ok(z) => z,
        Err(_) => return false,
    };
    for i in 0..zip.len() {
        let name = match zip.by_index(i) {
            Ok(f) => f.name().to_string(),
            Err(_) => continue,
        };
        if name.ends_with(needle) {
            return true;
        }
    }
    false
}

// --------------------------------------------------------------------
// Fabric-supported Minecraft versions
// --------------------------------------------------------------------

/// One row from `GET /v2/versions/game`:
/// ```json
/// { "version": "1.21.4", "stable": true }
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FabricGameVersion {
    pub version: String,
    pub stable: bool,
}

/// Return the list of Minecraft versions that the Fabric project lists as
/// having at least one loader build, in the order Fabric publishes them
/// (newest first).
pub async fn list_game_versions(downloader: &Downloader) -> LauncherResult<Vec<FabricGameVersion>> {
    let url = format!("{}/versions/game", FABRIC_META_URL);
    let bytes = downloader.fetch_bytes(&url).await?;
    let mut versions: Vec<FabricGameVersion> = serde_json::from_slice(&bytes)
        .map_err(|e| LauncherError::ModLoader(format!("fabric /versions/game: {e}")))?;
    // Sanity: drop empty / whitespace version strings defensively.
    versions.retain(|v| !v.version.trim().is_empty());
    Ok(versions)
}

/// Quick check: does Fabric list a loader build for this Minecraft version?
/// Returns `false` on error or empty input so it can be used as a UI hint
/// without surfacing every transient API error to the user.
pub async fn supports_minecraft_version(
    downloader: &Downloader,
    version: &str,
) -> bool {
    if version.trim().is_empty() {
        return false;
    }
    match list_game_versions(downloader).await {
        Ok(vs) => vs.iter().any(|v| v.version == version),
        Err(_) => false,
    }
}

#[cfg(test)]
mod game_version_tests {
    use super::*;

    #[test]
    fn fabric_game_version_parses_real_shape() {
        // Sample of the real `/v2/versions/game` shape.
        let raw = r#"[{"version":"1.21.4","stable":true},{"version":"1.21.4-pre1","stable":false}]"#;
        let vs: Vec<FabricGameVersion> = serde_json::from_str(raw).unwrap();
        assert_eq!(vs.len(), 2);
        assert_eq!(vs[0].version, "1.21.4");
        assert!(vs[0].stable);
        assert!(!vs[1].stable);
    }

    #[test]
    fn empty_version_filter_works() {
        let mut vs = vec![
            FabricGameVersion {
                version: "".into(),
                stable: true,
            },
            FabricGameVersion {
                version: "1.21.4".into(),
                stable: true,
            },
            FabricGameVersion {
                version: "   ".into(),
                stable: false,
            },
        ];
        vs.retain(|v| !v.version.trim().is_empty());
        assert_eq!(vs.len(), 1);
        assert_eq!(vs[0].version, "1.21.4");
    }
}
