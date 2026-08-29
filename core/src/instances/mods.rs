//! Per-instance mods, resource packs, and shaderpacks management.

use crate::error::LauncherResult;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModInfo {
    pub file_name: String,
    pub enabled: bool,
    pub size: u64,
    /// Loader kind detected from filename (jar name heuristic).
    pub loader_hint: Option<String>,
}

/// List `.jar` files in the mods directory. Disabled mods have a `.disabled`
/// suffix.
pub fn list_mods(game_dir: &Path) -> LauncherResult<Vec<ModInfo>> {
    let dir = game_dir.join("mods");
    let mut out = Vec::new();
    if !dir.exists() {
        return Ok(out);
    }
    for entry in std::fs::read_dir(&dir)?.flatten() {
        let p = entry.path();
        let name = match p.file_name().and_then(|s| s.to_str()) {
            Some(s) => s.to_string(),
            None => continue,
        };
        if name.starts_with('.') {
            continue;
        }
        let enabled = if name.ends_with(".disabled") {
            false
        } else if name.ends_with(".jar") {
            true
        } else {
            continue;
        };
        let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
        let clean_name = name
            .trim_end_matches(".disabled")
            .trim_end_matches(".jar")
            .to_string();
        let loader_hint = detect_loader_hint(&clean_name);
        out.push(ModInfo {
            file_name: name,
            enabled,
            size,
            loader_hint,
        });
    }
    out.sort_by(|a, b| a.file_name.to_lowercase().cmp(&b.file_name.to_lowercase()));
    Ok(out)
}

fn detect_loader_hint(jar_base: &str) -> Option<String> {
    let lower = jar_base.to_lowercase();
    if lower.contains("fabric") {
        Some("fabric".to_string())
    } else if lower.contains("forge") && !lower.contains("neoforge") {
        Some("forge".to_string())
    } else if lower.contains("neoforge") {
        Some("neoforge".to_string())
    } else if lower.contains("quilt") {
        Some("quilt".to_string())
    } else {
        None
    }
}

pub fn set_mod_enabled(game_dir: &Path, file_name: &str, enabled: bool) -> LauncherResult<()> {
    let p: PathBuf = game_dir.join("mods").join(file_name);
    if !p.exists() {
        return Ok(());
    }
    let new_name = if enabled {
        if file_name.ends_with(".disabled") {
            file_name.trim_end_matches(".disabled").to_string()
        } else {
            return Ok(());
        }
    } else if file_name.ends_with(".jar") {
        format!("{}.disabled", file_name)
    } else {
        return Ok(());
    };
    let new_p = game_dir.join("mods").join(&new_name);
    std::fs::rename(&p, &new_p)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detect_loader_hints() {
        assert_eq!(
            detect_loader_hint("fabric-api-0.96.0"),
            Some("fabric".to_string())
        );
        assert_eq!(
            detect_loader_hint("Forge-1.20.1-47.2.0"),
            Some("forge".to_string())
        );
        assert_eq!(
            detect_loader_hint("neoforge-20.1.0"),
            Some("neoforge".to_string())
        );
        assert_eq!(
            detect_loader_hint("quilt-loader-0.21.0"),
            Some("quilt".to_string())
        );
        assert_eq!(detect_loader_hint("sodium-fabric-0.5.0"), Some("fabric".to_string()));
        assert_eq!(detect_loader_hint("jade-1.20.1-forge"), Some("forge".to_string()));
    }
}
