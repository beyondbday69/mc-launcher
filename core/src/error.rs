//! Centralized error types for the launcher.
//!
//! All errors implement `serde::Serialize` so they can cross the Tauri IPC
//! boundary into the frontend without leaking sensitive details.

use serde::{Serialize, Serializer};
use std::path::PathBuf;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum LauncherError {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),

    #[error("JSON parse error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Path traversal blocked: {0}")]
    PathTraversal(PathBuf),

    #[error("Invalid path: {0}")]
    InvalidPath(String),

    #[error("File not found: {0}")]
    NotFound(PathBuf),

    #[error("Hash mismatch: expected {expected}, got {actual} for {path}")]
    HashMismatch {
        expected: String,
        actual: String,
        path: PathBuf,
    },

    #[error("Size mismatch: expected {expected} bytes, got {actual} for {path}")]
    SizeMismatch {
        expected: u64,
        actual: u64,
        path: PathBuf,
    },

    #[error("Manifest error: {0}")]
    Manifest(String),

    #[error("Version {0} not found")]
    VersionNotFound(String),

    #[error("Version JSON error for {version}: {message}")]
    VersionJson { version: String, message: String },

    #[error("Library resolution failed: {0}")]
    Library(String),

    #[error("Asset error: {0}")]
    Asset(String),

    #[error("Java not found. Install Java {recommended}+ or set the path in Settings.")]
    JavaNotFound { recommended: u32 },

    #[error("Java at {path} is invalid: {reason}")]
    JavaInvalid { path: PathBuf, reason: String },

    #[error("Instance not found: {0}")]
    InstanceNotFound(String),

    #[error("Instance {0} already exists")]
    InstanceExists(String),

    #[error("Launch failed: {0}")]
    Launch(String),

    #[error("Process error: {0}")]
    Process(String),

    #[error("Authentication error: {0}")]
    Auth(String),

    #[error("Token storage error: {0}")]
    TokenStorage(String),

    #[error("Config error: {0}")]
    Config(String),

    #[error("Config migration failed from v{from} to v{to}: {message}")]
    ConfigMigration {
        from: u32,
        to: u32,
        message: String,
    },

    #[error("Mod loader error: {0}")]
    ModLoader(String),

    #[error("Mod error: {0}")]
    Mod(String),

    #[error("Download cancelled")]
    Cancelled,

    #[error("Download failed: {0}")]
    Download(String),

    #[error("Invalid argument: {0}")]
    InvalidArgument(String),

    #[error("Unsupported operation: {0}")]
    Unsupported(String),

    #[error("{0}")]
    Other(String),
}

impl LauncherError {
    /// Get a stable error code for UI consumption.
    pub fn code(&self) -> &'static str {
        match self {
            Self::Io(_) => "E_IO",
            Self::Http(_) => "E_HTTP",
            Self::Json(_) => "E_JSON",
            Self::PathTraversal(_) => "E_PATH_TRAVERSAL",
            Self::InvalidPath(_) => "E_INVALID_PATH",
            Self::NotFound(_) => "E_NOT_FOUND",
            Self::HashMismatch { .. } => "E_HASH_MISMATCH",
            Self::SizeMismatch { .. } => "E_SIZE_MISMATCH",
            Self::Manifest(_) => "E_MANIFEST",
            Self::VersionNotFound(_) => "E_VERSION_NOT_FOUND",
            Self::VersionJson { .. } => "E_VERSION_JSON",
            Self::Library(_) => "E_LIBRARY",
            Self::Asset(_) => "E_ASSET",
            Self::JavaNotFound { .. } => "E_JAVA_NOT_FOUND",
            Self::JavaInvalid { .. } => "E_JAVA_INVALID",
            Self::InstanceNotFound(_) => "E_INSTANCE_NOT_FOUND",
            Self::InstanceExists(_) => "E_INSTANCE_EXISTS",
            Self::Launch(_) => "E_LAUNCH",
            Self::Process(_) => "E_PROCESS",
            Self::Auth(_) => "E_AUTH",
            Self::TokenStorage(_) => "E_TOKEN_STORAGE",
            Self::Config(_) => "E_CONFIG",
            Self::ConfigMigration { .. } => "E_CONFIG_MIGRATION",
            Self::ModLoader(_) => "E_MOD_LOADER",
            Self::Mod(_) => "E_MOD",
            Self::Cancelled => "E_CANCELLED",
            Self::Download(_) => "E_DOWNLOAD",
            Self::InvalidArgument(_) => "E_INVALID_ARGUMENT",
            Self::Unsupported(_) => "E_UNSUPPORTED",
            Self::Other(_) => "E_OTHER",
        }
    }

    /// Get a human-readable suggestion for how to fix the error.
    pub fn suggestion(&self) -> Option<&'static str> {
        match self {
            Self::JavaNotFound { .. } => Some(
                "Install a compatible Java version or set the Java path manually in Settings.",
            ),
            Self::HashMismatch { .. } | Self::SizeMismatch { .. } => {
                Some("The file is corrupted. It will be redownloaded automatically on next launch.")
            }
            Self::InstanceNotFound(_) => Some("Refresh the Instances list."),
            Self::ConfigMigration { .. } => {
                Some("Check the launcher log for details. Backup your config before retrying.")
            }
            Self::Cancelled => None,
            Self::Http(_) => Some("Check your internet connection and try again."),
            Self::PathTraversal(_) => Some("The path was rejected for safety. Report this as a bug."),
            _ => None,
        }
    }
}

impl Serialize for LauncherError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut s = serializer.serialize_struct("LauncherError", 4)?;
        s.serialize_field("code", self.code())?;
        s.serialize_field("message", &self.to_string())?;
        s.serialize_field("suggestion", &self.suggestion())?;
        s.serialize_field("kind", &format!("{:?}", std::mem::discriminant(self)))?;
        s.end()
    }
}

pub type LauncherResult<T> = std::result::Result<T, LauncherError>;
