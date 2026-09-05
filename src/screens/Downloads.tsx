import { useState } from "react";
import { formatBytes, formatSpeed } from "../lib/types";
import { IconDownloads, IconCheck } from "../lib/icons";
import { useTaskManager } from "../lib/taskManager";

export function Downloads() {
  const { downloadsSnapshot, installTasks, cancelAllDownloads, cancelTask } = useTaskManager();
  const [cancelling, setCancelling] = useState(false);

  const activeTasksList = Object.values(installTasks).filter((t) => t.status === "downloading");
  const isIdle = downloadsSnapshot.active === 0 && activeTasksList.length === 0;

  const handleCancelAll = () => {
    setCancelling(true);
    cancelAllDownloads();
    setTimeout(() => setCancelling(false), 500);
  };

  const percent =
    downloadsSnapshot.bytes_total > 0
      ? Math.min(
          Math.round(
            (downloadsSnapshot.bytes_downloaded / downloadsSnapshot.bytes_total) * 100
          ),
          100
        )
      : 100;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Telemetry Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
        <div className="callout-stat">
          <div className="corner-square" style={{ width: 8, height: 8 }} />
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="callout-stat-label">NETWORK THROUGHPUT</span>
            <span className="badge-tag" style={{ fontSize: 11 }}>
              {isIdle ? "STANDBY" : "ACTIVE"}
            </span>
          </div>
          <div className="callout-stat-num" style={{ color: isIdle ? "var(--nv-mute)" : "var(--nv-primary)" }}>
            {formatSpeed(downloadsSnapshot.speed_bps)}
          </div>
          <span style={{ fontSize: 12, color: "var(--nv-mute)" }}>
            Multi-threaded chunked downloader
          </span>
        </div>

        <div className="callout-stat">
          <div className="corner-square" style={{ width: 8, height: 8 }} />
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="callout-stat-label">PIPELINE PROGRESS</span>
            <span className="badge-tag badge-tag-primary" style={{ fontSize: 11 }}>
              {percent}% SYNCED
            </span>
          </div>
          <div className="callout-stat-num" style={{ fontSize: 24, color: "#ffffff" }}>
            {formatBytes(downloadsSnapshot.bytes_downloaded)}{" "}
            <span style={{ fontSize: 14, color: "var(--nv-mute)" }}>
              / {formatBytes(downloadsSnapshot.bytes_total)}
            </span>
          </div>
          <div style={{ width: "100%", height: 4, background: "var(--nv-surface-soft)", overflow: "hidden", marginTop: 4 }}>
            <div
              style={{
                width: `${percent}%`,
                height: "100%",
                background: "var(--nv-primary)",
                transition: "width 0.35s ease",
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
            {downloadsSnapshot.completed}{" "}
            <span style={{ fontSize: 14, color: "var(--nv-on-dark-mute)" }}>COMPLETED</span>
          </div>
          <span style={{ fontSize: 12, color: "var(--nv-mute)" }}>
            Active: {downloadsSnapshot.active} • Failed: {downloadsSnapshot.failed}
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
              width: 24,
              height: 24,
              borderRadius: "var(--rounded-sm)",
              background: "var(--nv-surface-dark)",
              border: "1px solid var(--nv-hairline)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: isIdle ? "var(--nv-mute)" : "var(--nv-primary)",
            }}
          >
            <IconDownloads size={15} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#ffffff" }}>
              {isIdle ? "DOWNLOAD PIPELINE IDLE" : "SYNCING ASSETS & LIBRARIES"}
            </div>
            <div style={{ fontSize: 12, color: "var(--nv-mute)" }}>
              {isIdle
                ? "All assets and client libraries up to date"
                : `${activeTasksList.length} download tasks running in background...`}
            </div>
          </div>
        </div>

        {!isIdle && (
          <button
            type="button"
            className="button-outline-on-dark button-sm"
            style={{ color: "var(--nv-error)" }}
            disabled={cancelling}
            onClick={handleCancelAll}
          >
            {cancelling ? "ABORTING..." : "ABORT ALL TRANSFERS"}
          </button>
        )}
      </div>

      {/* Active Tasks In-Flight (if any) */}
      {activeTasksList.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: "var(--nv-mute)", textTransform: "uppercase" }}>
            ACTIVE DOWNLOAD TASKS ({activeTasksList.length})
          </span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
            {activeTasksList.map((t) => (
              <div key={t.id} className="nv-card" style={{ padding: "18px" }}>
                <div className="corner-square" style={{ width: 8, height: 8 }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    <span className="badge-tag badge-tag-primary" style={{ fontSize: 10 }}>
                      {t.type.toUpperCase()}
                    </span>
                    <h4 style={{ fontSize: 15, fontWeight: 700, color: "#ffffff", marginTop: 4 }}>
                      {t.title}
                    </h4>
                  </div>
                  <button
                    type="button"
                    style={{ background: "none", border: "none", color: "var(--nv-mute)", cursor: "pointer", fontSize: 12 }}
                    onClick={() => cancelTask(t.id)}
                  >
                    CANCEL
                  </button>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--nv-mute)", marginBottom: 6 }}>
                  <span>{t.stage}</span>
                  <span style={{ color: "var(--nv-primary)", fontWeight: 700 }}>{t.progress}%</span>
                </div>
                <div style={{ width: "100%", height: 4, background: "var(--nv-surface-soft)", borderRadius: 2, overflow: "hidden", marginBottom: 8 }}>
                  <div style={{ width: `${t.progress}%`, height: "100%", background: "var(--nv-primary)", transition: "width 0.25s ease" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--nv-mute)", fontFamily: "var(--font-mono)" }}>
                  <span>{formatBytes(t.bytesDownloaded)} / {formatBytes(t.bytesTotal)}</span>
                  <span>{formatSpeed(t.speedBps)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <IconCheck size={14} />
                  <span>SHA-1 VERIFIED</span>
                </span>
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
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <IconCheck size={14} />
                  <span>SHA-1 VERIFIED</span>
                </span>
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
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <IconCheck size={14} />
                  <span>SHA-1 VERIFIED</span>
                </span>
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
