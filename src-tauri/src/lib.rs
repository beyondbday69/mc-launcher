//! Library root for the launcher backend.
//!
//! Each module is independently testable and exposes a small, typed surface.

pub mod auth;
pub mod commands;
pub mod config;
pub mod downloads;
pub mod error;
pub mod instances;
pub mod java;
pub mod launcher;
pub mod logging;
pub mod metadata;
pub mod mods;
pub mod paths;
pub mod process;
pub mod security;
pub mod state;
pub mod update;

pub use error::{LauncherError, LauncherResult};
pub use paths::AppPaths;

use tauri::Manager;

/// Tauri application entry point. Initializes the app state, logging, and
/// plugins, then runs the event loop.
pub fn run() {
    let _guard = match init_logging() {
        Ok(g) => g,
        Err(_) => {
            eprintln!("Failed to init logging");
            return;
        }
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let paths = AppPaths::resolve()?;
            let state = state::AppState::bootstrap(paths)?;
            let downloader = crate::downloads::Downloader::new(
                state.paths().cache_dir.clone(),
            );
            let metadata = crate::metadata::MetadataCache::new(
                state.paths().cache_dir.join("metadata"),
            );
            let cmd_state = commands::CommandState::new(downloader, metadata);
            app.manage(state);
            app.manage(cmd_state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::ping,
            commands::config_get,
            commands::config_update,
            commands::versions_list,
            commands::versions_latest,
            commands::java_detect,
            commands::java_list,
            commands::java_add,
            commands::java_recommend,
            commands::instances_list,
            commands::instances_get,
            commands::instances_create,
            commands::instances_update,
            commands::instances_delete,
            commands::instances_duplicate,
            commands::instances_select,
            commands::instances_list_mods,
            commands::instances_set_mod_enabled,
            commands::downloads_progress,
            commands::downloads_cancel,
            commands::prepare_launch,
            commands::launch_instance,
            commands::launch_kill,
            commands::launch_list,
            commands::launch_next_log,
            commands::auth_begin,
            commands::auth_accounts,
            commands::auth_remove,
            commands::loader_versions,
            commands::loader_install,
            commands::update_check,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn init_logging() -> crate::LauncherResult<tracing_appender::non_blocking::WorkerGuard> {
    // Best-effort path resolution for the data dir.
    let paths = AppPaths::resolve()?;
    logging::init(&paths.log_dir)
}
