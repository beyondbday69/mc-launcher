//! Offline (local) account support.
//!
//! An offline account is a purely local user identity. It has:
//!   * a username (3-16 chars, alphanumerics + underscore, like real MC names)
//!   * a deterministic UUID v3 derived from `OfflinePlayer:<username>` via
//!     MD5 (this is the exact algorithm the vanilla server uses to map a
//!     username to a UUID when online auth is disabled)
//!   * NO access token (Yggdrasil auth servers are not contacted)
//!   * NO refresh token (nothing to refresh)
//!
//! Offline accounts let users play on LAN / singleplayer / "cracked"
//! servers without ever signing in to Mojang. The launch pipeline works
//! the same way — Minecraft will just see the username and a stable UUID.
//!
//! Username -> UUID is intentionally deterministic and versioned so a user
//! who plays on a cracked server can re-import their identity on any
//! other machine by re-typing the same username.

use crate::auth::Account;
use crate::error::{LauncherError, LauncherResult};
use chrono::{Duration, Utc};

/// Username rules per the official Minecraft profile system: 3-16 chars,
/// letters / digits / underscore. We enforce this so the offline UUID
/// matches what a real account would receive.
const USERNAME_MIN: usize = 3;
const USERNAME_MAX: usize = 16;

/// Construct an offline `Account` for the given username. The UUID is
/// derived from MD5("OfflinePlayer:" + username) per the standard
/// algorithm used by the Minecraft server when online-mode is false.
pub fn new_offline_account(username: &str) -> LauncherResult<Account> {
    let username = username.trim();
    if username.len() < USERNAME_MIN || username.len() > USERNAME_MAX {
        return Err(LauncherError::Auth(format!(
            "Username must be {}-{} characters (got {})",
            USERNAME_MIN,
            USERNAME_MAX,
            username.len()
        )));
    }
    if !username
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '_')
    {
        return Err(LauncherError::Auth(
            "Username may only contain ASCII letters, digits, and underscore".to_string(),
        ));
    }
    let uuid = offline_uuid(username);
    // Far-future expiry: offline accounts never need refreshing.
    let expires_at = Utc::now() + Duration::days(365 * 100);
    Ok(Account {
        id: format!("offline:{}", username),
        username: username.to_string(),
        uuid,
        access_token: String::new(),
        refresh_token: String::new(),
        expires_at,
        is_msa: false,
    })
}

/// Compute the offline UUID for a username.
///
/// This is the exact algorithm the Minecraft server uses to map a
/// username to a UUID when `online-mode=false`:
///
/// ```text
///   digest = MD5("OfflinePlayer:" + username)
///   uuid   = (digest[0..8] "-" digest[8..12] "-" digest[12..16]
///             "-" digest[16..20] "-" digest[20..32])
///   // set version (high nibble of byte 6) to 3 (MD5)
///   // set variant (high bits of byte 8) to 10xx (RFC 4122)
/// ```
pub fn offline_uuid(username: &str) -> String {
    use md5::{Digest, Md5};
    let mut h = Md5::new();
    h.update(format!("OfflinePlayer:{}", username).as_bytes());
    let digest = h.finalize();
    let bytes: [u8; 16] = digest.into();
    // Force version 3 (MD5) in the high nibble of byte 6.
    let mut b6 = bytes[6];
    b6 = (b6 & 0x0f) | 0x30;
    // Force RFC 4122 variant (10xx) in the high bits of byte 8.
    let mut b8 = bytes[8];
    b8 = (b8 & 0x3f) | 0x80;
    format!(
        "{:02x}{:02x}{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}",
        bytes[0], bytes[1], bytes[2], bytes[3],
        bytes[4], bytes[5],
        b6, bytes[7],
        b8, bytes[9],
        bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15],
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn offline_uuid_notch_has_correct_version_and_variant() {
        let u = offline_uuid("Notch");
        assert_eq!(u.len(), 36);
        assert_eq!(&u[14..15], "3", "version nibble should be 3 (MD5)");
        let variant = &u[19..20];
        assert!(
            matches!(variant, "8" | "9" | "a" | "b"),
            "RFC 4122 variant nibble should be 8/9/a/b, got {variant}"
        );
        assert_eq!(offline_uuid("Notch"), u);
        assert_ne!(offline_uuid("Notch"), offline_uuid("jeb_"));
    }

    #[test]
    fn new_offline_account_validates_username() {
        assert!(new_offline_account("Notch").is_ok());
        assert!(new_offline_account("ab").is_err());
        assert!(new_offline_account("a".repeat(17).as_str()).is_err());
        assert!(new_offline_account("has space").is_err());
        assert!(new_offline_account("with-dash").is_err());
        assert!(new_offline_account("Player_123").is_ok());
    }

    #[test]
    fn new_offline_account_has_no_tokens() {
        let acc = new_offline_account("Notch").unwrap();
        assert!(!acc.is_msa);
        assert_eq!(acc.access_token, "");
        assert_eq!(acc.refresh_token, "");
        assert!(!acc.needs_refresh());
        assert_eq!(acc.uuid.len(), 36);
    }

    #[test]
    fn uuid_stable_across_calls() {
        let a = offline_uuid("TestUser");
        let b = offline_uuid("TestUser");
        assert_eq!(a, b);
    }
}
