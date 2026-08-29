//! Config schema migrations.
//!
//! Each migration is a pure function that takes the JSON value at version N
//! and returns the value at version N+1. The runner applies them in order.

use crate::error::{LauncherError, LauncherResult};
use serde_json::{json, Value};

/// Run migrations from `from` up to and including `CONFIG_VERSION`.
pub fn run(mut value: Value, from: u32) -> LauncherResult<Value> {
    let to = crate::paths::CONFIG_VERSION;
    let mut current = from;
    while current < to {
        current += 1;
        value = match current {
            1 => v0_to_v1(value)?,
            v => {
                return Err(LauncherError::ConfigMigration {
                    from: current,
                    to,
                    message: format!("No migration registered for v{}", v),
                })
            }
        };
    }
    // Stamp final version explicitly.
    value["version"] = json!(to);
    Ok(value)
}

/// v0 (unversioned) -> v1. Add `version`, fill missing fields with defaults.
fn v0_to_v1(mut value: Value) -> LauncherResult<Value> {
    if !value.is_object() {
        return Err(LauncherError::Config(
            "Config root must be an object".to_string(),
        ));
    }
    let obj = value.as_object_mut().unwrap();
    obj.insert("version".to_string(), json!(1));
    // Defaults for fields added in v1.
    if !obj.contains_key("theme") {
        obj.insert("theme".to_string(), json!("dark"));
    }
    if !obj.contains_key("language") {
        obj.insert("language".to_string(), json!("en-US"));
    }
    if !obj.contains_key("close_on_launch") {
        obj.insert("close_on_launch".to_string(), json!(false));
    }
    if !obj.contains_key("show_snapshots") {
        obj.insert("show_snapshots".to_string(), json!(false));
    }
    if !obj.contains_key("show_historical") {
        obj.insert("show_historical".to_string(), json!(false));
    }
    if !obj.contains_key("default_jvm_profile") {
        obj.insert("default_jvm_profile".to_string(), json!("balanced"));
    }
    if !obj.contains_key("default_ram_mb") {
        obj.insert("default_ram_mb".to_string(), json!(2048));
    }
    if !obj.contains_key("default_custom_jvm_args") {
        obj.insert("default_custom_jvm_args".to_string(), json!([]));
    }
    if !obj.contains_key("download_concurrency") {
        obj.insert("download_concurrency".to_string(), json!(8));
    }
    if !obj.contains_key("telemetry") {
        obj.insert("telemetry".to_string(), json!(false));
    }
    if !obj.contains_key("onboarded") {
        obj.insert("onboarded".to_string(), json!(false));
    }
    Ok(value)
}
