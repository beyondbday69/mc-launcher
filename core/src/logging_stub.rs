//! Stub for the Tauri project's logging module.
//! The real one uses tracing-appender for daily file rotation; this stub
//! just initializes a no-op subscriber so tests don't panic.
pub fn init(_log_dir: &std::path::Path) -> crate::LauncherResult<()> {
    Ok(())
}
