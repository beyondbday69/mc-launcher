//! Tauri command layer: bridges Rust backend to the TypeScript frontend.
//!
//! Each command is a thin wrapper that:
//!  1. Loads state from `tauri::State<AppState>`.
//!  2. Calls the underlying backend function.
//!  3. Returns either a typed result or a `LauncherError` (serialized).
//!
//! Commands are intentionally synchronous where possible (returns within a
//! few ms) and use `async` only for downloads and the launch engine.

use crate::auth::{microsoft, new_offline_account, Account, AuthStore};
use crate::config::LauncherConfig;
use crate::downloads::{Downloader, PollingProgressSink};
use crate::error::{LauncherError, LauncherResult};
use crate::instances::Instance;
use crate::java::JavaInstallation;
use crate::launcher::prepare::{self, PreparedLaunch};
use crate::launcher::{self, LaunchRequest};
use crate::metadata::{MetadataCache, VersionEntry, VersionManifest};
use crate::state::AppState;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

/// State held by the Tauri app that lives across commands but is reset on
/// restart. Kept separate from `AppState` to avoid serializing live handles
/// into commands that don't need them.
pub struct CommandState {
    /// Downloader shared with the prepare flow.
    pub downloader: Arc<Downloader>,
    /// Metadata cache shared with the prepare flow.
    pub metadata: Arc<MetadataCache>,
    /// In-flight prepare/launch ops (one per launch).
    pub inflight: Mutex<Option<PreparedLaunch>>,
    /// Progress sink.
    pub progress: Arc<PollingProgressSink>,
}

impl CommandState {
    pub fn new(downloader: Downloader, metadata: MetadataCache) -> Self {
        let progress = Arc::new(PollingProgressSink::default());
        downloader.attach_progress(progress.clone());
        Self {
            downloader: Arc::new(downloader),
            metadata: Arc::new(metadata),
            inflight: Mutex::new(None),
            progress,
        }
    }
}

// --------------------------------------------------------------------
// Config
// --------------------------------------------------------------------

#[tauri::command]
pub async fn config_get(state: State<'_, AppState>) -> LauncherResult<LauncherConfig> {
    Ok(state.config().read().clone())
}

#[tauri::command]
pub async fn config_update(
    state: State<'_, AppState>,
    new: LauncherConfig,
) -> LauncherResult<()> {
    let paths = state.paths().clone();
    let mut g = state.config().write();
    *g = new;
    g.save(&paths)
}

// --------------------------------------------------------------------
// Versions
// --------------------------------------------------------------------

#[tauri::command]
pub async fn versions_list(
    state: State<'_, AppState>,
    cmd: State<'_, CommandState>,
    show_snapshots: bool,
    show_historical: bool,
) -> LauncherResult<Vec<VersionEntry>> {
    let manifest: VersionManifest = state
        .metadata()
        .manifest(&cmd.downloader)
        .await?;
    Ok(manifest
        .versions
        .into_iter()
        .filter(|v| {
            (show_snapshots || !v.kind.is_snapshot())
                && (show_historical || !v.kind.is_historical())
        })
        .collect())
}

#[tauri::command]
pub async fn versions_latest(
    state: State<'_, AppState>,
    cmd: State<'_, CommandState>,
) -> LauncherResult<LatestPair> {
    let manifest = state.metadata().manifest(&cmd.downloader).await?;
    Ok(LatestPair {
        release: manifest.latest.release,
        snapshot: manifest.latest.snapshot,
    })
}

#[derive(Serialize, Deserialize)]
pub struct LatestPair {
    pub release: String,
    pub snapshot: String,
}

// --------------------------------------------------------------------
// Java
// --------------------------------------------------------------------

#[tauri::command]
pub async fn java_detect(
    state: State<'_, AppState>,
) -> LauncherResult<Vec<JavaInstallation>> {
    state.java().detect()
}

#[tauri::command]
pub async fn java_list(state: State<'_, AppState>) -> LauncherResult<Vec<JavaInstallation>> {
    Ok(state.java().list())
}

#[tauri::command]
pub async fn java_add(
    state: State<'_, AppState>,
    path: PathBuf,
) -> LauncherResult<JavaInstallation> {
    state.java().add_manual(&path)
}

#[tauri::command]
pub async fn java_recommend(
    state: State<'_, AppState>,
    minecraft_major: u32,
) -> LauncherResult<JavaInstallation> {
    Ok(state.java().recommend(minecraft_major))
}

// --------------------------------------------------------------------
// Instances
// --------------------------------------------------------------------

#[tauri::command]
pub async fn instances_list(state: State<'_, AppState>) -> LauncherResult<Vec<Instance>> {
    Ok(state.instances().list())
}

#[tauri::command]
pub async fn instances_get(
    state: State<'_, AppState>,
    id: String,
) -> LauncherResult<Instance> {
    state
        .instances()
        .get(&id)
        .ok_or_else(|| LauncherError::InstanceNotFound(id))
}

#[tauri::command]
pub async fn instances_create(
    state: State<'_, AppState>,
    name: String,
    version: String,
) -> LauncherResult<Instance> {
    state.instances().create(&name, &version)
}

#[tauri::command]
pub async fn instances_update(
    state: State<'_, AppState>,
    instance: Instance,
) -> LauncherResult<()> {
    state.instances().update(instance)
}

#[tauri::command]
pub async fn instances_delete(state: State<'_, AppState>, id: String) -> LauncherResult<()> {
    state.instances().delete(&id)
}

#[tauri::command]
pub async fn instances_duplicate(
    state: State<'_, AppState>,
    id: String,
    new_name: String,
) -> LauncherResult<Instance> {
    state.instances().duplicate(&id, &new_name)
}

#[tauri::command]
pub async fn instances_select(
    state: State<'_, AppState>,
    id: String,
) -> LauncherResult<()> {
    let mut g = state.config().write();
    g.update(state.paths(), |c| c.selected_instance = Some(id))
}

// --------------------------------------------------------------------
// Mods
// --------------------------------------------------------------------

#[tauri::command]
pub async fn instances_list_mods(
    state: State<'_, AppState>,
    instance_id: String,
) -> LauncherResult<Vec<crate::instances::mods::ModInfo>> {
    let inst = state
        .instances()
        .get(&instance_id)
        .ok_or_else(|| LauncherError::InstanceNotFound(instance_id))?;
    crate::instances::mods::list_mods(&inst.game_dir)
}

#[tauri::command]
pub async fn instances_set_mod_enabled(
    state: State<'_, AppState>,
    instance_id: String,
    file_name: String,
    enabled: bool,
) -> LauncherResult<()> {
    let inst = state
        .instances()
        .get(&instance_id)
        .ok_or_else(|| LauncherError::InstanceNotFound(instance_id))?;
    crate::instances::mods::set_mod_enabled(&inst.game_dir, &file_name, enabled)
}

// --------------------------------------------------------------------
// Download + Prepare + Launch
// --------------------------------------------------------------------

#[derive(Serialize, Deserialize, Clone)]
pub struct ProgressSnapshot {
    pub active: u32,
    pub completed: u32,
    pub failed: u32,
    pub bytes_downloaded: u64,
    pub bytes_total: u64,
    pub speed_bps: f64,
}

#[tauri::command]
pub async fn downloads_progress(cmd: State<'_, CommandState>) -> LauncherResult<ProgressSnapshot> {
    let s = cmd.progress.snapshot();
    Ok(ProgressSnapshot {
        active: s.active.len() as u32,
        completed: s.completed as u32,
        failed: s.failed as u32,
        bytes_downloaded: s.bytes_downloaded,
        bytes_total: s.total_bytes,
        speed_bps: s.bytes_per_sec,
    })
}

#[tauri::command]
pub async fn downloads_cancel(cmd: State<'_, CommandState>) -> LauncherResult<()> {
    cmd.downloader.cancel_handle().cancel();
    Ok(())
}

#[tauri::command]
pub async fn prepare_launch(
    state: State<'_, AppState>,
    cmd: State<'_, CommandState>,
    instance_id: String,
) -> LauncherResult<()> {
    let inst = state
        .instances()
        .get(&instance_id)
        .ok_or_else(|| LauncherError::InstanceNotFound(instance_id))?;
    let prepared = prepare::prepare(
        &cmd.downloader,
        &cmd.metadata,
        &state.paths().runtime_dir,
        &inst,
    )
    .await?;
    *cmd.inflight.lock().await = Some(prepared);
    Ok(())
}

#[tauri::command]
pub async fn launch_instance(
    state: State<'_, AppState>,
    cmd: State<'_, CommandState>,
    instance_id: String,
) -> LauncherResult<u32> {
    let inst = state
        .instances()
        .get(&instance_id)
        .ok_or_else(|| LauncherError::InstanceNotFound(instance_id))?;
    let prepared = cmd
        .inflight
        .lock()
        .await
        .take()
        .ok_or_else(|| LauncherError::Launch("No prepared launch in flight".to_string()))?;
    let auth = current_account(&state).await?;
    let (java_path, java_major) = resolve_java(&state, &inst)?;
    let req = LaunchRequest {
        instance: inst,
        version: prepared.version,
        version_url: prepared.version_url,
        auth,
        java_path,
        java_major,
        max_ram_mb: state.config().read().default_ram_mb,
        resolution: None,
        downloads: cmd.downloader.clone(),
        metadata: cmd.metadata.clone(),
        runtime_dir: state.paths().runtime_dir.clone(),
        asset_index_path: prepared.asset_index_path,
        asset_index_id: prepared.asset_index_id,
        natives_dir: prepared.natives_dir,
    };
    let handle = launcher::launch(req, state.processes()).await?;
    Ok(handle.pid())
}

#[tauri::command]
pub async fn launch_kill(state: State<'_, AppState>, instance_id: String) -> LauncherResult<()> {
    if let Some(h) = state.processes().get(&instance_id) {
        h.kill().await?;
        state.processes().unregister(&instance_id);
    }
    Ok(())
}

#[tauri::command]
pub async fn launch_list(state: State<'_, AppState>) -> LauncherResult<Vec<(String, u32)>> {
    Ok(state.processes().list())
}

#[tauri::command]
pub async fn launch_next_log(
    state: State<'_, AppState>,
    instance_id: String,
) -> LauncherResult<Option<launcher::LogLine>> {
    if let Some(h) = state.processes().get(&instance_id) {
        return Ok(h.next_log().await);
    }
    Ok(None)
}

async fn current_account(state: &State<'_, AppState>) -> LauncherResult<Account> {
    // AuthStore is loaded on bootstrap; we keep a single global in config.
    // For simplicity the launcher uses a single offline-style account if no
    // MSA login has been completed. Real MSA tokens are stored in
    // `<data>/auth.json` but managed by AuthStore directly.
    let store = AuthStore::new(state.paths());
    store.load().ok();
    if let Some(mut a) = store.current() {
        if a.needs_refresh() {
            store.refresh(&mut a).await.ok();
        }
        return Ok(a);
    }
    // Offline fallback: launch in demo mode.
    Ok(Account {
        id: "offline".to_string(),
        username: "Player".to_string(),
        uuid: "00000000-0000-0000-0000-000000000000".to_string(),
        access_token: "0".to_string(),
        refresh_token: "0".to_string(),
        expires_at: chrono::Utc::now() + chrono::Duration::days(365),
        is_msa: false,
    })
}

fn resolve_java(state: &State<'_, AppState>, inst: &Instance) -> LauncherResult<(PathBuf, u32)> {
    if let Some(p) = &inst.java_path {
        if p.exists() {
            if let Some(j) = state.java().list().into_iter().find(|j| &j.path == p) {
                return Ok((p.clone(), j.version));
            }
        }
    }
    if let Some(p) = &state.config().read().default_java_path {
        if p.exists() {
            if let Some(j) = state.java().list().into_iter().find(|j| &j.path == p) {
                return Ok((p.clone(), j.version));
            }
        }
    }
    let j = state.java().recommend(parse_mc_major(&inst.version));
    if j.version == 0 {
        return Err(LauncherError::JavaNotFound { recommended: 17 });
    }
    Ok((j.path.clone(), j.version))
}

fn parse_mc_major(v: &str) -> u32 {
    let mut parts = v.split('.');
    let _ = parts.next();
    parts
        .next()
        .and_then(|s| s.parse::<u32>().ok())
        .unwrap_or(0)
}

// --------------------------------------------------------------------
// Auth
// --------------------------------------------------------------------

#[tauri::command]
pub async fn auth_begin(state: State<'_, AppState>) -> LauncherResult<Account> {
    let client = reqwest::Client::new();
    let dc = microsoft::start_device_code(&client).await?;
    let tok = microsoft::poll_for_token(&client, &dc).await?;
    let mc = microsoft::login_with_xbox(&client, &tok.access_token).await?;
    let refresh = tok.refresh_token.unwrap_or_default();
    let acc = Account {
        id: mc.uuid.clone(),
        username: mc.username.clone(),
        uuid: mc.uuid.clone(),
        access_token: mc.access.clone(),
        refresh_token: refresh,
        expires_at: chrono::Utc::now() + chrono::Duration::seconds(tok.expires_in as i64),
        is_msa: true,
    };
    let store = AuthStore::new(state.paths());
    store.load().ok();
    store.add(acc.clone())?;
    Ok(acc)
}

#[tauri::command]
pub async fn auth_accounts(state: State<'_, AppState>) -> LauncherResult<Vec<Account>> {
    let store = AuthStore::new(state.paths());
    store.load().ok();
    Ok(store.list())
}

#[tauri::command]
pub async fn auth_remove(state: State<'_, AppState>, id: String) -> LauncherResult<()> {
    let store = AuthStore::new(state.paths());
    store.load().ok();
    store.remove(&id)
}

/// Add a purely offline (local) account. No MSA, no tokens. The launcher
/// can use the returned account to play singleplayer and on
/// `online-mode=false` servers. The UUID is deterministically derived
/// from the username (MD5 of "OfflinePlayer:<username>") so the same
/// username on a different machine yields the same identity.
#[tauri::command]
pub async fn auth_add_offline(
    state: State<'_, AppState>,
    username: String,
) -> LauncherResult<Account> {
    let acc = new_offline_account(&username)?;
    let store = AuthStore::new(state.paths());
    store.load().ok();
    store.add(acc.clone())?;
    Ok(acc)
}

// --------------------------------------------------------------------
// Mod loaders
// --------------------------------------------------------------------

#[tauri::command]
pub async fn loader_versions(
    cmd: State<'_, CommandState>,
    kind: String,
    minecraft_version: String,
) -> LauncherResult<Vec<String>> {
    let kind = crate::mods::LoaderKind::parse(&kind)
        .ok_or_else(|| LauncherError::ModLoader(format!("Unknown loader: {kind}")))?;
    let loader = crate::mods::get(kind)
        .ok_or_else(|| LauncherError::ModLoader("Loader not found".to_string()))?;
    loader
        .list_versions(&cmd.downloader, &minecraft_version)
        .await
}

#[tauri::command]
pub async fn loader_install(
    state: State<'_, AppState>,
    cmd: State<'_, CommandState>,
    instance_id: String,
) -> LauncherResult<()> {
    let inst = state
        .instances()
        .get(&instance_id)
        .ok_or_else(|| LauncherError::InstanceNotFound(instance_id))?;
    let _profile = crate::mods::install_for_instance(
        &cmd.downloader,
        &inst,
        &state.paths().runtime_dir,
    )
    .await?;
    Ok(())
}

// --------------------------------------------------------------------
// Modrinth content (mods / resource packs / shaders)
// --------------------------------------------------------------------

/// Search Modrinth. The frontend picks which `project_type` (mods,
/// resourcepacks, shaders, modpacks) and any version/loader filters.
#[tauri::command]
pub async fn modrinth_search(
    query: String,
    project_type: String,
    game_version: Option<String>,
    loader: Option<String>,
    limit: u32,
) -> LauncherResult<Vec<crate::mods::modrinth::ProjectHit>> {
    let pt = match project_type.as_str() {
        "mod" | "mods" => crate::mods::modrinth::ProjectType::Mod,
        "modpack" | "modpacks" => crate::mods::modrinth::ProjectType::Modpack,
        "resourcepack" | "resourcepacks" | "resource_pack" | "resource_packs" => {
            crate::mods::modrinth::ProjectType::Resourcepack
        }
        "shader" | "shaders" | "shaderpack" | "shaderpacks" => {
            crate::mods::modrinth::ProjectType::Shader
        }
        other => {
            return Err(LauncherError::Other(format!(
                "Unknown project type: {other}"
            )))
        }
    };
    crate::mods::modrinth::search(
        &query,
        pt,
        game_version.as_deref(),
        loader.as_deref(),
        limit,
    )
    .await
}

#[tauri::command]
pub async fn modrinth_project(
    slug_or_id: String,
) -> LauncherResult<crate::mods::modrinth::ProjectHit> {
    crate::mods::modrinth::get_project(&slug_or_id).await
}

#[tauri::command]
pub async fn modrinth_versions(
    slug_or_id: String,
    game_version: Option<String>,
    loader: Option<String>,
) -> LauncherResult<Vec<crate::mods::modrinth::ProjectVersion>> {
    crate::mods::modrinth::list_versions(
        &slug_or_id,
        game_version.as_deref(),
        loader.as_deref(),
    )
    .await
}

/// Download a Modrinth version into the instance's subdirectory for the
/// project type (mods / resourcepacks / shaderpacks). Uses the launcher's
/// shared `Downloader` so the file is verified against Modrinth's SHA-1
/// (which arrives as base64; we hex-decode before passing to the
/// downloader).
#[tauri::command]
pub async fn instance_install_content(
    cmd: State<'_, CommandState>,
    state: State<'_, AppState>,
    instance_id: String,
    project_type: String,
    file_url: String,
    file_name: String,
    file_size: u64,
    sha1_base64: String,
) -> LauncherResult<String> {
    let inst = state
        .instances()
        .get(&instance_id)
        .ok_or_else(|| LauncherError::InstanceNotFound(instance_id))?;
    let pt = match project_type.as_str() {
        "mod" | "mods" => crate::mods::modrinth::ProjectType::Mod,
        "modpack" | "modpacks" => crate::mods::modrinth::ProjectType::Modpack,
        "resourcepack" | "resourcepacks" | "resource_pack" | "resource_packs" => {
            crate::mods::modrinth::ProjectType::Resourcepack
        }
        "shader" | "shaders" | "shaderpack" | "shaderpacks" => {
            crate::mods::modrinth::ProjectType::Shader
        }
        other => {
            return Err(LauncherError::Other(format!(
                "Unknown project type: {other}"
            )))
        }
    };
    let game_dir = inst.effective_game_dir();
    let dest_dir = game_dir.join(pt.instance_subdir());
    tokio::fs::create_dir_all(&dest_dir).await?;
    // Sanitize: keep it on disk — Modrinth file names are already safe
    // (lowercase + dash + extension), but reject anything that tries to
    // escape.
    if file_name.is_empty()
        || file_name.contains('/')
        || file_name.contains('\\')
        || file_name.contains("..")
    {
        return Err(LauncherError::Other(format!(
            "Refusing to write unsafe filename: {file_name}"
        )));
    }
    let dest = dest_dir.join(&file_name);
    let sha1_hex = crate::mods::modrinth::sha1_base64_to_hex(&sha1_base64)?;
    cmd.downloader
        .download_verified(&file_url, &dest, &sha1_hex, file_size)
        .await?;
    Ok(dest.to_string_lossy().into_owned())
}

// --------------------------------------------------------------------
// Updates
// --------------------------------------------------------------------

#[tauri::command]
pub async fn update_check() -> LauncherResult<crate::update::UpdateInfo> {
    crate::update::check_for_update().await
}

// --------------------------------------------------------------------
// Health
// --------------------------------------------------------------------

#[tauri::command]
pub async fn ping() -> LauncherResult<String> {
    Ok("pong".to_string())
}
