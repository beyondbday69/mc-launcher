//! Mojang version manifest, version metadata, and asset index handling.
//!
//! All data is fetched dynamically. No version, library, or classpath is
//! ever hardcoded.

use crate::downloads::Downloader;
use crate::error::{LauncherError, LauncherResult};
use crate::paths::AppPaths;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

pub mod version;
pub mod library;
pub mod asset;
pub mod inherits;

pub use version::*;
pub use library::*;
pub use asset::*;

/// Canonical Mojang endpoints.
pub const MOJANG_MANIFEST_URL: &str =
    "https://piston-meta.mojang.com/mc/game/version_manifest.json";
pub const MOJANG_RESOURCES_URL: &str = "https://resources.download.minecraft.net";
pub const MOJANG_LIBRARIES_URL: &str = "https://libraries.minecraft.net";

/// Cached Mojang manifest. Refreshed at most once per `MIN_REFRESH_SECS`.
#[derive(Debug)]
pub struct MetadataCache {
    cache_dir: PathBuf,
}

impl MetadataCache {
    pub fn new(cache_dir: PathBuf) -> Self {
        std::fs::create_dir_all(&cache_dir).ok();
        Self { cache_dir }
    }

    pub fn cache_dir(&self) -> &Path {
        &self.cache_dir
    }

    fn manifest_path(&self) -> PathBuf {
        self.cache_dir.join("version_manifest.json")
    }

    /// Return the manifest, fetching it from Mojang if the cache is stale
    /// or missing.
    pub async fn manifest(&self, downloader: &Downloader) -> LauncherResult<VersionManifest> {
        let path = self.manifest_path();
        let needs_fetch = !path.exists()
            || path
                .metadata()
                .and_then(|m| m.modified())
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs())
                .map(|age| age > 60 * 60) // 1 hour
                .unwrap_or(true);

        if !needs_fetch {
            if let Ok(raw) = std::fs::read_to_string(&path) {
                if let Ok(m) = serde_json::from_str::<VersionManifest>(&raw) {
                    return Ok(m);
                }
            }
        }

        let manifest = fetch_manifest(downloader).await?;
        let raw = serde_json::to_string_pretty(&manifest)?;
        atomic_write(&path, raw.as_bytes())?;
        Ok(manifest)
    }
}

/// Mojang version manifest (top-level).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionManifest {
    pub latest: LatestVersions,
    pub versions: Vec<VersionEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LatestVersions {
    pub release: String,
    pub snapshot: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionEntry {
    pub id: String,
    #[serde(rename = "type")]
    pub kind: VersionKind,
    pub url: String,
    pub time: String,
    #[serde(rename = "releaseTime")]
    pub release_time: String,
    /// Optional: present in some older / cached manifest snapshots, but the
    /// live Mojang endpoint as of 2024+ no longer returns it. The launcher
    /// never relied on it (URL is the source of truth), so we tolerate
    /// either form.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sha1: Option<String>,
    /// Compliance level (1, 2, or 3). 3 = fully compatible with current auth.
    #[serde(default)]
    pub compliance_level: u8,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum VersionKind {
    Release,
    Snapshot,
    OldAlpha,
    OldBeta,
    #[serde(other)]
    Other,
}

impl VersionKind {
    pub fn is_release(&self) -> bool {
        matches!(self, Self::Release)
    }
    pub fn is_snapshot(&self) -> bool {
        matches!(self, Self::Snapshot)
    }
    pub fn is_historical(&self) -> bool {
        matches!(self, Self::OldAlpha | Self::OldBeta)
    }
}

async fn fetch_manifest(downloader: &Downloader) -> LauncherResult<VersionManifest> {
    let bytes = downloader
        .fetch_bytes(MOJANG_MANIFEST_URL)
        .await
        .map_err(|e| LauncherError::Manifest(e.to_string()))?;
    let manifest: VersionManifest = serde_json::from_slice(&bytes)?;
    Ok(manifest)
}

/// Write `data` to `path` atomically: write to a temp file in the same
/// directory, fsync, then rename.
pub(crate) fn atomic_write(path: &Path, data: &[u8]) -> LauncherResult<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let tmp = path.with_extension("tmp");
    std::fs::write(&tmp, data)?;
    if let Ok(f) = std::fs::File::open(&tmp) {
        let _ = f.sync_all();
    }
    std::fs::rename(&tmp, path)?;
    Ok(())
}
