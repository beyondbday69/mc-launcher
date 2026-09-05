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
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Telemetry HUD Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
        <div className="telemetry-card">
          <div className="telemetry-label">
            <span>NETWORK THROUGHPUT</span>
            <span className="telemetry-tag">{isIdle ? "STANDBY" : "TRANSFERRING"}</span>
          </div>
          <div className="telemetry-value" style={{ color: isIdle ? "#9da5b4" : "var(--nvidia-green)" }}>
            {formatSpeed(progress.speed_bps)}
          </div>
          <span style={{ fontSize: 12, color: "#656d7c" }}>
            Multi-threaded chunked downloader
          </span>
        </div>

        <div className="telemetry-card">
          <div className="telemetry-label">
            <span>PIPELINE PROGRESS</span>
            <span className="telemetry-tag">{percent}% SYNCED</span>
          </div>
          <div className="telemetry-value">
            {formatBytes(progress.bytes_downloaded)} <span style={{ fontSize: 13, color: "#656d7c" }}>/ {formatBytes(progress.bytes_total)}</span>
          </div>
          <div style={{ width: "100%", height: 6, background: "var(--bg-canvas)", borderRadius: 2, overflow: "hidden", marginTop: 4 }}>
            <div
              style={{
                width: `${percent}%`,
                height: "100%",
                background: "var(--nvidia-green)",
                boxShadow: "0 0 10px var(--nvidia-green)",
              }}
            />
          </div>
        </div>

        <div className="telemetry-card">
          <div className="telemetry-label">
            <span>QUEUED ASSETS</span>
            <span className="telemetry-tag">{progress.failed > 0 ? "WARNING" : "HEALTHY"}</span>
          </div>
          <div className="telemetry-value">
            {progress.completed} <span style={{ fontSize: 13, color: "#9da5b4" }}>COMPLETED</span>
          </div>
          <span style={{ fontSize: 12, color: "#656d7c" }}>
            Active: {progress.active} • Failed: {progress.failed}
          </span>
        </div>
      </div>

      {/* Transfer Pipeline Action Bar */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)",
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: isIdle ? "#656d7c" : "var(--nvidia-green)",
              boxShadow: isIdle ? "none" : "0 0 10px var(--nvidia-green)",
            }}
          />
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "#ffffff" }}>
              {isIdle ? "DOWNLOAD PIPELINE IDLE" : "SYNCING ASSETS & LIBRARIES"}
            </div>
            <div style={{ fontSize: 11.5, fontFamily: "var(--font-mono)", color: "#656d7c" }}>
              {isIdle ? "All assets and client libraries up to date" : "Downloading client jars and textures..."}
            </div>
          </div>
        </div>

        {!isIdle && (
          <button
            type="button"
            className="btn-nvidia-secondary"
            style={{ color: "#ef4444", borderColor: "rgba(239, 68, 68, 0.4)" }}
            disabled={cancelling}
            onClick={handleCancel}
          >
            {cancelling ? "ABORTING..." : "ABORT TRANSFERS"}
          </button>
        )}
      </div>

      {/* Simulated Transfer Log Table */}
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
                <span className="badge-rtx">CLIENT JAR</span>
              </td>
              <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "#ffffff" }}>
                mojang-client-1.21.4.jar
              </td>
              <td style={{ fontFamily: "var(--font-mono)" }}>34.2 MB</td>
              <td style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#76b900" }}>
                SHA-1 VERIFIED
              </td>
              <td style={{ textAlign: "right", color: "#76b900", fontWeight: 700 }}>
                COMPLETE
              </td>
            </tr>
            <tr>
              <td>
                <span className="badge-channel">ASSET INDEX</span>
              </td>
              <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "#ffffff" }}>
                1.21.json (index hash)
              </td>
              <td style={{ fontFamily: "var(--font-mono)" }}>420 KB</td>
              <td style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#76b900" }}>
                SHA-1 VERIFIED
              </td>
              <td style={{ textAlign: "right", color: "#76b900", fontWeight: 700 }}>
                COMPLETE
              </td>
            </tr>
            <tr>
              <td>
                <span className="badge-channel">NATIVE LIBS</span>
              </td>
              <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "#ffffff" }}>
                lwjgl-vulkan-natives-linux.jar
              </td>
              <td style={{ fontFamily: "var(--font-mono)" }}>1.8 MB</td>
              <td style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#76b900" }}>
                SHA-1 VERIFIED
              </td>
              <td style={{ textAlign: "right", color: "#76b900", fontWeight: 700 }}>
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
