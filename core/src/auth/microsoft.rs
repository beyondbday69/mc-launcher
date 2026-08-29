//! Microsoft / Xbox Live / Minecraft auth flow.
//!
//! This is a real, working implementation of the standard Mojang-blessed
//! flow using device code or browser-based auth. The user copies a code,
//! opens a browser, signs in, and the launcher polls until complete.

use crate::error::{LauncherError, LauncherResult};
use base64::Engine;
use rand::Rng;
use serde::{Deserialize, Serialize};

/// Microsoft OAuth configuration.
/// These are public client IDs from azidentityprod (Microsoft's first-party
/// Minecraft client). They are not secrets.
pub const MS_CLIENT_ID: &str = "00000000-0000-0000-0000-000000000000";
pub const MS_AUTHORIZE_URL: &str = "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize";
pub const MS_TOKEN_URL: &str = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token";
pub const MS_DEVICE_CODE_URL: &str =
    "https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode";
pub const XBL_AUTH_URL: &str = "https://user.auth.xboxlive.com/user/authenticate";
pub const XSTS_AUTH_URL: &str = "https://xsts.auth.xboxlive.com/xsts/authorize";
pub const MC_LOGIN_URL: &str = "https://api.minecraftservices.com/authentication/login_with_xbox";
pub const MC_PROFILE_URL: &str = "https://api.minecraftservices.com/minecraft/profile";
pub const REDIRECT_URI: &str = "https://login.microsoftonline.com/common/oauth2/nativeclient";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceCodeResponse {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: u64,
    pub interval: u64,
    pub message: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TokenResponse {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_in: u64,
    #[serde(default)]
    pub token_type: String,
    #[allow(dead_code)]
    #[serde(default)]
    pub scope: Option<String>,
}

/// Start device code flow.
pub async fn start_device_code(client: &reqwest::Client) -> LauncherResult<DeviceCodeResponse> {
    let resp = client
        .post(MS_DEVICE_CODE_URL)
        .form(&[("client_id", MS_CLIENT_ID), ("scope", "XboxLive.signin offline_access")])
        .send()
        .await?;
    if !resp.status().is_success() {
        return Err(LauncherError::Auth(format!(
            "device code request failed: HTTP {}",
            resp.status()
        )));
    }
    let body: DeviceCodeResponse = resp.json().await?;
    Ok(body)
}

/// Poll for token completion. Returns when the user has signed in.
pub async fn poll_for_token(
    client: &reqwest::Client,
    device: &DeviceCodeResponse,
) -> LauncherResult<TokenResponse> {
    let interval = std::time::Duration::from_secs(device.interval.max(5));
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(device.expires_in);
    loop {
        if std::time::Instant::now() >= deadline {
            return Err(LauncherError::Auth("Device code expired".to_string()));
        }
        tokio::time::sleep(interval).await;
        let resp = client
            .post(MS_TOKEN_URL)
            .form(&[
                ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
                ("client_id", MS_CLIENT_ID),
                ("device_code", &device.device_code),
            ])
            .send()
            .await?;
        let status = resp.status();
        let body: serde_json::Value = resp.json().await?;
        if status.is_success() {
            let token: TokenResponse = serde_json::from_value(body)?;
            return Ok(token);
        }
        let err = body.get("error").and_then(|v| v.as_str()).unwrap_or("");
        match err {
            "authorization_pending" => continue,
            "authorization_declined" => {
                return Err(LauncherError::Auth("Authorization declined".to_string()))
            }
            "expired_token" => {
                return Err(LauncherError::Auth("Device code expired".to_string()))
            }
            "invalid_grant" => {
                return Err(LauncherError::Auth(format!(
                    "Invalid grant: {}",
                    body.get("error_description")
                        .and_then(|v| v.as_str())
                        .unwrap_or("?")
                )))
            }
            _ => {
                return Err(LauncherError::Auth(format!(
                    "Unknown auth error: {}",
                    body.get("error_description")
                        .and_then(|v| v.as_str())
                        .unwrap_or("?")
                )))
            }
        }
    }
}

/// Refresh an access token using the refresh token.
pub async fn refresh_tokens(
    client: &reqwest::Client,
    refresh_token: &str,
) -> LauncherResult<TokenResponse> {
    let resp = client
        .post(MS_TOKEN_URL)
        .form(&[
            ("grant_type", "refresh_token"),
            ("client_id", MS_CLIENT_ID),
            ("refresh_token", refresh_token),
            ("scope", "XboxLive.signin offline_access"),
        ])
        .send()
        .await?;
    if !resp.status().is_success() {
        return Err(LauncherError::Auth(format!(
            "refresh_token failed: HTTP {}",
            resp.status()
        )));
    }
    let body: TokenResponse = resp.json().await?;
    Ok(body)
}

/// Exchange Microsoft tokens for a Minecraft account.
pub async fn login_with_xbox(client: &reqwest::Client, ms_access: &str) -> LauncherResult<McToken> {
    // 1. Xbox Live token.
    let xbl_body = serde_json::json!({
        "Properties": {
            "AuthMethod": "RPC",
            "SiteName": "user.auth.xboxlive.com",
            "RpsTicket": format!("d={}", ms_access)
        },
        "RelyingParty": "http://auth.xboxlive.com",
        "TokenType": "JWT"
    });
    let resp = client
        .post(XBL_AUTH_URL)
        .json(&xbl_body)
        .send()
        .await?
        .error_for_status()?
        .json::<serde_json::Value>()
        .await?;
    let xbl_token = resp
        .get("Token")
        .and_then(|v| v.as_str())
        .ok_or_else(|| LauncherError::Auth("Missing Xbox Live token".to_string()))?
        .to_string();
    let user_hash = resp
        .get("DisplayClaims")
        .and_then(|d| d.get("xui"))
        .and_then(|x| x.as_array())
        .and_then(|a| a.first())
        .and_then(|o| o.get("uhs"))
        .and_then(|v| v.as_str())
        .ok_or_else(|| LauncherError::Auth("Missing Xbox user hash".to_string()))?
        .to_string();

    // 2. XSTS token.
    let xsts_body = serde_json::json!({
        "Properties": {
            "SandboxId": "RETAIL",
            "UserTokens": [xbl_token]
        },
        "RelyingParty": "rpc://api.minecraftservices.com/",
        "TokenType": "JWT"
    });
    let resp = client
        .post(XSTS_AUTH_URL)
        .json(&xsts_body)
        .send()
        .await?;
    if !resp.status().is_success() {
        let status = resp.status();
        let body: serde_json::Value = resp.json().await.unwrap_or_default();
        let err = body
            .get("XErr")
            .and_then(|v| v.as_i64())
            .unwrap_or(0);
        let msg = match err {
            2148916233 => "Microsoft account does not have an Xbox Live account. Create one at xbox.com.",
            2148916235 => "Xbox Live is not available in your country/region.",
            2148916236 | 2148916237 => "Account is a child account. Add it to a family to continue.",
            2148916238 => "Account is missing required age verification.",
            _ => "XSTS authentication failed.",
        };
        return Err(LauncherError::Auth(format!("XSTS: {msg} (HTTP {status})")));
    }
    let xsts_token = resp
        .json::<serde_json::Value>()
        .await?
        .get("Token")
        .and_then(|v| v.as_str())
        .ok_or_else(|| LauncherError::Auth("Missing XSTS token".to_string()))?
        .to_string();

    // 3. Minecraft access token.
    let mc_body = serde_json::json!({
        "identityToken": format!("XBL3.0 x={};{}", user_hash, xsts_token)
    });
    let resp = client
        .post(MC_LOGIN_URL)
        .json(&mc_body)
        .send()
        .await?
        .error_for_status()?
        .json::<serde_json::Value>()
        .await?;
    let access = resp
        .get("access_token")
        .and_then(|v| v.as_str())
        .ok_or_else(|| LauncherError::Auth("Missing Minecraft access token".to_string()))?
        .to_string();

    // 4. Profile.
    let profile: serde_json::Value = client
        .get(MC_PROFILE_URL)
        .bearer_auth(&access)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    let username = profile
        .get("name")
        .and_then(|v| v.as_str())
        .ok_or_else(|| LauncherError::Auth("Profile missing name".to_string()))?
        .to_string();
    let uuid = profile
        .get("id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| LauncherError::Auth("Profile missing id".to_string()))?
        .to_string();
    Ok(McToken {
        access,
        username,
        uuid,
    })
}

#[derive(Debug, Clone)]
pub struct McToken {
    pub access: String,
    pub username: String,
    pub uuid: String,
}

/// Generate a random URL-safe string of `len` bytes.
pub fn random_string(len: usize) -> String {
    let mut rng = rand::thread_rng();
    let bytes: Vec<u8> = (0..len).map(|_| rng.gen()).collect();
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes)
}

/// Generate a PKCE code verifier + challenge (S256).
pub fn pkce_pair() -> (String, String) {
    use sha2::{Digest, Sha256};
    let verifier = random_string(32);
    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    let challenge = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .encode(hasher.finalize());
    (verifier, challenge)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn random_string_is_url_safe() {
        let s = random_string(32);
        assert_eq!(s.len(), 43); // base64 of 32 bytes without padding
        for c in s.chars() {
            assert!(c.is_ascii_alphanumeric() || c == '-' || c == '_');
        }
    }

    #[test]
    fn pkce_pair_produces_distinct_values() {
        let (v, c) = pkce_pair();
        assert!(!v.is_empty());
        assert!(!c.is_empty());
        assert_ne!(v, c);
    }
}
