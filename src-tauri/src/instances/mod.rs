//! Instance management.
//!
//! Each instance is an isolated Minecraft environment with its own:
//!  * Game directory (`.minecraft/<instance>/`)
//!  * Java path, RAM, JVM args, resolution, fullscreen
//!  * Environment variables
//!  * Mods, resource packs, shaderpacks
//!  * Log files
//!
//! Instances are persisted to `<data_dir>/instances/<id>/instance.json` and
//! discovered on load. Operations are atomic.

use crate::error::{LauncherError, LauncherResult};
use crate::paths::AppPaths;
use chrono::{DateTime, Utc};
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use uuid::Uuid;

pub mod mods;
pub mod store;
pub mod version;

pub use mods::*;
pub use store::*;
pub use version::*;

/// Schema version for the on-disk `instance.json`. Bump when fields change
/// in a breaking way. Migrations live in `instance_migrations`.
pub const INSTANCE_SCHEMA: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Instance {
    /// Stable UUID, used as the on-disk directory name.
    pub id: String,
    /// Display name (must be unique, case-insensitive).
    pub name: String,
    /// Minecraft version id (e.g. "1.21.4").
    pub version: String,
    /// Optional mod loader configuration.
    pub mod_loader: Option<ModLoaderConfig>,
    /// Absolute path to the game directory.
    pub game_dir: PathBuf,
    /// Absolute path to java.exe / bin/java. `None` = use launcher default.
    pub java_path: Option<PathBuf>,
    /// Allocated memory in megabytes. `None` = use launcher default.
    pub ram_mb: Option<u32>,
    /// JVM profile (preset name). "custom" = use `custom_jvm_args`.
    pub jvm_profile: String,
    /// Custom JVM arguments. Used when `jvm_profile == "custom"`.
    pub custom_jvm_args: Vec<String>,
    /// Window width. `None` = game default.
    pub resolution_width: Option<u32>,
    pub resolution_height: Option<u32>,
    /// Launch in fullscreen.
    pub fullscreen: bool,
    /// Custom environment variables (applied on top of inherited env).
    #[serde(default)]
    pub env: HashMap<String, String>,
    /// Override game directory inside the instance (advanced). If `None`, the
    /// instance directory itself is the game dir.
    #[serde(default)]
    pub game_dir_override: Option<PathBuf>,
    /// Icon color (hex). Purely cosmetic.
    pub color: String,
    /// Notes shown in the UI.
    #[serde(default)]
    pub notes: String,
    /// Created timestamp.
    pub created: DateTime<Utc>,
    /// Last launched timestamp.
    pub last_played: Option<DateTime<Utc>>,
    /// Total playtime in seconds.
    pub play_time_secs: u64,
    /// Schema version of this instance.
    pub schema: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModLoaderConfig {
    /// Loader kind (e.g. "fabric").
    pub kind: String,
    /// Loader version (e.g. "0.16.5").
    pub version: String,
}

impl Instance {
    /// Create a new instance with sensible defaults.
    pub fn new(name: &str, version: &str, paths: &AppPaths) -> LauncherResult<Self> {
        let id = Uuid::new_v4().to_string();
        let game_dir = paths.instances_dir.join(&id);
        std::fs::create_dir_all(&game_dir)?;
        Ok(Self {
            id,
            name: name.to_string(),
            version: version.to_string(),
            mod_loader: None,
            game_dir,
            java_path: None,
            ram_mb: None,
            jvm_profile: "balanced".to_string(),
            custom_jvm_args: Vec::new(),
            resolution_width: None,
            resolution_height: None,
            fullscreen: false,
            env: HashMap::new(),
            game_dir_override: None,
            color: "#3b82f6".to_string(),
            notes: String::new(),
            created: Utc::now(),
            last_played: None,
            play_time_secs: 0,
            schema: INSTANCE_SCHEMA,
        })
    }

    /// The on-disk directory for this instance.
    pub fn dir(&self) -> &Path {
        &self.game_dir
    }

    /// Path to the on-disk instance.json.
    pub fn config_path(&self) -> PathBuf {
        self.game_dir.join("instance.json")
    }

    /// Effective game directory (the place Minecraft will use as `.minecraft`).
    pub fn effective_game_dir(&self) -> PathBuf {
        self.game_dir_override
            .clone()
            .unwrap_or_else(|| self.game_dir.clone())
    }

    /// Effective RAM in megabytes.
    pub fn effective_ram_mb(&self, default: u32) -> u32 {
        self.ram_mb.unwrap_or(default).max(256)
    }

    /// Save to disk atomically.
    pub fn save(&self) -> LauncherResult<()> {
        let p = self.config_path();
        let tmp = p.with_extension("json.tmp");
        let raw = serde_json::to_string_pretty(self)?;
        std::fs::write(&tmp, raw)?;
        if let Ok(f) = std::fs::File::open(&tmp) {
            let _ = f.sync_all();
        }
        std::fs::rename(&tmp, &p)?;
        Ok(())
    }

    /// Load from disk.
    pub fn load(path: &Path) -> LauncherResult<Self> {
        let raw = std::fs::read_to_string(path)?;
        let mut v: serde_json::Value = serde_json::from_str(&raw)?;
        let from = v
            .get("schema")
            .and_then(|x| x.as_u64())
            .map(|x| x as u32)
            .unwrap_or(0);
        if from != INSTANCE_SCHEMA {
            v = migrate_instance(v, from)?;
        }
        let mut inst: Instance = serde_json::from_value(v)?;
        inst.id = path
            .parent()
            .and_then(|p| p.file_name())
            .and_then(|n| n.to_str())
            .unwrap_or(&inst.id)
            .to_string();
        Ok(inst)
    }

    /// Validate that all required directories exist, creating them lazily.
    pub fn ensure_dirs(&self) -> LauncherResult<()> {
        for sub in &["mods", "resourcepacks", "shaderpacks", "logs", "crash-reports"] {
            let p = self.game_dir.join(sub);
            if !p.exists() {
                std::fs::create_dir_all(&p)?;
            }
        }
        Ok(())
    }
}

fn migrate_instance(
    mut v: serde_json::Value,
    from: u32,
) -> LauncherResult<serde_json::Value> {
    let to = INSTANCE_SCHEMA;
    let mut current = from;
    while current < to {
        current += 1;
        match current {
            1 => {
                if v.get("schema").is_none() {
                    v["schema"] = serde_json::json!(1);
                }
            }
            _ => {
                return Err(LauncherError::ConfigMigration {
                    from: current,
                    to,
                    message: "No instance migration registered".to_string(),
                })
            }
        }
    }
    Ok(v)
}

/// In-memory instance store. Persisted instances are loaded from
/// `<data_dir>/instances/<id>/instance.json`.
pub struct InstanceStore {
    inner: RwLock<HashMap<String, Instance>>,
    paths: AppPaths,
}

impl InstanceStore {
    pub fn new(paths: AppPaths) -> Self {
        Self {
            inner: RwLock::new(HashMap::new()),
            paths,
        }
    }

    /// Load all instances from disk. Missing instance dirs are skipped.
    pub fn load(paths: &AppPaths) -> LauncherResult<Self> {
        let store = Self::new(paths.clone());
        let dir = &paths.instances_dir;
        if !dir.exists() {
            std::fs::create_dir_all(dir).ok();
        }
        let entries = std::fs::read_dir(dir)?;
        for entry in entries.flatten() {
            let cfg = entry.path().join("instance.json");
            if cfg.exists() {
                match Instance::load(&cfg) {
                    Ok(inst) => {
                        inst.ensure_dirs().ok();
                        store.inner.write().insert(inst.id.clone(), inst);
                    }
                    Err(e) => {
                        tracing::warn!(path = %cfg.display(), error = %e, "Skipping invalid instance");
                    }
                }
            }
        }
        Ok(store)
    }

    pub fn list(&self) -> Vec<Instance> {
        let mut v: Vec<Instance> = self.inner.read().values().cloned().collect();
        v.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
        v
    }

    pub fn get(&self, id: &str) -> Option<Instance> {
        self.inner.read().get(id).cloned()
    }

    pub fn create(&self, name: &str, version: &str) -> LauncherResult<Instance> {
        let mut guard = self.inner.write();
        // Reject duplicate names (case-insensitive).
        if guard.values().any(|i| i.name.eq_ignore_ascii_case(name)) {
            return Err(LauncherError::InstanceExists(name.to_string()));
        }
        let inst = Instance::new(name, version, &self.paths)?;
        inst.ensure_dirs()?;
        inst.save()?;
        guard.insert(inst.id.clone(), inst.clone());
        Ok(inst)
    }

    pub fn update(&self, inst: Instance) -> LauncherResult<()> {
        let mut guard = self.inner.write();
        // Reject duplicate name against OTHER instances.
        if guard
            .values()
            .any(|i| i.id != inst.id && i.name.eq_ignore_ascii_case(&inst.name))
        {
            return Err(LauncherError::InstanceExists(inst.name.clone()));
        }
        inst.save()?;
        guard.insert(inst.id.clone(), inst);
        Ok(())
    }

    pub fn delete(&self, id: &str) -> LauncherResult<()> {
        let mut guard = self.inner.write();
        let inst = guard
            .remove(id)
            .ok_or_else(|| LauncherError::InstanceNotFound(id.to_string()))?;
        if inst.game_dir.exists() {
            std::fs::remove_dir_all(&inst.game_dir).ok();
        }
        Ok(())
    }

    pub fn duplicate(&self, id: &str, new_name: &str) -> LauncherResult<Instance> {
        let src = self
            .get(id)
            .ok_or_else(|| LauncherError::InstanceNotFound(id.to_string()))?;
        let mut copy = self.create(new_name, &src.version)?;
        copy.java_path = src.java_path.clone();
        copy.ram_mb = src.ram_mb;
        copy.jvm_profile = src.jvm_profile.clone();
        copy.custom_jvm_args = src.custom_jvm_args.clone();
        copy.resolution_width = src.resolution_width;
        copy.resolution_height = src.resolution_height;
        copy.fullscreen = src.fullscreen;
        copy.env = src.env.clone();
        copy.color = src.color.clone();
        copy.notes = src.notes.clone();
        copy.mod_loader = src.mod_loader.clone();
        self.update(copy.clone())?;
        Ok(copy)
    }
}
