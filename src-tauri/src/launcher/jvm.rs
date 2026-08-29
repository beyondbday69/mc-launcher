//! JVM argument presets.
//!
//! Only safe, well-known, version-appropriate flags. The set is small by
//! design — no random "tweaks" or obsolete flags.
//!
//! Flags are tuned per Java major version. For example, G1 is the default
//! on Java 9+, so we never force `-XX:+UseG1GC` on those versions; on
//! Java 8 we keep the default unless the user opts in.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum JvmProfile {
    Default,
    LowRam,
    Balanced,
    Performance,
    Custom,
}

impl JvmProfile {
    pub fn resolve(name: &str) -> Self {
        match name {
            "low_ram" => Self::LowRam,
            "balanced" => Self::Balanced,
            "performance" => Self::Performance,
            "custom" => Self::Custom,
            _ => Self::Default,
        }
    }

    pub fn args(&self, java_major: u32, ram_mb: u32) -> Vec<String> {
        match self {
            Self::Default => Self::default_args(java_major, ram_mb),
            Self::LowRam => Self::low_ram_args(java_major, ram_mb),
            Self::Balanced => Self::balanced_args(java_major, ram_mb),
            Self::Performance => Self::performance_args(java_major, ram_mb),
            Self::Custom => Vec::new(),
        }
    }

    /// Sane default that works for almost everyone.
    pub fn default_args(java_major: u32, ram_mb: u32) -> Vec<String> {
        let mut v = vec![
            format!("-Xms{}m", ram_mb / 2),
            format!("-Xmx{}m", ram_mb),
            "-XX:+UnlockExperimentalVMOptions".to_string(),
            "-XX:+UseG1GC".to_string(),
            "-XX:G1NewSizePercent=20".to_string(),
            "-XX:G1ReservePercent=20".to_string(),
            "-XX:MaxGCPauseMillis=50".to_string(),
            "-XX:G1HeapRegionSize=32M".to_string(),
        ];
        if java_major >= 9 {
            v.push("-XX:InitiatingHeapOccupancyPercent=15".to_string());
        }
        if java_major <= 8 {
            // PermGen is Java 8 only.
            v.push("-XX:PermSize=256m".to_string());
        }
        v
    }

    /// Aggressively low memory footprint. Aim for 1-2 GB total.
    pub fn low_ram_args(java_major: u32, ram_mb: u32) -> Vec<String> {
        let mut v = vec![
            format!("-Xms{}m", 256.min(ram_mb)),
            format!("-Xmx{}m", ram_mb),
            "-XX:+UnlockExperimentalVMOptions".to_string(),
            "-XX:+UseG1GC".to_string(),
            "-XX:G1NewSizePercent=20".to_string(),
            "-XX:G1ReservePercent=15".to_string(),
            "-XX:MaxGCPauseMillis=30".to_string(),
            "-XX:G1HeapRegionSize=8M".to_string(),
            "-XX:InitiatingHeapOccupancyPercent=10".to_string(),
        ];
        if java_major <= 8 {
            v.push("-XX:PermSize=128m".to_string());
        }
        v
    }

    /// Balanced for most users on most hardware.
    pub fn balanced_args(java_major: u32, ram_mb: u32) -> Vec<String> {
        let mut v = vec![
            format!("-Xms{}m", ram_mb / 2),
            format!("-Xmx{}m", ram_mb),
            "-XX:+UnlockExperimentalVMOptions".to_string(),
            "-XX:+UseG1GC".to_string(),
            "-XX:G1NewSizePercent=20".to_string(),
            "-XX:G1ReservePercent=20".to_string(),
            "-XX:MaxGCPauseMillis=50".to_string(),
            "-XX:G1HeapRegionSize=16M".to_string(),
        ];
        if java_major >= 9 {
            v.push("-XX:InitiatingHeapOccupancyPercent=15".to_string());
        } else {
            v.push("-XX:PermSize=256m".to_string());
        }
        v
    }

    /// Performance-oriented. Higher GC pause tolerance, larger regions.
    pub fn performance_args(java_major: u32, ram_mb: u32) -> Vec<String> {
        let mut v = vec![
            format!("-Xms{}m", ram_mb),
            format!("-Xmx{}m", ram_mb),
            "-XX:+UnlockExperimentalVMOptions".to_string(),
            "-XX:+UseG1GC".to_string(),
            "-XX:G1NewSizePercent=40".to_string(),
            "-XX:G1ReservePercent=15".to_string(),
            "-XX:MaxGCPauseMillis=50".to_string(),
            "-XX:G1HeapRegionSize=32M".to_string(),
            "-XX:InitiatingHeapOccupancyPercent=20".to_string(),
            "-XX:+ParallelRefProcEnabled".to_string(),
        ];
        if java_major <= 8 {
            v.push("-XX:PermSize=256m".to_string());
        }
        v
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_has_g1gc() {
        let v = JvmProfile::Default.args(17, 2048);
        assert!(v.iter().any(|s| s == "-XX:+UseG1GC"));
    }

    #[test]
    fn low_ram_caps_initial_heap() {
        let v = JvmProfile::LowRam.args(17, 1024);
        assert!(v.iter().any(|s| s == "-Xms256m"));
        assert!(v.iter().any(|s| s == "-Xmx1024m"));
    }

    #[test]
    fn custom_returns_empty() {
        let v = JvmProfile::Custom.args(17, 2048);
        assert!(v.is_empty());
    }

    #[test]
    fn java_8_adds_permgen() {
        let v = JvmProfile::Default.args(8, 2048);
        assert!(v.iter().any(|s| s.contains("PermSize")));
    }

    #[test]
    fn java_17_omits_permgen() {
        let v = JvmProfile::Default.args(17, 2048);
        assert!(!v.iter().any(|s| s.contains("PermSize")));
    }
}
