//! Version JSON parser and inheritance resolver.
//!
//! The version JSON format is fully dynamic. We deserialize into `serde_json::Value`
//! and resolve the inheritance chain (`inheritsFrom`) explicitly so that the
//! merged structure can be queried without surprises.

use crate::downloads::Downloader;
use crate::error::{LauncherError, LauncherResult};
use crate::metadata::{MetadataCache, MOJANG_LIBRARIES_URL, MOJANG_RESOURCES_URL};
use serde::{Deserialize, Serialize};
use std::path::Path;
use url::Url;

/// Merged, fully-inherited version metadata. Everything the launcher needs to
/// download files and build a classpath is exposed here.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionMeta {
    pub id: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub main_class: String,
    pub minecraft_arguments: Option<String>,
    pub arguments: Option<Arguments>,
    pub asset_index: AssetIndexRef,
    pub assets: String,
    pub downloads: VersionDownloads,
    pub libraries: Vec<Library>,
    #[serde(rename = "javaVersion")]
    pub java_version: Option<JavaVersion>,
    pub logging: Option<LoggingConfig>,
    /// Resolved in `resolve_inheritance`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub inherits_from: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Arguments {
    pub game: Vec<Arg>,
    pub jvm: Vec<Arg>,
}

/// A rule-conditional argument. We always store a Vec<String> internally;
/// a "plain" string from Mojang is normalized to a single-element Vec with
/// no rules (which means it's always present).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum Arg {
    /// Bare string argument. Always present.
    Plain(String),
    /// Conditional argument with rules.
    Conditional {
        rules: Vec<Rule>,
        value: ArgValue,
    },
}

impl Arg {
    /// Get the owned list of strings for this argument.
    pub fn strings(&self) -> Vec<String> {
        match self {
            Self::Plain(s) => vec![s.clone()],
            Self::Conditional { value, .. } => value.clone().into_strings(),
        }
    }
    pub fn rules(&self) -> &[Rule] {
        match self {
            Self::Plain(_) => &[],
            Self::Conditional { rules, .. } => rules,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ArgValue {
    Single(String),
    Multi(Vec<String>),
}

impl ArgValue {
    pub fn into_owned(self) -> ArgValue {
        self
    }
}

impl ArgValue {
    pub fn as_strings(&self) -> Vec<&str> {
        match self {
            Self::Single(s) => vec![s.as_str()],
            Self::Multi(v) => v.iter().map(String::as_str).collect(),
        }
    }
    pub fn into_strings(self) -> Vec<String> {
        match self {
            Self::Single(s) => vec![s],
            Self::Multi(v) => v,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Rule {
    pub action: RuleAction,
    pub os: Option<OsRule>,
    pub features: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum RuleAction {
    Allow,
    Disallow,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct OsRule {
    pub name: Option<String>,
    pub version: Option<String>,
    pub arch: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetIndexRef {
    pub id: String,
    pub sha1: String,
    pub size: u64,
    pub url: String,
    #[serde(rename = "totalSize")]
    pub total_size: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct VersionDownloads {
    pub client: Option<DownloadArtifact>,
    pub server: Option<DownloadArtifact>,
    pub windows_server: Option<DownloadArtifact>,
    pub client_mappings: Option<DownloadArtifact>,
    pub server_mappings: Option<DownloadArtifact>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadArtifact {
    pub sha1: String,
    pub size: u64,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JavaVersion {
    /// "JRE" legacy, "JDK" or "SEMVER" (>=1.17 reports majorVersion as int).
    #[serde(default = "default_component")]
    pub component: String,
    /// Legacy: 8 means Java 8. Newer: major_version = N -> Java N.
    #[serde(rename = "majorVersion")]
    pub major_version: u32,
}

fn default_component() -> String {
    "JRE".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoggingConfig {
    pub client: Option<LoggingEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoggingEntry {
    pub argument: String,
    pub file: LoggingFile,
    #[serde(rename = "type")]
    pub kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoggingFile {
    pub id: String,
    pub sha1: String,
    pub size: u64,
    pub url: String,
}

// Re-export Library for convenience
pub use crate::metadata::library::Library;

impl VersionMeta {
    /// Fetch and parse a version JSON, resolving the full inheritance chain.
    pub async fn fetch(
        cache: &MetadataCache,
        downloader: &Downloader,
        url: &str,
    ) -> LauncherResult<Self> {
        let path = cache
            .cache_dir()
            .join("versions")
            .join(derive_id_from_url(url))
            .join("version.json");
        if path.exists() {
            if let Ok(raw) = std::fs::read_to_string(&path) {
                if let Ok(value) = serde_json::from_str::<serde_json::Value>(&raw) {
                    return resolve_inheritance(cache, downloader, value).await;
                }
            }
        }
        let bytes = downloader.fetch_bytes(url).await?;
        let value: serde_json::Value = serde_json::from_slice(&bytes)?;
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).ok();
        }
        crate::metadata::atomic_write(&path, &bytes)?;
        resolve_inheritance(cache, downloader, value).await
    }
}

fn derive_id_from_url(url: &str) -> String {
    if let Ok(u) = Url::parse(url) {
        if let Some(last) = u.path_segments().and_then(|mut s| s.next_back()) {
            if last.ends_with(".json") {
                return last.trim_end_matches(".json").to_string();
            }
        }
    }
    "unknown".to_string()
}

/// Walk the `inheritsFrom` chain and merge all fields. Parent fields are
/// replaced by child fields when both define the same key.
pub async fn resolve_inheritance(
    cache: &MetadataCache,
    downloader: &Downloader,
    mut value: serde_json::Value,
) -> LauncherResult<VersionMeta> {
    let mut visited: Vec<String> = Vec::new();
    while let Some(parent_id) = value
        .get("inheritsFrom")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
    {
        if visited.iter().any(|v| v == &parent_id) {
            return Err(LauncherError::VersionJson {
                version: parent_id,
                message: "Inheritance cycle detected".to_string(),
            });
        }
        visited.push(parent_id.clone());
        let parent = fetch_parent(cache, downloader, &parent_id).await?;
        value = merge_json(parent, value);
    }
    let mut meta: VersionMeta = serde_json::from_value(value)?;
    if let Some(last) = visited.last() {
        if meta.id != *last && meta.inherits_from.is_none() {
            meta.inherits_from = Some(last.clone());
        }
    }
    Ok(meta)
}

async fn fetch_parent(
    cache: &MetadataCache,
    downloader: &Downloader,
    id: &str,
) -> LauncherResult<serde_json::Value> {
    let manifest = cache.manifest(downloader).await?;
    let entry = manifest
        .versions
        .iter()
        .find(|v| v.id == id)
        .ok_or_else(|| LauncherError::VersionNotFound(id.to_string()))?;
    let path = cache
        .cache_dir()
        .join("versions")
        .join(id)
        .join("version.json");
    if path.exists() {
        if let Ok(raw) = std::fs::read_to_string(&path) {
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&raw) {
                return Ok(v);
            }
        }
    }
    let bytes = downloader.fetch_bytes(&entry.url).await?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).ok();
    }
    crate::metadata::atomic_write(&path, &bytes)?;
    let v: serde_json::Value = serde_json::from_slice(&bytes)?;
    Ok(v)
}

/// Merge `parent` and `child`. Child values win. Lists in `libraries` and
/// `arguments.{jvm,game}` are concatenated, child after parent.
pub fn merge_json(parent: serde_json::Value, child: serde_json::Value) -> serde_json::Value {
    use serde_json::Value;
    match (parent, child) {
        (Value::Object(mut p), Value::Object(c)) => {
            for (k, v) in c {
                let existing = p.remove(&k);
                let merged = match (existing, v) {
                    (Some(Value::Object(a)), Value::Object(b)) => {
                        merge_json(Value::Object(a), Value::Object(b))
                    }
                    (Some(Value::Array(mut a)), Value::Array(b)) => {
                        if matches!(k.as_str(), "libraries" | "jvm" | "game") {
                            a.extend(b);
                            Value::Array(a)
                        } else {
                            Value::Array(b)
                        }
                    }
                    (_, b) => b,
                };
                p.insert(k, merged);
            }
            Value::Object(p)
        }
        (_, b) => b,
    }
}

/// Compute the on-disk path to the client JAR for this version.
pub fn client_jar_path(runtime_dir: &Path, id: &str) -> std::path::PathBuf {
    std::path::PathBuf::from(runtime_dir)
        .join("versions")
        .join(id)
        .join(format!("{id}.jar"))
}

/// Compute the on-disk path to a version's directory.
pub fn version_dir(runtime_dir: &Path, id: &str) -> std::path::PathBuf {
    std::path::PathBuf::from(runtime_dir)
        .join("versions")
        .join(id)
}

/// Helper to compute the URL prefix for asset downloads.
pub fn resource_url(prefix: &str) -> String {
    format!("{MOJANG_RESOURCES_URL}{prefix}")
}

pub fn library_url(path: &str) -> String {
    format!("{MOJANG_LIBRARIES_URL}/{path}")
}

// --------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn merge_concatenates_libraries() {
        let parent = json!({
            "id": "1.20",
            "libraries": [{"name": "a"}],
            "arguments": {"jvm": ["-X"]}
        });
        let child = json!({
            "id": "1.20.1",
            "inheritsFrom": "1.20",
            "libraries": [{"name": "b"}],
            "arguments": {"jvm": ["-Y"]}
        });
        let merged = merge_json(parent, child);
        assert_eq!(merged["libraries"].as_array().unwrap().len(), 2);
        assert_eq!(merged["arguments"]["jvm"].as_array().unwrap().len(), 2);
        assert_eq!(merged["id"], "1.20.1");
    }

    #[test]
    fn merge_overrides_scalar() {
        let parent = json!({"mainClass": "old.Main"});
        let child = json!({"mainClass": "new.Main"});
        let merged = merge_json(parent, child);
        assert_eq!(merged["mainClass"], "new.Main");
    }

    #[test]
    fn derive_id_from_url_works() {
        let id = derive_id_from_url("https://piston-meta.mojang.com/v1/packages/abc/1.21.4.json");
        assert_eq!(id, "1.21.4");
    }
}
