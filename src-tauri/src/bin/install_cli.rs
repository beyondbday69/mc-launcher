//! Headless install driver for CI smoke tests.
//!
//! This binary exercises the same install path the Tauri UI uses —
//! `AppState::bootstrap`, `InstanceStore::create`, `mods::install_for_instance`,
//! `launcher::prepare::prepare` — but driven by CLI args instead of
//! user interaction. It writes everything into the resolved `AppPaths`,
//! which honours the same env vars as the GUI (`XDG_DATA_HOME` on Linux,
//! `APPDATA` on Windows, `~/Library/Application Support` on macOS), so
//! a follow-up GUI launch under the same env will pick up the
//! installed instance and show it on the home screen.
//!
//! Usage:
//!   install-cli --version 1.21.4 --instance-name smoke
//!   install-cli --version 1.21.4 --fabric 0.16.5 --instance-name smoke
//!
//! Exit codes:
//!   0  success
//!   1  bad arguments
//!   2  install / download failure
//!
//! Intended for `tauri-linux-smoke` (and friends) to pre-populate an
//! instance before launching the GUI for a screenshot. The GUI itself
//! is the verifier — if the install is broken, the home screen will
//! be empty.

use mc_launcher::downloads::Downloader;
use mc_launcher::error::{LauncherError, LauncherResult};
use mc_launcher::instances::{Instance, InstanceStore, ModLoaderConfig};
use mc_launcher::launcher::prepare;
use mc_launcher::metadata::MetadataCache;
use mc_launcher::state::AppState;
use std::process::ExitCode;
use std::time::Instant;

#[derive(Debug)]
struct Args {
    version: String,
    instance_name: String,
    /// Fabric loader version, e.g. "0.16.5". When `None`, no mod loader
    /// is installed and the instance stays vanilla.
    fabric: Option<String>,
}

fn parse_args() -> Result<Args, String> {
    let mut version: Option<String> = None;
    let mut instance_name: Option<String> = None;
    let mut fabric: Option<String> = None;

    let mut it = std::env::args().skip(1);
    while let Some(a) = it.next() {
        match a.as_str() {
            "--version" => version = it.next(),
            "-v" => version = it.next(),
            "--instance-name" => instance_name = it.next(),
            "-n" => instance_name = it.next(),
            "--fabric" => fabric = it.next(),
            "-f" => fabric = it.next(),
            "--help" | "-h" => {
                eprintln!(
                    "usage: install-cli --version <MC> [--fabric <loader>] [--instance-name <name>]"
                );
                std::process::exit(0);
            }
            other => return Err(format!("unknown arg: {other}")),
        }
    }
    let version = version.ok_or_else(|| "missing --version".to_string())?;
    let instance_name = instance_name.unwrap_or_else(|| "smoke-instance".to_string());
    Ok(Args {
        version,
        instance_name,
        fabric,
    })
}

#[tokio::main(flavor = "current_thread")]
async fn main() -> ExitCode {
    let args = match parse_args() {
        Ok(a) => a,
        Err(e) => {
            eprintln!("install-cli: {e}");
            eprintln!("try --help");
            return ExitCode::from(1);
        }
    };

    let total = Instant::now();
    eprintln!(
        "[install-cli] starting install: version={} fabric={:?} name={}",
        args.version, args.fabric, args.instance_name
    );

    // 1. Resolve the same data dir the GUI uses. Honours XDG_DATA_HOME
    //    on Linux, APPDATA on Windows.
    let paths = match mc_launcher::paths::AppPaths::resolve() {
        Ok(p) => p,
        Err(e) => {
            eprintln!("[install-cli] failed to resolve AppPaths: {e}");
            return ExitCode::from(2);
        }
    };
    eprintln!("[install-cli] data_dir: {}", paths.data_dir.display());

    // 2. Bootstrap state (loads config + existing instances).
    let state = match AppState::bootstrap(paths.clone()) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("[install-cli] AppState::bootstrap failed: {e}");
            return ExitCode::from(2);
        }
    };

    // 3. Create (or re-use) the instance. If an instance with this
    //    name already exists, reuse it so re-runs are idempotent.
    let store: &InstanceStore = state.instances();
    let existing: Option<Instance> = store
        .list()
        .into_iter()
        .find(|i| i.name == args.instance_name);
    let inst = match existing {
        Some(i) => {
            eprintln!(
                "[install-cli] reusing existing instance id={} name={}",
                i.id, i.name
            );
            i
        }
        None => match store.create(&args.instance_name, &args.version) {
            Ok(i) => {
                eprintln!("[install-cli] created instance id={}", i.id);
                i
            }
            Err(e) => {
                eprintln!("[install-cli] instance create failed: {e}");
                return ExitCode::from(2);
            }
        },
    };

    // 4. If a Fabric loader was requested, set the loader config on
    //    the instance and install the loader profile.
    let mut inst = inst;
    if let Some(loader_ver) = &args.fabric {
        inst.mod_loader = Some(ModLoaderConfig {
            kind: "fabric".to_string(),
            version: loader_ver.clone(),
        });
        if let Err(e) = store.update(inst.clone()) {
            eprintln!("[install-cli] instance.update (set loader) failed: {e}");
            return ExitCode::from(2);
        }
        let downloader = Downloader::new(paths.cache_dir.clone());
        let t = Instant::now();
        eprintln!(
            "[install-cli] installing fabric loader {} for mc {} ...",
            loader_ver, args.version
        );
        if let Err(e) = mc_launcher::mods::install_for_instance(
            &downloader,
            &inst,
            &paths.runtime_dir,
        )
        .await
        {
            eprintln!("[install-cli] install_for_instance failed: {e}");
            return ExitCode::from(2);
        }
        eprintln!(
            "[install-cli] fabric loader installed in {:.1}s",
            t.elapsed().as_secs_f64()
        );
    }

    // 5. Pre-fetch the version JSON + libraries + client JAR + assets.
    //    prepare::prepare is the same function the launch path uses, so
    //    anything that succeeds here will be ready to launch in the GUI.
    let downloader = Downloader::new(paths.cache_dir.clone());
    let metadata = MetadataCache::new(paths.cache_dir.join("metadata"));
    let t = Instant::now();
    eprintln!(
        "[install-cli] preparing {} (client + libraries + assets) ...",
        args.version
    );
    let prepared = match prepare::prepare(&downloader, &metadata, &paths.runtime_dir, &inst).await
    {
        Ok(p) => p,
        Err(e) => {
            // prepare::prepare takes a non-modifier &Instance, but we
            // need to allow the modded profile too. Wrap and retry.
            eprintln!(
                "[install-cli] prepare::prepare returned {e}; trying modded profile fallback"
            );
            match prepare_modded(&downloader, &metadata, &paths, &inst).await {
                Ok(p) => p,
                Err(e2) => {
                    eprintln!("[install-cli] modded fallback also failed: {e2}");
                    return ExitCode::from(2);
                }
            }
        }
    };
    eprintln!(
        "[install-cli] prepared {} in {:.1}s (asset_index={})",
        prepared.version.id,
        t.elapsed().as_secs_f64(),
        prepared.asset_index_id
    );

    eprintln!(
        "[install-cli] done in {:.1}s — instance '{}' is ready",
        total.elapsed().as_secs_f64(),
        inst.name
    );
    ExitCode::SUCCESS
}

/// Fallback path for instances with a mod loader. Looks up the loader
/// profile's `inheritsFrom` and prepares that vanilla version (the
/// loader jars were already downloaded by `install_for_instance`).
async fn prepare_modded(
    downloader: &Downloader,
    metadata: &MetadataCache,
    paths: &mc_launcher::paths::AppPaths,
    inst: &Instance,
) -> LauncherResult<prepare::PreparedLaunch> {
    // The loader wrote a profile JSON at
    //   <runtime>/versions/<profile_id>/<profile_id>.json
    // which inherits from the vanilla version id. Read it and use
    // inheritsFrom as the version to prepare.
    let profile_id = format!(
        "fabric-loader-{}-{}",
        inst.mod_loader
            .as_ref()
            .map(|m| m.version.clone())
            .unwrap_or_default(),
        inst.version
    );
    let profile_path = paths
        .runtime_dir
        .join("versions")
        .join(&profile_id)
        .join(format!("{profile_id}.json"));
    let raw = tokio::fs::read_to_string(&profile_path)
        .await
        .map_err(|e| LauncherError::Other(format!("read profile {profile_path:?}: {e}")))?;
    let v: serde_json::Value = serde_json::from_str(&raw)
        .map_err(|e| LauncherError::Other(format!("parse profile: {e}")))?;
    let inherits_from = v
        .get("inheritsFrom")
        .and_then(|x| x.as_str())
        .ok_or_else(|| LauncherError::Other("profile missing inheritsFrom".to_string()))?
        .to_string();
    // Synthesize an Instance whose `version` is the vanilla id so the
    // existing prepare path picks it up.
    let vanilla = Instance {
        id: inst.id.clone(),
        name: inst.name.clone(),
        version: inherits_from,
        mod_loader: None,
        game_dir: inst.game_dir.clone(),
        java_path: inst.java_path.clone(),
        ram_mb: inst.ram_mb,
        jvm_profile: inst.jvm_profile.clone(),
        custom_jvm_args: inst.custom_jvm_args.clone(),
        resolution_width: inst.resolution_width,
        resolution_height: inst.resolution_height,
        fullscreen: inst.fullscreen,
        env: inst.env.clone(),
        game_dir_override: inst.game_dir_override.clone(),
        color: inst.color.clone(),
        notes: inst.notes.clone(),
        created: inst.created,
        last_played: inst.last_played,
        play_time_secs: inst.play_time_secs,
        schema: inst.schema,
    };
    prepare::prepare(downloader, metadata, &paths.runtime_dir, &vanilla).await
}
