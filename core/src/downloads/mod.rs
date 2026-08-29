//! Async concurrent downloader with persistent cache.
//!
//! Features:
//!  * Concurrent downloads with bounded parallelism.
//!  * HTTP connection reuse via a shared `reqwest::Client`.
//!  * SHA-1 + size verification, corrupt-file redownload.
//!  * Resume (HTTP Range) when the server supports it and a `.partial` file exists.
//!  * Exponential backoff with jitter on retryable errors.
//!  * Atomic file replacement (write to `.partial`, then rename).
//!  * Progress reporting via a channel that the UI listens on.
//!  * Cancellation via an `AtomicBool` flag.
//!  * Persistent cache: downloaded files are kept and re-verified on reuse.

use crate::error::{LauncherError, LauncherResult};
use crate::metadata::atomic_write;
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use sha1_smol::Sha1;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::io::AsyncWriteExt;
use tokio::sync::Semaphore;

pub mod progress;
pub mod verify;

pub use progress::*;

/// Shared downloader instance. Cheap to clone (all fields are `Arc`-shared).
#[derive(Clone)]
pub struct Downloader {
    inner: Arc<Inner>,
}

struct Inner {
    client: reqwest::Client,
    cache_dir: PathBuf,
    /// Limits the number of concurrent network requests.
    semaphore: Arc<Semaphore>,
    /// Optional per-launch cancellation flag.
    cancel: Arc<AtomicBool>,
    /// Optional shared progress sink.
    progress: Arc<Mutex<Option<Arc<dyn ProgressSink>>>>,
    /// Configurable concurrency.
    concurrency: usize,
    /// Optional speed cap in bytes/sec (0 = unlimited).
    speed_limit_bps: Arc<AtomicU64>,
}

impl Downloader {
    /// Create a new downloader with the given cache root.
    pub fn new(cache_dir: PathBuf) -> Self {
        std::fs::create_dir_all(&cache_dir).ok();
        let client = reqwest::Client::builder()
            .user_agent(concat!("MCLauncher/", env!("CARGO_PKG_VERSION")))
            .pool_max_idle_per_host(8)
            .timeout(Duration::from_secs(60))
            .connect_timeout(Duration::from_secs(15))
            .tcp_keepalive(Duration::from_secs(30))
            .build()
            .expect("reqwest client");
        Self {
            inner: Arc::new(Inner {
                client,
                cache_dir,
                semaphore: Arc::new(Semaphore::new(8)),
                cancel: Arc::new(AtomicBool::new(false)),
                progress: Arc::new(Mutex::new(None)),
                concurrency: 8,
                speed_limit_bps: Arc::new(AtomicU64::new(0)),
            }),
        }
    }

    pub fn with_concurrency(mut self, n: usize) -> Self {
        // Re-create the semaphore with the new permit count.
        let new_inner = Inner {
            client: self.inner.client.clone(),
            cache_dir: self.inner.cache_dir.clone(),
            semaphore: Arc::new(Semaphore::new(n.max(1))),
            cancel: self.inner.cancel.clone(),
            progress: self.inner.progress.clone(),
            concurrency: n.max(1),
            speed_limit_bps: self.inner.speed_limit_bps.clone(),
        };
        self.inner = Arc::new(new_inner);
        self
    }

    pub fn with_speed_limit(mut self, kbps: u32) -> Self {
        let bps = (kbps as u64) * 1024;
        let new_inner = Inner {
            client: self.inner.client.clone(),
            cache_dir: self.inner.cache_dir.clone(),
            semaphore: self.inner.semaphore.clone(),
            cancel: self.inner.cancel.clone(),
            progress: self.inner.progress.clone(),
            concurrency: self.inner.concurrency,
            speed_limit_bps: Arc::new(AtomicU64::new(bps)),
        };
        self.inner = Arc::new(new_inner);
        self
    }

    pub fn cancel_handle(&self) -> CancelHandle {
        CancelHandle {
            flag: self.inner.cancel.clone(),
        }
    }

    pub fn attach_progress(&self, sink: Arc<dyn ProgressSink>) {
        *self.inner.progress.lock() = Some(sink);
    }

    pub fn detach_progress(&self) {
        *self.inner.progress.lock() = None;
    }

    pub fn cache_dir(&self) -> &Path {
        &self.inner.cache_dir
    }

    /// Fetch a URL into memory, with retry.
    pub async fn fetch_bytes(&self, url: &str) -> LauncherResult<Vec<u8>> {
        let mut attempt = 0u32;
        let max_attempts = 4;
        let mut backoff_ms = 250u64;
        loop {
            if self.inner.cancel.load(Ordering::Relaxed) {
                return Err(LauncherError::Cancelled);
            }
            match self.fetch_bytes_once(url).await {
                Ok(b) => return Ok(b),
                Err(e) if is_retryable(&e) && attempt + 1 < max_attempts => {
                    attempt += 1;
                    let jitter = rand::random::<u64>() % 100;
                    let delay = backoff_ms + jitter;
                    tracing::warn!(
                        url = url,
                        attempt = attempt,
                        delay_ms = delay,
                        error = %e,
                        "Retrying download"
                    );
                    tokio::time::sleep(Duration::from_millis(delay)).await;
                    backoff_ms = (backoff_ms * 2).min(8_000);
                }
                Err(e) => return Err(e),
            }
        }
    }

    async fn fetch_bytes_once(&self, url: &str) -> LauncherResult<Vec<u8>> {
        let _permit = self.inner.semaphore.acquire().await.map_err(|_| {
            LauncherError::Download("semaphore closed".to_string())
        })?;
        let resp = self.inner.client.get(url).send().await?;
        if !resp.status().is_success() {
            return Err(LauncherError::Download(format!(
                "HTTP {} for {}",
                resp.status(),
                url
            )));
        }
        let bytes = resp.bytes().await?;
        Ok(bytes.to_vec())
    }

    /// Download a file with SHA-1 + size verification. If the file already
    /// exists in the cache and verifies, returns immediately. If verification
    /// fails, deletes the corrupt file and re-downloads.
    pub async fn download_verified(
        &self,
        url: &str,
        out_path: &Path,
        expected_sha1: &str,
        expected_size: u64,
    ) -> LauncherResult<()> {
        if let Some(parent) = out_path.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }
        // Cache hit?
        if out_path.exists() {
            match verify::verify_file(out_path, expected_sha1, expected_size).await {
                Ok(()) => {
                    tracing::debug!(path = %out_path.display(), "Cache hit");
                    return Ok(());
                }
                Err(_) => {
                    tracing::debug!(path = %out_path.display(), "Cache miss / corrupt, redownloading");
                }
            }
            tracing::warn!(path = %out_path.display(), "Corrupt cache file, redownloading");
            tokio::fs::remove_file(out_path).await.ok();
        }

        let mut attempt = 0u32;
        let max_attempts = 4;
        let mut backoff_ms = 250u64;
        loop {
            if self.inner.cancel.load(Ordering::Relaxed) {
                return Err(LauncherError::Cancelled);
            }
            match self
                .download_with_resume(url, out_path, expected_size)
                .await
            {
                Ok(()) => {
                    // Verify after download.
                    if let Err(e) =
                        verify::verify_file(out_path, expected_sha1, expected_size).await
                    {
                        if matches!(e, LauncherError::HashMismatch { .. }) {
                            // Force re-download on next call.
                            tokio::fs::remove_file(out_path).await.ok();
                        }
                        return Err(e);
                    }
                    return Ok(());
                }
                Err(e) if is_retryable(&e) && attempt + 1 < max_attempts => {
                    attempt += 1;
                    let jitter = rand::random::<u64>() % 100;
                    let delay = backoff_ms + jitter;
                    tracing::warn!(
                        url = url,
                        attempt = attempt,
                        delay_ms = delay,
                        error = %e,
                        "Retrying download"
                    );
                    tokio::time::sleep(Duration::from_millis(delay)).await;
                    backoff_ms = (backoff_ms * 2).min(8_000);
                }
                Err(e) => return Err(e),
            }
        }
    }

    /// Download with optional HTTP Range resume.
    async fn download_with_resume(
        &self,
        url: &str,
        out_path: &Path,
        expected_size: u64,
    ) -> LauncherResult<()> {
        let _permit = self.inner.semaphore.acquire().await.map_err(|_| {
            LauncherError::Download("semaphore closed".to_string())
        })?;

        let partial = out_path.with_extension("partial");
        let mut already_have: u64 = 0;
        if partial.exists() {
            already_have = tokio::fs::metadata(&partial)
                .await
                .map(|m| m.len())
                .unwrap_or(0);
        }

        let mut req = self.inner.client.get(url);
        if already_have > 0 {
            req = req.header("Range", format!("bytes={}-", already_have));
        }
        let resp = req.send().await?;
        let status = resp.status();
        if !status.is_success() {
            return Err(LauncherError::Download(format!(
                "HTTP {} for {}",
                status, url
            )));
        }
        let supports_resume = status.as_u16() == 206;
        let mut stream = resp;

        // If the server ignored the Range header, restart from scratch.
        let mut start_offset = if supports_resume { already_have } else { 0 };
        if start_offset > 0 && !supports_resume {
            tokio::fs::remove_file(&partial).await.ok();
            start_offset = 0;
        }

        let mut file = if start_offset == 0 {
            tokio::fs::File::create(&partial).await?
        } else {
            let mut f = tokio::fs::OpenOptions::new()
                .append(true)
                .open(&partial)
                .await?;
            use tokio::io::AsyncSeekExt;
            f.seek(std::io::SeekFrom::Start(start_offset)).await?;
            f
        };

        let total = expected_size;
        let mut downloaded = start_offset;
        let mut last_progress_emit = std::time::Instant::now();
        let mut last_emit_bytes = downloaded;

        let speed_limit = self.inner.speed_limit_bps.load(Ordering::Relaxed);
        let mut throttle = Throttle::new(speed_limit);

        while let Some(chunk) = stream.chunk().await? {
            if self.inner.cancel.load(Ordering::Relaxed) {
                return Err(LauncherError::Cancelled);
            }
            file.write_all(&chunk).await?;
            downloaded += chunk.len() as u64;

            if let Some(sink) = self.inner.progress.lock().clone() {
                // Emit at most every 100ms.
                if last_progress_emit.elapsed() >= Duration::from_millis(100) {
                    sink.on_progress(
                        url,
                        downloaded,
                        total,
                        last_emit_bytes,
                        last_progress_emit.elapsed(),
                    );
                    last_emit_bytes = downloaded;
                    last_progress_emit = std::time::Instant::now();
                }
            }

            if speed_limit > 0 {
                throttle.wait_for(chunk.len() as u64).await;
            }
        }
        file.flush().await?;
        drop(file);

        // Atomic rename to final path.
        if let Err(e) = tokio::fs::rename(&partial, out_path).await {
            return Err(LauncherError::Io(e));
        }
        if let Some(sink) = self.inner.progress.lock().clone() {
            sink.on_complete(url, downloaded, total);
        }
        Ok(())
    }
}

fn is_retryable(e: &LauncherError) -> bool {
    matches!(
        e,
        LauncherError::Http(_) | LauncherError::Download(_) | LauncherError::Io(_)
    ) && !matches!(e, LauncherError::Cancelled)
}

/// Handle that can be used to cancel an in-flight batch of downloads.
#[derive(Clone)]
pub struct CancelHandle {
    flag: Arc<AtomicBool>,
}

impl CancelHandle {
    pub fn cancel(&self) {
        self.flag.store(true, Ordering::Relaxed);
    }
    pub fn reset(&self) {
        self.flag.store(false, Ordering::Relaxed);
    }
    pub fn is_cancelled(&self) -> bool {
        self.flag.load(Ordering::Relaxed)
    }
}

/// Throttle helper for optional speed limiting.
struct Throttle {
    bytes_per_sec: u64,
    window_start: std::time::Instant,
    bytes_in_window: u64,
}

impl Throttle {
    fn new(bps: u64) -> Self {
        Self {
            bytes_per_sec: bps,
            window_start: std::time::Instant::now(),
            bytes_in_window: 0,
        }
    }
    async fn wait_for(&mut self, n: u64) {
        if self.bytes_per_sec == 0 {
            return;
        }
        self.bytes_in_window += n;
        let elapsed = self.window_start.elapsed();
        if elapsed.is_zero() {
            return;
        }
        let allowed = (self.bytes_per_sec * elapsed.as_millis() as u64) / 1000;
        if self.bytes_in_window > allowed {
            let excess = self.bytes_in_window - allowed;
            let sleep_ms = (excess * 1000) / self.bytes_per_sec;
            if sleep_ms > 0 {
                tokio::time::sleep(Duration::from_millis(sleep_ms.max(1))).await;
            }
        }
        // Reset window periodically to avoid drift.
        if self.window_start.elapsed() > Duration::from_secs(1) {
            self.window_start = std::time::Instant::now();
            self.bytes_in_window = 0;
        }
    }
}

/// Trait for receiving progress events.
pub trait ProgressSink: Send + Sync {
    fn on_progress(&self, url: &str, downloaded: u64, total: u64, prev: u64, dt: Duration);
    fn on_complete(&self, url: &str, downloaded: u64, total: u64);
    fn on_error(&self, url: &str, error: &str) {
        let _ = (url, error);
    }
}

/// Simple in-memory progress sink that the UI can poll.
pub struct PollingProgressSink {
    pub state: parking_lot::Mutex<PollingProgressState>,
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct PollingProgressState {
    pub active: Vec<ProgressEntry>,
    pub completed: u64,
    pub failed: u64,
    pub bytes_downloaded: u64,
    pub total_bytes: u64,
    pub bytes_per_sec: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressEntry {
    pub url: String,
    pub downloaded: u64,
    pub total: u64,
    pub speed_bps: f64,
    pub eta_secs: Option<f64>,
}

impl Default for PollingProgressSink {
    fn default() -> Self {
        Self {
            state: parking_lot::Mutex::new(PollingProgressState::default()),
        }
    }
}

impl PollingProgressSink {
    pub fn snapshot(&self) -> PollingProgressState {
        self.state.lock().clone()
    }
}

impl ProgressSink for PollingProgressSink {
    fn on_progress(&self, url: &str, downloaded: u64, total: u64, prev: u64, dt: Duration) {
        let mut s = self.state.lock();
        let secs = dt.as_secs_f64().max(0.001);
        let speed = ((downloaded.saturating_sub(prev)) as f64) / secs;
        let eta = if speed > 0.0 && total > downloaded {
            Some(((total - downloaded) as f64) / speed)
        } else {
            None
        };
        if let Some(e) = s.active.iter_mut().find(|e| e.url == url) {
            e.downloaded = downloaded;
            e.total = total;
            e.speed_bps = speed;
            e.eta_secs = eta;
        } else {
            s.active.push(ProgressEntry {
                url: url.to_string(),
                downloaded,
                total,
                speed_bps: speed,
                eta_secs: eta,
            });
        }
        // Update aggregate speed.
        s.bytes_per_sec = s.active.iter().map(|e| e.speed_bps).sum();
        s.bytes_downloaded = s.active.iter().map(|e| e.downloaded).sum();
        s.total_bytes = total.max(s.total_bytes);
    }

    fn on_complete(&self, url: &str, downloaded: u64, _total: u64) {
        let mut s = self.state.lock();
        s.active.retain(|e| e.url != url);
        s.completed += 1;
        s.bytes_downloaded = s.bytes_downloaded.max(downloaded);
    }

    fn on_error(&self, url: &str, error: &str) {
        let mut s = self.state.lock();
        s.active.retain(|e| e.url != url);
        s.failed += 1;
        tracing::warn!(url = url, error = error, "Download failed");
    }
}

/// Parallel download of a batch of artifacts, all using a shared progress sink.
pub async fn download_all(
    downloader: &Downloader,
    jobs: Vec<DownloadJob>,
) -> Vec<LauncherResult<()>> {
    let mut handles = Vec::with_capacity(jobs.len());
    for job in jobs {
        let d = downloader.clone();
        handles.push(tokio::spawn(async move {
            d.download_verified(&job.url, &job.path, &job.sha1, job.size)
                .await
        }));
    }
    let mut out = Vec::with_capacity(handles.len());
    for h in handles {
        match h.await {
            Ok(r) => out.push(r),
            Err(e) => out.push(Err(LauncherError::Other(format!("join: {e}")))),
        }
    }
    out
}

#[derive(Debug, Clone)]
pub struct DownloadJob {
    pub url: String,
    pub path: PathBuf,
    pub sha1: String,
    pub size: u64,
}
