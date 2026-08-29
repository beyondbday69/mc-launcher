//! Process registry: tracks running game processes so the UI can query
//! status and the user can kill the game from the launcher.

use crate::launcher::LaunchHandle;
use dashmap::DashMap;

pub struct ProcessRegistry {
    inner: DashMap<String, LaunchHandle>,
}

impl ProcessRegistry {
    pub fn new() -> Self {
        Self {
            inner: DashMap::new(),
        }
    }
    pub fn register(&self, handle: LaunchHandle) {
        self.inner.insert(handle.instance_id().to_string(), handle);
    }
    pub fn unregister(&self, instance_id: &str) {
        self.inner.remove(instance_id);
    }
    pub fn get(&self, instance_id: &str) -> Option<LaunchHandle> {
        self.inner.get(instance_id).map(|e| e.clone())
    }
    pub fn list(&self) -> Vec<(String, u32)> {
        self.inner
            .iter()
            .map(|e| (e.key().clone(), e.value().pid()))
            .collect()
    }
    pub async fn kill_all(&self) {
        for entry in self.inner.iter() {
            let h = entry.value().clone();
            let _ = h.kill().await;
        }
        self.inner.clear();
    }
}

impl Default for ProcessRegistry {
    fn default() -> Self {
        Self::new()
    }
}
