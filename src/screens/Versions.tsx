import { useEffect, useMemo, useState } from "react";
import { Button, ButtonGroup, Card, Chip, Input } from "@heroui/react";
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
          <Input
            type="text"
            className="search-bar frosted-glass-input"
            placeholder="Search versions (e.g. 1.21)…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              width: 240,
              fontSize: 13,
              background: "var(--glass-bg-interactive)",
              backdropFilter: "var(--glass-blur-sm)",
              WebkitBackdropFilter: "var(--glass-blur-sm)",
              borderColor: "var(--glass-border)",
            }}
          />
          {filter && (
            <Button
              variant="ghost"
              size="sm"
              onPress={() => setFilter("")}
              aria-label="Clear filter"
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
            </Button>
          )}
        </div>
      </div>

      {/* ButtonGroup Filter */}
      <div>
        <ButtonGroup>
          <Button
            variant={type === "release" ? "primary" : "outline"}
            size="sm"
            onPress={() => setType("release")}
          >
            <IconCheck size={14} style={{ opacity: type === "release" ? 1 : 0.4 }} />
            <span>Releases</span>
          </Button>

          <Button
            variant={type === "snapshot" ? "primary" : "outline"}
            size="sm"
            onPress={() => setType("snapshot")}
          >
            <span style={{ fontSize: 12 }}>⚡</span>
            <span>Snapshots</span>
          </Button>

          <Button
            variant={type === "modded" ? "primary" : "outline"}
            size="sm"
            onPress={() => setType("modded")}
          >
            <span style={{ fontSize: 12 }}>✦</span>
            <span>Modded (Popular)</span>
          </Button>

          <Button
            variant={type === "all" ? "primary" : "outline"}
            size="sm"
            onPress={() => setType("all")}
          >
            <span>All Versions</span>
          </Button>
        </ButtonGroup>
      </div>

      {/* Spotlight Cards for Latest Release & Snapshot */}
      {latest && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Card
            className="spotlight-card-release"
            style={{
              padding: "20px 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderLeft: "4px solid #10b981",
              position: "relative",
            }}
          >
            <Card.Content style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <Chip color="success" size="sm">
                    Latest Release
                  </Chip>
                  <strong style={{ fontSize: 17, color: "#ffffff" }}>
                    {latest.release}
                  </strong>
                </div>
                <span className="muted" style={{ fontSize: 12 }}>
                  Stable production release recommended for all players
                </span>
              </div>
              <Button
                variant="primary"
                size="sm"
                onPress={() => handleCreateInstance(latest.release)}
                style={{ padding: "6px 16px", fontSize: 12, gap: 6 }}
              >
                <IconPlus size={14} />
                <span>Install</span>
              </Button>
            </Card.Content>
          </Card>

          <Card
            className="spotlight-card-snapshot"
            style={{
              padding: "20px 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderLeft: "4px solid #f59e0b",
              position: "relative",
            }}
          >
            <Card.Content style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <Chip color="warning" size="sm">
                    Latest Snapshot
                  </Chip>
                  <strong style={{ fontSize: 17, color: "var(--md-sys-color-on-surface)" }}>
                    {latest.snapshot}
                  </strong>
                </div>
                <span className="muted" style={{ fontSize: 12 }}>
                  Development build previewing upcoming features
                </span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onPress={() => handleCreateInstance(latest.snapshot)}
                style={{ padding: "6px 16px", fontSize: 12, gap: 6 }}
              >
                <IconPlus size={14} />
                <span>Install</span>
              </Button>
            </Card.Content>
          </Card>
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
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <Card.Content style={{ padding: 0 }}>
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
                          <Chip
                            color={isRelease ? "success" : isSnapshot ? "warning" : "default"}
                            size="sm"
                          >
                            {v.type}
                          </Chip>
                        </td>
                        <td className="muted" style={{ fontSize: 12 }}>
                          {formatReleaseDate(v.releaseTime)}
                        </td>
                        <td className="muted" style={{ fontSize: 12, fontFamily: "var(--mono)" }}>
                          {isRelease ? "~28–36 MB client" : "~35 MB snapshot"}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <Button
                            variant="secondary"
                            size="sm"
                            onPress={() => handleCreateInstance(v.id)}
                            style={{ padding: "4px 12px", fontSize: 12, gap: 5 }}
                          >
                            <IconPlus size={13} />
                            <span>Create Instance</span>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filtered.length > 150 && (
              <p className="faint" style={{ margin: "12px 0", fontSize: 12, textAlign: "center" }}>
                Showing first 150 of {filtered.length} matching versions. Use search to find older builds.
              </p>
            )}
          </Card.Content>
        </Card>
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
