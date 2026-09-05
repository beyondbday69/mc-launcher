import { useEffect, useState, useCallback, ReactNode } from "react";
import { api, Config, Instance, formatDuration } from "./lib/types";
import { TaskManagerProvider, useTaskManager } from "./lib/taskManager";
import { Home } from "./screens/Home";
import { Instances } from "./screens/Instances";
import { Versions } from "./screens/Versions";
import { Downloads } from "./screens/Downloads";
import { Content } from "./screens/Content";
import { Settings } from "./screens/Settings";
import { MinecraftGameWindow } from "./components/MinecraftGameWindow";
import { AccountButton } from "./screens/AccountButton";
import {
  IconHome,
  IconInstances,
  IconVersions,
  IconDownloads,
  IconContent,
  IconSettings,
} from "./lib/icons";

export type Screen =
  | "home"
  | "instances"
  | "versions"
  | "downloads"
  | "content"
  | "settings";

interface NavScreen {
  id: Screen;
  label: string;
  category: string;
  icon: () => ReactNode;
}

const SCREENS: NavScreen[] = [
  {
    id: "home",
    label: "Dashboard",
    category: "HOME",
    icon: () => <IconHome size={18} />,
  },
  {
    id: "instances",
    label: "Game Library",
    category: "GAMES",
    icon: () => <IconInstances size={18} />,
  },
  {
    id: "versions",
    label: "Driver Catalog",
    category: "DRIVERS",
    icon: () => <IconVersions size={18} />,
  },
  {
    id: "downloads",
    label: "Transfers",
    category: "NETWORK",
    icon: () => <IconDownloads size={18} />,
  },
  {
    id: "content",
    label: "Mods & Packs",
    category: "CONTENT",
    icon: () => <IconContent size={18} />,
  },
  {
    id: "settings",
    label: "Settings & Tuning",
    category: "TUNING",
    icon: () => <IconSettings size={18} />,
  },
];

function AppContent() {
  const [screen, setScreen] = useState<Screen>("home");
  const { gameSession, activeDlCount } = useTaskManager();

  // Deep linking and CLI / smoke test initial screen support
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paramScreen = params.get("screen");
    if (
      paramScreen === "home" ||
      paramScreen === "instances" ||
      paramScreen === "versions" ||
      paramScreen === "downloads" ||
      paramScreen === "content" ||
      paramScreen === "settings"
    ) {
      setScreen(paramScreen);
      return;
    }

    api
      .initialScreen()
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

  const refresh = useCallback(async () => {
    try {
      const [cfg, insts] = await Promise.all([
        api.configGet(),
        api.instancesList(),
      ]);
      setConfig(cfg);
      setInstances(insts);

      if (cfg.selected_instance) {
        const found = insts.find((i) => i.id === cfg.selected_instance);
        setSelected(found || insts[0] || null);
      } else if (insts.length > 0) {
        setSelected(insts[0]);
      }
    } catch (err) {
      console.error("[NVIDIA App] refresh error:", err);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onSelect = useCallback(
    async (inst: Instance) => {
      setSelected(inst);
      try {
        await api.instancesSelect(inst.id);
        if (config) {
          setConfig({ ...config, selected_instance: inst.id });
        }
      } catch (err) {
        console.error("[NVIDIA App] select instance error:", err);
      }
    },
    [config]
  );

  const onConfigChange = useCallback(async (newConfig: Config) => {
    setConfig(newConfig);
    try {
      await api.configUpdate(newConfig);
    } catch (err) {
      console.error("[NVIDIA App] update config error:", err);
    }
  }, []);

  return (
    <div className="app">
      {/* NVIDIA Sidebar Navigation Rail */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path
                d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="#000000"
                strokeWidth="2.5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="brand-info">
            <span className="brand-title">NVIDIA LAUNCHER</span>
            <span className="brand-sub">SYSTEM RUNTIME</span>
          </div>
        </div>

        <nav className="nav">
          {SCREENS.map((s) => {
            const isActive = screen === s.id;
            return (
              <button
                key={s.id}
                type="button"
                className={`nav-item ${isActive ? "active" : ""}`}
                onClick={() => setScreen(s.id)}
              >
                <div className="nav-icon">{s.icon()}</div>
                <span>{s.label}</span>
                {s.id === "instances" && instances.length > 0 && (
                  <span className="nav-badge">{instances.length}</span>
                )}
                {s.id === "downloads" && activeDlCount > 0 && (
                  <span
                    className="nav-badge"
                    style={{
                      background: "var(--nv-primary)",
                      color: "#000000",
                      fontWeight: 800,
                    }}
                  >
                    {activeDlCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="status-indicator-live">
            <div className="status-dot-solid" />
            <span>SYSTEM OPTIMAL</span>
          </div>
          <span style={{ color: "var(--nv-mute)" }}>v0.1.0</span>
        </div>
      </aside>

      {/* Main Viewport */}
      <main className="main">
        <header className="header">
          <div className="header-left">
            {gameSession.status === "running" ? (
              <div className="header-status-badge header-status-running">
                <div className="running-dot" style={{ width: 6, height: 6 }} />
                <span>
                  RUNNING: {gameSession.instanceName || "GAME"} (
                  {formatDuration(gameSession.runTimeSecs)})
                </span>
              </div>
            ) : gameSession.status === "preparing" ? (
              <div className="header-status-badge header-status-preparing">
                <span>●</span>
                <span>PREPARING PIPELINE {gameSession.progress}%</span>
              </div>
            ) : activeDlCount > 0 ? (
              <div className="header-status-badge header-status-dl">
                <span>↓</span>
                <span>DOWNLOADING ({activeDlCount} ACTIVE)</span>
              </div>
            ) : (
              <div className="header-status-badge">
                <span>●</span>
                <span>ENGINE READY</span>
              </div>
            )}

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                color: "var(--nv-on-dark-mute)",
              }}
            >
              <span style={{ color: "var(--nv-mute)" }}>NVIDIA</span>
              <span>/</span>
              <span
                style={{
                  color: "#ffffff",
                  fontWeight: 700,
                  textTransform: "uppercase",
                }}
              >
                {SCREENS.find((s) => s.id === screen)?.label || "Dashboard"}
              </span>
            </div>
          </div>

          <div className="header-right">
            {selected ? (
              <div
                className="header-chip-instance"
                role="button"
                tabIndex={0}
                onClick={() => setScreen("instances")}
                style={{ cursor: "pointer" }}
                title="Click to switch active profile"
              >
                <div className="header-chip-dot" />
                <span>{selected.name}</span>
                <span
                  style={{
                    color: "var(--nv-mute)",
                    fontSize: 12,
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {selected.version}
                </span>
              </div>
            ) : (
              <div
                className="header-chip-instance"
                style={{ color: "var(--nv-mute)" }}
              >
                <span>No profile active</span>
              </div>
            )}

            <AccountButton />
          </div>
        </header>

        {/* Persistent Viewport (Keeps screens mounted so progress, scroll, and filters never reset) */}
        <div className="content">
          <div
            style={{
              display: screen === "home" ? "flex" : "none",
              flexDirection: "column",
              gap: 28,
              width: "100%",
            }}
          >
            <Home
              config={config}
              instances={instances}
              selected={selected}
              onSelect={onSelect}
              onRefresh={refresh}
            />
          </div>

          <div
            style={{
              display: screen === "instances" ? "flex" : "none",
              flexDirection: "column",
              gap: 24,
              width: "100%",
            }}
          >
            <Instances
              instances={instances}
              onChange={refresh}
              onSelect={(i) => {
                onSelect(i);
                setScreen("home");
              }}
            />
          </div>

          <div
            style={{
              display: screen === "versions" ? "flex" : "none",
              flexDirection: "column",
              gap: 24,
              width: "100%",
            }}
          >
            <Versions onInstalled={refresh} />
          </div>

          <div
            style={{
              display: screen === "downloads" ? "flex" : "none",
              flexDirection: "column",
              gap: 24,
              width: "100%",
            }}
          >
            <Downloads />
          </div>

          <div
            style={{
              display: screen === "content" ? "flex" : "none",
              flexDirection: "column",
              gap: 24,
              width: "100%",
            }}
          >
            <Content selected={selected} />
          </div>

          <div
            style={{
              display: screen === "settings" ? "flex" : "none",
              flexDirection: "column",
              gap: 24,
              width: "100%",
            }}
          >
            <Settings config={config} onChange={onConfigChange} />
          </div>
        </div>

        {/* Live Launched Minecraft Game Window */}
        <MinecraftGameWindow />
      </main>
    </div>
  );
}

export function App() {
  return (
    <TaskManagerProvider>
      <AppContent />
    </TaskManagerProvider>
  );
}

export default App;
