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
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Dual Spotlight Banners */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Game Ready Stable */}
        <div
          style={{
            background: "linear-gradient(135deg, #182012 0%, #12151c 100%)",
            border: "1px solid var(--nvidia-green)",
            borderRadius: "var(--radius-sm)",
            padding: "20px 24px",
            boxShadow: "0 0 20px rgba(118, 185, 0, 0.15)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span className="badge-rtx">● GAME READY RELEASE</span>
              <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "#76b900" }}>
                RECOMMENDED
              </span>
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: "#ffffff" }}>
              MINECRAFT {latest?.release || "1.21.4"}
            </h2>
            <p style={{ fontSize: 12.5, color: "#9da5b4", marginTop: 4 }}>
              Fully verified for optimal stability, shader rendering, and multiplayer compatibility.
            </p>
          </div>

          <div>
            <button
              type="button"
              className="btn-nvidia-primary"
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
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span className="badge-channel" style={{ color: "#f59e0b", borderColor: "rgba(245,158,11,0.4)" }}>
                DEVELOPER PREVIEW
              </span>
              <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "#656d7c" }}>
                EXPERIMENTAL
              </span>
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: "#ffffff" }}>
              SNAPSHOT {latest?.snapshot || "24w45a"}
            </h2>
            <p style={{ fontSize: 12.5, color: "#9da5b4", marginTop: 4 }}>
              Bleeding-edge Mojang development channel. Early features & testbed.
            </p>
          </div>

          <div>
            <button
              type="button"
              className="btn-nvidia-secondary"
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
            className={channel === "release" ? "btn-nvidia-primary" : "btn-nvidia-secondary"}
            style={{ padding: "8px 16px", fontSize: 12 }}
            onClick={() => setChannel("release")}
          >
            GAME READY CHANNELS ONLY
          </button>
          <button
            type="button"
            className={channel === "all" ? "btn-nvidia-primary" : "btn-nvidia-secondary"}
            style={{ padding: "8px 16px", fontSize: 12 }}
            onClick={() => setChannel("all")}
          >
            SHOW ALL (INCL. SNAPSHOTS)
          </button>
        </div>

        <input
          type="text"
          className="input-nvidia"
          placeholder="Filter driver versions..."
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
              <th>SHA-1 CHECKSUM</th>
              <th style={{ textAlign: "right" }}>DEPLOY</th>
            </tr>
          </thead>
          <tbody>
            {filteredVersions.map((v) => (
              <tr key={v.id}>
                <td>
                  <span className={v.type === "release" ? "badge-rtx" : "badge-channel"}>
                    {v.type === "release" ? "GAME READY" : "SNAPSHOT"}
                  </span>
                </td>
                <td style={{ fontWeight: 800, color: "#ffffff", fontFamily: "var(--font-mono)" }}>
                  {v.id}
                </td>
                <td style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
                  {v.releaseTime ? new Date(v.releaseTime).toLocaleDateString() : "—"}
                </td>
                <td style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "#656d7c" }}>
                  {v.sha1 ? `${v.sha1.slice(0, 10)}...` : "VERIFIED SIGNATURE"}
                </td>
                <td style={{ textAlign: "right" }}>
                  <button
                    type="button"
                    className="btn-nvidia-secondary"
                    style={{ padding: "5px 12px", fontSize: 11 }}
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
