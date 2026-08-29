import { useEffect, useState, useCallback } from "react";
import { api, Config, Instance } from "./lib/types";
import { Home } from "./screens/Home";
import { Instances } from "./screens/Instances";
import { Versions } from "./screens/Versions";
import { Downloads } from "./screens/Downloads";
import { Content } from "./screens/Content";
import { Settings } from "./screens/Settings";
import { AccountButton } from "./screens/AccountButton";

type Screen =
  | "home"
  | "instances"
  | "versions"
  | "downloads"
  | "content"
  | "settings";

const SCREENS: { id: Screen; label: string; icon: string }[] = [
  { id: "home", label: "Home", icon: "▣" },
  { id: "instances", label: "Instances", icon: "▤" },
  { id: "versions", label: "Versions", icon: "❖" },
  { id: "downloads", label: "Downloads", icon: "↧" },
  { id: "content", label: "Content", icon: "✦" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

export function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [config, setConfig] = useState<Config | null>(null);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [selected, setSelected] = useState<Instance | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [cfg, inst] = await Promise.all([
        api.configGet(),
        api.instancesList(),
      ]);
      setConfig(cfg);
      setInstances(inst);
      const cur =
        cfg.selected_instance != null
          ? inst.find((i) => i.id === cfg.selected_instance) ?? inst[0] ?? null
          : inst[0] ?? null;
      setSelected(cur);
    } catch (e) {
      setError(typeof e === "string" ? e : (e as any)?.message ?? String(e));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Polling: refresh instance list every 5s, but only when on the home screen.
  useEffect(() => {
    if (screen !== "home") return;
    const id = setInterval(() => {
      api.instancesList().then(setInstances).catch(() => {});
    }, 5000);
    return () => clearInterval(id);
  }, [screen]);

  const onSelect = useCallback(
    async (inst: Instance) => {
      setSelected(inst);
      try {
        await api.instancesSelect(inst.id);
      } catch {
        // ignore
      }
    },
    [],
  );

  const onConfigChange = useCallback(
    async (next: Config) => {
      setConfig(next);
      try {
        await api.configUpdate(next);
      } catch (e) {
        setError(typeof e === "string" ? e : String(e));
      }
    },
    [],
  );

  if (error) {
    return (
      <div className="app">
        <div className="content">
          <div className="card">
            <h3>Launcher error</h3>
            <p style={{ color: "var(--danger)" }}>{error}</p>
            <p className="muted" style={{ marginTop: 8 }}>
              Check the launcher log for details. Restart the launcher to retry.
            </p>
            <button
              className="btn"
              style={{ marginTop: 12 }}
              onClick={() => {
                setError(null);
                refresh();
              }}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="app">
        <div className="content">
          <div className="empty">
            <div className="icon">▣</div>
            <p>Loading launcher…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo" />
          <span>MC Launcher</span>
        </div>
        <nav className="nav">
          {SCREENS.map((s) => (
            <div
              key={s.id}
              className={`nav-item ${screen === s.id ? "active" : ""}`}
              onClick={() => setScreen(s.id)}
            >
              <span style={{ width: 14, opacity: 0.7 }}>{s.icon}</span>
              <span>{s.label}</span>
              {s.id === "instances" && instances.length > 0 && (
                <span className="badge">{instances.length}</span>
              )}
            </div>
          ))}
        </nav>
        <div
          style={{
            padding: "12px 16px",
            fontSize: 11,
            color: "var(--text-faint)",
            borderTop: "1px solid var(--border)",
          }}
        >
          v{(config && "0.1.0") || "0.1.0"}
        </div>
      </aside>
      <main className="main">
        <div className="titlebar">
          <span>MC Launcher</span>
          <div className="user">
            <AccountButton />
            {selected ? (
              <span className="muted" style={{ fontSize: 12, marginLeft: 12 }}>
                {selected.name} · {selected.version}
              </span>
            ) : (
              <span className="muted" style={{ fontSize: 12, marginLeft: 12 }}>
                No instance
              </span>
            )}
          </div>
        </div>
        <div className="content">
          {screen === "home" && (
            <Home
              config={config}
              instances={instances}
              selected={selected}
              onSelect={onSelect}
              onRefresh={refresh}
            />
          )}
          {screen === "instances" && (
            <Instances
              instances={instances}
              onChange={refresh}
              onSelect={(i) => {
                onSelect(i);
                setScreen("home");
              }}
            />
          )}
          {screen === "versions" && <Versions onInstalled={refresh} />}
          {screen === "downloads" && <Downloads />}
          {screen === "content" && <Content selected={selected} />}
          {screen === "settings" && (
            <Settings config={config} onChange={onConfigChange} />
          )}
        </div>
      </main>
    </div>
  );
}
