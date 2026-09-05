//! Java detection, validation, and recommendation.
//!
//! Searches the OS registry (Windows), `JAVA_HOME`, and common install paths
//! for Java installations. Does not bundle a runtime; the user is expected
//! to have one installed.

use crate::error::{LauncherError, LauncherResult};
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::Command;
use which::which;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JavaInstallation {
    pub path: PathBuf,
    pub version: u32,
    pub vendor: String,
    pub architecture: String,
    /// Whether this is the OS-managed default (e.g. `java` on PATH).
    pub is_default: bool,
}

#[derive(Debug, Default)]
pub struct JavaCatalog {
    inner: RwLock<Vec<JavaInstallation>>,
    catalog_path: PathBuf,
}

impl JavaCatalog {
    pub fn new(catalog_path: PathBuf) -> Self {
        Self {
            inner: RwLock::new(Vec::new()),
            catalog_path,
        }
    }

    /// Load cached detections from disk.
    pub fn load(&self) {
        if self.catalog_path.exists() {
            if let Ok(raw) = std::fs::read_to_string(&self.catalog_path) {
                if let Ok(list) = serde_json::from_str::<Vec<JavaInstallation>>(&raw) {
                    *self.inner.write() = list;
                }
            }
        }
    }

    pub fn save(&self) -> LauncherResult<()> {
        if let Some(parent) = self.catalog_path.parent() {
            std::fs::create_dir_all(parent).ok();
        }
        let raw = serde_json::to_string_pretty(&*self.inner.read())?;
        std::fs::write(&self.catalog_path, raw)?;
        Ok(())
    }

    pub fn list(&self) -> Vec<JavaInstallation> {
        self.inner.read().clone()
    }

    /// Run a full detection pass, replacing the cached list.
    pub fn detect(&self) -> LauncherResult<Vec<JavaInstallation>> {
        let mut found = Vec::new();
        for path in search_paths() {
            if let Some(install) = detect_one(&path) {
                if !found.iter().any(|j: &JavaInstallation| j.path == install.path) {
                    found.push(install);
                }
            }
        }
        // `java` on PATH
        if let Ok(p) = which("java") {
            if let Some(install) = detect_one(&p) {
                if !found.iter().any(|j| j.path == install.path) {
                    found.push(install);
                }
            }
        }
        *self.inner.write() = found.clone();
        self.save().ok();
        Ok(found)
    }

    /// Add a manually-selected java path.
    pub fn add_manual(&self, path: &Path) -> LauncherResult<JavaInstallation> {
        let install = detect_one(path).ok_or_else(|| {
            LauncherError::JavaInvalid {
                path: path.to_path_buf(),
                reason: "Not a valid java executable".to_string(),
            }
        })?;
        let mut guard = self.inner.write();
        if let Some(existing) = guard.iter_mut().find(|j| j.path == install.path) {
            *existing = install.clone();
        } else {
            guard.push(install.clone());
        }
        drop(guard);
        self.save().ok();
        Ok(install)
    }

    pub fn remove(&self, path: &Path) {
        self.inner.write().retain(|j| j.path != path);
        self.save().ok();
    }

    /// Check if an existing, valid Java installation matches or exceeds target_version.
    pub fn has_version(&self, target_version: u32) -> bool {
        self.inner
            .read()
            .iter()
            .any(|j| j.version >= target_version && j.path.exists())
    }

    /// Recommend a Java version for the given Minecraft `major_version` hint.
    /// Mojang's mapping: 1.17+ = Java 16+, 1.18+ = Java 17+, 1.20.5+ = Java 21, 1.21+ = Java 21.
    pub fn recommend(&self, minecraft_major: u32) -> JavaInstallation {
        let list = self.inner.read();
        let target = target_java_version_for_mc(minecraft_major);
        // Prefer the highest version >= target that exists on disk.
        let mut best: Option<&JavaInstallation> = None;
        for j in list.iter() {
            if j.version >= target && j.path.exists() {
                if best.map_or(true, |b| j.version > b.version) {
                    best = Some(j);
                }
            }
        }
        if let Some(b) = best {
            return b.clone();
        }
        // Fallback: highest version overall that exists on disk.
        list.iter()
            .filter(|j| j.path.exists())
            .max_by_key(|j| j.version)
            .cloned()
            .unwrap_or_else(|| JavaInstallation {
                path: PathBuf::from("java"),
                version: 0,
                vendor: "Unknown".to_string(),
                architecture: std::env::consts::ARCH.to_string(),
                is_default: true,
            })
    }
}

#[cfg(target_os = "windows")]
fn search_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    // Common install locations.
    for base in &[
        r"C:\Program Files\Java",
        r"C:\Program Files\Eclipse Adoptium",
        r"C:\Program Files\Eclipse Foundation",
        r"C:\Program Files\AdoptOpenJDK",
        r"C:\Program Files\OpenJDK",
        r"C:\Program Files\Microsoft",
        r"C:\Program Files\BellSoft",
        r"C:\Program Files\Zulu",
    ] {
        let p = PathBuf::from(base);
        if p.exists() {
            if let Ok(rd) = std::fs::read_dir(&p) {
                for entry in rd.flatten() {
                    let bin = entry.path().join("bin").join("javaw.exe");
                    if bin.exists() {
                        paths.push(bin);
                    }
                    let bin2 = entry.path().join("bin").join("java.exe");
                    if bin2.exists() {
                        paths.push(bin2);
                    }
                }
            }
        }
    }
    if let Ok(jh) = std::env::var("JAVA_HOME") {
        let p = PathBuf::from(&jh).join("bin").join("javaw.exe");
        if p.exists() {
            paths.push(p);
        }
        let p2 = PathBuf::from(&jh).join("bin").join("java.exe");
        if p2.exists() {
            paths.push(p2);
        }
    }
    paths
}

#[cfg(target_os = "macos")]
fn search_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    let bases = [
        "/Library/Java/JavaVirtualMachines",
        "/opt/homebrew/opt",
        "/usr/local/opt",
    ];
    for base in bases {
        let p = PathBuf::from(base);
        if p.exists() {
            if let Ok(rd) = std::fs::read_dir(&p) {
                for entry in rd.flatten() {
                    let home = entry.path().join("Contents/Home/bin/java");
                    if home.exists() {
                        paths.push(home);
                    }
                    let bin = entry.path().join("bin/java");
                    if bin.exists() {
                        paths.push(bin);
                    }
                }
            }
        }
    }
    if let Ok(jh) = std::env::var("JAVA_HOME") {
        let p = PathBuf::from(&jh).join("bin/java");
        if p.exists() {
            paths.push(p);
        }
    }
    paths
}

#[cfg(target_os = "linux")]
fn search_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    let bases = [
        "/usr/lib/jvm",
        "/usr/local/lib/jvm",
        "/opt/jdk",
        "/opt/java",
        "/opt/jvm",
    ];
    for base in bases {
        let p = PathBuf::from(base);
        if p.exists() {
            if let Ok(rd) = std::fs::read_dir(&p) {
                for entry in rd.flatten() {
                    let bin = entry.path().join("bin/java");
                    if bin.exists() {
                        paths.push(bin);
                    }
                }
            }
        }
    }
    if let Ok(jh) = std::env::var("JAVA_HOME") {
        let p = PathBuf::from(&jh).join("bin/java");
        if p.exists() {
            paths.push(p);
        }
    }
    paths
}

/// Detect a single java executable: must exist, be a file, and respond to `-version`.
pub fn detect_one(path: &Path) -> Option<JavaInstallation> {
    if !path.exists() || !path.is_file() {
        return None;
    }
    let output = Command::new(path).arg("-version").output().ok()?;
    if !output.status.success() {
        return None;
    }
    let stderr = String::from_utf8_lossy(&output.stderr);
    let version = parse_java_version(&stderr);
    let vendor = parse_java_vendor(&stderr);
    let is_default = path
        .file_name()
        .and_then(|s| s.to_str())
        .map(|s| s == "java" || s == "java.exe")
        .unwrap_or(false);
    Some(JavaInstallation {
        path: path.to_path_buf(),
        version,
        vendor,
        architecture: std::env::consts::ARCH.to_string(),
        is_default,
    })
}

/// Parse the major Java version from `java -version` output.
/// Handles both old (1.8.0_xxx) and new (17.0.1) styles.
pub fn parse_java_version(out: &str) -> u32 {
    // Find a version-like token.
    let mut max: u32 = 0;
    for line in out.lines() {
        if let Some(idx) = line.find('"') {
            let tail = &line[idx + 1..];
            if let Some(end) = tail.find('"') {
                let v = &tail[..end];
                if let Some(major) = java_version_major(v) {
                    if major > max {
                        max = major;
                    }
                }
            }
        }
    }
    if max == 0 {
        // Fallback: look for "1.X.0" pattern
        for token in out.split_whitespace() {
            if let Some(major) = java_version_major(token) {
                if major > max {
                    max = major;
                }
            }
        }
    }
    max
}

fn java_version_major(v: &str) -> Option<u32> {
    let first = v.split(|c: char| !c.is_ascii_digit()).next()?;
    let n: u32 = first.parse().ok()?;
    if n >= 8 {
        return Some(n);
    }
    if n == 1 {
        // "1.8.0_xxx" -> 8
        let after = &v[first.len()..];
        if let Some(rest) = after.strip_prefix('.') {
            if let Some(dot) = rest.find('.') {
                if let Ok(m) = rest[..dot].parse::<u32>() {
                    return Some(m);
                }
            }
        }
    }
    Some(n)
}

fn parse_java_vendor(out: &str) -> String {
    // Look for known vendor markers anywhere in the output.
    let lower = out.to_ascii_lowercase();
    for marker in [
        "zulu", "temurin", "adoptium", "corretto", "graalvm", "openjdk",
        "microsoft", "oracle", "azul", "semeru", "liberica", "sapmachine",
    ] {
        if lower.contains(marker) {
            return marker.to_string();
        }
    }
    // Fall back: first parenthesized chunk.
    for line in out.lines() {
        if let Some(idx) = line.find('(') {
            let inside = &line[idx + 1..];
            if let Some(end) = inside.find(')') {
                return inside[..end].to_string();
            }
        }
    }
    "Unknown".to_string()
}

/// Target Java runtime major version recommended for a Minecraft major version.
pub fn target_java_version_for_mc(minecraft_major: u32) -> u32 {
    match minecraft_major {
        0..=16 => 8,
        17 => 17,
        18..=20 => 17,
        _ => 21,
    }
}

/// Resolve Adoptium Temurin download API URL for a Java major version.
pub fn resolve_adoptium_url(version: u32) -> LauncherResult<String> {
    let os = if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "mac"
    } else {
        "linux"
    };

    let arch = match std::env::consts::ARCH {
        "x86_64" => "x64",
        "aarch64" => "aarch64",
        "arm" => "arm",
        "x86" => "x32",
        other => other,
    };

    Ok(format!(
        "https://api.adoptium.net/v3/binary/latest/{version}/ga/{os}/{arch}/jdk/hotspot/normal/eclipse"
    ))
}

/// Find a java or javaw executable inside a directory recursively.
pub fn find_java_binary(dir: &Path) -> Option<PathBuf> {
    if !dir.exists() {
        return None;
    }

    #[cfg(target_os = "windows")]
    let names = ["javaw.exe", "java.exe"];
    #[cfg(not(target_os = "windows"))]
    let names = ["java"];

    // Direct check in bin/
    for name in &names {
        let p = dir.join("bin").join(name);
        if p.exists() && p.is_file() {
            return Some(p);
        }
    }

    // Direct check in Contents/Home/bin/ (macOS structure)
    #[cfg(target_os = "macos")]
    {
        for name in &names {
            let p = dir.join("Contents/Home/bin").join(name);
            if p.exists() && p.is_file() {
                return Some(p);
            }
        }
    }

    // Recursive search up to 4 levels deep
    fn search_recursive(d: &Path, names: &[&str], depth: usize) -> Option<PathBuf> {
        if depth > 4 {
            return None;
        }
        if let Ok(entries) = std::fs::read_dir(d) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    for name in names {
                        let candidate_bin = path.join("bin").join(name);
                        if candidate_bin.exists() && candidate_bin.is_file() {
                            return Some(candidate_bin);
                        }
                        let candidate = path.join(name);
                        if candidate.exists() && candidate.is_file() {
                            return Some(candidate);
                        }
                    }
                    if let Some(found) = search_recursive(&path, names, depth + 1) {
                        return Some(found);
                    }
                }
            }
        }
        None
    }

    search_recursive(dir, &names, 0)
}

/// Automatically download, extract, and register an OpenJDK Java runtime.
pub async fn download_runtime(
    version: u32,
    java_dir: &Path,
    catalog: &JavaCatalog,
) -> LauncherResult<JavaInstallation> {
    let dest = java_dir.join(format!("jdk-{}", version));

    // Check if already downloaded and valid
    if let Some(existing_bin) = find_java_binary(&dest) {
        if let Some(install) = detect_one(&existing_bin) {
            if install.version >= version {
                tracing::info!(
                    "Found already-downloaded Java {} runtime at {}",
                    install.version,
                    install.path.display()
                );
                catalog.add_manual(&install.path).ok();
                return Ok(install);
            }
        }
    }

    std::fs::create_dir_all(java_dir).map_err(|e| {
        LauncherError::Other(format!("Failed to create java directory {}: {e}", java_dir.display()))
    })?;

    let url = resolve_adoptium_url(version)?;
    tracing::info!("Downloading Java {} runtime from {}", version, url);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    let response = client
        .get(&url)
        .header(reqwest::header::USER_AGENT, "MC-Launcher/1.0")
        .send()
        .await
        .map_err(|e| LauncherError::Network(format!("Failed to request Java {version} from {url}: {e}")))?;

    if !response.status().is_success() {
        return Err(LauncherError::Network(format!(
            "Adoptium returned HTTP {} for Java {version}",
            response.status()
        )));
    }

    let is_zip = cfg!(target_os = "windows") || response.url().path().ends_with(".zip");
    let ext = if is_zip { "zip" } else { "tar.gz" };
    let temp_archive = java_dir.join(format!("adoptium-jdk-{version}-{}.{ext}", uuid::Uuid::new_v4()));

    let bytes = response
        .bytes()
        .await
        .map_err(|e| LauncherError::Network(format!("Failed to download Java {version} archive: {e}")))?;

    tokio::fs::write(&temp_archive, &bytes)
        .await
        .map_err(|e| LauncherError::Other(format!("Failed to write temp Java archive: {e}")))?;

    if dest.exists() {
        let _ = std::fs::remove_dir_all(&dest);
    }
    std::fs::create_dir_all(&dest).map_err(|e| {
        LauncherError::Other(format!("Failed to create JDK destination {}: {e}", dest.display()))
    })?;

    if is_zip {
        let file = std::fs::File::open(&temp_archive).map_err(|e| {
            LauncherError::Other(format!("Failed to open temp zip: {e}"))
        })?;
        let mut archive = zip::ZipArchive::new(file).map_err(|e| {
            LauncherError::Other(format!("Failed to parse zip archive: {e}"))
        })?;
        for i in 0..archive.len() {
            let mut entry = archive.by_index(i).map_err(|e| {
                LauncherError::Other(format!("Zip entry error: {e}"))
            })?;
            let outpath = match entry.enclosed_name() {
                Some(path) => dest.join(path),
                None => continue,
            };
            if entry.is_dir() {
                std::fs::create_dir_all(&outpath).ok();
            } else {
                if let Some(p) = outpath.parent() {
                    std::fs::create_dir_all(p).ok();
                }
                let mut outfile = std::fs::File::create(&outpath).map_err(|e| {
                    LauncherError::Other(format!("Failed to create extracted file {}: {e}", outpath.display()))
                })?;
                std::io::copy(&mut entry, &mut outfile).map_err(|e| {
                    LauncherError::Other(format!("Failed to write extracted file {}: {e}", outpath.display()))
                })?;
            }
        }
    } else {
        let status = Command::new("tar")
            .arg("-xzf")
            .arg(&temp_archive)
            .arg("-C")
            .arg(&dest)
            .status()
            .map_err(|e| LauncherError::Other(format!("Failed to run tar command: {e}")))?;
        if !status.success() {
            let _ = tokio::fs::remove_file(&temp_archive).await;
            return Err(LauncherError::Other(format!("tar extraction failed with status {:?}", status)));
        }
    }

    let _ = tokio::fs::remove_file(&temp_archive).await;

    let java_bin = find_java_binary(&dest).ok_or_else(|| {
        LauncherError::Other(format!("Could not locate java executable in extracted runtime at {}", dest.display()))
    })?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(meta) = std::fs::metadata(&java_bin) {
            let mut perms = meta.permissions();
            perms.set_mode(0o755);
            let _ = std::fs::set_permissions(&java_bin, perms);
        }
    }

    let install = detect_one(&java_bin).ok_or_else(|| {
        LauncherError::JavaInvalid {
            path: java_bin.clone(),
            reason: "Extracted java runtime did not respond to -version".to_string(),
        }
    })?;

    catalog.add_manual(&java_bin).ok();
    tracing::info!(
        "Successfully downloaded and registered Java {} runtime at {}",
        install.version,
        install.path.display()
    );

    Ok(install)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_openjdk_17() {
        let s = r#"openjdk version "17.0.9" 2023-10-17
OpenJDK Runtime Environment (build 17.0.9+9)
OpenJDK 64-Bit Server VM (build 17.0.9+9, mixed mode, sharing)
"#;
        assert_eq!(parse_java_version(s), 17);
    }

    #[test]
    fn parse_java_8_legacy() {
        let s = r#"java version "1.8.0_381"
Java(TM) SE Runtime Environment (build 1.8.0_381-b09)
Java HotSpot(TM) 64-Bit Server VM (build 25.381-b09, mixed mode)
"#;
        assert_eq!(parse_java_version(s), 8);
    }

    #[test]
    fn parse_vendor_zulu() {
        let s = r#"openjdk version "21.0.1" 2023-10-17 LTS
OpenJDK Runtime Environment Zulu21.30+15-CA (build 21.0.1+12-LTS)
OpenJDK 64-Bit Server VM Zulu21.30+15-CA (build 21.0.1+12-LTS, mixed mode, sharing)
"#;
        assert!(parse_java_vendor(s).to_ascii_lowercase().contains("zulu"));
    }
}
