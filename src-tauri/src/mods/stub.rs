//! Placeholder for loaders we don't yet support. Provides a clear
//! "not yet supported" error rather than silently failing.

use crate::downloads::Downloader;
use crate::error::{LauncherError, LauncherResult};
use crate::mods::{LoaderKind, LoaderProfile, ModLoader};
use async_trait::async_trait;
use std::path::Path;

pub struct UnsupportedLoader {
    kind: LoaderKind,
    name: &'static str,
}

impl UnsupportedLoader {
    pub fn new(kind: LoaderKind, name: &'static str) -> Self {
        Self { kind, name }
    }
}

#[async_trait]
impl ModLoader for UnsupportedLoader {
    fn kind(&self) -> LoaderKind {
        self.kind
    }
    fn name(&self) -> &'static str {
        self.name
    }

    async fn list_versions(
        &self,
        _downloader: &Downloader,
        _minecraft_version: &str,
    ) -> LauncherResult<Vec<String>> {
        Err(LauncherError::Unsupported(format!(
            "{} is not yet supported. Check the project roadmap.",
            self.name
        )))
    }

    async fn install(
        &self,
        _downloader: &Downloader,
        _runtime_dir: &Path,
        _minecraft_version: &str,
        _loader_version: &str,
    ) -> LauncherResult<LoaderProfile> {
        Err(LauncherError::Unsupported(format!(
            "{} is not yet supported. Track the project roadmap for updates.",
            self.name
        )))
    }
}
