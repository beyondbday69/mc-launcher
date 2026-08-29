import { useEffect, useRef, useState } from "react";
import { api, Config, Instance, LogLine } from "../lib/types";

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
  const logBox = useRef<HTMLDivElement | null>(null);
  const pollHandle = useRef<number | null>(null);

  useEffect(() => {
    if (showLogs && logBox.current) {
      logBox.current.scrollTop = logBox.current.scrollHeight;
    }
  }, [logs, showLogs]);

  // Poll for next log line.
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
        // Check if process is still alive.
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
    <div>
      {instances.length === 0 ? (
        <div className="card">
          <h3>Welcome</h3>
          <p className="muted" style={{ marginBottom: 16 }}>
            Create your first instance to get started. Pick a Minecraft
            version, choose your Java, and press Play.
          </p>
          <div className="row" style={{ gap: 8 }}>
            <button
              className="btn primary"
              onClick={() => { onSelect({} as Instance); onRefresh(); }}
            >
              Get started
            </button>
          </div>
          <p className="faint" style={{ marginTop: 12, fontSize: 12 }}>
            Go to <strong>Instances</strong> in the sidebar to create one.
          </p>
        </div>
      ) : (
        <div className="home-hero">
          <div className="info">
            <h1>{selected ? selected.name : "No instance selected"}</h1>
            <p>
              {selected
                ? `Minecraft ${selected.version} · ${selected.jvm_profile} JVM · ${selected.ram_mb ?? config.default_ram_mb} MB`
                : "Select an instance in the sidebar."}
            </p>
            {selected?.mod_loader && (
              <p style={{ marginTop: 4 }}>
                <span className="tag">{selected.mod_loader.kind}</span>{" "}
                <span className="muted" style={{ fontSize: 12 }}>
                  {selected.mod_loader.version}
                </span>
              </p>
            )}
            {error && (
              <p
                style={{
                  marginTop: 12,
                  color: "var(--danger)",
                  fontSize: 13,
                }}
              >
                {error}
              </p>
            )}
          </div>
          <div className="play">
            {state === "running" ? (
              <button
                className="play-button"
                onClick={kill}
                title="Stop the running game"
                style={{
                  background: "var(--danger-soft)",
                  color: "var(--danger)",
                }}
              >
                Stop
              </button>
            ) : (
              <button
                className="play-button"
                onClick={play}
                disabled={!selected || state === "preparing" || state === "launching"}
                title="Play"
              >
                {state === "preparing"
                  ? "Prep…"
                  : state === "launching"
                    ? "Launch…"
                    : "Play"}
              </button>
            )}
            <span className="muted" style={{ fontSize: 12 }}>
              {state === "running" ? "Running" : "Ready"}
            </span>
          </div>
        </div>
      )}

      {selected && (
        <div className="kpi-row" style={{ marginBottom: 20 }}>
          <Kpi label="Play time" value={fmtTime(selected.play_time_secs)} />
          <Kpi
            label="Last played"
            value={selected.last_played ? fmtDate(selected.last_played) : "—"}
          />
          <Kpi label="Minecraft" value={selected.version} />
          <Kpi
            label="Memory"
            value={`${selected.ram_mb ?? config.default_ram_mb} MB`}
          />
        </div>
      )}

      {instances.length > 1 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3>Switch instance</h3>
          <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
            {instances.map((i) => (
              <button
                key={i.id}
                className={`btn ${selected?.id === i.id ? "primary" : ""}`}
                onClick={() => onSelect(i)}
              >
                {i.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {showLogs && logs.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div
            className="row between"
            style={{ marginBottom: 8 }}
          >
            <h3 style={{ margin: 0 }}>Game output</h3>
            <button className="btn ghost" onClick={() => setShowLogs(false)}>
              Hide
            </button>
          </div>
          <div className="log-view" ref={logBox} style={{ height: 280 }}>
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

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="kpi">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}

function fmtTime(s: number): string {
  if (!s) return "0h";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
