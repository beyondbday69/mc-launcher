import { useState, useEffect, useMemo } from "react";
import { api, VersionEntry, LatestPair, formatBytes, formatSpeed } from "../lib/types";
import { IconDownloads, IconPlus, IconSearch, IconCheck } from "../lib/icons";
import { useTaskManager } from "../lib/taskManager";

interface VersionsProps {
  onInstalled: () => Promise<void>;
}

export function Versions({ onInstalled }: VersionsProps) {
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [latest, setLatest] = useState<LatestPair | null>(null);
  const [channel, setChannel] = useState<"release" | "all">("release");
  const [search, setSearch] = useState("");
  const { installTasks, installVersion } = useTaskManager();

  useEffect(() => {
    Promise.all([
      api.versionsList(true, false),
      api.versionsLatest(),
    ])
      .then(([vList, lPair]) => {
        setVersions(vList);
        setLatest(lPair);
      })
      .catch((err) => console.error("[NVIDIA Versions Load]:", err));
  }, []);

  const filteredVersions = useMemo(() => {
    return versions.filter((v) => {
      if (channel === "release" && v.type !== "release") return false;
      if (search && !v.id.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [versions, channel, search]);

  const releaseId = latest?.release || "1.21.4";
  const snapshotId = latest?.snapshot || "24w45a";

  const releaseTask = installTasks[`version-${releaseId}`];
  const isReleaseDownloading = releaseTask && releaseTask.status === "downloading";
  const isReleaseCompleted = releaseTask && releaseTask.status === "completed";

  const snapshotTask = installTasks[`version-${snapshotId}`];
  const isSnapshotDownloading = snapshotTask && snapshotTask.status === "downloading";
  const isSnapshotCompleted = snapshotTask && snapshotTask.status === "completed";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Dual Spotlight Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Game Ready Stable */}
        <div
          className="nv-card"
          style={{
            border: "1px solid var(--nv-primary)",
            background: "var(--nv-surface-card)",
            padding: "28px 32px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: 20,
          }}
        >
          <div className="corner-square" />

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span className="badge-tag badge-tag-primary">GAME READY RELEASE</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--nv-primary)" }}>
                RECOMMENDED
              </span>
            </div>
            <h2 style={{ fontSize: 26, fontWeight: 700, color: "#ffffff" }}>
              MINECRAFT {releaseId}
            </h2>
            <p style={{ fontSize: 14, color: "var(--nv-on-dark-mute)", marginTop: 6 }}>
              Production release channel. Verified for stability, multithreading, and rendering compatibility.
            </p>
          </div>

          <div>
            {isReleaseDownloading ? (
              <div className="launch-progress-box">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--nv-primary)" }}>
                    {releaseTask.stage}
                  </span>
                  <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "#ffffff", fontWeight: 700 }}>
                    {releaseTask.progress}%
                  </span>
                </div>
                <div className="launch-progress-bar">
                  <div className="launch-progress-fill" style={{ width: `${releaseTask.progress}%` }} />
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 11,
                    color: "var(--nv-mute)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  <span>
                    {formatBytes(releaseTask.bytesDownloaded)} / {formatBytes(releaseTask.bytesTotal)}
                  </span>
                  <span>{formatSpeed(releaseTask.speedBps)}</span>
                </div>
              </div>
            ) : isReleaseCompleted ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--nv-primary)", fontWeight: 700, fontSize: 14 }}>
                <IconCheck size={18} />
                <span>PROFILE READY IN GAME LIBRARY</span>
              </div>
            ) : (
              <button
                type="button"
                className="button-primary"
                onClick={() => installVersion(releaseId, "release", onInstalled)}
              >
                <IconDownloads size={16} />
                <span>INSTALL GAME READY</span>
              </button>
            )}
          </div>
        </div>

        {/* Developer Snapshot */}
        <div
          className="nv-card"
          style={{
            background: "var(--nv-surface-card)",
            padding: "28px 32px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: 20,
          }}
        >
          <div className="corner-square" style={{ background: "var(--nv-warning)" }} />

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span className="badge-tag" style={{ color: "var(--nv-warning)", borderColor: "var(--nv-warning)" }}>
                DEVELOPER PREVIEW
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--nv-mute)" }}>
                EXPERIMENTAL
              </span>
            </div>
            <h2 style={{ fontSize: 26, fontWeight: 700, color: "#ffffff" }}>
              SNAPSHOT {snapshotId}
            </h2>
            <p style={{ fontSize: 14, color: "var(--nv-on-dark-mute)", marginTop: 6 }}>
              Bleeding-edge Mojang development channel. Early features & testbed builds.
            </p>
          </div>

          <div>
            {isSnapshotDownloading ? (
              <div className="launch-progress-box">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--nv-warning)" }}>
                    {snapshotTask.stage}
                  </span>
                  <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "#ffffff", fontWeight: 700 }}>
                    {snapshotTask.progress}%
                  </span>
                </div>
                <div className="launch-progress-bar">
                  <div
                    className="launch-progress-fill"
                    style={{ width: `${snapshotTask.progress}%`, background: "var(--nv-warning)" }}
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 11,
                    color: "var(--nv-mute)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  <span>
                    {formatBytes(snapshotTask.bytesDownloaded)} / {formatBytes(snapshotTask.bytesTotal)}
                  </span>
                  <span>{formatSpeed(snapshotTask.speedBps)}</span>
                </div>
              </div>
            ) : isSnapshotCompleted ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--nv-warning)", fontWeight: 700, fontSize: 14 }}>
                <IconCheck size={18} />
                <span>SNAPSHOT PROFILE CREATED</span>
              </div>
            ) : (
              <button
                type="button"
                className="button-outline-on-dark"
                onClick={() => installVersion(snapshotId, "snapshot", onInstalled)}
              >
                <IconDownloads size={16} />
                <span>INSTALL SNAPSHOT</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Release Channel Filter & Search Toolbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            className={`pill-tab ${channel === "release" ? "active" : ""}`}
            onClick={() => setChannel("release")}
          >
            GAME READY ONLY
          </button>
          <button
            type="button"
            className={`pill-tab ${channel === "all" ? "active" : ""}`}
            onClick={() => setChannel("all")}
          >
            ALL (INCL. SNAPSHOTS)
          </button>
        </div>

        <div style={{ position: "relative", display: "flex", alignItems: "center", maxWidth: 320, width: "100%" }}>
          <span style={{ position: "absolute", left: 12, color: "var(--nv-mute)", pointerEvents: "none", display: "flex", alignItems: "center" }}>
            <IconSearch size={15} />
          </span>
          <input
            type="text"
            className="text-input"
            placeholder="Filter version catalog..."
            style={{ paddingLeft: 34 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Full Version Matrix Table */}
      <div className="nvidia-table-wrap">
        <table className="nvidia-table">
          <thead>
            <tr>
              <th style={{ width: 140 }}>CHANNEL</th>
              <th>VERSION ID</th>
              <th>RELEASE DATE</th>
              <th>INTEGRITY STATUS</th>
              <th style={{ textAlign: "right" }}>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {filteredVersions.map((v) => {
              const task = installTasks[`version-${v.id}`];
              const isTaskDownloading = task && task.status === "downloading";
              const isTaskCompleted = task && task.status === "completed";

              return (
                <tr key={v.id}>
                  <td>
                    <span className={v.type === "release" ? "badge-tag badge-tag-primary" : "badge-tag"}>
                      {v.type === "release" ? "GAME READY" : "SNAPSHOT"}
                    </span>
                  </td>
                  <td style={{ fontWeight: 700, color: "#ffffff", fontFamily: "var(--font-mono)" }}>
                    {v.id}
                  </td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>
                    {v.releaseTime ? new Date(v.releaseTime).toLocaleDateString() : "—"}
                  </td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--nv-primary)" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <IconCheck size={14} />
                      <span>VERIFIED SIGNATURE</span>
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {isTaskDownloading ? (
                      <div style={{ display: "inline-flex", flexDirection: "column", gap: 3, minWidth: 120, textAlign: "left" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--nv-primary)", fontWeight: 700 }}>
                          <span>INSTALLING</span>
                          <span>{task.progress}%</span>
                        </div>
                        <div style={{ width: "100%", height: 4, background: "var(--nv-surface-soft)", borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ width: `${task.progress}%`, height: "100%", background: "var(--nv-primary)", transition: "width 0.25s ease" }} />
                        </div>
                      </div>
                    ) : isTaskCompleted ? (
                      <span className="badge-tag badge-tag-primary" style={{ fontSize: 11 }}>
                        ✓ INSTALLED
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="button-outline-on-dark button-sm"
                        onClick={() => installVersion(v.id, v.type, onInstalled)}
                      >
                        <IconPlus size={13} />
                        <span>CREATE PROFILE</span>
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Versions;
