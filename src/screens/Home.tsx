import { useEffect, useRef, useState, ReactNode } from "react";
import { Button, Card, Chip, ProgressBar } from "@heroui/react";
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
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Welcome / Empty state if no instances */}
      {instances.length === 0 ? (
        <Card style={{ padding: "40px 32px", textAlign: "center" }}>
          <Card.Content>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: "10px",
                background: "#18181b",
                border: "1px solid #27272a",
                color: "#0070f3",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
              }}
            >
              <IconCube size={26} />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: "#ffffff" }}>
              Welcome to MC Launcher
            </h2>
            <p className="muted" style={{ maxWidth: 440, margin: "0 auto 24px", fontSize: 13.5, lineHeight: 1.5 }}>
              Create your first Minecraft instance to get started. Choose a version,
              tune memory, and jump straight into the game.
            </p>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <Button
                variant="primary"
                size="lg"
                onPress={() => {
                  onSelect({} as Instance);
                  onRefresh();
                }}
              >
                <IconPlus size={18} />
                <span>Create First Instance</span>
              </Button>
            </div>
          </Card.Content>
        </Card>
      ) : (
        /* Streamlined Hero Card */
        <Card className="home-hero hero-card" style={{ padding: "24px 28px" }}>
          <Card.Content style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center" }}>
            <div className="info" style={{ flex: 1, minWidth: 0, paddingRight: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                {selected?.color && (
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: selected.color,
                      boxShadow: `0 0 10px ${selected.color}`,
                      display: "inline-block",
                      flexShrink: 0,
                    }}
                  />
                )}
                <h1
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    letterSpacing: "-0.02em",
                    margin: 0,
                    color: "#ffffff",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={selected?.name}
                >
                  {selected ? selected.name : "No instance selected"}
                </h1>
              </div>

              {selected && (
                <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                  <Chip color="success" size="sm">
                    <IconCube size={13} />
                    <span>Minecraft {selected.version}</span>
                  </Chip>

                  {selected.mod_loader && (
                    <Chip variant="secondary" size="sm">
                      {selected.mod_loader.kind} {selected.mod_loader.version}
                    </Chip>
                  )}

                  <Chip size="sm">
                    <IconRam size={13} />
                    <span>{selected.ram_mb ?? config.default_ram_mb} MB</span>
                  </Chip>

                  {selected.jvm_profile && selected.jvm_profile !== "default" && (
                    <Chip size="sm" variant="secondary">
                      JVM: {selected.jvm_profile}
                    </Chip>
                  )}
                </div>
              )}

              {error && (
                <div
                  style={{
                    marginTop: 14,
                    padding: "8px 14px",
                    borderRadius: "8px",
                    background: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    color: "#ef4444",
                    fontSize: 12.5,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{error}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onPress={() => setError(null)}
                    style={{ fontSize: 11, padding: "2px 8px", color: "inherit" }}
                  >
                    Dismiss
                  </Button>
                </div>
              )}
            </div>

            {/* Play Button & State Indicator */}
            <div className="play" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              {state === "running" ? (
                <button
                  className="play-button"
                  onClick={kill}
                  title="Stop running instance"
                  style={{
                    background: "#ef4444",
                    color: "#ffffff",
                    boxShadow: "0 4px 16px rgba(239, 68, 68, 0.4)",
                  }}
                >
                  <IconStop size={26} />
                  <span style={{ fontSize: 11.5, fontWeight: 800, marginTop: 2 }}>STOP</span>
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
                      <IconRefresh size={24} style={{ animation: "indeterminate 1.5s infinite linear" }} />
                      <span style={{ fontSize: 11, fontWeight: 700, marginTop: 2 }}>PREPARING</span>
                    </>
                  ) : state === "launching" ? (
                    <>
                      <IconPlay size={24} style={{ opacity: 0.7 }} />
                      <span style={{ fontSize: 11, fontWeight: 700, marginTop: 2 }}>STARTING</span>
                    </>
                  ) : (
                    <>
                      <IconPlay size={30} />
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
                  fontSize: 11.5,
                  fontWeight: 600,
                  color:
                    state === "running"
                      ? "#10b981"
                      : state === "preparing"
                        ? "#f59e0b"
                        : state === "launching"
                          ? "#0070f3"
                          : "#a1a1aa",
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background:
                      state === "running"
                        ? "#10b981"
                        : state === "preparing"
                          ? "#f59e0b"
                          : state === "launching"
                            ? "#0070f3"
                            : "#52525b",
                    boxShadow:
                      state === "running"
                        ? "0 0 8px #10b981"
                        : state === "preparing"
                          ? "0 0 8px #f59e0b"
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
          </Card.Content>
        </Card>
      )}

      {/* Non-Redundant Key Activity Stats */}
      {selected && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 12,
          }}
        >
          <KpiCard
            icon={<IconClock size={15} />}
            label="Total Play Time"
            value={fmtTime(selected.play_time_secs)}
          />
          <KpiCard
            icon={<IconCalendar size={15} />}
            label="Last Launched"
            value={selected.last_played ? fmtDate(selected.last_played) : "Never played"}
          />
          <KpiCard
            icon={<IconRam size={15} />}
            label="Memory Allocation"
            value={`${selected.ram_mb ?? config.default_ram_mb} MB`}
          />
        </div>
      )}

      {/* Live Download & Prepare Progress Bar */}
      {state === "preparing" && (
        <Card>
          <Card.Content>
            <div className="row between" style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <IconRefresh size={16} style={{ color: "#0070f3", animation: "indeterminate 1.5s infinite linear" }} />
                <h3 style={{ margin: 0, textTransform: "none", fontSize: 14, fontWeight: 700 }}>
                  Preparing Game Files…
                </h3>
              </div>
              <Button
                variant="outline"
                size="sm"
                onPress={cancelPrepare}
                style={{ fontSize: 11.5, padding: "3px 10px" }}
              >
                Cancel
              </Button>
            </div>

            {progress ? (
              <PrepareProgress p={progress} />
            ) : (
              <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>
                Verifying Mojang manifest and local cache…
              </p>
            )}
          </Card.Content>
        </Card>
      )}

      {/* Sleek Horizontal Instance Switcher */}
      {instances.length > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 12px",
            background: "#121215",
            border: "1px solid #27272a",
            borderRadius: "10px",
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              color: "#71717a",
              whiteSpace: "nowrap",
            }}
          >
            Quick Switch
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, flex: 1 }}>
            {instances.map((i) => {
              const isCur = selected?.id === i.id;
              return (
                <Chip
                  key={i.id}
                  variant={isCur ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => onSelect(i)}
                  style={{
                    cursor: "pointer",
                    padding: "3px 10px",
                    gap: 6,
                    fontSize: 12,
                    fontWeight: isCur ? 700 : 500,
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: i.color || "#0070f3",
                    }}
                  />
                  <span>{i.name}</span>
                </Chip>
              );
            })}
          </div>
        </div>
      )}

      {/* Clean Game Output / Logs */}
      {showLogs && logs.length > 0 && (
        <Card>
          <Card.Content>
            <div className="row between" style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#ffffff" }}>Game Console Output</span>
              <div style={{ display: "flex", gap: 6 }}>
                <Button
                  variant="ghost"
                  size="sm"
                  style={{ fontSize: 11, padding: "2px 8px" }}
                  onPress={() => setLogs([])}
                >
                  Clear
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  style={{ fontSize: 11, padding: "2px 8px" }}
                  onPress={() => setShowLogs(false)}
                >
                  Hide
                </Button>
              </div>
            </div>
            <div className="log-view" ref={logBox} style={{ height: 220, borderRadius: "6px" }}>
              {logs.map((l, idx) => (
                <div key={idx} className={`log-line ${l.stream}`}>
                  {l.text}
                </div>
              ))}
            </div>
          </Card.Content>
        </Card>
      )}
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  accent = "#0070f3",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div
      style={{
        padding: "14px 16px",
        background: "#121215",
        border: "1px solid #27272a",
        borderRadius: "10px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#71717a", fontSize: 11.5, fontWeight: 600 }}>
        <span style={{ color: accent, display: "flex" }}>{icon}</span>
        <span>{label}</span>
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: "#ffffff" }}>{value}</div>
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
      <div className="row between" style={{ marginBottom: 8 }}>
        <span className="muted" style={{ fontSize: 12, fontFamily: "var(--mono)" }}>
          {indeterminate
            ? `${formatBytes(p.bytes_downloaded)} downloaded`
            : `${formatBytes(p.bytes_downloaded)} / ${formatBytes(p.bytes_total)}`}
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#0070f3" }}>
          {indeterminate
            ? `${p.completed} files done`
            : `${pct.toFixed(1)}% · ${formatSpeed(p.speed_bps)}${eta != null ? ` · ${formatDuration(eta)} left` : ""}`}
        </span>
      </div>

      <ProgressBar value={pct} isIndeterminate={indeterminate}>
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>
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
