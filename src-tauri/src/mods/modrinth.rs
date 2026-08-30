//! Modrinth API client.
//!
//! Modrinth is the primary source for Minecraft mods, modpacks, shaders, and
//! resource packs. The API is documented at <https://docs.modrinth.com>.
//!
//! This module wraps the public read-only endpoints we need:
//!   * `GET /search`                     — full-text + facet search
//!   * `GET /project/{id}`               — project metadata
//!   * `GET /project/{id}/version`       — all versions, optionally filtered
//!   * `GET /version/{id}`               — single version lookup
//!   * `GET /version_file/{hash}`        — version lookup by file hash
//!   * `GET /project/{id}/dependencies`  — modpack dependency graph
//!   * `GET /tag/loader`                 — list of known mod loaders
//!   * `GET /tag/game_version`           — list of known Minecraft versions
//!   * `GET /tag/category`               — list of project categories
//!   * `GET /tag/project_type`           — list of project types
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

/// Modrinth returns the SHA-1 as a 40-char lowercase hex string. Earlier
/// versions of this file (and several unofficial docs floating around)
/// claimed it was base64, but the real API serves hex. This function
/// normalises to the launcher's canonical form: 40-char lowercase hex.
///
/// It tolerates two inputs for safety:
///   * 40 hex characters  -> returned as-is, lowercased.
///   * 28-char base64 (20 bytes encoded) -> decoded to bytes then hex.
/// Anything else returns an error so we don't silently accept garbage.
pub fn sha1_base64_to_hex(input: &str) -> LauncherResult<String> {
    let trimmed = input.trim();
    if trimmed.len() == 40 && trimmed.chars().all(|c| c.is_ascii_hexdigit()) {
        return Ok(trimmed.to_ascii_lowercase());
    }
    // Fall back to base64 in case some upstream caller passes one.
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(trimmed)
        .map_err(|e| LauncherError::Other(format!("invalid Modrinth SHA-1 {trimmed:?}: {e}")))?;
    if bytes.len() != 20 {
        return Err(LauncherError::Other(format!(
            "Modrinth SHA-1 {trimmed:?} decoded to {} bytes, expected 20",
            bytes.len()
        )));
    }
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
///
/// The `facets` query parameter is a real JSON array, e.g.
/// `[["project_type:mod"],["versions:1.21.4"],["categories:fabric"]]`.
/// We build it as a structured `Vec<Vec<String>>` and serialize it
/// directly — earlier code stringified and then JSON-escaped it, which
/// caused Modrinth to reject the request with HTTP 400.
pub async fn search(
    query: &str,
    project_type: ProjectType,
    game_version: Option<&str>,
    loader: Option<&str>,
    limit: u32,
) -> LauncherResult<Vec<ProjectHit>> {
    let mut facets: Vec<Vec<String>> = Vec::new();
    facets.push(vec![format!("project_type:{}", project_type.as_str())]);
    if let Some(gv) = game_version {
        facets.push(vec![format!("versions:{gv}")]);
    }
    if let Some(ld) = loader {
        facets.push(vec![format!("categories:{ld}")]);
    }
    let facets_json = serde_json::to_string(&facets)
        .map_err(|e| LauncherError::Other(format!("encode facets: {e}")))?;
    let url = format!(
        "{API_BASE}/search?query={}&facets={}&limit={limit}",
        urlencoding::encode(query),
        urlencoding::encode(&facets_json),
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

// --------------------------------------------------------------------
// Single-version and hash lookups
// --------------------------------------------------------------------

/// Fetch one specific version by its Modrinth version id.
pub async fn get_version(version_id: &str) -> LauncherResult<ProjectVersion> {
    let url = format!("{API_BASE}/version/{}", urlencoding::encode(version_id));
    let bytes = http_get(&url).await?;
    let v: ProjectVersion = serde_json::from_slice(&bytes)
        .map_err(|e| LauncherError::Other(format!("modrinth version: {e}")))?;
    Ok(v)
}

/// Result of `GET /version_file/{hash}`. The endpoint returns either the
/// version object or an empty `null` body when no project has uploaded
/// that hash, so we model it as `Option`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionFileLookup {
    pub version: ProjectVersion,
    /// The file on the version that matched the hash, if the server
    /// disambiguated between multiple files.
    #[serde(default)]
    pub file: Option<VersionFile>,
}

/// Look up a Modrinth version by a file hash. `algorithm` is one of
/// `"sha1"`, `"sha512"`, or `"sha256"`. Returns `Ok(None)` when the API
/// responds 404 (no project has uploaded a file with this hash).
pub async fn get_version_by_hash(
    hash: &str,
    algorithm: &str,
) -> LauncherResult<Option<VersionFileLookup>> {
    let url = format!(
        "{API_BASE}/version_file/{}?algorithm={}",
        urlencoding::encode(hash),
        urlencoding::encode(algorithm)
    );
    // The endpoint returns 200 with the version body, or 404 for unknown
    // hashes. `http_get` already returns Err on non-2xx, so handle 404
    // by re-issuing with status inspection.
    let client = reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .build()
        .map_err(|e| LauncherError::Other(e.to_string()))?;
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| LauncherError::Other(e.to_string()))?;
    let status = resp.status();
    if status.as_u16() == 404 {
        return Ok(None);
    }
    if !status.is_success() {
        return Err(LauncherError::Other(format!(
            "modrinth /version_file returned {status}"
        )));
    }
    let bytes = resp
        .bytes()
        .await
        .map_err(|e| LauncherError::Other(e.to_string()))?;
    let lookup: VersionFileLookup = serde_json::from_slice(&bytes)
        .map_err(|e| LauncherError::Other(format!("modrinth /version_file: {e}")))?;
    Ok(Some(lookup))
}

/// One node of a project's dependency graph (returned by
/// `GET /project/{id}/dependencies`).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectDependency {
    pub version_id: Option<String>,
    pub project_id: String,
    pub file_name: Option<String>,
    /// One of `"required"`, `"optional"`, `"incompatible"`, `"embedded"`.
    pub dependency_type: String,
}

/// List the dependencies declared by a project's latest version. Modpacks
/// embed their mod list here; mods declare library dependencies the
/// launcher must install alongside.
pub async fn list_project_dependencies(
    slug_or_id: &str,
) -> LauncherResult<Vec<ProjectDependency>> {
    let url = format!(
        "{API_BASE}/project/{}/dependencies",
        urlencoding::encode(slug_or_id)
    );
    let bytes = http_get(&url).await?;
    let deps: Vec<ProjectDependency> = serde_json::from_slice(&bytes)
        .map_err(|e| LauncherError::Other(format!("modrinth /dependencies: {e}")))?;
    Ok(deps)
}

// --------------------------------------------------------------------
// Tag endpoints — used to populate the UI filter dropdowns
// --------------------------------------------------------------------

/// A single loader tag from `GET /tag/loader`. Each loader has an SVG
/// icon and a list of project types it can be associated with.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoaderTag {
    pub icon: String,
    pub name: String,
    #[serde(default)]
    pub supported_project_types: Vec<String>,
}

/// A single Minecraft game version from `GET /tag/game_version`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameVersionTag {
    pub version: String,
    /// "release" or "snapshot".
    pub version_type: String,
    pub date: String,
    /// Whether this version is a major release boundary (Modrinth flag).
    pub major: bool,
}

/// A project category from `GET /tag/category`. Categories group mods
/// inside a single Minecraft version (e.g. "adventure", "optimization").
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryTag {
    pub icon: String,
    pub name: String,
    /// Project types this category can apply to.
    pub project_type: String,
    pub header: Option<String>,
}

/// Fetch the list of known mod loaders (fabric, forge, neoforge, …).
pub async fn list_loaders() -> LauncherResult<Vec<LoaderTag>> {
    let url = format!("{API_BASE}/tag/loader");
    let bytes = http_get(&url).await?;
    let v: Vec<LoaderTag> = serde_json::from_slice(&bytes)
        .map_err(|e| LauncherError::Other(format!("modrinth /tag/loader: {e}")))?;
    Ok(v)
}

/// Fetch the list of Minecraft versions Modrinth knows about. Ordered
/// newest-first by Modrinth.
pub async fn list_game_versions() -> LauncherResult<Vec<GameVersionTag>> {
    let url = format!("{API_BASE}/tag/game_version");
    let bytes = http_get(&url).await?;
    let v: Vec<GameVersionTag> = serde_json::from_slice(&bytes)
        .map_err(|e| LauncherError::Other(format!("modrinth /tag/game_version: {e}")))?;
    Ok(v)
}

/// Fetch the list of project categories (e.g. "adventure", "fabric",
/// "optimization"). Categories are per-project-type.
pub async fn list_categories() -> LauncherResult<Vec<CategoryTag>> {
    let url = format!("{API_BASE}/tag/category");
    let bytes = http_get(&url).await?;
    let v: Vec<CategoryTag> = serde_json::from_slice(&bytes)
        .map_err(|e| LauncherError::Other(format!("modrinth /tag/category: {e}")))?;
    Ok(v)
}
