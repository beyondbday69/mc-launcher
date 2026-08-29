//! File verification: SHA-1 + size.
//!
//! Reads in 64 KiB chunks to keep memory low.

use crate::error::{LauncherError, LauncherResult};
use sha1_smol::Sha1;
use std::path::Path;
use tokio::io::AsyncReadExt;

const CHUNK: usize = 64 * 1024;

/// Verify `path` against expected SHA-1 and size. Returns `Ok(())` on match,
/// or an appropriate `LauncherError` otherwise.
pub async fn verify_file(path: &Path, expected_sha1: &str, expected_size: u64) -> LauncherResult<()> {
    let metadata = tokio::fs::metadata(path).await.map_err(|_| {
        LauncherError::NotFound(path.to_path_buf())
    })?;
    let actual_size = metadata.len();
    if actual_size != expected_size {
        return Err(LauncherError::SizeMismatch {
            expected: expected_size,
            actual: actual_size,
            path: path.to_path_buf(),
        });
    }
    let actual = sha1_file(path).await?;
    let actual_hex = actual.digest().to_string();
    if !actual_hex.eq_ignore_ascii_case(expected_sha1) {
        return Err(LauncherError::HashMismatch {
            expected: expected_sha1.to_string(),
            actual: actual_hex,
            path: path.to_path_buf(),
        });
    }
    Ok(())
}

pub async fn sha1_file(path: &Path) -> LauncherResult<Sha1> {
    let mut f = tokio::fs::File::open(path).await?;
    let mut hasher = Sha1::new();
    let mut buf = vec![0u8; CHUNK];
    loop {
        let n = f.read(&mut buf).await?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(hasher)
}

/// Synchronous variant for small files (used in tests).
pub fn sha1_bytes(data: &[u8]) -> String {
    let mut h = Sha1::new();
    h.update(data);
    h.digest().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn sha1_known() {
        // Known SHA-1 of "abc"
        assert_eq!(sha1_bytes(b"abc"), "a9993e364706816aba3e25717850c26c9cd0d89d");
    }

    #[tokio::test]
    async fn verify_passes_for_correct_file() {
        let tmp = std::env::temp_dir().join("mc_launcher_verify_test.bin");
        let data = b"hello world";
        std::fs::File::create(&tmp)
            .unwrap()
            .write_all(data)
            .unwrap();
        let expected = sha1_bytes(data);
        verify_file(&tmp, &expected, data.len() as u64)
            .await
            .unwrap();
        std::fs::remove_file(&tmp).ok();
    }

    #[tokio::test]
    async fn verify_detects_corruption() {
        let tmp = std::env::temp_dir().join("mc_launcher_verify_corrupt.bin");
        std::fs::File::create(&tmp)
            .unwrap()
            .write_all(b"x")
            .unwrap();
        let res = verify_file(&tmp, "0000000000000000000000000000000000000000", 1)
            .await;
        assert!(matches!(res, Err(LauncherError::HashMismatch { .. })));
        std::fs::remove_file(&tmp).ok();
    }
}
