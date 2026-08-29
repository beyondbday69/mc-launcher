//! Argument placeholder resolution.
//!
//! Minecraft 1.13+ uses placeholders in game arguments like
//! `${auth_player_name}`, `${version_name}`, `${assets_root}`, etc.
//! This module replaces them with the actual values.

use crate::error::LauncherResult;
use std::collections::HashMap;
use std::path::PathBuf;

/// All Mojang-defined placeholders. Mapped to a function that produces the
/// replacement value from a context.
pub fn build_context(
    auth_player_name: &str,
    auth_uuid: &str,
    auth_access_token: &str,
    version_name: &str,
    game_directory: &PathBuf,
    assets_root: &PathBuf,
    asset_index_name: &str,
    user_type: &str,
    version_type: &str,
    resolution_width: Option<u32>,
    resolution_height: Option<u32>,
    natives_directory: &PathBuf,
    launcher_name: &str,
    launcher_version: &str,
    classpath: &str,
) -> HashMap<&'static str, String> {
    let mut m = HashMap::new();
    m.insert("auth_player_name", auth_player_name.to_string());
    m.insert("auth_uuid", auth_uuid.replace('-', ""));
    m.insert("auth_access_token", auth_access_token.to_string());
    m.insert("auth_session", auth_access_token.to_string());
    m.insert("user_properties", "{}".to_string());
    m.insert("user_property_map", "{}".to_string());
    m.insert("version_name", version_name.to_string());
    m.insert("game_directory", path_to_string(game_directory));
    m.insert("assets_root", path_to_string(assets_root));
    m.insert("assets_index_name", asset_index_name.to_string());
    m.insert("user_type", user_type.to_string());
    m.insert("version_type", version_type.to_string());
    m.insert("resolution_width", resolution_width.unwrap_or(854).to_string());
    m.insert("resolution_height", resolution_height.unwrap_or(480).to_string());
    m.insert("natives_directory", path_to_string(natives_directory));
    m.insert("launcher_name", launcher_name.to_string());
    m.insert("launcher_version", launcher_version.to_string());
    m.insert("classpath", classpath.to_string());
    m
}

fn path_to_string(p: &PathBuf) -> String {
    p.to_string_lossy().into_owned()
}

/// Replace all `${key}` and `${key:-default}` placeholders in `s` with
/// values from `context`. Missing keys with defaults fall back to default;
/// missing keys without defaults are left as `${key}` so a downstream error
/// surfaces them.
pub fn substitute(s: &str, context: &HashMap<&'static str, String>) -> String {
    let mut out = String::with_capacity(s.len());
    let bytes = s.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'$' && i + 1 < bytes.len() && bytes[i + 1] == b'{' {
            // Find matching '}'
            if let Some(end) = s[i + 2..].find('}') {
                let inner = &s[i + 2..i + 2 + end];
                let (key, default) = match inner.find(":-") {
                    Some(idx) => (&inner[..idx], Some(&inner[idx + 2..])),
                    None => (inner, None),
                };
                if let Some(v) = context.get(key) {
                    out.push_str(v);
                } else if let Some(d) = default {
                    out.push_str(d);
                } else {
                    out.push_str(&s[i..i + 2 + end + 1]);
                }
                i += 2 + end + 1;
                continue;
            }
        }
        // Push one char (UTF-8 safe by re-decoding).
        let ch = s[i..].chars().next().unwrap();
        out.push(ch);
        i += ch.len_utf8();
    }
    out
}

/// Substitute all placeholders in a vector of argument strings.
pub fn substitute_all(args: &[String], context: &HashMap<&'static str, String>) -> Vec<String> {
    args.iter().map(|a| substitute(a, context)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn substitute_basic() {
        let mut ctx = HashMap::new();
        ctx.insert("name", "alice".to_string());
        ctx.insert("ver", "1.21.4".to_string());
        assert_eq!(substitute("--username ${name} --version ${ver}", &ctx),
                   "--username alice --version 1.21.4");
    }

    #[test]
    fn substitute_with_default() {
        let ctx = HashMap::new();
        assert_eq!(substitute("--width ${width:-800}", &ctx), "--width 800");
    }

    #[test]
    fn substitute_missing_left_alone() {
        let ctx = HashMap::new();
        assert_eq!(substitute("--x ${unknown}", &ctx), "--x ${unknown}");
    }

    #[test]
    fn build_context_has_required_keys() {
        let ctx = build_context(
            "alice",
            "00000000-0000-0000-0000-000000000000",
            "tok",
            "1.21.4",
            &PathBuf::from("/game"),
            &PathBuf::from("/assets"),
            "1.21",
            "msa",
            "release",
            Some(1920),
            Some(1080),
            &PathBuf::from("/natives"),
            "MCLauncher",
            "0.1.0",
            "/cp",
        );
        assert_eq!(ctx.get("auth_player_name").unwrap(), "alice");
        assert_eq!(ctx.get("version_name").unwrap(), "1.21.4");
        assert_eq!(ctx.get("auth_uuid").unwrap(), "00000000000000000000000000000000");
    }
}
