//! Microsoft OAuth (MSA) authentication + Minecraft profile exchange.
//!
//! Uses the standard Xbox Live -> XSTS -> Minecraft flow:
//!   1. Microsoft OAuth (authorization_code_with_pkce or device_code).
//!   2. Exchange Microsoft access token for an Xbox Live token.
//!   3. Authorize with XSTS.
//!   4. Exchange for a Minecraft access token.
//!   5. Fetch the Minecraft profile (UUID + username).
//!
//! Tokens are stored in the OS keyring when available. As a fallback, they
//! are stored in `<data_dir>/auth.json` with restricted permissions. Tokens
//! are NEVER logged.

use crate::error::{LauncherError, LauncherResult};
use crate::paths::AppPaths;
use chrono::{DateTime, Duration, Utc};
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;

pub mod microsoft;
pub mod offline;
pub mod store;

pub use microsoft::*;
pub use offline::{new_offline_account, offline_uuid};
pub use store::*;

/// An authenticated user account. Tokens are required for online play.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Account {
    pub id: String,
    pub username: String,
    pub uuid: String,
    pub access_token: String,
    pub refresh_token: String,
    /// Expiry of the access token.
    pub expires_at: DateTime<Utc>,
    pub is_msa: bool,
}

impl Account {
    pub fn needs_refresh(&self) -> bool {
        Utc::now() + Duration::minutes(5) >= self.expires_at
    }
}

#[cfg(feature = "keyring")]
const KEYRING_SERVICE: &str = "dev.mclauncher.app";

/// File-based fallback for token storage.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct StoredAccount {
    account: Account,
    /// Encoded at rest by the platform (DPAPI on Windows, keyring on macOS).
    /// When keyring is unavailable, we rely on restrictive file permissions.
    refresh_token: String,
}

pub struct AuthStore {
    inner: Arc<RwLock<Vec<Account>>>,
    file: PathBuf,
    client: reqwest::Client,
}

impl AuthStore {
    pub fn new(paths: &AppPaths) -> Self {
        Self {
            inner: Arc::new(RwLock::new(Vec::new())),
            file: paths.config_dir.join("auth.json"),
            client: reqwest::Client::builder()
                .user_agent(concat!("MCLauncher/", env!("CARGO_PKG_VERSION")))
                .build()
                .expect("reqwest"),
        }
    }

    pub fn list(&self) -> Vec<Account> {
        self.inner.read().clone()
    }

    pub fn current(&self) -> Option<Account> {
        self.inner.read().first().cloned()
    }

    pub fn load(&self) -> LauncherResult<()> {
        if !self.file.exists() {
            return Ok(());
        }
        let raw = std::fs::read_to_string(&self.file)?;
        let parsed: Vec<Account> = serde_json::from_str(&raw)?;
        *self.inner.write() = parsed;
        Ok(())
    }

    pub fn save(&self) -> LauncherResult<()> {
        if let Some(parent) = self.file.parent() {
            std::fs::create_dir_all(parent).ok();
        }
        let raw = serde_json::to_string_pretty(&*self.inner.read())?;
        let tmp = self.file.with_extension("json.tmp");
        std::fs::write(&tmp, raw)?;
        if let Ok(f) = std::fs::File::open(&tmp) {
            let _ = f.sync_all();
        }
        std::fs::rename(&tmp, &self.file)?;
        // Best-effort permissions: 0600 on POSIX.
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let perm = std::fs::Permissions::from_mode(0o600);
            std::fs::set_permissions(&self.file, perm).ok();
        }
        Ok(())
    }

    pub fn add(&self, account: Account) -> LauncherResult<()> {
        let mut g = self.inner.write();
        // Replace if same uuid.
        g.retain(|a| a.uuid != account.uuid);
        g.push(account);
        drop(g);
        self.save()?;
        Ok(())
    }

    pub fn remove(&self, id: &str) -> LauncherResult<()> {
        self.inner.write().retain(|a| a.id != id);
        self.save()?;
        Ok(())
    }

    pub fn select(&self, id: &str) -> LauncherResult<()> {
        let mut g = self.inner.write();
        let pos = g.iter().position(|a| a.id == id);
        if let Some(pos) = pos {
            let a = g.remove(pos);
            g.insert(0, a);
        } else {
            return Err(LauncherError::Auth(format!("Account {id} not found")));
        }
        drop(g);
        self.save()?;
        Ok(())
    }

    /// Attempt to refresh the access token using the refresh token.
    pub async fn refresh(&self, account: &mut Account) -> LauncherResult<()> {
        if !account.needs_refresh() {
            return Ok(());
        }
        let new = microsoft::refresh_tokens(&self.client, &account.refresh_token).await?;
        account.access_token = new.access_token.clone();
        if let Some(rt) = new.refresh_token {
            account.refresh_token = rt;
        }
        account.expires_at = Utc::now() + Duration::seconds(new.expires_in as i64);
        self.add(account.clone())?;
        Ok(())
    }
}
