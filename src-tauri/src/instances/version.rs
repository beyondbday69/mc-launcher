//! Helpers for parsing Minecraft version IDs.
//!
//! Mojang uses two shapes for version IDs that are both still in active
//! use in 2026:
//!
//! * **Releases and pre-releases**: `1.X`, `1.X.Y`, `1.X.Y-preZ`. The
//!   Java major we want is `X` (the second dot-separated segment).
//!   Example: `1.21.4` -> 21, `1.18-pre1` -> 18, `1.21.4-pre1` -> 21.
//!
//! * **New-style snapshots**: `YYwWWA` (year `YY`, week `WW`, letter `A`).
//!   The Java major is the year `YY`. Example: `24w40a` -> 24, `25w01a`
//!   -> 25.
//!
//! Anything unrecognised returns 0 so the caller can fall back to a
//! default Java instead of panicking — this matches the old
//! `parse_mc_major` behaviour for the unknown cases (e.g. `1.0`, `abc`).

/// Extract the Minecraft major version number from a version id, suitable
/// for picking a Java runtime (Java 17 for 1.18+, Java 21 for 1.20.5+).
///
/// Returns 0 for empty input or anything that doesn't match either
/// recognised shape. Callers should treat 0 as "use the system default".
pub fn parse_mc_major(v: &str) -> u32 {
    let trimmed = v.trim();
    if trimmed.is_empty() {
        return 0;
    }
    // New-style snapshot: "24w40a", "25w01a", etc. The major is the
    // leading digits before the 'w'.
    if let Some(w_pos) = trimmed.find('w') {
        if w_pos > 0 && trimmed.as_bytes()[..w_pos].iter().all(u8::is_ascii_digit) {
            if let Ok(n) = trimmed[..w_pos].parse::<u32>() {
                if n > 0 {
                    return n;
                }
            }
        }
    }
    // Standard: "1.X", "1.X.Y", "1.X.Y-preZ" — major is the second segment.
    let mut parts = trimmed.split('.');
    let _ = parts.next();
    let Some(second) = parts.next() else {
        return 0;
    };
    // Strip any trailing non-digit suffix (e.g. "18-pre1" -> "18").
    let major_str: String = second
        .chars()
        .take_while(|c| c.is_ascii_digit())
        .collect();
    if major_str.is_empty() {
        return 0;
    }
    major_str.parse::<u32>().unwrap_or(0)
}

/// True if the version id looks like a Mojang snapshot. Snapshot ids
/// either start with `YYw` (new style) or end with `-preN` / `-rcN` (old
/// pre-release style on a 1.X.Y base).
pub fn is_snapshot_id(v: &str) -> bool {
    let t = v.trim();
    if t.is_empty() {
        return false;
    }
    // New-style snapshot: leading "YYw" where YY is digits.
    if let Some(w_pos) = t.find('w') {
        if w_pos == 2 && t.as_bytes()[..2].iter().all(u8::is_ascii_digit) {
            return true;
        }
    }
    // Old-style pre-release: contains "-pre" or "-rc".
    t.contains("-pre") || t.contains("-rc") || t.contains("-Pre") || t.contains("-RC")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_release_versions() {
        assert_eq!(parse_mc_major("1.21.4"), 21);
        assert_eq!(parse_mc_major("1.21.10"), 21);
        assert_eq!(parse_mc_major("1.20.5"), 20);
        assert_eq!(parse_mc_major("1.18"), 18);
        assert_eq!(parse_mc_major("1.12.2"), 12);
        assert_eq!(parse_mc_major("1.0"), 0);
    }

    #[test]
    fn parse_pre_releases() {
        // Old "1.X-preN" form — the old code returned 0 here because
        // "18-pre1" doesn't parse as u32.
        assert_eq!(parse_mc_major("1.18-pre1"), 18);
        assert_eq!(parse_mc_major("1.20-pre7"), 20);
        // "1.X.Y-preZ" — major is still the second segment.
        assert_eq!(parse_mc_major("1.21.4-pre1"), 21);
        assert_eq!(parse_mc_major("1.20.5-rc1"), 20);
    }

    #[test]
    fn parse_new_style_snapshots() {
        assert_eq!(parse_mc_major("24w40a"), 24);
        assert_eq!(parse_mc_major("25w01a"), 25);
        assert_eq!(parse_mc_major("23w35a"), 23);
    }

    #[test]
    fn parse_unknown_returns_zero() {
        assert_eq!(parse_mc_major(""), 0);
        assert_eq!(parse_mc_major("   "), 0);
        assert_eq!(parse_mc_major("abc"), 0);
        assert_eq!(parse_mc_major("1"), 0);
    }

    #[test]
    fn is_snapshot_id_classifies() {
        assert!(is_snapshot_id("24w40a"));
        assert!(is_snapshot_id("25w01a"));
        assert!(is_snapshot_id("1.18-pre1"));
        assert!(is_snapshot_id("1.20.5-rc1"));
        assert!(!is_snapshot_id("1.21.4"));
        assert!(!is_snapshot_id("1.18"));
        assert!(!is_snapshot_id(""));
    }
}
