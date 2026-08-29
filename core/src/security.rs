//! Security utilities: path validation, secret redaction.
//!
//! Used by the logging layer (to strip secrets from traces) and by the
//! config / instances code (to prevent path traversal).

use std::path::{Component, Path, PathBuf};

/// Verify a path is absolute and contains no `..` components.
pub fn validate_path(path: &Path) -> Result<PathBuf, String> {
    if !path.is_absolute() {
        return Err(format!("Path is not absolute: {}", path.display()));
    }
    for c in path.components() {
        if matches!(c, Component::ParentDir) {
            return Err(format!("Path traversal detected: {}", path.display()));
        }
    }
    Ok(path.to_path_buf())
}

/// Check that a child path is inside the given root.
pub fn is_within(child: &Path, root: &Path) -> bool {
    let c = match child.canonicalize() {
        Ok(p) => p,
        Err(_) => child.to_path_buf(),
    };
    let r = match root.canonicalize() {
        Ok(p) => p,
        Err(_) => root.to_path_buf(),
    };
    c.starts_with(r)
}

/// Redact likely-secret substrings in a free-form string.
/// Used to scrub log lines.
pub fn redact(input: &str) -> String {
    let mut out = input.to_string();
    // Bearer tokens.
    if let Some(idx) = out.find("Bearer ") {
        let rest = &out[idx + 7..];
        let end = rest
            .find(|c: char| c.is_whitespace() || c == '"' || c == ',')
            .unwrap_or(rest.len());
        let token = &rest[..end];
        if token.len() > 16 {
            out = out.replace(token, "<redacted-token>");
        }
    }
    // Access token / refresh token in JSON-like fields.
    for key in ["access_token", "refresh_token", "client_secret", "password", "xuid"] {
        if let Some(idx) = out.find(&format!("\"{}\":\"", key)) {
            let start = idx + key.len() + 4;
            if let Some(end) = out[start..].find('"') {
                let val = &out[start..start + end];
                if val.len() > 4 {
                    out = out.replace(val, "<redacted>");
                }
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn validate_path_rejects_relative() {
        assert!(validate_path(&PathBuf::from("foo")).is_err());
        assert!(validate_path(&PathBuf::from("/abs/path")).is_ok());
    }

    #[test]
    fn validate_path_rejects_traversal() {
        assert!(validate_path(&PathBuf::from("/foo/../bar")).is_err());
        assert!(validate_path(&PathBuf::from("/foo/bar")).is_ok());
    }

    #[test]
    fn redact_strips_bearer() {
        let s = "Authorization: Bearer abc.def.ghi.jkl.mnop";
        let r = redact(s);
        assert!(r.contains("<redacted-token>"));
    }

    #[test]
    fn redact_strips_token_field() {
        let s = r#"{"access_token":"abcdefghijklmnop","x":1}"#;
        let r = redact(s);
        assert!(r.contains("<redacted>"));
        assert!(!r.contains("abcdefghijklmnop"));
    }
}
