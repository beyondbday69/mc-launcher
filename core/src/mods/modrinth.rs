//! Modrinth API client.
//!
//! Modrinth is the primary source for Minecraft mods, modpacks, shaders, and
//! resource packs. The API is documented at <https://docs.modrinth.com>.
//!
//! This module wraps the public read-only endpoints we need:
//!   * `GET /search`           — full-text + facet search
//!   * `GET /project/{id}`     — project metadata
//!   * `GET /project/{id}/version` — all versions, optionally filtered by
//!     Minecraft version and loader
//!
//! The download URLs returned by the version endpoint point at Modrinth's
//! CDN; we hand them to the existing `Downloader` (which handles SHA-1
//! verification, resume, cache, retries).
//!
//! No API key is needed for public read-only traffic. We set a descriptive
//! `User-Agent` because the Modrinth API explicitly asks for one.

use crate::error::{LauncherError, LauncherResult};
use serde::{Deserialize, Serialize};

const API_BASE: &str = "https://api.modrinth.com/v2";
const USER_AGENT: &str = concat!(
    "mc-launcher/",
    env!("CARGO_PKG_VERSION"),
    " (real launcher; +https://github.com/beyondbday69/mc-launcher)"
);

/// What kind of content we're searching for / downloading.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum ProjectType {
    Mod,
    Modpack,
    Resourcepack,
    Shader,
}

impl ProjectType {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Mod => "mod",
            Self::Modpack => "modpack",
            Self::Resourcepack => "resourcepack",
            Self::Shader => "shader",
        }
    }
    /// Subdirectory inside the instance where this type of project belongs.
    pub fn instance_subdir(&self) -> &'static str {
        match self {
            Self::Mod => "mods",
            Self::Modpack => "mods",
            Self::Resourcepack => "resourcepacks",
            Self::Shader => "shaderpacks",
        }
    }
}

/// A search hit (project summary).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectHit {
    pub slug: String,
    pub title: String,
    pub description: String,
    pub project_type: String,
    pub downloads: u64,
    #[serde(default)]
    pub icon_url: Option<String>,
    pub author: String,
    pub versions: Vec<String>,
    pub follows: u64,
}

/// Search response envelope.
#[derive(Debug, Deserialize)]
struct SearchEnvelope {
    hits: Vec<ProjectHit>,
    total_hits: u64,
    offset: u64,
    limit: u64,
}

/// A version returned by `/project/{id}/version`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectVersion {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub version_number: String,
    pub game_versions: Vec<String>,
    pub loaders: Vec<String>,
    pub files: Vec<VersionFile>,
    pub date_published: String,
    pub downloads: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionFile {
    pub url: String,
    pub filename: String,
    /// Base64 SHA-1 hash. We hex-decode before comparing against our
    /// downloader's SHA-1 checksum.
    pub hashes: Hashes,
    pub size: u64,
    pub primary: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Hashes {
    pub sha1: String,
    pub sha512: Option<String>,
}

/// Modrinth returns the SHA-1 as a base64-encoded string. The rest of the
/// launcher stores SHA-1 as 40-char lowercase hex. This converts.
pub fn sha1_base64_to_hex(b64: &str) -> LauncherResult<String> {
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(b64)
        .map_err(|e| LauncherError::Other(format!("invalid base64 SHA-1: {e}")))?;
    Ok(bytes
        .iter()
        .map(|b| format!("{:02x}", b))
        .collect::<String>())
}

/// Async GET that returns the raw bytes. Uses the shared `reqwest` Client
/// so connection pooling is reused across calls.
async fn http_get(url: &str) -> LauncherResult<Vec<u8>> {
    let client = reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .build()
        .map_err(|e| LauncherError::Other(e.to_string()))?;
    let resp = client
        .get(url)
        .send()
        .await
        .map_err(|e| LauncherError::Other(e.to_string()))?;
    if !resp.status().is_success() {
        return Err(LauncherError::Other(format!(
            "Modrinth {} returned {}",
            url,
            resp.status()
        )));
    }
    let bytes = resp
        .bytes()
        .await
        .map_err(|e| LauncherError::Other(e.to_string()))?;
    Ok(bytes.to_vec())
}

/// Search Modrinth. `query` may be empty (browse). `game_version` and
/// `loader` are optional filters. Returns up to `limit` hits.
pub async fn search(
    query: &str,
    project_type: ProjectType,
    game_version: Option<&str>,
    loader: Option<&str>,
    limit: u32,
) -> LauncherResult<Vec<ProjectHit>> {
    let mut facets: Vec<String> = vec![format!("[\"project_type:{}\"]", project_type.as_str())];
    if let Some(gv) = game_version {
        facets.push(format!("[\"versions:{}\"]", gv));
    }
    if let Some(ld) = loader {
        facets.push(format!("[\"categories:{}\"]", ld));
    }
    let facets_enc = serde_json::to_string(&facets.join(","))
        .map_err(|e| LauncherError::Other(e.to_string()))?;
    let url = format!(
        "{API_BASE}/search?query={}&facets={facets_enc}&limit={limit}",
        urlencoding::encode(query)
    );
    let bytes = http_get(&url).await?;
    let env: SearchEnvelope = serde_json::from_slice(&bytes)
        .map_err(|e| LauncherError::Other(format!("modrinth search: {e}")))?;
    Ok(env.hits)
}

/// Fetch a single project's metadata.
pub async fn get_project(slug_or_id: &str) -> LauncherResult<ProjectHit> {
    let url = format!("{API_BASE}/project/{}", urlencoding::encode(slug_or_id));
    let bytes = http_get(&url).await?;
    let hit: ProjectHit = serde_json::from_slice(&bytes)
        .map_err(|e| LauncherError::Other(format!("modrinth project: {e}")))?;
    Ok(hit)
}

/// List versions for a project, optionally filtered by game version and loader.
pub async fn list_versions(
    slug_or_id: &str,
    game_version: Option<&str>,
    loader: Option<&str>,
) -> LauncherResult<Vec<ProjectVersion>> {
    let mut url = format!(
        "{API_BASE}/project/{}/version",
        urlencoding::encode(slug_or_id)
    );
    let mut sep = "?";
    if let Some(gv) = game_version {
        url.push_str(&format!("{sep}game_versions={}", urlencoding::encode(gv)));
        sep = "&";
    }
    if let Some(ld) = loader {
        url.push_str(&format!("{sep}loaders={}", urlencoding::encode(ld)));
    }
    let bytes = http_get(&url).await?;
    let versions: Vec<ProjectVersion> = serde_json::from_slice(&bytes)
        .map_err(|e| LauncherError::Other(format!("modrinth versions: {e}")))?;
    Ok(versions)
}

/// Convenience: pick the latest matching version (highest `date_published`)
/// that supports the given game version + loader.
pub async fn latest_matching(
    slug_or_id: &str,
    game_version: &str,
    loader: Option<&str>,
) -> LauncherResult<Option<ProjectVersion>> {
    let versions = list_versions(slug_or_id, Some(game_version), loader).await?;
    Ok(versions.into_iter().max_by_key(|v| v.date_published.clone()))
}
