//! Tauri-free verification build of the MC Launcher core logic.
//!
//! This is a copy of the launcher's non-UI modules for verifying that the
//! launcher logic compiles and the test suite passes in environments
//! without the Tauri toolchain (e.g., CI runners with Rust 1.75 only).
//! The real project at `../src-tauri/` adds the Tauri command surface
//! and the process-registry glue.

pub mod auth;
pub mod config;
pub mod downloads;
pub mod error;
pub mod instances;
pub mod java;
pub mod launcher;
pub mod metadata;
pub mod mods;
pub mod paths;
pub mod process;
pub mod security;
pub mod update;

pub use error::{LauncherError, LauncherResult};
pub use paths::AppPaths;
