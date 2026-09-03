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
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Top Header */}
      <div className="row between" style={{ flexWrap: "wrap", gap: 12 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em", margin: 0, color: "#ffffff" }}>
          Downloads & Transfers
        </h2>

        {/* Live Status Chip */}
        <Chip
          color={isActive ? "warning" : "success"}
          size="sm"
          style={{ padding: "4px 12px", gap: 6 }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: isActive ? "#f59e0b" : "#10b981",
              boxShadow: isActive ? "0 0 8px #f59e0b" : "0 0 8px #10b981",
            }}
          />
          <span style={{ fontWeight: 600 }}>
            {isActive && p ? `${p.active} active transfers` : "Queue Idle"}
          </span>
        </Chip>
      </div>

      {/* Main Transfer Status Card */}
      <Card style={{ position: "relative" }}>
        <Card.Content>
          <div className="row between" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
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
                <h3 style={{ margin: 0, textTransform: "none", fontSize: 15, fontWeight: 700, color: "#ffffff" }}>
                  {isActive ? "Active Downloads Pipeline" : "No Active Downloads"}
                </h3>
                <span className="muted" style={{ fontSize: 12 }}>
                  {isActive ? "Parallel worker threads actively fetching game assets" : "All downloaded assets verified with SHA-1"}
                </span>
              </div>
            </div>

            {isActive && (
              <Button
                variant="danger"
                size="sm"
                onPress={async () => {
                  await api.downloadsCancel();
                }}
                style={{ padding: "4px 12px", fontSize: 12, gap: 5 }}
              >
                <IconStop size={14} />
                <span>Cancel</span>
              </Button>
            )}
          </div>

          {/* KPI Metrics */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 10,
              marginBottom: 16,
            }}
          >
            <KpiTile
              icon={<IconRefresh size={14} />}
              label="Active Files"
              value={String(p?.active ?? 0)}
              color={isActive ? "#0070f3" : undefined}
            />
            <KpiTile
              icon={<IconCheck size={14} />}
              label="Completed"
              value={String(p?.completed ?? 0)}
              color="#10b981"
            />
            <KpiTile
              icon={<IconStop size={14} />}
              label="Failed"
              value={String(p?.failed ?? 0)}
              color={p && p.failed > 0 ? "#ef4444" : undefined}
            />
            <KpiTile
              icon={<IconSpeed size={14} />}
              label="Speed"
              value={p ? formatSpeed(p.speed_bps) : "0 B/s"}
              color={isActive ? "#0070f3" : undefined}
            />
          </div>

          {/* Progress Bar & Details */}
          {isActive ? (
            <div>
              <div style={{ marginBottom: 6 }} className="row between">
                <span className="muted" style={{ fontSize: 12, fontFamily: "var(--mono)" }}>
                  {p ? formatBytes(p.bytes_downloaded) : "0 B"} / {p ? formatBytes(p.bytes_total) : "0 B"}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#0070f3" }}>
                  {indeterminate
                    ? "Calculating total size…"
                    : `${pct.toFixed(1)}%${eta != null ? ` · ${formatDuration(eta)} remaining` : ""}`}
                </span>
              </div>

              <ProgressBar value={pct} isIndeterminate={indeterminate}>
                <ProgressBar.Track>
                  <ProgressBar.Fill />
                </ProgressBar.Track>
              </ProgressBar>
            </div>
          ) : (
            <div
              style={{
                padding: "10px 14px",
                background: "#18181b",
                borderRadius: "8px",
                border: "1px solid #27272a",
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
                color: "#a1a1aa",
              }}
            >
              <IconCheck size={14} style={{ color: "#10b981" }} />
              <span>Smart local cache is synchronized. Subsequent launches verify hashes and reuse cached files.</span>
            </div>
          )}
        </Card.Content>
      </Card>
    </div>
  );
}

function KpiTile({
  icon,
  label,
  value,
  color,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div
      style={{
        padding: "10px 12px",
        background: "#18181b",
        border: "1px solid #27272a",
        borderRadius: "8px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 5, color: "#71717a", fontSize: 11, fontWeight: 600 }}>
        <span style={{ color: color || "#a1a1aa", display: "flex" }}>{icon}</span>
        <span>{label}</span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: color || "#ffffff" }}>
        {value}
      </div>
    </div>
  );
}
