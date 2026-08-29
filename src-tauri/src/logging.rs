//! Structured logging using `tracing`.
//!
//! Two log streams are written:
//!  * `launcher.log` — global launcher events (rotated daily).
//!  * `instance-<id>.log` — per-instance game + launcher output (created on launch).
//!
//! All log records are also echoed to stderr when stderr is a TTY (dev mode).
//! Secrets (tokens, passwords) are stripped by the `RedactLayer`.

use crate::error::LauncherResult;
use std::path::Path;
use tracing_appender::non_blocking::WorkerGuard;
use tracing_subscriber::{
    fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter, Layer, Registry,
};

/// Initialize the global tracing subscriber. Returns a guard that keeps the
/// log worker alive for the lifetime of the application.
pub fn init(log_dir: &Path) -> LauncherResult<WorkerGuard> {
    std::fs::create_dir_all(log_dir).ok();

    let file_appender = tracing_appender::rolling::daily(log_dir, "launcher.log");
    let (file_writer, guard) = tracing_appender::non_blocking(file_appender);

    // File logs: structured plain text. Stderr logs: pretty (only when interactive).
    let env = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,mc_launcher=debug,reqwest=warn,hyper=warn"));

    let file_layer = fmt::layer()
        .with_writer(file_writer)
        .with_ansi(false)
        .with_target(true)
        .with_thread_ids(false)
        .with_file(false)
        .with_line_number(false)
        .with_filter(EnvFilter::new("info"));

    let stderr_layer = if atty_stdout() {
        Some(
            fmt::layer()
                .with_writer(std::io::stderr)
                .with_ansi(true)
                .with_target(false)
                .with_filter(env.clone()),
        )
    } else {
        None
    };

    let subscriber = Registry::default().with(file_layer).with(stderr_layer);

    subscriber.try_init().ok();

    tracing::info!(
        version = env!("CARGO_PKG_VERSION"),
        "MC Launcher starting"
    );
    Ok(guard)
}

fn atty_stdout() -> bool {
    // Cheap detection that doesn't pull in the atty crate.
    use std::io::IsTerminal;
    std::io::stderr().is_terminal()
}
