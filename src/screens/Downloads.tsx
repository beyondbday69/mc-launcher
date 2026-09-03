import { useEffect, useState, ReactNode } from "react";
import { Button, Card, Chip, ProgressBar } from "@heroui/react";
import {
  api,
  formatBytes,
  formatDuration,
  formatSpeed,
  ProgressSnapshot,
} from "../lib/types";
import {
  IconDownloads,
  IconRefresh,
  IconCheck,
  IconStop,
  IconSpeed,
  IconFolder,
} from "../lib/icons";

export function Downloads() {
  const [p, setP] = useState<ProgressSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      try {
        const s = await api.downloadsProgress();
        setP(s);
      } catch {
        // ignore
      }
      setTimeout(tick, 500);
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, []);

  const isActive = Boolean(p && p.active > 0);
  const pct = p && p.bytes_total > 0 ? (p.bytes_downloaded / p.bytes_total) * 100 : 0;
  const eta =
    p && p.speed_bps > 0 && p.bytes_total > p.bytes_downloaded
      ? (p.bytes_total - p.bytes_downloaded) / p.speed_bps
      : null;
  const indeterminate = Boolean(isActive && (!p || p.bytes_total === 0));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Top Header */}
      <div className="row between" style={{ flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em" }}>
            Downloads & Transfer Queue
          </h2>
          <span className="muted" style={{ fontSize: 12 }}>
            Real-time pipeline monitoring for game client, assets, libraries, and mods
          </span>
        </div>

        {/* Live Status Chip */}
        <Chip
          color={isActive ? "warning" : "success"}
          style={{ padding: "4px 12px", gap: 8 }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: isActive
                ? "var(--md-sys-color-warning)"
                : "var(--md-sys-color-tertiary)",
              boxShadow: isActive
                ? "0 0 8px var(--md-sys-color-warning)"
                : "0 0 8px var(--md-sys-color-tertiary)",
            }}
          />
          <span style={{ fontWeight: 600 }}>
            {isActive && p ? `${p.active} active transfers` : "Queue Idle"}
          </span>
        </Chip>
      </div>

      {/* Active Transfer Card */}
      <Card style={{ position: "relative" }}>
        <Card.Content>
          <div className="row between" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: "8px",
                  background: "#18181b",
                  color: isActive ? "#0070f3" : "#a1a1aa",
                  border: "1px solid #27272a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <IconDownloads size={18} />
              </div>
              <div>
                <h3 style={{ margin: 0, textTransform: "none", fontSize: 16, fontWeight: 700 }}>
                  In-Flight Transfers
                </h3>
                <span className="muted" style={{ fontSize: 12 }}>
                  {isActive ? "Downloading files with parallel workers" : "No downloads currently in progress"}
                </span>
              </div>
            </div>

            <Button
              variant="danger"
              isDisabled={!p || p.active === 0}
              onPress={async () => {
                await api.downloadsCancel();
              }}
              style={{ padding: "6px 14px", fontSize: 12, gap: 6 }}
            >
              <IconStop size={14} />
              <span>Cancel Transfers</span>
            </Button>
          </div>

          {/* Expressive KPI Grid */}
          <div className="kpi-row" style={{ marginBottom: 20 }}>
            <KpiTile
              icon={<IconRefresh size={16} />}
              label="Active Files"
              value={String(p?.active ?? 0)}
              highlight={isActive ? "primary" : undefined}
            />
            <KpiTile
              icon={<IconCheck size={16} />}
              label="Completed Files"
              value={String(p?.completed ?? 0)}
              highlight="tertiary"
            />
            <KpiTile
              icon={<IconStop size={16} />}
              label="Failed Retries"
              value={String(p?.failed ?? 0)}
              highlight={p && p.failed > 0 ? "error" : undefined}
            />
            <KpiTile
              icon={<IconSpeed size={16} />}
              label="Transfer Speed"
              value={p ? formatSpeed(p.speed_bps) : "0 B/s"}
              highlight={isActive ? "primary" : undefined}
            />
          </div>

          {/* Progress Bar & Readout */}
          <div style={{ marginBottom: 8 }} className="row between">
            <span className="muted" style={{ fontSize: 12.5, fontWeight: 500, fontFamily: "var(--mono)" }}>
              {p ? formatBytes(p.bytes_downloaded) : "0 B"} / {p ? formatBytes(p.bytes_total) : "0 B"}
            </span>
            <span
              className="muted"
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: isActive ? "#0070f3" : "#a1a1aa",
              }}
            >
              {indeterminate
                ? "Calculating total size…"
                : `${pct.toFixed(1)}%${eta != null ? ` · ${formatDuration(eta)} remaining` : ""}`}
            </span>
          </div>

          <ProgressBar
            value={pct}
            isIndeterminate={indeterminate}
          >
            <ProgressBar.Track>
              <ProgressBar.Fill />
            </ProgressBar.Track>
          </ProgressBar>
        </Card.Content>
      </Card>

      {/* Cache & Local Verification Card */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card style={{ position: "relative" }}>
          <Card.Content>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <IconCheck size={18} style={{ color: "#10b981" }} />
              <h3 style={{ margin: 0, textTransform: "none", fontSize: 14, fontWeight: 700 }}>
                SHA-1 Integrity Verification
              </h3>
            </div>
            <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
              Every downloaded artifact (game client jar, Minecraft libraries, sound files, and mod assets)
              is strictly checked against cryptographic SHA-1 hashes before being written to disk. Corrupted
              chunks are automatically discarded and re-fetched.
            </p>
          </Card.Content>
        </Card>

        <Card style={{ position: "relative" }}>
          <Card.Content>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <IconFolder size={18} style={{ color: "#0070f3" }} />
              <h3 style={{ margin: 0, textTransform: "none", fontSize: 14, fontWeight: 700 }}>
                Smart Local Cache
              </h3>
            </div>
            <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
              Unchanged assets are preserved across launches and instances. Once an asset exists in the
              local cache, launcher preparations skip it entirely, ensuring near-instant launches for
              previously played versions.
            </p>
          </Card.Content>
        </Card>
      </div>
    </div>
  );
}

function KpiTile({
  icon,
  label,
  value,
  highlight,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  highlight?: "primary" | "tertiary" | "error";
}) {
  const accentColor =
    highlight === "primary"
      ? "#0070f3"
      : highlight === "tertiary"
        ? "#10b981"
        : highlight === "error"
          ? "#ef4444"
          : "#a1a1aa";

  return (
    <Card className="kpi">
      <Card.Content>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-muted)" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 26,
              height: 26,
              borderRadius: "6px",
              background: "#18181b",
              border: "1px solid #27272a",
              color: accentColor,
            }}
          >
            {icon}
          </span>
          <div className="label" style={{ margin: 0 }}>{label}</div>
        </div>
        <div className="value" style={{ marginTop: 8, color: highlight ? accentColor : undefined }}>
          {value}
        </div>
      </Card.Content>
    </Card>
  );
}
