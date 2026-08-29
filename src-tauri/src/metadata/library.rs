//! Library, classifier, and rule resolution.
//!
//! Libraries are extracted from `libraries[]` in the version JSON, evaluated
//! against the current OS / architecture, and the resulting artifacts are
//! resolved to concrete download URLs and on-disk paths.

use crate::error::{LauncherError, LauncherResult};
use crate::metadata::version::DownloadArtifact;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Library {
    pub name: Option<String>,
    pub downloads: Option<LibraryDownloads>,
    pub natives: Option<NativeSpec>,
    pub extract: Option<ExtractSpec>,
    pub rules: Vec<Rule>,
    /// Hint: which side needs this. "client", "server", or both.
    #[serde(default)]
    pub side: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LibraryDownloads {
    pub artifact: Option<DownloadArtifact>,
    pub classifiers: Option<std::collections::HashMap<String, DownloadArtifact>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NativeSpec {
    pub linux: Option<String>,
    pub windows: Option<String>,
    pub osx: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractSpec {
    pub exclude: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Rule {
    pub action: RuleAction,
    pub os: Option<OsRule>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum RuleAction {
    Allow,
    Disallow,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct OsRule {
    pub name: Option<String>,
    pub version: Option<String>,
    pub arch: Option<String>,
}

/// A fully-resolved library artifact (after rules + classifier + side filter).
#[derive(Debug, Clone)]
pub struct ResolvedLibrary {
    pub path: String,
    pub url: String,
    pub sha1: String,
    pub size: u64,
    /// Native classifier name, if this is a native artifact.
    pub native: Option<String>,
    /// If true, this artifact must be extracted on disk to the natives dir.
    pub extract: bool,
    /// Files (substring match) to exclude when extracting.
    pub extract_excludes: Vec<String>,
    /// Original library name (group:artifact:version) for diagnostics.
    pub name: String,
}

/// Compute the relative path of a Maven coordinate.
pub fn maven_path(coord: &str) -> LauncherResult<String> {
    let parts: Vec<&str> = coord.split(':').collect();
    if parts.len() != 3 {
        return Err(LauncherError::Library(format!(
            "Invalid Maven coordinate: {}",
            coord
        )));
    }
    let group = parts[0].replace('.', "/");
    let artifact = parts[1];
    let version = parts[2];
    Ok(format!("{}/{}/{}/{}-{}.jar", group, artifact, version, artifact, version))
}

pub fn maven_path_with_classifier(coord: &str, classifier: &str, ext: &str) -> LauncherResult<String> {
    let parts: Vec<&str> = coord.split(':').collect();
    if parts.len() != 3 {
        return Err(LauncherError::Library(format!(
            "Invalid Maven coordinate: {}",
            coord
        )));
    }
    let group = parts[0].replace('.', "/");
    let artifact = parts[1];
    let version = parts[2];
    Ok(format!(
        "{}/{}/{}/{}-{}-{}.{}",
        group, artifact, version, artifact, version, classifier, ext
    ))
}

impl Library {
    /// Filter libraries by current OS / arch and classifier side.
    /// Returns the list of resolved artifacts that must be present.
    pub fn resolve_all(
        libraries: &[Library],
        os_name: &str,
        os_arch: &str,
        include_server: bool,
    ) -> Vec<ResolvedLibrary> {
        let mut out = Vec::new();
        for lib in libraries {
            // Side filter
            if let Some(side) = &lib.side {
                if side == "server" && !include_server {
                    continue;
                }
            }
            if !eval_rules(&lib.rules, os_name, os_arch) {
                continue;
            }

            // Natives: classifiers map, key is the classifier name.
            // Mojang uses classifier names like "natives-windows", "natives-linux".
            let mut added = false;
            if let Some(dls) = &lib.downloads {
                if let Some(classifiers) = &dls.classifiers {
                    if let Some(natives) = &lib.natives {
                        let key = match os_name {
                            "windows" => natives.windows.as_deref(),
                            "linux" => natives.linux.as_deref(),
                            "osx" => natives.osx.as_deref(),
                            _ => None,
                        };
                        if let Some(key) = key {
                            if let Some(art) = classifiers.get(key) {
                                let path = art
                                    .url
                                    .rsplit_once("/")
                                    .map(|(_, p)| p.to_string())
                                    .unwrap_or_else(|| art.url.clone());
                                out.push(ResolvedLibrary {
                                    path,
                                    url: art.url.clone(),
                                    sha1: art.sha1.clone(),
                                    size: art.size,
                                    native: Some(key.to_string()),
                                    extract: lib.extract.is_some(),
                                    extract_excludes: lib
                                        .extract
                                        .as_ref()
                                        .map(|e| e.exclude.clone())
                                        .unwrap_or_default(),
                                    name: lib.name.clone().unwrap_or_default(),
                                });
                                added = true;
                            }
                        }
                    }
                }
            }
            // Plain artifact (jar) — skip if we already added a native.
            if !added {
                if let Some(dls) = &lib.downloads {
                    if let Some(art) = &dls.artifact {
                        let path = art
                            .url
                            .rsplit_once("/")
                            .map(|(_, p)| p.to_string())
                            .unwrap_or_else(|| art.url.clone());
                        out.push(ResolvedLibrary {
                            path,
                            url: art.url.clone(),
                            sha1: art.sha1.clone(),
                            size: art.size,
                            native: None,
                            extract: false,
                            extract_excludes: Vec::new(),
                            name: lib.name.clone().unwrap_or_default(),
                        });
                    }
                }
            }
        }
        out
    }
}

/// Evaluate Mojang's `rules` against the current OS.
pub fn eval_rules(rules: &[Rule], os_name: &str, _os_arch: &str) -> bool {
    if rules.is_empty() {
        return true;
    }
    // Mojang rules are OR-combined: any allow permits, but a disallow on a
    // matching OS removes the lib.
    let mut allowed = false;
    let mut matched = false;
    for r in rules {
        let matches = r
            .os
            .as_ref()
            .map(|o| o.name.as_deref().map(|n| n == os_name).unwrap_or(true))
            .unwrap_or(true);
        if !matches {
            continue;
        }
        matched = true;
        match r.action {
            RuleAction::Allow => allowed = true,
            RuleAction::Disallow => return false,
        }
    }
    if matched {
        allowed
    } else {
        // No OS-specific rule matched; allow.
        true
    }
}

/// Convert a resolved library's relative path into an absolute on-disk path
/// under the runtime directory.
pub fn local_path(runtime_dir: &std::path::Path, lib: &ResolvedLibrary) -> PathBuf {
    runtime_dir.join("libraries").join(&lib.path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maven_path_basic() {
        assert_eq!(
            maven_path("org.lwjgl:lwjgl:3.3.3").unwrap(),
            "org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3.jar"
        );
    }

    #[test]
    fn maven_path_uses_classifier() {
        assert_eq!(
            maven_path_with_classifier("org.lwjgl:lwjgl:3.3.3", "natives-windows", "jar").unwrap(),
            "org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3-natives-windows.jar"
        );
    }

    #[test]
    fn rules_no_match_allows() {
        let rules = vec![];
        assert!(eval_rules(&rules, "windows", "x86_64"));
    }

    #[test]
    fn rules_disallow_blocks() {
        let rules = vec![Rule {
            action: RuleAction::Disallow,
            os: Some(OsRule {
                name: Some("linux".to_string()),
                version: None,
                arch: None,
            }),
        }];
        assert!(!eval_rules(&rules, "linux", "x86_64"));
        assert!(eval_rules(&rules, "windows", "x86_64"));
    }

    #[test]
    fn rules_allow_specific_os() {
        let rules = vec![Rule {
            action: RuleAction::Allow,
            os: Some(OsRule {
                name: Some("windows".to_string()),
                version: None,
                arch: None,
            }),
        }];
        assert!(eval_rules(&rules, "windows", "x86_64"));
        // Allow rule with no matching OS: falls through to "no rule matched" => allow.
        assert!(eval_rules(&rules, "linux", "x86_64"));
    }
}
