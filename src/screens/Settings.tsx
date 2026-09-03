import { useEffect, useState, ReactNode } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Button, Card, Chip, Input, Label, Slider, Switch } from "@heroui/react";
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
  { id: "about", label: "About", icon: <span style={{ fontSize: 13 }}>ℹ</span> },
];

export function Settings({ config, onChange }: Props) {
  const [tab, setTab] = useState<Tab>("general");
  const [java, setJava] = useState<JavaInstallation[]>([]);

  useEffect(() => {
    api.javaList().then(setJava).catch(() => {});
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em", margin: 0, color: "#ffffff" }}>
          Launcher Settings
        </h2>
        <span className="muted" style={{ fontSize: 12 }}>
          Customize runtime performance, Java environments, and preferences
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
                    color: isActive ? "#0070f3" : "#a1a1aa",
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
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Memory Allocation Card */}
      <Card>
        <Card.Header>
          <Card.Title style={{ margin: 0, textTransform: "none", fontSize: 15, fontWeight: 700 }}>
            Default Memory Allocation
          </Card.Title>
        </Card.Header>

        <Card.Content>
          <div className="field">
            <Slider
              className="w-full"
              minValue={1024}
              maxValue={16384}
              step={512}
              value={ramMb}
              onChange={(v) => {
                const val = Array.isArray(v) ? v[0] : v;
                onChange({
                  ...config,
                  default_ram_mb: val || 2048,
                });
              }}
              style={{ width: "100%", margin: "8px 0" }}
            >
              <Label>RAM allocated to new instances</Label>
              <Slider.Output>
                {({ state }) => `${state.values[0]} MB (${(state.values[0] / 1024).toFixed(1)} GB)`}
              </Slider.Output>
              <Slider.Track>
                <Slider.Fill />
                <Slider.Thumb />
              </Slider.Track>
            </Slider>

            <div className="button-group" style={{ marginTop: 8 }}>
              {[2048, 4096, 6144, 8192].map((mb) => (
                <Button
                  key={mb}
                  variant={ramMb === mb ? "primary" : "secondary"}
                  size="sm"
                  onPress={() => onChange({ ...config, default_ram_mb: mb })}
                >
                  {mb / 1024} GB
                </Button>
              ))}
            </div>
          </div>
        </Card.Content>
      </Card>

      {/* Interface & Options Card */}
      <Card>
        <Card.Header>
          <Card.Title style={{ margin: 0, textTransform: "none", fontSize: 15, fontWeight: 700 }}>
            Interface & Options
          </Card.Title>
        </Card.Header>

        <Card.Content>
          <div className="form-grid">
            <div className="field">
              <label>Launcher Theme</label>
              <select
                value={config.theme}
                onChange={(e) => onChange({ ...config, theme: e.target.value })}
              >
                <option value="dark">Solid Black (HeroUI v3 OLED)</option>
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

          <div className="divider" style={{ margin: "14px 0" }} />

          {/* HeroUI Switches */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Switch
              isSelected={config.close_on_launch}
              onChange={(v) =>
                onChange({ ...config, close_on_launch: v })
              }
            >
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
                <span style={{ fontSize: 13 }}>Close launcher automatically when Minecraft starts</span>
              </Switch.Content>
            </Switch>

            <Switch
              isSelected={config.show_snapshots}
              onChange={(v) =>
                onChange({ ...config, show_snapshots: v })
              }
            >
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
                <span style={{ fontSize: 13 }}>Show snapshot releases in the version picker</span>
              </Switch.Content>
            </Switch>

            <Switch
              isSelected={config.show_historical}
              onChange={(v) =>
                onChange({ ...config, show_historical: v })
              }
            >
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
                <span style={{ fontSize: 13 }}>Show historical (Alpha & Beta) versions in lists</span>
              </Switch.Content>
            </Switch>
          </div>
        </Card.Content>
      </Card>

      {/* Storage & Directories */}
      <Card>
        <Card.Header>
          <Card.Title style={{ margin: 0, textTransform: "none", fontSize: 15, fontWeight: 700 }}>
            Storage & Directories
          </Card.Title>
        </Card.Header>
        <Card.Content>
          <p className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>
            Launcher data and cache are managed automatically. Override the default directory if needed.
          </p>
          <div className="field" style={{ margin: 0 }}>
            <label>Data Directory Path</label>
            <div style={{ display: "flex", gap: 8 }}>
              <Input
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
                <Button
                  variant="ghost"
                  size="sm"
                  onPress={() => onChange({ ...config, data_dir_override: null })}
                  style={{ fontSize: 12 }}
                >
                  Reset
                </Button>
              )}
            </div>
          </div>
        </Card.Content>
      </Card>
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
    <Card>
      <Card.Header className="row between" style={{ marginBottom: 14 }}>
        <div>
          <Card.Title style={{ margin: 0, textTransform: "none", fontSize: 15, fontWeight: 700 }}>
            Java Runtimes
          </Card.Title>
          <span className="muted" style={{ fontSize: 12 }}>
            Detect and assign Java versions for Minecraft Java Edition
          </span>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <Button
            variant="secondary"
            size="sm"
            isDisabled={detecting}
            onPress={async () => {
              setDetecting(true);
              try {
                await api.javaDetect();
                onRefresh();
              } finally {
                setDetecting(false);
              }
            }}
            style={{ padding: "5px 12px", fontSize: 12, gap: 6 }}
          >
            <IconRefresh
              size={14}
              style={{ animation: detecting ? "indeterminate 1.5s infinite linear" : undefined }}
            />
            <span>{detecting ? "Scanning…" : "Re-detect"}</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onPress={async () => {
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
            style={{ padding: "5px 12px", fontSize: 12, gap: 6 }}
          >
            <IconFolder size={14} />
            <span>Add Manually…</span>
          </Button>
        </div>
      </Card.Header>

      <Card.Content>
        {installations.length === 0 ? (
          <div
            style={{
              padding: "24px",
              textAlign: "center",
              background: "#18181b",
              borderRadius: "8px",
              border: "1px solid #27272a",
            }}
          >
            <p className="muted" style={{ fontSize: 13, marginBottom: 6 }}>
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
                        <Chip color="success" size="sm">
                          Java {j.version}
                        </Chip>
                      </td>
                      <td style={{ fontWeight: 600, color: "#ffffff" }}>
                        {j.vendor}
                      </td>
                      <td
                        style={{
                          fontFamily: "var(--mono)",
                          fontSize: 11,
                          color: "#a1a1aa",
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
                          <Chip variant="primary" size="sm">
                            <IconCheck size={12} style={{ marginRight: 4 }} />
                            <span>Default</span>
                          </Chip>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onPress={() =>
                              onChange({ ...config, default_java_path: j.path })
                            }
                            style={{ fontSize: 11, padding: "2px 8px" }}
                          >
                            Set Default
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card.Content>
    </Card>
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
    <Card>
      <Card.Header>
        <Card.Title style={{ margin: 0, textTransform: "none", fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
          Java Virtual Machine Profiles
        </Card.Title>
      </Card.Header>
      <Card.Content>
        <p className="muted" style={{ marginBottom: 14, fontSize: 12.5 }}>
          Choose optimization presets for garbage collection and memory tuning.
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
      </Card.Content>
    </Card>
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
    <Card>
      <Card.Header>
        <Card.Title style={{ margin: 0, textTransform: "none", fontSize: 15, fontWeight: 700, marginBottom: 14 }}>
          Network & Download Manager
        </Card.Title>
      </Card.Header>

      <Card.Content>
        <div className="field">
          <Slider
            className="w-full"
            minValue={1}
            maxValue={32}
            step={1}
            value={config.download_concurrency}
            onChange={(v) => {
              const val = Array.isArray(v) ? v[0] : v;
              onChange({
                ...config,
                download_concurrency: val || 8,
              });
            }}
            style={{ width: "100%", margin: "8px 0" }}
          >
            <Label>Parallel Worker Concurrency</Label>
            <Slider.Output>
              {({ state }) => `${state.values[0]} threads`}
            </Slider.Output>
            <Slider.Track>
              <Slider.Fill />
              <Slider.Thumb />
            </Slider.Track>
          </Slider>
        </div>

        <div className="field" style={{ marginTop: 12 }}>
          <label>Download Speed Limit (KB/s, 0 for unrestricted)</label>
          <Input
            type="number"
            min={0}
            value={config.download_speed_limit_kbps ? String(config.download_speed_limit_kbps) : ""}
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
      </Card.Content>
    </Card>
  );
}

/* ==========================================================================
   About Tab
   ========================================================================== */

function AboutTab() {
  return (
    <Card>
      <Card.Header>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "8px",
              background: "#0070f3",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              fontWeight: 800,
              fontSize: 18,
            }}
          >
            M
          </div>
          <div>
            <Card.Title style={{ margin: 0, textTransform: "none", fontSize: 16, fontWeight: 700 }}>
              MC Launcher
            </Card.Title>
            <span className="muted" style={{ fontSize: 12 }}>
              Version 0.1.0 · Solid Black OLED Edition
            </span>
          </div>
        </div>
      </Card.Header>

      <Card.Content>
        <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.6, marginBottom: 14 }}>
          A lightweight, secure Minecraft Java Edition launcher designed for speed,
          clarity, and minimal resource usage. Powered by Tauri 2.0, Rust, and HeroUI v3.
        </p>

        <div className="divider" style={{ margin: "12px 0" }} />

        <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="muted">Privacy:</span>
            <span style={{ fontWeight: 600, color: "#10b981" }}>
              Zero Telemetry · 100% Local
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="muted">Engine:</span>
            <span style={{ fontWeight: 600 }}>Tauri v2 + Tokio Core</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="muted">Design System:</span>
            <span style={{ fontWeight: 600 }}>HeroUI v3 Solid Black</span>
          </div>
        </div>
      </Card.Content>
    </Card>
  );
}
