//! Prepare-to-launch: downloads everything Minecraft needs to run.
//!
//! This is the "warm up" pass that the UI calls before `launch()`. It
//! downloads, in order of priority:
//!  1. The version JSON (if not cached).
//!  2. The asset index JSON.
//!  3. All asset objects referenced by the asset index.
//!  4. The client JAR.
//!  5. Every library and native JAR (with SHA-1 verification).
//!
//! Already-cached files that pass verification are skipped. Corrupt files
//! are redownloaded. The result is a `PreparedLaunch` containing all paths
//! needed by `launcher::launch`.

use crate::downloads::{Downloader, DownloadJob};
use crate::error::{LauncherError, LauncherResult};
use crate::instances::Instance;
use crate::metadata::asset::{self, AssetIndex};
use crate::metadata::library::{self, ResolvedLibrary};
use crate::metadata::version::{client_jar_path, VersionMeta};
use crate::metadata::MetadataCache;
use std::path::{Path, PathBuf};
use std::sync::Arc;

pub struct PreparedLaunch {
    pub version: VersionMeta,
    pub version_url: String,
    pub client_jar: PathBuf,
    pub asset_index_path: PathBuf,
    pub asset_index_id: String,
    pub natives_dir: PathBuf,
    pub classpath_separator: &'static str,
}

/// Download everything required to launch `instance`. Returns a
/// `PreparedLaunch` that the caller can pass to `launcher::launch`.
pub async fn prepare(
    downloader: &Downloader,
    metadata: &MetadataCache,
    runtime_dir: &Path,
    instance: &Instance,
) -> LauncherResult<PreparedLaunch> {
    // 1. Resolve version URL from manifest.
    let manifest = metadata.manifest(downloader).await?;
    let version_url = manifest
        .versions
        .iter()
        .find(|v| v.id == instance.version)
        .map(|v| v.url.clone())
        .ok_or_else(|| LauncherError::VersionNotFound(instance.version.clone()))?;

    // 2. Fetch + resolve inheritance.
    let version = VersionMeta::fetch(metadata, downloader, &version_url).await?;

    // 3. Resolve libraries for the current OS.
    let os_name = if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "osx"
    } else {
        "linux"
    };
    let os_arch = std::env::consts::ARCH;
    let resolved: Vec<ResolvedLibrary> =
        library::Library::resolve_all(&version.libraries, os_name, os_arch, false);

    // 4. Build download jobs.
    let mut jobs: Vec<DownloadJob> = Vec::new();
    let libs_dir = runtime_dir.join("libraries");

    // Client JAR.
    if let Some(client) = &version.downloads.client {
        let jar = client_jar_path(runtime_dir, &version.id);
        if let Some(parent) = jar.parent() {
            tokio::fs::create_dir_all(parent).await.ok();
        }
        jobs.push(DownloadJob {
            url: client.url.clone(),
            path: jar.clone(),
            sha1: client.sha1.clone(),
            size: client.size,
        });
    } else {
        return Err(LauncherError::VersionJson {
            version: version.id.clone(),
            message: "Version has no client download".to_string(),
        });
    }

    // Libraries + natives.
    for lib in &resolved {
        let p = libs_dir.join(&lib.path);
        if let Some(parent) = p.parent() {
            tokio::fs::create_dir_all(parent).await.ok();
        }
        jobs.push(DownloadJob {
            url: lib.url.clone(),
            path: p,
            sha1: lib.sha1.clone(),
            size: lib.size,
        });
    }

    // Asset index. `asset_index` is optional on `VersionMeta` because
    // a mod-loader profile inherits it from the vanilla parent; we
    // back-filled it during `resolve_inheritance` so it should be
    // `Some` here. Bail clearly if it isn't.
    let asset_index = version.asset_index.as_ref().ok_or_else(|| {
        LauncherError::VersionJson {
            version: version.id.clone(),
            message: "Version has no asset index (loader profile missing parent?)".to_string(),
        }
    })?;
    let index_path = asset::index_dir(runtime_dir, &asset_index.id);
    if let Some(parent) = index_path.parent() {
        tokio::fs::create_dir_all(parent).await.ok();
    }
    jobs.push(DownloadJob {
        url: asset_index.url.clone(),
        path: index_path.clone(),
        sha1: asset_index.sha1.clone(),
        size: asset_index.size,
    });

    // 5. Run all downloads concurrently.
    let results = crate::downloads::download_all(downloader, jobs).await;
    let mut failed: Vec<&LauncherError> = Vec::new();
    for r in &results {
        if let Err(e) = r {
            failed.push(e);
        }
    }
    if !failed.is_empty() {
        return Err(LauncherError::Download(format!(
            "{} download(s) failed",
            failed.len()
        )));
    }

    // 6. Parse asset index and queue asset objects.
    let raw = tokio::fs::read(&index_path).await?;
    let asset_index: AssetIndex = serde_json::from_slice(&raw)?;
    asset::validate(&asset_index)?;
    let objects_dir = asset::objects_dir(runtime_dir);
    tokio::fs::create_dir_all(&objects_dir).await.ok();

    // Dedupe by hash and produce download jobs.
    let mut asset_jobs: Vec<DownloadJob> = Vec::new();
    let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();
    for (hash, _vpath, size) in asset::collect_objects(&asset_index) {
        if !seen.insert(hash.clone()) {
            continue;
        }
        let obj = asset::AssetObject {
            hash: hash.clone(),
            size,
        };
        let rel = obj.object_path();
        let url = format!("https://resources.download.minecraft.net/{}", &rel[8..]);
        let p = runtime_dir.join("assets").join(&rel);
        if let Some(parent) = p.parent() {
            tokio::fs::create_dir_all(parent).await.ok();
        }
        asset_jobs.push(DownloadJob {
            url,
            path: p,
            sha1: hash,
            size,
        });
    }
    let results = crate::downloads::download_all(downloader, asset_jobs).await;
    for r in &results {
        if let Err(e) = r {
            return Err(LauncherError::Download(format!("Asset failed: {e}")));
        }
    }

    // 7. Create natives dir.
    let natives_dir = runtime_dir.join("natives").join(&version.id);
    tokio::fs::create_dir_all(&natives_dir).await.ok();

    let client_jar = client_jar_path(runtime_dir, &version.id);
    // `asset_index` is guaranteed Some by the early-return above.
    let asset_index_id = version.asset_index.as_ref().map(|a| a.id.clone()).unwrap_or_default();
    Ok(PreparedLaunch {
        version,
        version_url,
        client_jar,
        asset_index_path: index_path,
        asset_index_id,
        natives_dir,
        classpath_separator: if cfg!(target_os = "windows") { ";" } else { ":" },
    })
}

/// Wrap a downloader + metadata cache in a single struct for ergonomics.
pub struct PrepareCtx {
    pub downloader: Arc<Downloader>,
    pub metadata: Arc<MetadataCache>,
}
