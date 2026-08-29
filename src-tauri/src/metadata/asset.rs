//! Asset index + virtual asset resolution.
//!
//! Minecraft 1.7.6+ uses a "virtual" asset system: assets are stored under
//! `objects/<2-char-prefix>/<sha1>` and symlinked/copied into
//! `assets/virtual/<namespace>/...` when launched. Older versions (pre-1.6)
//! use legacy `assets/virtual/legacy/...` structure.

use crate::error::{LauncherError, LauncherResult};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetIndex {
    /// Whether the assets should be virtual (symlinks) or not.
    #[serde(default = "default_true")]
    pub virtual_assets: bool,
    pub objects: HashMap<String, AssetObject>,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetObject {
    pub hash: String,
    pub size: u64,
}

impl AssetObject {
    /// Path under the object store: `objects/<aa>/<rest>` where the prefix
    /// is the first two hex chars of the hash.
    pub fn object_path(&self) -> String {
        let h = &self.hash;
        format!("objects/{}/{}", &h[..2], h)
    }
    /// Path under the virtual tree (matching the asset key).
    pub fn virtual_path(&self, key: &str) -> String {
        format!("virtual/{}", key)
    }
}

/// Resolve the on-disk directory for the assets tree.
pub fn assets_root(runtime_dir: &Path) -> PathBuf {
    runtime_dir.join("assets")
}

/// Resolve the on-disk directory for a specific asset index.
pub fn index_dir(runtime_dir: &Path, index_id: &str) -> PathBuf {
    assets_root(runtime_dir).join("indexes").join(index_id)
}

/// Resolve the on-disk directory for asset objects.
pub fn objects_dir(runtime_dir: &Path) -> PathBuf {
    assets_root(runtime_dir).join("objects")
}

/// Resolve the on-disk virtual asset tree.
pub fn virtual_dir(runtime_dir: &Path) -> PathBuf {
    assets_root(runtime_dir).join("virtual")
}

/// Iterate over all assets, producing a deduplicated list of (object_hash, virtual_path, size).
pub fn collect_objects(
    index: &AssetIndex,
) -> Vec<(String, String, u64)> {
    let mut seen = std::collections::HashSet::new();
    let mut out = Vec::with_capacity(index.objects.len());
    for (key, obj) in &index.objects {
        if !seen.insert(obj.hash.clone()) {
            continue;
        }
        out.push((obj.hash.clone(), obj.virtual_path(key), obj.size));
    }
    out
}

/// Validate that an asset index has reasonable structure.
pub fn validate(index: &AssetIndex) -> LauncherResult<()> {
    if index.objects.is_empty() {
        return Err(LauncherError::Asset("Empty asset index".to_string()));
    }
    for (key, obj) in &index.objects {
        if obj.hash.len() != 40 {
            return Err(LauncherError::Asset(format!(
                "Invalid SHA-1 for {}: {}",
                key, obj.hash
            )));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn object_path_uses_prefix() {
        let obj = AssetObject {
            hash: "abcdef1234567890abcdef1234567890abcdef12".to_string(),
            size: 100,
        };
        assert_eq!(obj.object_path(), "objects/ab/abcdef1234567890abcdef1234567890abcdef12");
    }

    #[test]
    fn validate_rejects_bad_hash() {
        let mut objects = HashMap::new();
        objects.insert(
            "a".to_string(),
            AssetObject {
                hash: "tooshort".to_string(),
                size: 1,
            },
        );
        let idx = AssetIndex {
            virtual_assets: true,
            objects,
        };
        assert!(validate(&idx).is_err());
    }
}
