//! Integration tests for the launcher backend.
//!
//! These exercise the public API of `mc_launcher_lib` and verify:
//!  * JVM profile argument construction.
//!  * Library Maven path computation.
//!  * Rule evaluation.
//!  * Argument placeholder substitution.
//!  * Error code stability + serialization.
//!  * Secret redaction.
//!  * Path traversal detection.
//!  * Config save/load + migration.
//!  * Instance create/delete/duplicate-name handling.
//!  * Java version parsing.

use mc_launcher_lib::error::LauncherError;
use mc_launcher_lib::launcher::jvm::JvmProfile;
use mc_launcher_lib::metadata::inherits;
use mc_launcher_lib::metadata::library;
use mc_launcher_lib::security;
use std::collections::HashMap;
use std::path::PathBuf;

#[test]
fn jvm_default_includes_g1gc() {
    let v = JvmProfile::Default.args(17, 2048);
    assert!(v.iter().any(|s| s.contains("UseG1GC")));
}

#[test]
fn jvm_low_ram_caps_initial_heap() {
    let v = JvmProfile::LowRam.args(17, 1024);
    assert!(v.contains(&"-Xms256m".to_string()));
    assert!(v.contains(&"-Xmx1024m".to_string()));
}

#[test]
fn jvm_performance_uses_parallel_ref_proc() {
    let v = JvmProfile::Performance.args(21, 4096);
    assert!(v.iter().any(|s| s.contains("ParallelRefProcEnabled")));
}

#[test]
fn jvm_custom_is_empty() {
    assert!(JvmProfile::Custom.args(17, 2048).is_empty());
}

#[test]
fn jvm_java_8_adds_permgen() {
    let v = JvmProfile::Default.args(8, 2048);
    assert!(v.iter().any(|s| s.contains("PermSize")));
}

#[test]
fn jvm_java_17_skips_permgen() {
    let v = JvmProfile::Default.args(17, 2048);
    assert!(!v.iter().any(|s| s.contains("PermSize")));
}

#[test]
fn jvm_balanced_is_safe_for_17_and_21() {
    for maj in [17, 21] {
        let v = JvmProfile::Balanced.args(maj, 4096);
        assert!(v.contains(&format!("-Xmx{}m", 4096)));
        assert!(v.iter().any(|s| s.contains("UseG1GC")));
    }
}

#[test]
fn library_maven_path_format() {
    let p = library::maven_path("org.lwjgl:lwjgl:3.3.3").unwrap();
    assert_eq!(p, "org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3.jar");
}

#[test]
fn library_maven_path_classifier() {
    let p =
        library::maven_path_with_classifier("org.lwjgl:lwjgl:3.3.3", "natives-windows", "jar")
            .unwrap();
    assert_eq!(
        p,
        "org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3-natives-windows.jar"
    );
}

#[test]
fn rules_block_matching_os() {
    use library::{eval_rules, OsRule, Rule, RuleAction};
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
fn inherits_substitute_basic() {
    let mut ctx: HashMap<&'static str, String> = HashMap::new();
    ctx.insert("name", "Steve".to_string());
    let out = inherits::substitute("--username ${name}", &ctx);
    assert_eq!(out, "--username Steve");
}

#[test]
fn inherits_default_value() {
    let ctx: HashMap<&'static str, String> = HashMap::new();
    let out = inherits::substitute("--w ${w:-800}", &ctx);
    assert_eq!(out, "--w 800");
}

#[test]
fn inherits_keeps_unknown() {
    let ctx: HashMap<&'static str, String> = HashMap::new();
    let out = inherits::substitute("--x ${unknown}", &ctx);
    assert_eq!(out, "--x ${unknown}");
}

#[test]
fn error_codes_are_stable() {
    let e = LauncherError::JavaNotFound { recommended: 17 };
    assert_eq!(e.code(), "E_JAVA_NOT_FOUND");
    let e = LauncherError::HashMismatch {
        expected: "a".into(),
        actual: "b".into(),
        path: PathBuf::from("/x"),
    };
    assert_eq!(e.code(), "E_HASH_MISMATCH");
    let e = LauncherError::PathTraversal(PathBuf::from("/a/../b"));
    assert_eq!(e.code(), "E_PATH_TRAVERSAL");
    let e = LauncherError::Cancelled;
    assert_eq!(e.code(), "E_CANCELLED");
}

#[test]
fn error_serializes_with_code_and_suggestion() {
    let e = LauncherError::JavaNotFound { recommended: 17 };
    let j = serde_json::to_value(&e).unwrap();
    assert_eq!(j["code"], "E_JAVA_NOT_FOUND");
    assert!(j["message"].as_str().unwrap().contains("Java"));
    assert!(j["suggestion"].is_string());
}

#[test]
fn security_redact_bearer() {
    let s = "Authorization: Bearer abcdefghijklmnopqrstuvwxyz1234567890";
    let r = security::redact(s);
    assert!(r.contains("<redacted-token>"));
    assert!(!r.contains("abcdefghijklmnopqrstuvwxyz1234567890"));
}

#[test]
fn security_redact_access_token() {
    let s = r#"{"access_token":"abcdefghijklmnop","x":1}"#;
    let r = security::redact(s);
    assert!(r.contains("<redacted>"));
    assert!(!r.contains("abcdefghijklmnop"));
}

#[test]
fn security_redact_refresh_token() {
    let s = r#"{"refresh_token":"abcdefghijklmnop","x":1}"#;
    let r = security::redact(s);
    assert!(r.contains("<redacted>"));
    assert!(!r.contains("abcdefghijklmnop"));
}

#[test]
fn security_path_traversal_detected() {
    assert!(security::validate_path(&PathBuf::from("/foo/../bar")).is_err());
    assert!(security::validate_path(&PathBuf::from("/foo/bar")).is_ok());
    assert!(security::validate_path(&PathBuf::from("relative")).is_err());
}

#[test]
fn config_default_loads_from_missing_file() {
    let dir = tempdir();
    let paths = make_paths(&dir);
    let c = mc_launcher_lib::config::LauncherConfig::load(&paths).unwrap();
    assert_eq!(c.version, mc_launcher_lib::paths::CONFIG_VERSION);
    assert_eq!(c.default_jvm_profile, "balanced");
    assert_eq!(c.default_ram_mb, 2048);
}

#[test]
fn config_save_and_reload_preserves_values() {
    let dir = tempdir();
    let paths = make_paths(&dir);
    let mut c = mc_launcher_lib::config::LauncherConfig::default();
    c.default_ram_mb = 4096;
    c.default_jvm_profile = "performance".to_string();
    c.save(&paths).unwrap();
    let c2 = mc_launcher_lib::config::LauncherConfig::load(&paths).unwrap();
    assert_eq!(c2.default_ram_mb, 4096);
    assert_eq!(c2.default_jvm_profile, "performance");
}

#[test]
fn config_migrates_from_v0() {
    let dir = tempdir();
    let paths = make_paths(&dir);
    // Write an unversioned config (v0).
    let cfg_path = paths.config_dir.join("config.json");
    std::fs::create_dir_all(&paths.config_dir).unwrap();
    std::fs::write(
        &cfg_path,
        r#"{
            "theme": "dark",
            "default_ram_mb": 4096,
            "default_jvm_profile": "performance"
        }"#,
    )
    .unwrap();
    let c = mc_launcher_lib::config::LauncherConfig::load(&paths).unwrap();
    assert_eq!(c.version, 1);
    assert_eq!(c.theme, "dark");
    assert_eq!(c.default_ram_mb, 4096);
    assert_eq!(c.default_jvm_profile, "performance");
}

#[test]
fn instance_create_and_delete() {
    let dir = tempdir();
    let paths = make_paths(&dir);
    let store = mc_launcher_lib::instances::InstanceStore::new(paths.clone());
    let inst = store.create("Test", "1.21.4").unwrap();
    assert_eq!(inst.name, "Test");
    assert!(inst.game_dir.exists());
    store.delete(&inst.id).unwrap();
    assert!(!inst.game_dir.exists());
}

#[test]
fn instance_duplicate_name_rejected() {
    let dir = tempdir();
    let paths = make_paths(&dir);
    let store = mc_launcher_lib::instances::InstanceStore::new(paths.clone());
    let _ = store.create("Test", "1.21.4").unwrap();
    let res = store.create("test", "1.21.4");
    assert!(matches!(res, Err(LauncherError::InstanceExists(_))));
}

#[test]
fn instance_duplicate_copies_fields() {
    let dir = tempdir();
    let paths = make_paths(&dir);
    let store = mc_launcher_lib::instances::InstanceStore::new(paths.clone());
    let mut inst = store.create("Original", "1.21.4").unwrap();
    inst.ram_mb = Some(4096);
    inst.jvm_profile = "performance".to_string();
    inst.color = "#ff0000".to_string();
    store.update(inst.clone()).unwrap();
    let copy = store.duplicate(&inst.id, "Copy").unwrap();
    assert_eq!(copy.ram_mb, Some(4096));
    assert_eq!(copy.jvm_profile, "performance");
    assert_eq!(copy.color, "#ff0000");
    assert_ne!(copy.id, inst.id);
}

#[test]
fn java_version_parsing_openjdk() {
    let s = r#"openjdk version "17.0.9" 2023-10-17
OpenJDK Runtime Environment (build 17.0.9+9)
OpenJDK 64-Bit Server VM (build 17.0.9+9, mixed mode, sharing)
"#;
    assert_eq!(mc_launcher_lib::java::parse_java_version(s), 17);
}

#[test]
fn java_version_parsing_legacy() {
    let s = r#"java version "1.8.0_381"
Java(TM) SE Runtime Environment (build 1.8.0_381-b09)
Java HotSpot(TM) 64-Bit Server VM (build 25.381-b09, mixed mode)
"#;
    assert_eq!(mc_launcher_lib::java::parse_java_version(s), 8);
}

#[test]
fn java_version_parsing_zulu_21() {
    let s = r#"openjdk version "21.0.1" 2023-10-17 LTS
OpenJDK Runtime Environment Zulu21.30+15-CA (build 21.0.1+12-LTS)
OpenJDK 64-Bit Server VM Zulu21.30+15-CA (build 21.0.1+12-LTS, mixed mode, sharing)
"#;
    assert_eq!(mc_launcher_lib::java::parse_java_version(s), 21);
}

#[test]
fn fabric_loader_kind_parses() {
    use mc_launcher_lib::mods::LoaderKind;
    assert_eq!(LoaderKind::parse("fabric"), Some(LoaderKind::Fabric));
    assert_eq!(LoaderKind::parse("FORGE"), Some(LoaderKind::Forge));
    assert_eq!(LoaderKind::parse("NeoForge"), Some(LoaderKind::NeoForge));
    assert_eq!(LoaderKind::parse("quilt"), Some(LoaderKind::Quilt));
    assert_eq!(LoaderKind::parse("unknown"), None);
}

#[test]
fn pkce_pair_is_distinct() {
    let (a, b) = mc_launcher_lib::auth::microsoft::pkce_pair();
    let (c, d) = mc_launcher_lib::auth::microsoft::pkce_pair();
    assert_ne!(a, c);
    assert_ne!(b, d);
    assert!(!a.is_empty() && !b.is_empty());
}

fn tempdir() -> PathBuf {
    let base = std::env::temp_dir().join(format!(
        "mc_launcher_test_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    std::fs::create_dir_all(&base).unwrap();
    base
}

fn make_paths(root: &PathBuf) -> mc_launcher_lib::paths::AppPaths {
    mc_launcher_lib::paths::AppPaths {
        data_dir: root.clone(),
        config_dir: root.join("config"),
        cache_dir: root.join("cache"),
        log_dir: root.join("logs"),
        runtime_dir: root.join("runtime"),
        instances_dir: root.join("instances"),
        java_dir: root.join("java"),
    }
}
