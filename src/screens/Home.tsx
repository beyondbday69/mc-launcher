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
  const [copiedFolder, setCopiedFolder] = useState(false);
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

  const folderPath = selected
    ? selected.game_dir_override || selected.game_dir
    : config?.data_dir_override || "~/.local/share/mc-launcher";

  const handleCopyFolder = () => {
    navigator.clipboard?.writeText(folderPath);
    setCopiedFolder(true);
    setTimeout(() => setCopiedFolder(false), 2000);
  };

  const ramMb = selected?.ram_mb || config?.default_ram_mb || 2048;
  const ramPercent = Math.min(Math.round((ramMb / 16384) * 100), 100);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {/* NVIDIA Hero Dark Card */}
      {selected ? (
        <div className="hero-card-dark">
          {/* Signature NVIDIA 12px Corner Square */}
          <div className="corner-square" />

          <div style={{ maxWidth: "68%" }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <span className="badge-tag badge-tag-primary">
                GAME READY PROFILE
              </span>
              <span className="badge-tag">
                {selected.mod_loader
                  ? `${selected.mod_loader.kind.toUpperCase()} ${selected.mod_loader.version}`
                  : "VANILLA RELEASE"}
              </span>
              <span className="badge-tag">MC {selected.version}</span>
            </div>

            <h1 className="hero-title">{selected.name}</h1>
            <div className="hero-subhead">
              <span>Installed: {new Date(selected.created).toLocaleDateString()}</span>
              <span>•</span>
              <span>Playtime: {formatDuration(selected.play_time_secs)}</span>
              <span>•</span>
              <span style={{ color: "var(--nv-primary)", fontWeight: 700 }}>
                OPTIMAL PERFORMANCE VERIFIED
              </span>
            </div>

            <div className="hero-actions">
              {/* Primary CTA: button-primary */}
              <button
                type="button"
                className="button-primary"
                disabled={launching}
                onClick={handleLaunch}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
                <span>{launchStatus || (launching ? "LAUNCHING..." : "PLAY GAME")}</span>
              </button>

              {/* Secondary CTA: button-outline (2px green border) */}
              <button
                type="button"
                className="button-outline"
                onClick={handleCopyFolder}
                title="Copy or view instance directory path"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                <span>{copiedFolder ? "PATH COPIED!" : "GAME FOLDER"}</span>
              </button>

              {/* Tertiary: button-outline-on-dark */}
              <button
                type="button"
                className="button-outline-on-dark"
                onClick={() => {
                  window.location.search = "?screen=settings";
                }}
              >
                SETTINGS
              </button>
            </div>

            {/* Folder Location Bar */}
            <div
              style={{
                marginTop: 20,
                padding: "8px 14px",
                background: "var(--nv-surface-elevated)",
                border: "1px solid var(--nv-hairline)",
                borderRadius: "var(--rounded-sm)",
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 12,
                color: "var(--nv-mute)",
                fontFamily: "var(--font-mono)",
              }}
            >
              <span style={{ color: "var(--nv-primary)", fontWeight: 700 }}>DIR:</span>
              <span style={{ color: "var(--nv-on-dark-mute)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {folderPath}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <div
              style={{
                width: 140,
                height: 140,
                background: "var(--nv-surface-card)",
                border: "1px solid var(--nv-hairline-strong)",
                borderRadius: "var(--rounded-sm)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                position: "relative",
              }}
            >
              <div className="corner-square" style={{ width: 8, height: 8 }} />
              <span style={{ fontSize: 40 }}>🎮</span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--nv-primary)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                GAME READY
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div
          className="hero-card-dark"
          style={{ justifyContent: "center", textAlign: "center", padding: "64px 32px" }}
        >
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: "#ffffff", marginBottom: 8 }}>
              NO ACTIVE GAME PROFILE
            </h2>
            <p style={{ color: "var(--nv-on-dark-mute)", marginBottom: 20 }}>
              Select a profile from your game library or install a new version to get started.
            </p>
            <button
              type="button"
              className="button-primary"
              onClick={() => {
                window.location.search = "?screen=instances";
              }}
            >
              OPEN GAME LIBRARY
            </button>
          </div>
        </div>
      )}

      {/* Hardware & Runtime Telemetry (Callout Stats) */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.06em",
              color: "var(--nv-mute)",
              textTransform: "uppercase",
            }}
          >
            HARDWARE & RUNTIME TELEMETRY
          </span>
          <span
            style={{
              fontSize: 12,
              color: "var(--nv-primary)",
              fontWeight: 700,
            }}
          >
            ● STATUS: OPTIMAL
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 16,
          }}
        >
          {/* Card 1: Memory */}
          <div className="callout-stat">
            <div className="corner-square" style={{ width: 8, height: 8 }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="callout-stat-label">SYSTEM MEMORY (RAM)</span>
              <span className="badge-tag" style={{ fontSize: 11 }}>{ramPercent}% CAP</span>
            </div>
            <div className="callout-stat-num">
              {ramMb} <span style={{ fontSize: 16, color: "var(--nv-on-dark-mute)" }}>MB ({(ramMb / 1024).toFixed(1)} GB)</span>
            </div>
            <div
              style={{
                width: "100%",
                height: 4,
                background: "var(--nv-surface-soft)",
                borderRadius: "var(--rounded-none)",
                overflow: "hidden",
                marginTop: 4,
              }}
            >
              <div
                style={{
                  width: `${ramPercent}%`,
                  height: "100%",
                  background: "var(--nv-primary)",
                }}
              />
            </div>
          </div>

          {/* Card 2: Java Runtime */}
          <div className="callout-stat">
            <div className="corner-square" style={{ width: 8, height: 8 }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="callout-stat-label">RUNTIME ENGINE</span>
              <span className="badge-tag badge-tag-primary">VERIFIED</span>
            </div>
            <div className="callout-stat-num" style={{ fontSize: 24 }}>
              JAVA 21 <span style={{ fontSize: 14, color: "var(--nv-on-dark-mute)" }}>64-BIT</span>
            </div>
            <span style={{ fontSize: 12, color: "var(--nv-mute)" }}>
              Optimized for Minecraft 1.21+ rendering pipeline
            </span>
          </div>

          {/* Card 3: Session Playtime */}
          <div className="callout-stat">
            <div className="corner-square" style={{ width: 8, height: 8 }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="callout-stat-label">TOTAL PLAYTIME</span>
              <span className="badge-tag">ACTIVE</span>
            </div>
            <div className="callout-stat-num">
              {selected ? formatDuration(selected.play_time_secs) : "0s"}
            </div>
            <span style={{ fontSize: 12, color: "var(--nv-mute)" }}>
              Last Played: {selected?.last_played ? new Date(selected.last_played).toLocaleDateString() : "Never"}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Profile Library Strip */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.06em",
              color: "var(--nv-mute)",
              textTransform: "uppercase",
            }}
          >
            GAME PROFILES ({instances.length})
          </span>
          <button
            type="button"
            style={{
              background: "none",
              border: "none",
              color: "var(--nv-primary)",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
            onClick={() => {
              window.location.search = "?screen=instances";
            }}
          >
            VIEW ALL IN LIBRARY →
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 16,
          }}
        >
          {instances.map((inst) => {
            const isCurrent = selected?.id === inst.id;
            return (
              <div
                key={inst.id}
                role="button"
                tabIndex={0}
                className="nv-card"
                onClick={() => {
                  startTransition(() => {
                    onSelect(inst);
                  });
                }}
                style={{
                  cursor: "pointer",
                  border: `1px solid ${isCurrent ? "var(--nv-primary)" : "var(--nv-hairline)"}`,
                  background: isCurrent ? "var(--nv-surface-elevated)" : "var(--nv-surface-card)",
                }}
              >
                {isCurrent && <div className="corner-square" style={{ width: 8, height: 8 }} />}

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: isCurrent ? "#ffffff" : "var(--nv-on-dark-mute)" }}>
                    {inst.name}
                  </span>
                  {isCurrent && (
                    <span className="badge-tag badge-tag-primary">ACTIVE</span>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--nv-mute)", fontFamily: "var(--font-mono)" }}>
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
