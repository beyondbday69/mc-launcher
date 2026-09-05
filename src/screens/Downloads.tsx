import { useState, useEffect } from "react";
import { api, ProgressSnapshot, formatBytes, formatSpeed } from "../lib/types";

export function Downloads() {
  const [progress, setProgress] = useState<ProgressSnapshot>({
    active: 0,
    completed: 48,
    failed: 0,
    bytes_downloaded: 245000000,
    bytes_total: 245000000,
    speed_bps: 0,
  });
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      try {
        const snap = await api.downloadsProgress();
        if (mounted) setProgress(snap);
      } catch (err) {
        console.error("[NVIDIA Downloads Poll]:", err);
      }
    };

    poll();
    const interval = setInterval(poll, 1000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await api.downloadsCancel();
    } catch (err) {
      console.error("[NVIDIA Downloads Cancel]:", err);
    } finally {
      setCancelling(false);
    }
  };

  const percent =
    progress.bytes_total > 0
      ? Math.min(Math.round((progress.bytes_downloaded / progress.bytes_total) * 100), 100)
      : 100;

  const isIdle = progress.active === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Telemetry Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
        <div className="callout-stat">
          <div className="corner-square" style={{ width: 8, height: 8 }} />
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="callout-stat-label">NETWORK THROUGHPUT</span>
            <span className="badge-tag" style={{ fontSize: 11 }}>{isIdle ? "STANDBY" : "ACTIVE"}</span>
          </div>
          <div className="callout-stat-num" style={{ color: isIdle ? "var(--nv-mute)" : "var(--nv-primary)" }}>
            {formatSpeed(progress.speed_bps)}
          </div>
          <span style={{ fontSize: 12, color: "var(--nv-mute)" }}>
            Multi-threaded chunked downloader
          </span>
        </div>

        <div className="callout-stat">
          <div className="corner-square" style={{ width: 8, height: 8 }} />
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="callout-stat-label">PIPELINE PROGRESS</span>
            <span className="badge-tag badge-tag-primary" style={{ fontSize: 11 }}>{percent}% SYNCED</span>
          </div>
          <div className="callout-stat-num" style={{ fontSize: 24, color: "#ffffff" }}>
            {formatBytes(progress.bytes_downloaded)} <span style={{ fontSize: 14, color: "var(--nv-mute)" }}>/ {formatBytes(progress.bytes_total)}</span>
          </div>
          <div style={{ width: "100%", height: 4, background: "var(--nv-surface-soft)", overflow: "hidden", marginTop: 4 }}>
            <div
              style={{
                width: `${percent}%`,
                height: "100%",
                background: "var(--nv-primary)",
              }}
            />
          </div>
        </div>

        <div className="callout-stat">
          <div className="corner-square" style={{ width: 8, height: 8 }} />
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="callout-stat-label">ASSET QUEUE</span>
            <span className="badge-tag" style={{ fontSize: 11 }}>HEALTHY</span>
          </div>
          <div className="callout-stat-num" style={{ fontSize: 24 }}>
            {progress.completed} <span style={{ fontSize: 14, color: "var(--nv-on-dark-mute)" }}>COMPLETED</span>
          </div>
          <span style={{ fontSize: 12, color: "var(--nv-mute)" }}>
            Active: {progress.active} • Failed: {progress.failed}
          </span>
        </div>
      </div>

      {/* Transfer Pipeline Status Bar */}
      <div
        style={{
          background: "var(--nv-surface-card)",
          border: "1px solid var(--nv-hairline)",
          borderRadius: "var(--rounded-sm)",
          padding: "18px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 8,
              height: 8,
              background: isIdle ? "var(--nv-mute)" : "var(--nv-primary)",
            }}
          />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#ffffff" }}>
              {isIdle ? "DOWNLOAD PIPELINE IDLE" : "SYNCING ASSETS & LIBRARIES"}
            </div>
            <div style={{ fontSize: 12, color: "var(--nv-mute)" }}>
              {isIdle ? "All assets and client libraries up to date" : "Downloading client jars and textures..."}
            </div>
          </div>
        </div>

        {!isIdle && (
          <button
            type="button"
            className="button-outline-on-dark button-sm"
            style={{ color: "var(--nv-error)" }}
            disabled={cancelling}
            onClick={handleCancel}
          >
            {cancelling ? "ABORTING..." : "ABORT TRANSFERS"}
          </button>
        )}
      </div>

      {/* Transfer Log Table */}
      <div className="nvidia-table-wrap">
        <table className="nvidia-table">
          <thead>
            <tr>
              <th>RESOURCE CLASSIFICATION</th>
              <th>PACKAGE IDENTIFIER</th>
              <th>TRANSFER SIZE</th>
              <th>CHECKSUM STATUS</th>
              <th style={{ textAlign: "right" }}>STATE</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <span className="badge-tag badge-tag-primary">CLIENT JAR</span>
              </td>
              <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "#ffffff" }}>
                mojang-client-1.21.4.jar
              </td>
              <td style={{ fontFamily: "var(--font-mono)" }}>34.2 MB</td>
              <td style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--nv-primary)" }}>
                SHA-1 VERIFIED
              </td>
              <td style={{ textAlign: "right", color: "var(--nv-primary)", fontWeight: 700 }}>
                COMPLETE
              </td>
            </tr>
            <tr>
              <td>
                <span className="badge-tag">ASSET INDEX</span>
              </td>
              <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "#ffffff" }}>
                1.21.json (index hash)
              </td>
              <td style={{ fontFamily: "var(--font-mono)" }}>420 KB</td>
              <td style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--nv-primary)" }}>
                SHA-1 VERIFIED
              </td>
              <td style={{ textAlign: "right", color: "var(--nv-primary)", fontWeight: 700 }}>
                COMPLETE
              </td>
            </tr>
            <tr>
              <td>
                <span className="badge-tag">NATIVE LIBS</span>
              </td>
              <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "#ffffff" }}>
                lwjgl-vulkan-natives-linux.jar
              </td>
              <td style={{ fontFamily: "var(--font-mono)" }}>1.8 MB</td>
              <td style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--nv-primary)" }}>
                SHA-1 VERIFIED
              </td>
              <td style={{ textAlign: "right", color: "var(--nv-primary)", fontWeight: 700 }}>
                COMPLETE
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Downloads;
