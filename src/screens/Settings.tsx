import { useEffect, useState, ReactNode } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { api, Config, JavaInstallation } from "../lib/types";
import {
  IconSettings,
  IconCube,
  IconRam,
  IconDownloads,
  IconRefresh,
  IconCheck,
  IconFolder,
} from "../lib/icons";

interface Props {
  config: Config;
  onChange: (c: Config) => void;
}

type Tab = "general" | "java" | "jvm" | "downloads" | "about";

interface SettingTabDef {
  id: Tab;
  label: string;
  icon: ReactNode;
}

const TABS: SettingTabDef[] = [
  { id: "general", label: "General", icon: <IconSettings size={16} /> },
  { id: "java", label: "Java Runtimes", icon: <IconCube size={16} /> },
  { id: "jvm", label: "JVM Tuning", icon: <IconRam size={16} /> },
  { id: "downloads", label: "Downloads", icon: <IconDownloads size={16} /> },
  { id: "about", label: "About", icon: <span style={{ fontSize: 14 }}>ℹ</span> },
];

export function Settings({ config, onChange }: Props) {
  const [tab, setTab] = useState<Tab>("general");
  const [java, setJava] = useState<JavaInstallation[]>([]);

  useEffect(() => {
    api.javaList().then(setJava).catch(() => {});
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em" }}>
          Launcher Settings
        </h2>
        <span className="muted" style={{ fontSize: 12 }}>
          Customize performance, Java environments, runtime preferences, and storage
        </span>
      </div>

      <div className="settings">
        {/* Navigation Rail for Settings */}
        <div className="settings-nav">
          {TABS.map((t) => {
            const isActive = tab === t.id;
            return (
              <div
                key={t.id}
                className={`settings-nav-item ${isActive ? "active" : ""}`}
                onClick={() => setTab(t.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    color: isActive
                      ? "var(--md-sys-color-primary)"
                      : "var(--md-sys-color-on-surface-variant)",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {t.icon}
                </span>
                <span>{t.label}</span>
              </div>
            );
          })}
        </div>

        {/* Tab Content Cards */}
        <div className="settings-content">
          {tab === "general" && (
            <GeneralTab config={config} onChange={onChange} />
          )}
          {tab === "java" && (
            <JavaTab
              config={config}
              onChange={onChange}
              installations={java}
              onRefresh={() => api.javaList().then(setJava)}
            />
          )}
          {tab === "jvm" && <JvmTab config={config} onChange={onChange} />}
          {tab === "downloads" && (
            <DownloadsTab config={config} onChange={onChange} />
          )}
          {tab === "about" && <AboutTab />}
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   General Preferences Tab
   ========================================================================== */

function GeneralTab({
  config,
  onChange,
}: {
  config: Config;
  onChange: (c: Config) => void;
}) {
  const ramMb = config.default_ram_mb || 2048;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Memory Allocation Card */}
      <div className="card" style={{ position: "relative" }}>
        <div className="liquid-refraction-line" aria-hidden="true" style={{ opacity: 0.4 }} />
        <h3 style={{ margin: 0, textTransform: "none", fontSize: 15, fontWeight: 700, marginBottom: 16 }}>
          Default Memory Allocation
        </h3>

        <div className="field">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label>RAM allocated to new instances</label>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--liquid-sky)" }}>
              {ramMb} MB ({(ramMb / 1024).toFixed(1)} GB)
            </span>
          </div>

          <input
            type="range"
            min={1024}
            max={16384}
            step={512}
            value={ramMb}
            onChange={(e) =>
              onChange({
                ...config,
                default_ram_mb: parseInt(e.target.value, 10) || 2048,
              })
            }
            style={{ width: "100%", margin: "8px 0" }}
          />

          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            {[2048, 4096, 6144, 8192, 12288].map((mb) => (
              <button
                key={mb}
                type="button"
                className={`chip ${ramMb === mb ? "active" : ""}`}
                onClick={() => onChange({ ...config, default_ram_mb: mb })}
                style={{ fontSize: 11, padding: "2px 10px", cursor: "pointer" }}
              >
                {mb / 1024} GB
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Interface & Theme Card */}
      <div className="card" style={{ position: "relative" }}>
        <div className="liquid-refraction-line" aria-hidden="true" style={{ opacity: 0.4 }} />
        <h3 style={{ margin: 0, textTransform: "none", fontSize: 15, fontWeight: 700, marginBottom: 16 }}>
          Interface & Appearance
        </h3>

        <div className="form-grid">
          <div className="field">
            <label>Launcher Theme</label>
            <select
              value={config.theme}
              onChange={(e) => onChange({ ...config, theme: e.target.value })}
            >
              <option value="dark">Liquid Glass (Frosted Glassmorphism)</option>
              <option value="m3">Material 3 Dark Tonal (Expressive)</option>
            </select>
          </div>

          <div className="field">
            <label>Display Language</label>
            <select
              value={config.language}
              onChange={(e) => onChange({ ...config, language: e.target.value })}
            >
              <option value="en-US">English (United States)</option>
            </select>
          </div>
        </div>

        <div className="divider" />

        {/* Toggles */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ display: "inline-flex", alignItems: "center", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={config.close_on_launch}
              onChange={(e) =>
                onChange({ ...config, close_on_launch: e.target.checked })
              }
            />
            <span style={{ fontSize: 13 }}>Close launcher automatically when Minecraft starts</span>
          </label>

          <label style={{ display: "inline-flex", alignItems: "center", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={config.show_snapshots}
              onChange={(e) =>
                onChange({ ...config, show_snapshots: e.target.checked })
              }
            />
            <span style={{ fontSize: 13 }}>Show snapshot releases in the version picker</span>
          </label>

          <label style={{ display: "inline-flex", alignItems: "center", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={config.show_historical}
              onChange={(e) =>
                onChange({ ...config, show_historical: e.target.checked })
              }
            />
            <span style={{ fontSize: 13 }}>Show historical (Alpha & Beta) versions in lists</span>
          </label>
        </div>
      </div>

      {/* Storage & Directories */}
      <div className="card">
        <h3 style={{ margin: 0, textTransform: "none", fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
          Storage & Directories
        </h3>
        <p className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>
          Launcher data and cache are managed automatically. Override the default directory if you want
          instances saved on a specific drive.
        </p>
        <div className="field" style={{ margin: 0 }}>
          <label>Data Directory Override</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={config.data_dir_override ?? ""}
              placeholder="Default platform storage path (~/.local/share/mc-launcher)"
              onChange={(e) =>
                onChange({
                  ...config,
                  data_dir_override: e.target.value.trim() || null,
                })
              }
              style={{ flex: 1, fontSize: 12, fontFamily: "var(--mono)" }}
            />
            {config.data_dir_override && (
              <button
                className="btn ghost"
                onClick={() => onChange({ ...config, data_dir_override: null })}
                style={{ fontSize: 12 }}
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   Java Runtimes Tab
   ========================================================================== */

function JavaTab({
  config,
  onChange,
  installations,
  onRefresh,
}: {
  config: Config;
  onChange: (c: Config) => void;
  installations: JavaInstallation[];
  onRefresh: () => void;
}) {
  const [detecting, setDetecting] = useState(false);

  return (
    <div className="card" style={{ position: "relative" }}>
      <div className="liquid-refraction-line" aria-hidden="true" style={{ opacity: 0.4 }} />
      <div className="row between" style={{ marginBottom: 14 }}>
        <div>
          <h3 style={{ margin: 0, textTransform: "none", fontSize: 15, fontWeight: 700 }}>
            Java Runtimes
          </h3>
          <span className="muted" style={{ fontSize: 12 }}>
            Detect and assign Java versions for Minecraft Java Edition
          </span>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn tonal"
            disabled={detecting}
            onClick={async () => {
              setDetecting(true);
              try {
                await api.javaDetect();
                onRefresh();
              } finally {
                setDetecting(false);
              }
            }}
            style={{ padding: "6px 14px", fontSize: 12, gap: 6 }}
          >
            <IconRefresh
              size={14}
              style={{ animation: detecting ? "indeterminate 1.5s infinite linear" : undefined }}
            />
            <span>{detecting ? "Scanning…" : "Re-detect"}</span>
          </button>

          <button
            className="btn primary"
            onClick={async () => {
              const path = await open({
                multiple: false,
                directory: false,
                title: "Select Java executable (java / java.exe)",
              });
              if (typeof path === "string") {
                try {
                  await api.javaAdd(path);
                  onRefresh();
                } catch (e) {
                  alert(String(e));
                }
              }
            }}
            style={{ padding: "6px 14px", fontSize: 12, gap: 6 }}
          >
            <IconFolder size={14} />
            <span>Add Manually…</span>
          </button>
        </div>
      </div>

      {installations.length === 0 ? (
        <div
          style={{
            padding: "24px",
            textAlign: "center",
            background: "var(--md-sys-color-surface-container-lowest)",
            borderRadius: "var(--md-sys-shape-corner-lg)",
          }}
        >
          <p className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
            No Java installations detected on your system.
          </p>
          <span className="faint" style={{ fontSize: 12 }}>
            Install OpenJDK 17 or 21 (Temurin / Corretto / Oracle) or browse manually.
          </span>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Version</th>
                <th>Vendor</th>
                <th>Executable Path</th>
                <th style={{ textAlign: "right" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {installations.map((j) => {
                const isDefault = config.default_java_path === j.path;
                return (
                  <tr key={j.path}>
                    <td>
                      <span className="chip success" style={{ fontSize: 11, padding: "2px 8px" }}>
                        Java {j.version}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, color: "var(--md-sys-color-on-surface)" }}>
                      {j.vendor}
                    </td>
                    <td
                      style={{
                        fontFamily: "var(--mono)",
                        fontSize: 11,
                        color: "var(--md-sys-color-on-surface-variant)",
                        maxWidth: 240,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={j.path}
                    >
                      {j.path}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {isDefault ? (
                        <span className="chip active" style={{ fontSize: 11, padding: "2px 8px" }}>
                          <IconCheck size={12} />
                          <span>Default</span>
                        </span>
                      ) : (
                        <button
                          className="btn ghost"
                          onClick={() =>
                            onChange({ ...config, default_java_path: j.path })
                          }
                          style={{ fontSize: 11, padding: "3px 10px" }}
                        >
                          Set Default
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   JVM Tuning Tab
   ========================================================================== */

function JvmTab({
  config,
  onChange,
}: {
  config: Config;
  onChange: (c: Config) => void;
}) {
  return (
    <div className="card" style={{ position: "relative" }}>
      <div className="liquid-refraction-line" aria-hidden="true" style={{ opacity: 0.4 }} />
      <h3 style={{ margin: 0, textTransform: "none", fontSize: 15, fontWeight: 700, marginBottom: 8 }}>
        Java Virtual Machine Profiles
      </h3>
      <p className="muted" style={{ marginBottom: 16, fontSize: 12.5 }}>
        Choose optimization presets for garbage collection and memory tuning.
        Instances inherit this profile unless configured individually.
      </p>

      <div className="field">
        <label>Default Optimization Preset</label>
        <select
          value={config.default_jvm_profile}
          onChange={(e) =>
            onChange({ ...config, default_jvm_profile: e.target.value })
          }
        >
          <option value="default">Default JVM Arguments</option>
          <option value="low_ram">Low RAM Preset (Optimized for ≤ 2GB)</option>
          <option value="balanced">Balanced (Shenandoah/G1GC Optimized)</option>
          <option value="performance">High Performance (ZGC / High Heap)</option>
          <option value="custom">Custom Arguments</option>
        </select>
      </div>

      <div className="field" style={{ marginTop: 12 }}>
        <label>Custom JVM Flags (one parameter per line)</label>
        <textarea
          value={config.default_custom_jvm_args.join("\n")}
          onChange={(e) =>
            onChange({
              ...config,
              default_custom_jvm_args: e.target.value
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          placeholder="-XX:+UseG1GC&#10;-XX:InitiatingHeapOccupancyPercent=45"
          rows={5}
          style={{ fontFamily: "var(--mono)", fontSize: 12 }}
        />
      </div>
    </div>
  );
}

/* ==========================================================================
   Downloads Tab
   ========================================================================== */

function DownloadsTab({
  config,
  onChange,
}: {
  config: Config;
  onChange: (c: Config) => void;
}) {
  return (
    <div className="card" style={{ position: "relative" }}>
      <div className="liquid-refraction-line" aria-hidden="true" style={{ opacity: 0.4 }} />
      <h3 style={{ margin: 0, textTransform: "none", fontSize: 15, fontWeight: 700, marginBottom: 16 }}>
        Network & Download Manager
      </h3>

      <div className="field">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <label>Parallel Worker Concurrency</label>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--liquid-sky)" }}>
            {config.download_concurrency} threads
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={32}
          value={config.download_concurrency}
          onChange={(e) =>
            onChange({
              ...config,
              download_concurrency: parseInt(e.target.value, 10) || 8,
            })
          }
          style={{ width: "100%", margin: "8px 0" }}
        />
      </div>

      <div className="field" style={{ marginTop: 12 }}>
        <label>Download Speed Limit (KB/s, 0 for unrestricted)</label>
        <input
          type="number"
          min={0}
          value={config.download_speed_limit_kbps ?? 0}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10) || 0;
            onChange({
              ...config,
              download_speed_limit_kbps: v > 0 ? v : null,
            });
          }}
          placeholder="0 (Unlimited)"
        />
      </div>
    </div>
  );
}

/* ==========================================================================
   About Tab
   ========================================================================== */

function AboutTab() {
  return (
    <div className="card" style={{ position: "relative" }}>
      <div className="liquid-refraction-line" aria-hidden="true" style={{ opacity: 0.4 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "var(--md-sys-shape-corner-md)",
            background: "linear-gradient(135deg, var(--md-sys-color-primary) 0%, var(--md-sys-color-secondary) 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
            fontWeight: 800,
            fontSize: 20,
            boxShadow: "0 0 16px rgba(56, 189, 248, 0.35)",
          }}
        >
          M
        </div>
        <div>
          <h3 style={{ margin: 0, textTransform: "none", fontSize: 17, fontWeight: 700 }}>
            MC Launcher
          </h3>
          <span className="muted" style={{ fontSize: 12 }}>
            Version 0.1.0 · Material 3 Expressive Edition
          </span>
        </div>
      </div>

      <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
        A lightweight, secure Minecraft Java Edition launcher designed for speed,
        clarity, and modern desktop experiences. Powered by Tauri 2.0, Rust, and React 18.
      </p>

      <div className="divider" />

      <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span className="muted">Privacy & Analytics:</span>
          <span style={{ fontWeight: 600, color: "var(--md-sys-color-tertiary)" }}>
            Zero Telemetry · 100% Local
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span className="muted">Engine:</span>
          <span style={{ fontWeight: 600 }}>Tauri v2 + Tokio Async Core</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span className="muted">UI System:</span>
          <span style={{ fontWeight: 600 }}>Material Design 3 Expressive</span>
        </div>
      </div>
    </div>
  );
}
