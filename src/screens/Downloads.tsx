import { useEffect, useState } from "react";
import { api, formatBytes, formatDuration, formatSpeed, ProgressSnapshot } from "../lib/types";

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

  const pct = p && p.bytes_total > 0 ? (p.bytes_downloaded / p.bytes_total) * 100 : 0;
  const eta =
    p && p.speed_bps > 0 && p.bytes_total > p.bytes_downloaded
      ? (p.bytes_total - p.bytes_downloaded) / p.speed_bps
      : null;

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
        Downloads
      </h2>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row between" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>In-flight</h3>
          <div className="row" style={{ gap: 8 }}>
            <button
              className="btn"
              disabled={!p || p.active === 0}
              onClick={async () => {
                await api.downloadsCancel();
              }}
            >
              Cancel
            </button>
          </div>
        </div>

        <div className="kpi-row" style={{ marginBottom: 16 }}>
          <Kpi label="Active" value={String(p?.active ?? 0)} />
          <Kpi label="Completed" value={String(p?.completed ?? 0)} />
          <Kpi label="Failed" value={String(p?.failed ?? 0)} />
          <Kpi
            label="Speed"
            value={p ? formatSpeed(p.speed_bps) : "0 B/s"}
          />
        </div>

        <div style={{ marginBottom: 6 }} className="row between">
          <span className="muted" style={{ fontSize: 12 }}>
            {p ? formatBytes(p.bytes_downloaded) : "0 B"} /{" "}
            {p ? formatBytes(p.bytes_total) : "0 B"}
          </span>
          <span className="muted" style={{ fontSize: 12 }}>
            {pct.toFixed(1)}%{" "}
            {eta != null && `· ${formatDuration(eta)} remaining`}
          </span>
        </div>
        <div className="progress">
          <div className="bar" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="card">
        <h3>Cache</h3>
        <p className="muted" style={{ fontSize: 13 }}>
          Downloaded files are cached in the launcher's data directory. On
          the next launch, unchanged files are reused. Corrupt files are
          detected via SHA-1 and re-downloaded automatically.
        </p>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="kpi">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}
