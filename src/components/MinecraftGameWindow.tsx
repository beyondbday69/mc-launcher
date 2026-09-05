import { useState } from "react";
import { useTaskManager } from "../lib/taskManager";
import { formatDuration } from "../lib/types";
import mcWindowImg from "../assets/minecraft-game-window.png";

export function MinecraftGameWindow() {
  const { gameSession, stopGame } = useTaskManager();
  const [minimized, setMinimized] = useState(false);

  if (gameSession.status !== "running") return null;

  if (minimized) {
    return (
      <div
        className="mc-game-window-docked"
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 9999,
          background: "var(--nv-surface-elevated)",
          border: "1px solid var(--nv-primary)",
          borderRadius: "var(--rounded-sm)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.8), 0 0 16px rgba(118, 185, 0, 0.25)",
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          gap: 14,
          animation: "nvFadeIn 0.25s ease-out",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="running-dot" />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#ffffff" }}>
              MINECRAFT 1.21.4 (ACTIVE)
            </span>
            <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--nv-mute)" }}>
              {formatDuration(gameSession.runTimeSecs)} • 60 FPS • PID {gameSession.pid}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            className="button-outline-on-dark button-sm btn-show-game"
            onClick={() => setMinimized(false)}
            title="Restore Game Window"
          >
            SHOW GAME
          </button>
          <button
            type="button"
            className="button-stop button-sm"
            onClick={() => stopGame(gameSession.instanceId || undefined)}
            title="Terminate game process"
          >
            STOP
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="mc-game-window-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9998,
        background: "rgba(0, 0, 0, 0.72)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        animation: "nvFadeIn 0.3s ease-out",
      }}
    >
      <div
        className="mc-game-window"
        style={{
          width: "100%",
          maxWidth: 920,
          background: "#121212",
          border: "2px solid var(--nv-primary)",
          borderRadius: "var(--rounded-sm)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.9), 0 0 30px rgba(118, 185, 0, 0.35)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Native Style Window Title Bar */}
        <div
          className="mc-game-titlebar"
          style={{
            height: 38,
            background: "#1e1e1e",
            borderBottom: "1px solid var(--nv-hairline-strong)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 12px",
            userSelect: "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 12,
                height: 12,
                background: "var(--nv-primary)",
                borderRadius: 2,
              }}
            />
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#e5e5e5",
                fontFamily: "var(--font-sans)",
                letterSpacing: "0.02em",
              }}
            >
              Minecraft* 1.21.4 - Java Edition [LWJGL 3.3.3 • 60 FPS • PID {gameSession.pid}]
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span
              className="badge-tag badge-tag-primary"
              style={{ fontSize: 10, padding: "2px 6px" }}
            >
              LIVE: {formatDuration(gameSession.runTimeSecs)}
            </span>

            {/* Window Controls: Minimize, Maximize, Close */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                type="button"
                className="mc-win-ctrl-btn btn-min-game"
                onClick={() => setMinimized(true)}
                title="Minimize (Keep running in background)"
                style={{
                  width: 26,
                  height: 22,
                  background: "#2a2a2a",
                  border: "none",
                  borderRadius: 2,
                  color: "#ffffff",
                  fontSize: 12,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                —
              </button>
              <button
                type="button"
                className="mc-win-ctrl-btn"
                onClick={() => setMinimized(true)}
                title="Launcher Behind"
                style={{
                  width: 26,
                  height: 22,
                  background: "#2a2a2a",
                  border: "none",
                  borderRadius: 2,
                  color: "#ffffff",
                  fontSize: 12,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ▢
              </button>
              <button
                type="button"
                className="mc-win-ctrl-btn-close btn-close-game"
                onClick={() => stopGame(gameSession.instanceId || undefined)}
                title="Quit Game (STOP GAME)"
                style={{
                  width: 26,
                  height: 22,
                  background: "#e11d48",
                  border: "none",
                  borderRadius: 2,
                  color: "#ffffff",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        {/* Game Viewport Container */}
        <div
          className="mc-game-viewport"
          style={{
            position: "relative",
            width: "100%",
            background: "#000000",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          <img
            src={mcWindowImg}
            alt="Minecraft 1.21 Running"
            style={{
              width: "100%",
              maxHeight: "540px",
              objectFit: "contain",
              display: "block",
            }}
          />

          {/* Floating In-Game HUD overlay */}
          <div
            style={{
              position: "absolute",
              top: 12,
              right: 14,
              background: "rgba(0, 0, 0, 0.7)",
              border: "1px solid rgba(118, 185, 0, 0.5)",
              padding: "4px 10px",
              borderRadius: 3,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--nv-primary)",
              pointerEvents: "none",
            }}
          >
            FPS: 60 • MEM: 849MB (55%) • OpenGL 4.6
          </div>
        </div>

        {/* Bottom Game Toolbar / Status */}
        <div
          style={{
            padding: "8px 16px",
            background: "#181818",
            borderTop: "1px solid var(--nv-hairline)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 12,
            color: "var(--nv-mute)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ color: "#ffffff", fontWeight: 700 }}>
              PROFILE: {gameSession.instanceName || "Fabric 1.21.4 (Main)"}
            </span>
            <span>•</span>
            <span>DATA DIR: ~/.minecraft/instances/fabric-1-21-4</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              className="button-outline-on-dark button-sm btn-to-launcher"
              onClick={() => setMinimized(true)}
            >
              SWITCH TO LAUNCHER
            </button>
            <button
              type="button"
              className="button-stop button-sm btn-game-toolbar-stop"
              onClick={() => stopGame(gameSession.instanceId || undefined)}
            >
              STOP GAME
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
