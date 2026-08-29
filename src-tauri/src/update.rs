//! Self-update stub.
//!
//! Real implementation will integrate with `tauri-plugin-updater` or a
//! homegrown update server. For now, expose a `check_for_update` that
//! reports the current version and an "up to date" status. This file
//! exists so the rest of the code can call update APIs without churn.

use crate::error::LauncherResult;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub current_version: String,
    pub latest_version: String,
    pub update_available: bool,
    pub release_notes: String,
    pub download_url: Option<String>,
}

pub async fn check_for_update() -> LauncherResult<UpdateInfo> {
    Ok(UpdateInfo {
        current_version: env!("CARGO_PKG_VERSION").to_string(),
        latest_version: env!("CARGO_PKG_VERSION").to_string(),
        update_available: false,
        release_notes: String::new(),
        download_url: None,
    })
}
