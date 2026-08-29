//! Versioned launcher configuration with migration support.
//!
//! On-disk format is a single JSON document. The schema is versioned via the
//! `version` field; old schemas are migrated to the current version on load
//! via `migrate::run`.
//!
//! Writes are atomic: write to a `.tmp` file, fsync, then rename.

use crate::error::{LauncherError, LauncherResult};
use crate::paths::{AppPaths, CONFIG_VERSION};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

pub mod migrate;

/// Top-level launcher configuration persisted to disk.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LauncherConfig {
    /// Schema version. Used to dispatch migrations.
    pub version: u32,
    /// Globally selected instance id (UUID).
    pub selected_instance: Option<String>,
    /// Theme ("dark" | "light" | "system"). Currently only "dark" is shipped.
    pub theme: String,
    /// Global UI language (BCP-47 code, e.g. "en-US"). Default "en-US".
    pub language: String,
    /// Close the launcher when the game launches, or keep it open.
    pub close_on_launch: bool,
    /// Show snapshots in the version browser.
    pub show_snapshots: bool,
    /// Show old / beta / alpha versions in the version browser.
    pub show_historical: bool,
    /// Default Java path override. `None` means auto-detect.
    pub default_java_path: Option<PathBuf>,
    /// Default JVM profile. One of "default" | "low_ram" | "balanced" | "performance" | "custom".
    pub default_jvm_profile: String,
    /// Default RAM in megabytes (used when creating new instances).
    pub default_ram_mb: u32,
    /// Default custom JVM arguments (used when `default_jvm_profile == "custom"`).
    pub default_custom_jvm_args: Vec<String>,
    /// Override the data root. If `None`, OS default is used.
    pub data_dir_override: Option<PathBuf>,
    /// Concurrent download limit.
    pub download_concurrency: u32,
    /// Download speed cap in KiB/s. `None` means unlimited.
    pub download_speed_limit_kbps: Option<u32>,
    /// Whether telemetry is enabled. The launcher ships with telemetry off.
    pub telemetry: bool,
    /// Last successful manifest fetch (Unix epoch seconds). Used to throttle refresh.
    pub last_manifest_refresh: Option<u64>,
    /// Onboarded flag.
    pub onboarded: bool,
}

impl Default for LauncherConfig {
    fn default() -> Self {
        Self {
            version: CONFIG_VERSION,
            selected_instance: None,
            theme: "dark".to_string(),
            language: "en-US".to_string(),
            close_on_launch: false,
            show_snapshots: false,
            show_historical: false,
            default_java_path: None,
            default_jvm_profile: "balanced".to_string(),
            default_ram_mb: 2048,
            default_custom_jvm_args: Vec::new(),
            data_dir_override: None,
            download_concurrency: 8,
            download_speed_limit_kbps: None,
            telemetry: false,
            last_manifest_refresh: None,
            onboarded: false,
        }
    }
}

impl LauncherConfig {
    /// Path to the on-disk config file.
    pub fn path(paths: &AppPaths) -> PathBuf {
        paths.config_dir.join("config.json")
    }

    /// Load the config from disk, running migrations if necessary. If the
    /// file does not exist, return the default and persist it.
    pub fn load(paths: &AppPaths) -> LauncherResult<Self> {
        let p = Self::path(paths);
        if !p.exists() {
            let cfg = Self::default();
            cfg.save(paths)?;
            return Ok(cfg);
        }
        let raw = std::fs::read_to_string(&p)?;
        let mut value: serde_json::Value = serde_json::from_str(&raw)?;
        let from_version = value
            .get("version")
            .and_then(|v| v.as_u64())
            .map(|v| v as u32)
            .unwrap_or(0);
        if from_version != CONFIG_VERSION {
            tracing::info!(
                from = from_version,
                to = CONFIG_VERSION,
                "Migrating config"
            );
            value = migrate::run(value, from_version)?;
        }
        let cfg: LauncherConfig = serde_json::from_value(value)?;
        Ok(cfg)
    }

    /// Persist the config to disk atomically.
    pub fn save(&self, paths: &AppPaths) -> LauncherResult<()> {
        let p = Self::path(paths);
        if let Some(parent) = p.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let tmp = p.with_extension("json.tmp");
        let json = serde_json::to_string_pretty(self)?;
        std::fs::write(&tmp, json)?;
        // Best-effort fsync.
        if let Ok(f) = std::fs::File::open(&tmp) {
            let _ = f.sync_all();
        }
        std::fs::rename(&tmp, &p)?;
        Ok(())
    }

    /// Mutate and save in one call.
    pub fn update<F>(&mut self, paths: &AppPaths, f: F) -> LauncherResult<()>
    where
        F: FnOnce(&mut Self),
    {
        f(self);
        self.save(paths)
    }
}
