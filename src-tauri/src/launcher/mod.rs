//! JVM launch pipeline.
//!
//! Given an instance and a downloaded runtime (version JSON, libraries,
//! natives, assets, client JAR), this module:
//!  1. Resolves which libraries / natives are needed for the current OS.
//!  2. Extracts native `.so`/`.dll`/`.dylib` files into the natives dir.
//!  3. Builds the dynamic classpath (JAR list joined with `;` on Windows,
//!     `:` elsewhere).
//!  4. Builds JVM arguments using the user's preset and replaces Minecraft
//!     placeholders like `${classpath}`.
//!  5. Builds game arguments and replaces their placeholders.
//!  6. Spawns Java as a child process, capturing stdout/stderr.
//!  7. Tracks the process in the `ProcessRegistry` so it can be killed
//!     from the UI.
//!
//! This module NEVER hardcodes classpaths, library names, or Java paths.

use crate::auth::Account;
use crate::error::{LauncherError, LauncherResult};
use crate::instances::Instance;
use crate::metadata::inherits;
use crate::metadata::library::{self, ResolvedLibrary};
use crate::metadata::version::{Arg, RuleAction, VersionMeta};
use crate::metadata::MetadataCache;
use crate::downloads::Downloader;
use crate::process::ProcessRegistry;
use crate::LauncherResult as LRes;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::mpsc;
use tracing::info;

pub mod jvm;
pub mod prepare;

/// All inputs needed to launch a Minecraft instance.
pub struct LaunchRequest {
    pub instance: Instance,
    pub version: VersionMeta,
    pub version_url: String,
    pub auth: Account,
    pub java_path: PathBuf,
    pub java_major: u32,
    pub max_ram_mb: u32,
    pub resolution: Option<(u32, u32)>,
    pub downloads: Arc<Downloader>,
    pub metadata: Arc<MetadataCache>,
    pub runtime_dir: PathBuf,
    /// Path to the resolved Minecraft client JAR. **Must be on the
    /// JVM classpath** — `net.minecraft.client.main.Main` (and the
    /// Fabric Knot shim for modded launches) live in this JAR, not
    /// in the `libraries/` tree. `prepare::prepare` returns this in
    /// `PreparedLaunch::client_jar`; callers must thread it through.
    pub client_jar: PathBuf,
    pub asset_index_path: PathBuf,
    pub asset_index_id: String,
    pub natives_dir: PathBuf,
}

/// Launch a Minecraft instance. Returns a `LaunchHandle` that can be used
/// to track the running process and send a kill signal.
pub async fn launch(req: LaunchRequest, registry: &ProcessRegistry) -> LauncherResult<LaunchHandle> {
    let LaunchRequest {
        instance,
        version,
        version_url: _,
        auth,
        java_path,
        java_major,
        max_ram_mb,
        resolution,
        downloads,
        metadata: _,
        runtime_dir,
        client_jar,
        asset_index_path,
        asset_index_id,
        natives_dir,
    } = req;

    let game_dir = instance.effective_game_dir();
    tokio::fs::create_dir_all(&game_dir).await?;
    tokio::fs::create_dir_all(&natives_dir).await?;

    // 1. Resolve libraries.
    let os_name = os_name();
    let os_arch = std::env::consts::ARCH;
    let resolved: Vec<ResolvedLibrary> = library::Library::resolve_all(
        &version.libraries,
        os_name,
        os_arch,
        false,
    );

    // 2. Build classpath from the client JAR + already-downloaded
    //    libraries. The client JAR must come first because
    //    `net.minecraft.client.main.Main` (and the Fabric Knot shim
    //    for modded launches) live in it; without it, Java exits
    //    immediately with ClassNotFoundException.
    let mut classpath_entries: Vec<String> = Vec::with_capacity(resolved.len() + 1);
    classpath_entries.push(path_to_classpath(&client_jar));
    for lib in resolved
        .iter()
        .filter(|lib| lib.native.is_none() && !lib.extract)
    {
        let p = runtime_dir.join("libraries").join(&lib.path);
        if p.exists() {
            classpath_entries.push(path_to_classpath(&p));
        }
    }
    let classpath = classpath_entries.join(classpath_separator());

    // 3. Extract natives (idempotent).
    info!(natives = %natives_dir.display(), "Extracting natives");
    extract_natives(&resolved, &runtime_dir, &natives_dir).await?;

    // 4. Build JVM args (preset + classpath + natives path + placeholders).
    let ram = instance.effective_ram_mb(max_ram_mb);
    let profile = jvm::JvmProfile::resolve(&instance.jvm_profile);
    let mut jvm_args: Vec<String> = profile.args(java_major, ram);
    // Append user custom args.
    if instance.jvm_profile == "custom" {
        jvm_args.extend(instance.custom_jvm_args.iter().cloned());
    }
    // Natives path.
    jvm_args.push(format!(
        "-Djava.library.path={}",
        path_to_classpath(&natives_dir)
    ));
    jvm_args.push(format!("-Dorg.lwjgl.librarypath={}", path_to_classpath(&natives_dir)));

    // 5. Build placeholder context.
    let (w, h) = resolution.unwrap_or((854, 480));
    let context = inherits::build_context(
        &auth.username,
        &auth.uuid,
        &auth.access_token,
        &version.id,
        &game_dir,
        &runtime_dir.join("assets"),
        &asset_index_id,
        if auth.is_msa { "msa" } else { "legacy" },
        "release",
        Some(w),
        Some(h),
        &natives_dir,
        "MCLauncher",
        env!("CARGO_PKG_VERSION"),
        &classpath,
    );

    // 6. Build classpath arg as a JVM arg.
    jvm_args.push(format!("-cp"));
    jvm_args.push(classpath.clone());

    // 7. Build final JVM arg list with placeholders replaced.
    let mut final_jvm_args: Vec<String> = jvm_args
        .into_iter()
        .map(|a| inherits::substitute(&a, &context))
        .collect();

    // 8. Build game args.
    let game_args = build_game_args(&version, &context)?;

    // 9. Logging config (log4j.xml) — append to JVM args.
    if let Some(logging) = &version.logging {
        if let Some(client) = &logging.client {
            let log_path = game_dir.join(format!("logs/{}", client.file.id));
            // Download log4j config if missing.
            let _ = downloads
                .download_verified(
                    &client.file.url,
                    &log_path,
                    &client.file.sha1,
                    client.file.size,
                )
                .await;
            let substituted = inherits::substitute(&client.argument, &context);
            final_jvm_args
                .extend(substituted.split_whitespace().map(|s| s.to_string()));
        }
    }

    // 10. Launch.
    let mut cmd = Command::new(&java_path);
    cmd.args(&final_jvm_args)
        .arg(&version.main_class)
        .args(&game_args)
        .current_dir(&game_dir)
        .env("INST_NAME", &instance.name)
        .env("INST_ID", &instance.id)
        .env("GAME_DIR", &game_dir)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    // (final_jvm_args consumed above)
    // Custom env (overrides).
    for (k, v) in &instance.env {
        cmd.env(k, v);
    }
    info!(
        java = %java_path.display(),
        main = %version.main_class,
        args = final_jvm_args.len() + game_args.len() + 1,
        "Spawning Minecraft"
    );
    let mut child = cmd.spawn().map_err(|e| {
        LauncherError::Launch(format!("Failed to spawn Java: {e}"))
    })?;
    let pid = child.id().ok_or_else(|| {
        LauncherError::Process("Child process has no PID".to_string())
    })?;
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let (log_tx, log_rx) = mpsc::unbounded_channel::<LogLine>();
    if let Some(stdout) = stdout {
        spawn_log_reader("stdout", stdout, log_tx.clone());
    }
    if let Some(stderr) = stderr {
        spawn_log_reader("stderr", stderr, log_tx.clone());
    }

    let handle = LaunchHandle::new(
        instance.id.clone(),
        instance.name.clone(),
        pid,
        child,
        log_rx,
    );
    registry.register(handle.clone());
    Ok(handle)
}

fn path_to_classpath(p: &Path) -> String {
    p.to_string_lossy().into_owned()
}

#[cfg(target_os = "windows")]
fn classpath_separator() -> &'static str {
    ";"
}
#[cfg(not(target_os = "windows"))]
fn classpath_separator() -> &'static str {
    ":"
}

fn os_name() -> &'static str {
    if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "osx"
    } else {
        "linux"
    }
}

/// Build the game-arg list, applying rules and substituting placeholders.
fn build_game_args(
    version: &VersionMeta,
    context: &HashMap<&'static str, String>,
) -> LauncherResult<Vec<String>> {
    let mut out = Vec::new();
    if let Some(args) = &version.arguments {
        for arg in &args.game {
            if !arg_allowed(arg, context) {
                continue;
            }
            for v in arg.strings() {
                out.push(inherits::substitute(&v, context));
            }
        }
    } else if let Some(legacy) = &version.minecraft_arguments {
        // 1.13 and below.
        for tok in legacy.split_whitespace() {
            out.push(inherits::substitute(tok, context));
        }
    }
    Ok(out)
}

fn arg_allowed(arg: &Arg, _context: &HashMap<&'static str, String>) -> bool {
    let os = std::env::consts::OS;
    let os_name = match os {
        "windows" => "windows",
        "macos" => "osx",
        _ => "linux",
    };
    for r in arg.rules() {
        let matches = r
            .os
            .as_ref()
            .map(|o| o.name.as_deref().map(|n| n == os_name).unwrap_or(true))
            .unwrap_or(true);
        if !matches {
            continue;
        }
        match r.action {
            RuleAction::Allow => return true,
            RuleAction::Disallow => return false,
        }
    }
    true
}

async fn extract_natives(
    resolved: &[ResolvedLibrary],
    runtime_dir: &Path,
    natives_dir: &Path,
) -> LauncherResult<()> {
    // Track which native JARs we've already extracted to avoid double work.
    let mut done: std::collections::HashSet<String> = std::collections::HashSet::new();
    for lib in resolved {
        if !lib.extract {
            continue;
        }
        let jar_path = runtime_dir.join("libraries").join(&lib.path);
        if !jar_path.exists() {
            // Skip silently — main download flow will have already reported.
            continue;
        }
        if !done.insert(lib.path.clone()) {
            continue;
        }
        let f = std::fs::File::open(&jar_path)?;
        let mut zip = zip::ZipArchive::new(f)
            .map_err(|e| LauncherError::Other(format!("Open zip: {e}")))?;
        for i in 0..zip.len() {
            let mut entry = zip.by_index(i)
                .map_err(|e| LauncherError::Other(format!("Read zip: {e}")))?;
            if entry.is_dir() {
                continue;
            }
            let name = entry.name().to_string();
            // Skip META-INF and Mojang's exclusion list.
            if name.starts_with("META-INF/") {
                continue;
            }
            if lib.extract_excludes.iter().any(|ex| name.contains(ex)) {
                continue;
            }
            let out_path = natives_dir.join(&name);
            if let Some(parent) = out_path.parent() {
                std::fs::create_dir_all(parent)?;
            }
            let mut out = std::fs::File::create(&out_path)?;
            std::io::copy(&mut entry, &mut out)?;
        }
    }
    Ok(())
}

fn spawn_log_reader<R>(label: &'static str, reader: R, tx: mpsc::UnboundedSender<LogLine>)
where
    R: tokio::io::AsyncRead + Unpin + Send + 'static,
{
    tokio::spawn(async move {
        let mut buf = BufReader::new(reader);
        let mut line = String::new();
        loop {
            line.clear();
            match buf.read_line(&mut line).await {
                Ok(0) => break,
                Ok(_) => {
                    let trimmed = line.trim_end_matches(['\r', '\n']);
                    let _ = tx.send(LogLine {
                        stream: label.to_string(),
                        text: trimmed.to_string(),
                    });
                }
                Err(_) => break,
            }
        }
    });
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct LogLine {
    pub stream: String,
    pub text: String,
}

/// Handle to a running Minecraft process. Cloning is cheap (Arc-shared).
#[derive(Clone)]
pub struct LaunchHandle {
    inner: Arc<LaunchHandleInner>,
}

struct LaunchHandleInner {
    instance_id: String,
    instance_name: String,
    pid: u32,
    child: tokio::sync::Mutex<Option<tokio::process::Child>>,
    log_rx: tokio::sync::Mutex<mpsc::UnboundedReceiver<LogLine>>,
}

impl LaunchHandle {
    fn new(
        instance_id: String,
        instance_name: String,
        pid: u32,
        child: tokio::process::Child,
        log_rx: mpsc::UnboundedReceiver<LogLine>,
    ) -> Self {
        Self {
            inner: Arc::new(LaunchHandleInner {
                instance_id,
                instance_name,
                pid,
                child: tokio::sync::Mutex::new(Some(child)),
                log_rx: tokio::sync::Mutex::new(log_rx),
            }),
        }
    }
    pub fn instance_id(&self) -> &str {
        &self.inner.instance_id
    }
    pub fn instance_name(&self) -> &str {
        &self.inner.instance_name
    }
    pub fn pid(&self) -> u32 {
        self.inner.pid
    }
    pub async fn try_wait(&self) -> LRes<Option<std::process::ExitStatus>> {
        let mut guard = self.inner.child.lock().await;
        if let Some(c) = guard.as_mut() {
            Ok(c.try_wait()?)
        } else {
            Ok(None)
        }
    }
    pub async fn wait(&self) -> LRes<std::process::ExitStatus> {
        let mut guard = self.inner.child.lock().await;
        let c = guard
            .as_mut()
            .ok_or_else(|| LauncherError::Process("Already reaped".to_string()))?;
        let status = c.wait().await?;
        *guard = None;
        Ok(status)
    }
    pub async fn kill(&self) -> LRes<()> {
        let mut guard = self.inner.child.lock().await;
        if let Some(c) = guard.as_mut() {
            c.kill().await?;
        }
        Ok(())
    }
    pub async fn next_log(&self) -> Option<LogLine> {
        let mut guard = self.inner.log_rx.lock().await;
        guard.recv().await
    }
}
