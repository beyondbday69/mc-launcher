//! Global application state, shared across Tauri commands.

use crate::config::LauncherConfig;
use crate::instances::InstanceStore;
use crate::java::JavaCatalog;
use crate::metadata::MetadataCache;
use crate::paths::AppPaths;
use crate::process::ProcessRegistry;
use parking_lot::RwLock;
use std::sync::Arc;

/// Shared application state, wrapped in a Tauri-managed `Arc<State>`.
#[derive(Clone)]
pub struct AppState {
    inner: Arc<Inner>,
}

pub struct Inner {
    pub paths: AppPaths,
    pub config: RwLock<LauncherConfig>,
    pub metadata: MetadataCache,
    pub java: JavaCatalog,
    pub instances: InstanceStore,
    pub processes: ProcessRegistry,
}

impl AppState {
    /// Construct state, loading config and instances from disk.
    pub fn bootstrap(paths: AppPaths) -> crate::LauncherResult<Self> {
        let config = LauncherConfig::load(&paths)?;
        let metadata = MetadataCache::new(paths.cache_dir.join("metadata"));
        let java = JavaCatalog::new(paths.java_dir.clone());
        let instances = InstanceStore::load(&paths)?;
        let processes = ProcessRegistry::new();
        Ok(Self {
            inner: Arc::new(Inner {
                paths,
                config: RwLock::new(config),
                metadata,
                java,
                instances,
                processes,
            }),
        })
    }

    pub fn paths(&self) -> &AppPaths {
        &self.inner.paths
    }
    pub fn config(&self) -> &RwLock<LauncherConfig> {
        &self.inner.config
    }
    pub fn metadata(&self) -> &MetadataCache {
        &self.inner.metadata
    }
    pub fn java(&self) -> &JavaCatalog {
        &self.inner.java
    }
    pub fn instances(&self) -> &InstanceStore {
        &self.inner.instances
    }
    pub fn processes(&self) -> &ProcessRegistry {
        &self.inner.processes
    }
}
