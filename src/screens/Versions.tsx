import { useEffect, useMemo, useState } from "react";
import { api, VersionEntry } from "../lib/types";
import {
  IconCube,
  IconPlus,
  IconCheck,
  IconRefresh,
} from "../lib/icons";

interface Props {
  onInstalled: () => void;
}

type VersionFilterType = "all" | "release" | "snapshot" | "modded";

// Widely used modded Minecraft versions for the "modded" filter chip
const KNOWN_MODDED_VERSIONS = new Set([
  "1.21.4", "1.21.3", "1.21.1", "1.21",
  "1.20.6", "1.20.4", "1.20.2", "1.20.1", "1.20",
  "1.19.4", "1.19.2", "1.19",
  "1.18.2", "1.18.1", "1.18",
  "1.17.1", "1.16.5", "1.15.2", "1.14.4", "1.12.2", "1.7.10"
]);

export function Versions({ onInstalled }: Props) {
  const [all, setAll] = useState<VersionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [type, setType] = useState<VersionFilterType>("release");
  const [latest, setLatest] = useState<{ release: string; snapshot: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [vs, lt] = await Promise.all([
          api.versionsList(true, false),
          api.versionsLatest(),
        ]);
        setAll(vs);
        setLatest(lt);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    return all.filter((v) => {
      if (filter && !v.id.toLowerCase().includes(filter.toLowerCase())) {
        return false;
      }
      if (type === "release" && v.type !== "release") return false;
      if (type === "snapshot" && v.type !== "snapshot") return false;
      if (type === "modded" && !KNOWN_MODDED_VERSIONS.has(v.id)) return false;
      return true;
    });
  }, [all, filter, type]);

  const handleCreateInstance = async (versionId: string) => {
    const defaultName = `Minecraft ${versionId}`;
    const name = prompt(`Create new instance using Minecraft ${versionId}:`, defaultName);
    if (!name?.trim()) return;

    try {
      await api.instancesCreate(name.trim(), versionId);
      onInstalled();
      alert(`Instance "${name.trim()}" created successfully! It will prepare game files on first launch.`);
    } catch (e) {
      alert(String(e));
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Top Search & Filter Bar */}
      <div className="row between" style={{ flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em" }}>
            Minecraft Versions
          </h2>
          <span className="muted" style={{ fontSize: 12 }}>
            Official Mojang version manifest with SHA-1 asset hashes
          </span>
        </div>

        <div style={{ position: "relative" }}>
          <input
            type="text"
            placeholder="Search versions (e.g. 1.21)…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ width: 240, fontSize: 13 }}
          />
          {filter && (
            <button
              className="btn ghost"
              onClick={() => setFilter("")}
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                padding: "2px 6px",
                fontSize: 12,
                color: "var(--md-sys-color-on-surface-variant)",
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Material 3 Filter Chips */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          className={`chip ${type === "release" ? "active" : ""}`}
          onClick={() => setType("release")}
          style={{ cursor: "pointer", padding: "6px 14px" }}
        >
          <IconCheck size={14} style={{ opacity: type === "release" ? 1 : 0.4 }} />
          <span>Releases</span>
        </button>

        <button
          type="button"
          className={`chip ${type === "snapshot" ? "active" : ""}`}
          onClick={() => setType("snapshot")}
          style={{ cursor: "pointer", padding: "6px 14px" }}
        >
          <span style={{ fontSize: 12 }}>⚡</span>
          <span>Snapshots</span>
        </button>

        <button
          type="button"
          className={`chip ${type === "modded" ? "active" : ""}`}
          onClick={() => setType("modded")}
          style={{ cursor: "pointer", padding: "6px 14px" }}
        >
          <span style={{ fontSize: 12 }}>✦</span>
          <span>Modded (Popular)</span>
        </button>

        <button
          type="button"
          className={`chip ${type === "all" ? "active" : ""}`}
          onClick={() => setType("all")}
          style={{ cursor: "pointer", padding: "6px 14px" }}
        >
          <span>All Versions</span>
        </button>
      </div>

      {/* Latest Version Cards */}
      {latest && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div
            className="card"
            style={{
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderLeft: "4px solid var(--md-sys-color-tertiary)",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span className="tag success" style={{ fontSize: 11 }}>
                  Latest Release
                </span>
                <strong style={{ fontSize: 16, color: "var(--md-sys-color-on-surface)" }}>
                  {latest.release}
                </strong>
              </div>
              <span className="muted" style={{ fontSize: 12 }}>
                Stable production release recommended for all players
              </span>
            </div>
            <button
              className="btn primary"
              onClick={() => handleCreateInstance(latest.release)}
              style={{ padding: "6px 14px", fontSize: 12, gap: 5 }}
            >
              <IconPlus size={14} />
              <span>Install</span>
            </button>
          </div>

          <div
            className="card"
            style={{
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderLeft: "4px solid var(--md-sys-color-warning)",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span className="tag warning" style={{ fontSize: 11 }}>
                  Latest Snapshot
                </span>
                <strong style={{ fontSize: 16, color: "var(--md-sys-color-on-surface)" }}>
                  {latest.snapshot}
                </strong>
              </div>
              <span className="muted" style={{ fontSize: 12 }}>
                Development build previewing upcoming features
              </span>
            </div>
            <button
              className="btn tonal"
              onClick={() => handleCreateInstance(latest.snapshot)}
              style={{ padding: "6px 14px", fontSize: 12, gap: 5 }}
            >
              <IconPlus size={14} />
              <span>Install</span>
            </button>
          </div>
        </div>
      )}

      {/* Content Table or Loading */}
      {loading ? (
        <div className="empty">
          <div className="icon">
            <IconRefresh size={40} style={{ animation: "indeterminate 1.5s infinite linear" }} />
          </div>
          <p style={{ fontSize: 16, fontWeight: 600 }}>Fetching versions from Mojang…</p>
          <span className="muted" style={{ fontSize: 12 }}>
            Parsing launch manifest & asset index
          </span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty">
          <div className="icon">
            <IconCube size={40} />
          </div>
          <p style={{ fontSize: 16, fontWeight: 600 }}>No versions match filters</p>
          <p className="faint" style={{ fontSize: 12 }}>
            Try clearing the search query or switching to "All Versions".
          </p>
        </div>
      ) : (
        <div>
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Type</th>
                  <th>Release Date</th>
                  <th>Estimated Size</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 150).map((v) => {
                  const isRelease = v.type === "release";
                  const isSnapshot = v.type === "snapshot";

                  return (
                    <tr key={v.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <IconCube size={15} style={{ color: "var(--md-sys-color-primary)", opacity: 0.8 }} />
                          <span style={{ fontWeight: 600, color: "var(--md-sys-color-on-surface)" }}>
                            {v.id}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`tag ${
                            isRelease ? "success" : isSnapshot ? "warning" : ""
                          }`}
                          style={{ fontSize: 11 }}
                        >
                          {v.type}
                        </span>
                      </td>
                      <td className="muted" style={{ fontSize: 12 }}>
                        {formatReleaseDate(v.releaseTime)}
                      </td>
                      <td className="muted" style={{ fontSize: 12, fontFamily: "var(--mono)" }}>
                        {isRelease ? "~28–36 MB client" : "~35 MB snapshot"}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          className="btn tonal"
                          onClick={() => handleCreateInstance(v.id)}
                          style={{ padding: "4px 12px", fontSize: 12, gap: 5 }}
                        >
                          <IconPlus size={13} />
                          <span>Create Instance</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filtered.length > 150 && (
            <p className="faint" style={{ marginTop: 12, fontSize: 12, textAlign: "center" }}>
              Showing first 150 of {filtered.length} matching versions. Use search to find older builds.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function formatReleaseDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}
