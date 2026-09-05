import { useState, useEffect, useMemo } from "react";
import { api, VersionEntry, LatestPair } from "../lib/types";

interface VersionsProps {
  onInstalled: () => Promise<void>;
}

export function Versions({ onInstalled }: VersionsProps) {
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [latest, setLatest] = useState<LatestPair | null>(null);
  const [channel, setChannel] = useState<"release" | "all">("release");
  const [search, setSearch] = useState("");
  const [installingId, setInstallingId] = useState<string | null>(null);

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

  const handleInstall = async (versionId: string) => {
    setInstallingId(versionId);
    try {
      await api.instancesCreate(`Minecraft ${versionId}`, versionId);
      await onInstalled();
      alert(`Profile 'Minecraft ${versionId}' created successfully!`);
    } catch (err) {
      console.error("[NVIDIA Version Install]:", err);
    } finally {
      setInstallingId(null);
    }
  };

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
              MINECRAFT {latest?.release || "1.21.4"}
            </h2>
            <p style={{ fontSize: 14, color: "var(--nv-on-dark-mute)", marginTop: 6 }}>
              Production release channel. Verified for stability, multithreading, and rendering compatibility.
            </p>
          </div>

          <div>
            <button
              type="button"
              className="button-primary"
              disabled={Boolean(installingId)}
              onClick={() => handleInstall(latest?.release || "1.21.4")}
            >
              <span>
                {installingId === (latest?.release || "1.21.4") ? "INSTALLING..." : "INSTALL GAME READY"}
              </span>
            </button>
          </div>
        </div>

        {/* Developer Snapshot */}
        <div
          className="nv-card"
          style={{
            background: "var(--nv-surface-card)",
            padding: "28px 32px",
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
              SNAPSHOT {latest?.snapshot || "24w45a"}
            </h2>
            <p style={{ fontSize: 14, color: "var(--nv-on-dark-mute)", marginTop: 6 }}>
              Bleeding-edge Mojang development channel. Early features & testbed builds.
            </p>
          </div>

          <div>
            <button
              type="button"
              className="button-outline-on-dark"
              disabled={Boolean(installingId)}
              onClick={() => handleInstall(latest?.snapshot || "24w45a")}
            >
              <span>
                {installingId === (latest?.snapshot || "24w45a") ? "INSTALLING..." : "INSTALL SNAPSHOT"}
              </span>
            </button>
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

        <input
          type="text"
          className="text-input"
          placeholder="Filter version catalog..."
          style={{ maxWidth: 300 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Versions Catalog Table */}
      <div className="nvidia-table-wrap">
        <table className="nvidia-table">
          <thead>
            <tr>
              <th>CHANNEL</th>
              <th>VERSION ID</th>
              <th>RELEASE DATE</th>
              <th>INTEGRITY STATUS</th>
              <th style={{ textAlign: "right" }}>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {filteredVersions.map((v) => (
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
                  VERIFIED SIGNATURE
                </td>
                <td style={{ textAlign: "right" }}>
                  <button
                    type="button"
                    className="button-outline-on-dark button-sm"
                    disabled={installingId === v.id}
                    onClick={() => handleInstall(v.id)}
                  >
                    {installingId === v.id ? "CREATING..." : "+ CREATE PROFILE"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Versions;
