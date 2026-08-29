//! Mod loader trait and registry.
//!
//! Each loader (Fabric, Forge, NeoForge, Quilt) implements the
//! `ModLoader` trait, which knows how to:
//!  * Resolve a loader version compatible with a Minecraft version.
//!  * Produce a "profile" version JSON that Mojang-launcher-like launchers
//!    can consume (i.e. it `inheritsFrom` the base version and adds the
//!    loader's libraries and main class).
//!  * List installed mods and detect compatibility issues.
//!
//! Fabric is fully implemented. The other loaders register stub
//! implementations that return helpful "not yet supported" errors. This
//! keeps the architecture honest — we don't claim support we don't have.

use crate::error::{LauncherError, LauncherResult};
use crate::instances::Instance;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::path::Path;

pub mod fabric;
pub mod modrinth;
pub mod stub;

pub use fabric::FabricLoader;
pub use modrinth::{ProjectHit, ProjectType, ProjectVersion, VersionFile};
pub use stub::UnsupportedLoader;

/// Loader kinds the launcher knows about.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum LoaderKind {
    Fabric,
    Forge,
    NeoForge,
    Quilt,
}

impl LoaderKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Fabric => "fabric",
            Self::Forge => "forge",
            Self::NeoForge => "neoforge",
            Self::Quilt => "quilt",
        }
    }
    pub fn parse(s: &str) -> Option<Self> {
        match s.to_ascii_lowercase().as_str() {
            "fabric" => Some(Self::Fabric),
            "forge" => Some(Self::Forge),
            "neoforge" => Some(Self::NeoForge),
            "quilt" => Some(Self::Quilt),
            _ => None,
        }
    }
}

/// The output of a loader install: a synthetic version JSON that inherits
/// from the base Minecraft version and adds loader-specific libraries and
/// main class.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoaderProfile {
    pub id: String,
    pub inherits_from: String,
    pub main_class: String,
    pub libraries: Vec<crate::metadata::library::Library>,
    /// Optional arguments to add to the JVM launch (e.g. `-Dfabric.development=true`).
    pub extra_jvm_args: Vec<String>,
    /// Optional arguments to add to the game launch.
    pub extra_game_args: Vec<String>,
    /// Path to the loader JSON on disk.
    pub path: std::path::PathBuf,
}

#[async_trait]
pub trait ModLoader: Send + Sync {
    /// Stable identifier of this loader.
    fn kind(&self) -> LoaderKind;

    /// Display name.
    fn name(&self) -> &'static str;

    /// Resolve a list of available loader versions for the given Minecraft
    /// version. Returned newest-first.
    async fn list_versions(
        &self,
        downloader: &crate::downloads::Downloader,
        minecraft_version: &str,
    ) -> LauncherResult<Vec<String>>;

    /// Install the given loader version for the given Minecraft version,
    /// writing a profile JSON to disk under the runtime directory.
    async fn install(
        &self,
        downloader: &crate::downloads::Downloader,
        runtime_dir: &Path,
        minecraft_version: &str,
        loader_version: &str,
    ) -> LauncherResult<LoaderProfile>;

    /// Validate that the installed mods are compatible with the loader
    /// version (e.g. all jars declare a fabric.mod.json).
    fn validate_mods(&self, game_dir: &Path) -> LauncherResult<Vec<String>> {
        let _ = game_dir;
        Ok(Vec::new())
    }
}

/// Registry of all known loaders. Used by the install flow.
pub fn registry() -> Vec<Box<dyn ModLoader>> {
    vec![
        Box::new(FabricLoader::new()),
        Box::new(UnsupportedLoader::new(LoaderKind::Forge, "Forge")),
        Box::new(UnsupportedLoader::new(LoaderKind::NeoForge, "NeoForge")),
        Box::new(UnsupportedLoader::new(LoaderKind::Quilt, "Quilt")),
    ]
}

/// Helper: find a loader by kind.
pub fn get(kind: LoaderKind) -> Option<Box<dyn ModLoader>> {
    registry().into_iter().find(|l| l.kind() == kind)
}

/// Install the loader configured on the instance, returning the merged
/// version JSON.
pub async fn install_for_instance(
    downloader: &crate::downloads::Downloader,
    instance: &Instance,
    runtime_dir: &Path,
) -> LauncherResult<LoaderProfile> {
    let cfg = instance
        .mod_loader
        .as_ref()
        .ok_or_else(|| LauncherError::ModLoader("No mod loader configured".to_string()))?;
    let kind = LoaderKind::parse(&cfg.kind)
        .ok_or_else(|| LauncherError::ModLoader(format!("Unknown loader: {}", cfg.kind)))?;
    let loader = get(kind)
        .ok_or_else(|| LauncherError::ModLoader(format!("Loader {} not registered", kind.as_str())))?;
    loader
        .install(downloader, runtime_dir, &instance.version, &cfg.version)
        .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_kinds() {
        assert_eq!(LoaderKind::parse("fabric"), Some(LoaderKind::Fabric));
        assert_eq!(LoaderKind::parse("FORGE"), Some(LoaderKind::Forge));
        assert_eq!(LoaderKind::parse("quilt"), Some(LoaderKind::Quilt));
        assert_eq!(LoaderKind::parse("unknown"), None);
    }
}
