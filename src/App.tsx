import { useEffect, useState, useCallback, ReactNode } from "react";
import { api, Config, Instance } from "./lib/types";
import { Home } from "./screens/Home";
import { Instances } from "./screens/Instances";
import { Versions } from "./screens/Versions";
import { Downloads } from "./screens/Downloads";
import { Content } from "./screens/Content";
import { Settings } from "./screens/Settings";
import { AccountButton } from "./screens/AccountButton";
import {
  IconHome,
  IconInstances,
  IconVersions,
  IconDownloads,
  IconContent,
  IconSettings,
} from "./lib/icons";

type Screen =
  | "home"
  | "instances"
  | "versions"
  | "downloads"
  | "content"
  | "settings";

interface NavScreen {
  id: Screen;
  label: string;
  icon: (active: boolean) => ReactNode;
}

const SCREENS: NavScreen[] = [
  {
    id: "home",
    label: "Home",
    icon: () => <IconHome size={18} />,
  },
  {
    id: "instances",
    label: "Instances",
    icon: () => <IconInstances size={18} />,
  },
  {
    id: "versions",
    label: "Versions",
    icon: () => <IconVersions size={18} />,
  },
  {
    id: "downloads",
    label: "Downloads",
    icon: () => <IconDownloads size={18} />,
  },
  {
    id: "content",
    label: "Content",
    icon: () => <IconContent size={18} />,
  },
  {
    id: "settings",
    label: "Settings",
    icon: () => <IconSettings size={18} />,
  },
];

export function App() {
  // `MC_LAUNCHER_INITIAL_SCREEN` (env var) overrides the default screen.
  // Used by smoke tests to verify multiple pages in one run.
  const [screen, setScreen] = useState<Screen>("home");

  useEffect(() => {
    api.initialScreen()
      .then((s) => {
        if (
          s === "home" ||
          s === "instances" ||
          s === "versions" ||
          s === "downloads" ||
          s === "content" ||
          s === "settings"
        ) {
          setScreen(s);
        }
      })
      .catch(() => {});
  }, []);

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
          <div className="card" style={{ maxWidth: 500, margin: "60px auto" }}>
            <h3 style={{ color: "var(--md-sys-color-error)" }}>Launcher Error</h3>
            <p style={{ color: "var(--md-sys-color-on-surface)", marginBottom: 12 }}>
              {error}
            </p>
            <p className="muted" style={{ fontSize: 12, marginBottom: 16 }}>
              Check the launcher logs for technical details. You can retry now or restart the launcher.
            </p>
            <button
              className="btn primary"
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
        <div className="content" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="empty">
            <div className="icon" style={{ animation: "indeterminate 1.5s infinite ease-in-out" }}>
              <IconInstances size={42} />
            </div>
            <p style={{ fontSize: 16, fontWeight: 600 }}>Loading MC Launcher…</p>
            <span className="muted" style={{ fontSize: 12 }}>Connecting to runtime environment</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Material 3 Expressive Navigation Rail */}
      <aside className="sidebar">
        <div className="brand">
          <div className="logo" />
          <span>MC Launcher</span>
        </div>

        <nav className="nav">
          {SCREENS.map((s) => {
            const isActive = screen === s.id;
            return (
              <div
                key={s.id}
                className={`nav-item ${isActive ? "active" : ""}`}
                onClick={() => setScreen(s.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    setScreen(s.id);
                  }
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: isActive
                      ? "var(--md-sys-color-primary)"
                      : "var(--md-sys-color-on-surface-variant)",
                    transition: "color var(--md-sys-motion-duration-short) var(--md-sys-motion-easing-standard)",
                  }}
                >
                  {s.icon(isActive)}
                </span>
                <span>{s.label}</span>
                {s.id === "instances" && instances.length > 0 && (
                  <span className="badge">{instances.length}</span>
                )}
              </div>
            );
          })}
        </nav>

        {/* Navigation Rail Footer / Version Info */}
        <div
          style={{
            padding: "14px 18px",
            borderTop: "1px solid var(--md-sys-color-outline-variant)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              fontFamily: "var(--mono)",
              color: "var(--md-sys-color-on-surface-variant)",
              letterSpacing: "0.4px",
            }}
          >
            v0.1.0
          </span>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 11,
              color: "var(--md-sys-color-tertiary)",
              fontWeight: 500,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--md-sys-color-tertiary)",
                boxShadow: "0 0 6px var(--md-sys-color-tertiary)",
              }}
            />
            Ready
          </div>
        </div>
      </aside>

      {/* Main Content Area with Top App Bar */}
      <main className="main">
        {/* Top App Bar */}
        <header className="titlebar">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontWeight: 700, letterSpacing: "-0.01em" }}>MC Launcher</span>
            <span style={{ color: "var(--md-sys-color-outline)", fontSize: 13 }}>/</span>
            <span style={{ color: "var(--md-sys-color-on-surface-variant)", textTransform: "capitalize", fontWeight: 500 }}>
              {screen}
            </span>
          </div>

          <div className="user">
            {/* Selected Instance Status Chip */}
            {selected ? (
              <button
                className="chip"
                onClick={() => setScreen("home")}
                style={{
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  background: "var(--md-sys-color-surface-container)",
                  borderColor: "var(--md-sys-color-outline-variant)",
                }}
                title={`Active instance: ${selected.name} (${selected.version})`}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: selected.color || "var(--md-sys-color-primary)",
                    boxShadow: `0 0 6px ${selected.color || "var(--md-sys-color-primary)"}`,
                  }}
                />
                <span style={{ fontWeight: 600, color: "var(--md-sys-color-on-surface)" }}>
                  {selected.name}
                </span>
                <span style={{ color: "var(--md-sys-color-on-surface-variant)", fontSize: 11 }}>
                  · {selected.version}
                </span>
                {selected.mod_loader && (
                  <span
                    className="tag"
                    style={{
                      fontSize: 10,
                      padding: "1px 6px",
                      background: "rgba(167, 139, 250, 0.15)",
                      borderColor: "rgba(167, 139, 250, 0.3)",
                      color: "var(--md-sys-color-secondary)",
                    }}
                  >
                    {selected.mod_loader.kind}
                  </span>
                )}
              </button>
            ) : (
              <span
                className="chip"
                style={{
                  color: "var(--md-sys-color-on-surface-variant)",
                  fontSize: 11.5,
                }}
              >
                No instance
              </span>
            )}

            {/* Account Chip & Menu */}
            <AccountButton />
          </div>
        </header>

        {/* Screen Container with Smooth Entrance Animation */}
        <div key={screen} className="content">
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
