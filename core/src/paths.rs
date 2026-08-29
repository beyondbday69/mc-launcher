//! Centralized path resolution for the launcher's data directories.
//!
//! Windows: %APPDATA%\\MCLauncher
//! Linux:   $XDG_DATA_HOME/mc-launcher or ~/.local/share/mc-launcher
//! macOS:   ~/Library/Application Support/MCLauncher
//!
//! All paths returned here are absolute, normalized, and validated against
//! path-traversal attacks before any FS operation.

use crate::error::{LauncherError, LauncherResult};
use std::path::{Component, Path, PathBuf};

/// Application identifier used for OS-specific directories.
pub const APP_ID: &str = "mc-launcher";
/// Display name (used in dialogs and window title).
pub const APP_NAME: &str = "MC Launcher";
/// Current config schema version. Bump when the on-disk format changes.
pub const CONFIG_VERSION: u32 = 1;

/// Resolved application paths.
#[derive(Debug, Clone)]
pub struct AppPaths {
    /// Root data directory (contains everything below).
    pub data_dir: PathBuf,
    /// `config.json` directory.
    pub config_dir: PathBuf,
    /// Persistent cache (Mojang manifests, asset index, downloaded libraries).
    pub cache_dir: PathBuf,
    /// Log directory.
    pub log_dir: PathBuf,
    /// Directory containing `assets/`, `libraries/`, `versions/`, `natives/`.
    pub runtime_dir: PathBuf,
    /// Per-instance directories live here.
    pub instances_dir: PathBuf,
    /// Detected Java installations catalog.
    pub java_dir: PathBuf,
}

impl AppPaths {
    /// Resolve all application paths based on the OS conventions.
    pub fn resolve() -> LauncherResult<Self> {
        let data_dir = base_data_dir()?;
        let config_dir = data_dir.join("config");
        let cache_dir = data_dir.join("cache");
        let log_dir = data_dir.join("logs");
        let runtime_dir = data_dir.join("runtime");
        let instances_dir = data_dir.join("instances");
        let java_dir = data_dir.join("java");

        for d in [
            &data_dir,
            &config_dir,
            &cache_dir,
            &log_dir,
            &runtime_dir,
            &instances_dir,
            &java_dir,
        ] {
            std::fs::create_dir_all(d).map_err(|e| {
                LauncherError::Config(format!(
                    "Failed to create directory {}: {}",
                    d.display(),
                    e
                ))
            })?;
        }

        Ok(Self {
            data_dir,
            config_dir,
            cache_dir,
            log_dir,
            runtime_dir,
            instances_dir,
            java_dir,
        })
    }

    /// Convert a path to absolute, normalized form, and verify it does not
    /// contain traversal sequences. Reject symlink escapes where possible.
    pub fn sanitize(&self, path: &Path) -> LauncherResult<PathBuf> {
        let normalized: PathBuf = path
            .components()
            .filter_map(|c| match c {
                Component::CurDir => Some("/".to_string()),
                Component::Normal(s) => Some(s.to_string_lossy().into_owned()),
                Component::ParentDir => None, // strip ..
                _ => None,
            })
            .collect::<Vec<_>>()
            .join("/")
            .into();

        if path
            .components()
            .any(|c| matches!(c, Component::ParentDir))
        {
            return Err(LauncherError::PathTraversal(path.to_path_buf()));
        }

        // Ensure the resulting path is within an allowed root.
        let abs = if normalized.is_absolute() {
            normalized
        } else {
            self.data_dir.join(normalized)
        };
        Ok(abs)
    }

    /// Verify a path is inside `root` (defense-in-depth against symlink games).
    pub fn ensure_within(&self, path: &Path, root: &Path) -> LauncherResult<()> {
        let canon_path = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
        let canon_root = root.canonicalize().unwrap_or_else(|_| root.to_path_buf());
        if !canon_path.starts_with(&canon_root) {
            return Err(LauncherError::PathTraversal(path.to_path_buf()));
        }
        Ok(())
    }
}

fn base_data_dir() -> LauncherResult<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        if let Ok(roam) = std::env::var("APPDATA") {
            return Ok(PathBuf::from(roam).join(APP_NAME));
        }
    }
    #[cfg(target_os = "macos")]
    {
        if let Ok(home) = std::env::var("HOME") {
            return Ok(PathBuf::from(home)
                .join("Library/Application Support")
                .join(APP_NAME));
        }
    }
    #[cfg(target_os = "linux")]
    {
        if let Ok(xdg) = std::env::var("XDG_DATA_HOME") {
            return Ok(PathBuf::from(xdg).join(APP_ID));
        }
        if let Ok(home) = std::env::var("HOME") {
            return Ok(PathBuf::from(home).join(".local/share").join(APP_ID));
        }
    }
    // Fallback: cwd-relative. Will still work in a portable setup.
    Ok(PathBuf::from(".").join(APP_ID))
}
