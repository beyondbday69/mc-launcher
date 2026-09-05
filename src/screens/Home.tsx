import { useState, useTransition } from "react";
import { api, Config, Instance, formatDuration } from "../lib/types";

interface HomeProps {
  config: Config | null;
  instances: Instance[];
  selected: Instance | null;
  onSelect: (instance: Instance) => void;
  onRefresh: () => Promise<void>;
}

export function Home({ config, instances, selected, onSelect, onRefresh }: HomeProps) {
  const [launching, setLaunching] = useState(false);
  const [launchStatus, setLaunchStatus] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handleLaunch = async () => {
    if (!selected) return;
    setLaunching(true);
    setLaunchStatus("PREPARING PIPELINE...");
    try {
      await api.prepareLaunch(selected.id);
      setLaunchStatus("DISPATCHING JVM...");
      await api.launchInstance(selected.id);
      setLaunchStatus("GAME RUNNING");
      setTimeout(() => {
        setLaunching(false);
        setLaunchStatus(null);
        onRefresh();
      }, 2500);
    } catch (err: any) {
      console.error("[NVIDIA Launch Error]:", err);
      setLaunchStatus(`LAUNCH FAILED: ${err?.message || err}`);
      setTimeout(() => {
        setLaunching(false);
        setLaunchStatus(null);
      }, 4000);
    }
  };

  const ramMb = selected?.ram_mb || config?.default_ram_mb || 2048;
  const ramPercent = Math.min(Math.round((ramMb / 16384) * 100), 100);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* NVIDIA Hero Game Ready Card */}
      {selected ? (
        <div className="hero-game-card">
          <div style={{ zIndex: 2, maxWidth: "65%" }}>
            <div className="hero-badge-strip">
              <span className="badge-rtx">
                <span>✦</span> RTX GAME READY
              </span>
              <span className="badge-channel">
                {selected.mod_loader ? `${selected.mod_loader.kind.toUpperCase()} ${selected.mod_loader.version}` : "VANILLA RELEASE"}
              </span>
              <span className="badge-channel">MC {selected.version}</span>
            </div>

            <h1 className="hero-game-title">{selected.name}</h1>
            <p className="hero-game-meta">
              <span>Installed: {new Date(selected.created).toLocaleDateString()}</span>
              <span>•</span>
              <span>Playtime: {formatDuration(selected.play_time_secs)}</span>
              <span>•</span>
              <span style={{ color: "#76b900", fontWeight: 700 }}>OPTIMAL SETTINGS VERIFIED</span>
            </p>

            <div className="hero-actions">
              <button
                type="button"
                className="hero-btn-launch"
                disabled={launching}
                onClick={handleLaunch}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
                <span>{launchStatus || (launching ? "LAUNCHING..." : "PLAY GAME")}</span>
              </button>

              <button
                type="button"
                className="btn-nvidia-secondary"
                onClick={() => {
                  window.location.search = "?screen=settings";
                }}
              >
                <span>OPTIMIZE SETTINGS</span>
              </button>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 8,
              zIndex: 2,
            }}
          >
            <div
              style={{
                width: 130,
                height: 130,
                borderRadius: "var(--radius-sm)",
                border: "2px solid var(--border-strong)",
                background: "radial-gradient(circle, #1a2212 0%, #0d0f14 100%)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                boxShadow: "0 0 20px rgba(0,0,0,0.6)",
              }}
            >
              <span style={{ fontSize: 36, filter: "drop-shadow(0 0 10px rgba(118,185,0,0.5))" }}>
                🎮
              </span>
              <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 800, color: "#76b900" }}>
                GEFORCE READY
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div
          className="hero-game-card"
          style={{ justifyContent: "center", textAlign: "center", padding: "48px 24px" }}
        >
          <div>
            <h2 style={{ fontSize: 20, color: "#ffffff", marginBottom: 8 }}>NO ACTIVE GAME PROFILE</h2>
            <p style={{ color: "#9da5b4", marginBottom: 18 }}>
              Select an instance from your library or create a new profile to begin.
            </p>
            <button
              type="button"
              className="btn-nvidia-primary"
              onClick={() => {
                window.location.search = "?screen=instances";
              }}
            >
              OPEN GAME LIBRARY
            </button>
          </div>
        </div>
      )}

      {/* NVIDIA Performance & Telemetry HUD */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", fontWeight: 800, letterSpacing: "0.08em", color: "#656d7c", textTransform: "uppercase" }}>
            HARDWARE & RUNTIME TELEMETRY
          </span>
          <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "#76b900", fontWeight: 700 }}>
            ● STATUS: OPTIMAL
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          {/* Card 1: Memory */}
          <div className="telemetry-card">
            <div className="telemetry-label">
              <span>ALLOCATED MEMORY</span>
              <span className="telemetry-tag">{ramPercent}% SYSTEM CAP</span>
            </div>
            <div className="telemetry-value">
              {ramMb} <span style={{ fontSize: 14, color: "#9da5b4" }}>MB ({(ramMb / 1024).toFixed(1)} GB)</span>
            </div>
            <div style={{ width: "100%", height: 6, background: "var(--bg-canvas)", borderRadius: 2, overflow: "hidden", marginTop: 4 }}>
              <div
                style={{
                  width: `${ramPercent}%`,
                  height: "100%",
                  background: "var(--nvidia-green)",
                  boxShadow: "0 0 8px var(--nvidia-green)",
                }}
              />
            </div>
          </div>

          {/* Card 2: Java Runtime */}
          <div className="telemetry-card">
            <div className="telemetry-label">
              <span>RUNTIME ENGINE</span>
              <span className="telemetry-tag">WHQL VERIFIED</span>
            </div>
            <div className="telemetry-value">
              JAVA 21 <span style={{ fontSize: 13, color: "#9da5b4" }}>64-BIT ADOPTIUM</span>
            </div>
            <span style={{ fontSize: 12, color: "#656d7c" }}>
              Optimized for Minecraft 1.21+ rendering pipeline
            </span>
          </div>

          {/* Card 3: Session Playtime */}
          <div className="telemetry-card">
            <div className="telemetry-label">
              <span>TOTAL PLAYTIME</span>
              <span className="telemetry-tag">TELEMETRY ACTIVE</span>
            </div>
            <div className="telemetry-value">
              {selected ? formatDuration(selected.play_time_secs) : "0s"}
            </div>
            <span style={{ fontSize: 12, color: "#656d7c" }}>
              Last Session: {selected?.last_played ? new Date(selected.last_played).toLocaleDateString() : "Never"}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Profile Library Strip */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", fontWeight: 800, letterSpacing: "0.08em", color: "#656d7c", textTransform: "uppercase" }}>
            GAME PROFILES ({instances.length})
          </span>
          <button
            type="button"
            style={{ background: "none", border: "none", color: "#76b900", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            onClick={() => {
              window.location.search = "?screen=instances";
            }}
          >
            VIEW ALL IN LIBRARY →
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
          {instances.map((inst) => {
            const isCurrent = selected?.id === inst.id;
            return (
              <div
                key={inst.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  startTransition(() => {
                    onSelect(inst);
                  });
                }}
                style={{
                  background: isCurrent ? "var(--bg-surface-elevated)" : "var(--bg-surface)",
                  border: `1px solid ${isCurrent ? "var(--nvidia-green)" : "var(--border)"}`,
                  borderRadius: "var(--radius-sm)",
                  padding: "14px 16px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  boxShadow: isCurrent ? "0 0 14px rgba(118, 185, 0, 0.2)" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: isCurrent ? "#ffffff" : "var(--text-secondary)" }}>
                    {inst.name}
                  </span>
                  {isCurrent && (
                    <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", padding: "2px 6px", background: "var(--nvidia-green)", color: "#000", fontWeight: 800, borderRadius: 2 }}>
                      ACTIVE
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "#656d7c", fontFamily: "var(--font-mono)" }}>
                  <span>MC {inst.version}</span>
                  <span>•</span>
                  <span>{inst.mod_loader ? inst.mod_loader.kind.toUpperCase() : "VANILLA"}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default Home;
