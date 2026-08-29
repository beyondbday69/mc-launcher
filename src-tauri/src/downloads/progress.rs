//! Progress events published to the UI.

use serde::{Deserialize, Serialize};

/// Single download progress event.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressEvent {
    pub kind: ProgressKind,
    pub url: String,
    pub downloaded: u64,
    pub total: u64,
    pub speed_bps: f64,
    pub eta_secs: Option<f64>,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ProgressKind {
    Started,
    Updated,
    Completed,
    Failed,
    Cancelled,
}

/// Aggregated state of all in-flight downloads.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AggregateProgress {
    pub active: u32,
    pub completed: u32,
    pub failed: u32,
    pub bytes_downloaded: u64,
    pub bytes_total: u64,
    pub speed_bps: f64,
}
