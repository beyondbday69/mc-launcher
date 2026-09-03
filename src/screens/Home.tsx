import { useEffect, useRef, useState, ReactNode } from "react";
import {
  api,
  Config,
  formatBytes,
  formatDuration,
  formatSpeed,
  Instance,
  LogLine,
  ProgressSnapshot,
} from "../lib/types";
import {
  IconPlay,
  IconStop,
  IconClock,
  IconCalendar,
  IconCube,
  IconRam,
  IconSpeed,
  IconRefresh,
  IconPlus,
} from "../lib/icons";

interface HomeProps {
  config: Config;
  instances: Instance[];
  selected: Instance | null;
  onSelect: (i: Instance) => void;
  onRefresh: () => void;
}

type LaunchState = "idle" | "preparing" | "launching" | "running" | "error";

export function Home({ config, instances, selected, onSelect, onRefresh }: HomeProps) {
  const [state, setState] = useState<LaunchState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [progress, setProgress] = useState<ProgressSnapshot | null>(null);
  const logBox = useRef<HTMLDivElement | null>(null);
  const pollHandle = useRef<number | null>(null);
  const progressHandle = useRef<number | null>(null);

  // Poll download progress while preparing
  useEffect(() => {
    if (state !== "preparing") {
      if (progressHandle.current != null) {
        clearTimeout(progressHandle.current);
        progressHandle.current = null;
      }
      return;
    }
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      try {
        const s = await api.downloadsProgress();
        setProgress(s);
      } catch {
        // ignore
      }
      progressHandle.current = window.setTimeout(tick, 400);
    };
    tick();
    return () => {
      cancelled = true;
      if (progressHandle.current != null) {
        clearTimeout(progressHandle.current);
        progressHandle.current = null;
      }
    };
  }, [state]);

  useEffect(() => {
    if (showLogs && logBox.current) {
      logBox.current.scrollTop = logBox.current.scrollHeight;
    }
  }, [logs, showLogs]);

  // Poll for next log line when running
  useEffect(() => {
    if (state !== "running" || !selected) return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      try {
        const line = await api.launchNextLog(selected.id);
        if (line) {
          setLogs((prev) => [...prev.slice(-500), line]);
        }
        const running = await api.launchList();
        const alive = running.some(([id]) => id === selected.id);
        if (!alive) {
          setState("idle");
          return;
        }
      } catch {
        // ignore
      }
      pollHandle.current = window.setTimeout(tick, 250);
    };
    tick();
    return () => {
      cancelled = true;
      if (pollHandle.current != null) {
        clearTimeout(pollHandle.current);
        pollHandle.current = null;
      }
    };
  }, [state, selected]);

  const play = async () => {
    if (!selected) return;
    setError(null);
    setLogs([]);
    setShowLogs(true);
    setProgress(null);
    setState("preparing");
    try {
      await api.prepareLaunch(selected.id);
      setState("launching");
      await api.launchInstance(selected.id);
      setState("running");
    } catch (e) {
      setState("error");
      setError(typeof e === "string" ? e : (e as any)?.message ?? JSON.stringify(e));
    }
  };

  const cancelPrepare = async () => {
    try {
      await api.downloadsCancel();
    } catch {
      // ignore
    }
    setState("idle");
  };

  const kill = async () => {
    if (!selected) return;
    try {
      await api.launchKill(selected.id);
    } catch (e) {
      setError(String(e));
    }
    setState("idle");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Welcome / Empty state if no instance */}
      {instances.length === 0 ? (
        <div className="card" style={{ padding: "36px 32px", textAlign: "center" }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "var(--md-sys-color-primary-container)",
              color: "var(--md-sys-color-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <IconCube size={28} />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
            Welcome to MC Launcher
          </h2>
          <p className="muted" style={{ maxWidth: 460, margin: "0 auto 24px", fontSize: 14 }}>
            Create your first Minecraft instance to get started. Choose your preferred
            version, configure RAM, and jump straight into the game.
          </p>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <button
              className="btn primary large"
              onClick={() => {
                onSelect({} as Instance);
                onRefresh();
              }}
            >
              <IconPlus size={18} />
              <span>Create First Instance</span>
            </button>
          </div>
        </div>
      ) : (
        /* Material 3 Expressive Hero Card */
        <div className="home-hero">
          <div className="info">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              {selected?.color && (
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: selected.color,
                    boxShadow: `0 0 10px ${selected.color}`,
                    display: "inline-block",
                  }}
                />
              )}
              <h1>{selected ? selected.name : "No instance selected"}</h1>
            </div>

            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
              {selected && (
                <>
                  <span className="chip success">
                    <IconCube size={13} />
                    Minecraft {selected.version}
                  </span>

                  {selected.mod_loader && (
                    <span className="chip" style={{ background: "rgba(167, 139, 250, 0.15)", borderColor: "rgba(167, 139, 250, 0.3)", color: "var(--md-sys-color-secondary)" }}>
                      {selected.mod_loader.kind} {selected.mod_loader.version}
                    </span>
                  )}

                  <span className="chip">
                    <IconRam size={13} />
                    {selected.ram_mb ?? config.default_ram_mb} MB
                  </span>

                  <span className="chip">
                    JVM: {selected.jvm_profile}
                  </span>
                </>
              )}
            </div>

            {error && (
              <div
                style={{
                  marginTop: 16,
                  padding: "10px 14px",
                  borderRadius: "var(--md-sys-shape-corner-md)",
                  background: "var(--md-sys-color-error-container)",
                  color: "var(--md-sys-color-error)",
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <span>{error}</span>
                <button
                  className="btn ghost"
                  onClick={() => setError(null)}
                  style={{ fontSize: 11, padding: "2px 8px", color: "inherit" }}
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>

          {/* Heroic Play FAB */}
          <div className="play">
            {state === "running" ? (
              <button
                className="play-button"
                onClick={kill}
                title="Stop the running game"
                style={{
                  background: "linear-gradient(135deg, var(--md-sys-color-error) 0%, #b91c1c 100%)",
                  color: "#ffffff",
                  boxShadow: "0 4px 20px rgba(248, 113, 113, 0.5), 0 0 32px rgba(248, 113, 113, 0.3)",
                }}
              >
                <IconStop size={28} />
                <span style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>STOP</span>
              </button>
            ) : (
              <button
                className="play-button"
                onClick={play}
                disabled={!selected || state === "preparing" || state === "launching"}
                title={!selected ? "Select an instance first" : "Launch Minecraft"}
              >
                {state === "preparing" ? (
                  <>
                    <IconRefresh size={26} style={{ animation: "indeterminate 1.5s infinite linear" }} />
                    <span style={{ fontSize: 11, fontWeight: 700, marginTop: 2 }}>PREP…</span>
                  </>
                ) : state === "launching" ? (
                  <>
                    <IconPlay size={26} style={{ opacity: 0.7 }} />
                    <span style={{ fontSize: 11, fontWeight: 700, marginTop: 2 }}>LAUNCH…</span>
                  </>
                ) : (
                  <>
                    <IconPlay size={32} />
                    <span style={{ fontSize: 13, fontWeight: 800, marginTop: 2, letterSpacing: "0.5px" }}>PLAY</span>
                  </>
                )}
              </button>
            )}

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                fontWeight: 600,
                color:
                  state === "running"
                    ? "var(--md-sys-color-tertiary)"
                    : state === "preparing"
                      ? "var(--md-sys-color-warning)"
                      : state === "launching"
                        ? "var(--md-sys-color-primary)"
                        : "var(--md-sys-color-on-surface-variant)",
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background:
                    state === "running"
                      ? "var(--md-sys-color-tertiary)"
                      : state === "preparing"
                        ? "var(--md-sys-color-warning)"
                        : state === "launching"
                          ? "var(--md-sys-color-primary)"
                          : "var(--md-sys-color-outline)",
                  boxShadow:
                    state === "running"
                      ? "0 0 8px var(--md-sys-color-tertiary)"
                      : state === "preparing"
                        ? "0 0 8px var(--md-sys-color-warning)"
                        : "none",
                }}
              />
              {state === "running"
                ? "Running"
                : state === "preparing"
                  ? "Preparing files…"
                  : state === "launching"
                    ? "Starting JVM…"
                    : "Ready"}
            </div>
          </div>
        </div>
      )}

      {/* Expressive KPI Cards */}
      {selected && (
        <div className="kpi-row">
          <KpiCard
            icon={<IconClock size={16} />}
            label="Play time"
            value={fmtTime(selected.play_time_secs)}
          />
          <KpiCard
            icon={<IconCalendar size={16} />}
            label="Last played"
            value={selected.last_played ? fmtDate(selected.last_played) : "Never"}
          />
          <KpiCard
            icon={<IconCube size={16} />}
            label="Minecraft"
            value={selected.version}
          />
          <KpiCard
            icon={<IconRam size={16} />}
            label="Allocated RAM"
            value={`${selected.ram_mb ?? config.default_ram_mb} MB`}
          />
        </div>
      )}

      {/* Live Download & Prepare Progress Bar */}
      {state === "preparing" && (
        <div className="card" style={{ animation: "m3-fade-in var(--md-sys-motion-duration-short) var(--md-sys-motion-easing-standard)" }}>
          <div className="row between" style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "var(--md-sys-color-primary-container)",
                  color: "var(--md-sys-color-primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <IconRefresh size={16} style={{ animation: "indeterminate 1.5s infinite linear" }} />
              </div>
              <h3 style={{ margin: 0, textTransform: "none", fontSize: 15, fontWeight: 700 }}>
                Downloading & Preparing Game Files…
              </h3>
            </div>
            <button
              className="btn outlined"
              onClick={cancelPrepare}
              style={{ fontSize: 12, padding: "4px 12px" }}
            >
              Cancel
            </button>
          </div>

          {progress ? (
            <PrepareProgress p={progress} />
          ) : (
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>
              Connecting to Mojang & metadata repositories…
            </p>
          )}

          <p className="faint" style={{ fontSize: 11.5, marginTop: 12, marginBottom: 0 }}>
            Files are validated with SHA-1 hashes and cached locally. Subsequent launches bypass unchanged files.
          </p>
        </div>
      )}

      {/* Switch Instance Selector with M3 Chips */}
      {instances.length > 1 && (
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Switch instance</h3>
            <span className="muted" style={{ fontSize: 12 }}>
              {instances.length} instances installed
            </span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {instances.map((i) => {
              const isCur = selected?.id === i.id;
              return (
                <button
                  key={i.id}
                  className={`chip ${isCur ? "active" : ""}`}
                  onClick={() => onSelect(i)}
                  style={{
                    cursor: "pointer",
                    padding: "6px 14px",
                    gap: 8,
                    fontSize: 12.5,
                    fontWeight: isCur ? 700 : 500,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: i.color || "var(--md-sys-color-primary)",
                    }}
                  />
                  <span>{i.name}</span>
                  <span style={{ fontSize: 11, opacity: 0.75 }}>
                    ({i.version})
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Game Output / Logs */}
      {showLogs && logs.length > 0 && (
        <div className="card">
          <div className="row between" style={{ marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>Game output</h3>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn ghost"
                style={{ fontSize: 12, padding: "4px 10px" }}
                onClick={() => setLogs([])}
              >
                Clear
              </button>
              <button
                className="btn ghost"
                style={{ fontSize: 12, padding: "4px 10px" }}
                onClick={() => setShowLogs(false)}
              >
                Hide
              </button>
            </div>
          </div>
          <div className="log-view" ref={logBox} style={{ height: 260 }}>
            {logs.map((l, idx) => (
              <div key={idx} className={`log-line ${l.stream}`}>
                {l.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="kpi">
      <div style={{ display: "flex", alignItems: "center", gap: 7, color: "var(--md-sys-color-on-surface-variant)" }}>
        <span style={{ color: "var(--md-sys-color-primary)", opacity: 0.9 }}>{icon}</span>
        <div className="label" style={{ margin: 0 }}>{label}</div>
      </div>
      <div className="value" style={{ marginTop: 6 }}>{value}</div>
    </div>
  );
}

function PrepareProgress({ p }: { p: ProgressSnapshot }) {
  const pct = p.bytes_total > 0 ? (p.bytes_downloaded / p.bytes_total) * 100 : 0;
  const eta =
    p.speed_bps > 0 && p.bytes_total > p.bytes_downloaded
      ? (p.bytes_total - p.bytes_downloaded) / p.speed_bps
      : null;
  const indeterminate = p.bytes_total === 0;

  return (
    <div>
      <div className="kpi-row" style={{ marginBottom: 14 }}>
        <KpiCard icon={<IconRefresh size={14} />} label="Active" value={String(p.active)} />
        <KpiCard icon={<IconCube size={14} />} label="Completed" value={String(p.completed)} />
        <KpiCard icon={<IconStop size={14} />} label="Failed" value={String(p.failed)} />
        <KpiCard icon={<IconSpeed size={14} />} label="Speed" value={formatSpeed(p.speed_bps)} />
      </div>

      <div className="row between" style={{ marginBottom: 8 }}>
        <span className="muted" style={{ fontSize: 12.5, fontWeight: 500 }}>
          {indeterminate
            ? `${formatBytes(p.bytes_downloaded)} downloaded…`
            : `${formatBytes(p.bytes_downloaded)} of ${formatBytes(p.bytes_total)}`}
        </span>
        <span className="muted" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--md-sys-color-primary)" }}>
          {indeterminate
            ? `${p.completed} files done`
            : `${pct.toFixed(1)}%${eta != null ? ` · ${formatDuration(eta)} left` : ""}`}
        </span>
      </div>

      <div className={`progress ${indeterminate ? "indeterminate" : ""}`}>
        <div
          className="bar"
          style={{
            width: indeterminate ? "40%" : `${Math.min(100, pct)}%`,
          }}
        />
      </div>
    </div>
  );
}

function fmtTime(s: number): string {
  if (!s) return "0h 0m";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}
