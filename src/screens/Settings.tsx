import { useState, useEffect } from "react";
import { Label, Slider } from "@heroui/react";
import { api, Config, JavaInstallation } from "../lib/types";
import {
  IconRam,
  IconSpeed,
  IconFolder,
  IconSettings,
  IconCopy,
  IconCheck,
  IconRefresh,
  IconPlus,
  IconDownloads,
} from "../lib/icons";

interface SettingsProps {
  config: Config | null;
  onChange: (config: Config) => void;
}

export function Settings({ config, onChange }: SettingsProps) {
  const [tab, setTab] = useState<"perf" | "java" | "storage" | "general">("perf");
  const [javaList, setJavaList] = useState<JavaInstallation[]>([]);
  const [customJava, setCustomJava] = useState("");
  const [customDataDir, setCustomDataDir] = useState(config?.data_dir_override || "");
  const [copiedDir, setCopiedDir] = useState(false);
  const [downloadingRuntime, setDownloadingRuntime] = useState<number | null>(null);
  const [runtimeToast, setRuntimeToast] = useState<string | null>(null);

  useEffect(() => {
    api.javaDetect()
      .then(setJavaList)
      .catch((err) => console.error("[NVIDIA Java Detect]:", err));
  }, []);

  useEffect(() => {
    if (config?.data_dir_override) {
      setCustomDataDir(config.data_dir_override);
    }
  }, [config?.data_dir_override]);

  if (!config) return null;

  const ramMb = config.default_ram_mb || 2048;

  const handleRamChange = (val: number) => {
    onChange({
      ...config,
      default_ram_mb: val,
    });
  };

  const handleAddJava = async () => {
    if (!customJava.trim()) return;
    try {
      const res = await api.javaDetect();
      setJavaList(res);
      setCustomJava("");
    } catch (err) {
      console.error("[NVIDIA Add Java]:", err);
    }
  };

  const handleAutoDownloadJava = async (ver: number) => {
    setDownloadingRuntime(ver);
    try {
      await api.javaAutoDownload(ver);
      const updated = await api.javaDetect();
      setJavaList(updated);
      setRuntimeToast(`Java ${ver} (Adoptium Temurin OpenJDK) successfully downloaded and ready!`);
      setTimeout(() => setRuntimeToast(null), 4000);
    } catch (err: any) {
      console.error("[Auto Download Java]:", err);
      setRuntimeToast(`Download error: ${err?.message || err}`);
      setTimeout(() => setRuntimeToast(null), 5000);
    } finally {
      setDownloadingRuntime(null);
    }
  };

  const handleToggleAutoDownload = () => {
    onChange({
      ...config,
      auto_download_java: !config.auto_download_java,
    });
  };

  const handleSaveDataDir = () => {
    onChange({
      ...config,
      data_dir_override: customDataDir.trim() || null,
    });
    alert("Data storage location updated successfully.");
  };

  const handleResetDataDir = () => {
    setCustomDataDir("");
    onChange({
      ...config,
      data_dir_override: null,
    });
    alert("Restored default storage directory.");
  };

  const handleCopyDir = (path: string) => {
    navigator.clipboard?.writeText(path);
    setCopiedDir(true);
    setTimeout(() => setCopiedDir(false), 2000);
  };

  const currentFolder = config.data_dir_override || "~/.local/share/mc-launcher";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Settings Navigation Tabs */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {[
          { id: "perf", label: "PERFORMANCE & RAM", icon: <IconRam size={15} /> },
          { id: "java", label: "JAVA RUNTIMES", icon: <IconSpeed size={15} /> },
          { id: "storage", label: "FOLDER & STORAGE LOCATION", icon: <IconFolder size={15} /> },
          { id: "general", label: "GENERAL PREFERENCES", icon: <IconSettings size={15} /> },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            className={`pill-tab ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id as any)}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab 1: Performance & Memory */}
      {tab === "perf" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* RAM Slider Card */}
          <div className="nv-card" style={{ padding: "28px" }}>
            <div className="corner-square" />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "#ffffff", textTransform: "uppercase" }}>
                  SYSTEM MEMORY ALLOCATION (RAM)
                </h3>
                <span style={{ fontSize: 13, color: "var(--nv-mute)" }}>
                  Maximum memory allocated to Minecraft instances and mod rendering
                </span>
              </div>
              <span className="badge-tag badge-tag-primary">OPTIMAL</span>
            </div>

            <div style={{ margin: "14px 0" }}>
              <Slider
                className="w-full"
                minValue={1024}
                maxValue={16384}
                step={512}
                value={ramMb}
                onChange={(v) => {
                  const val = Array.isArray(v) ? v[0] : v;
                  handleRamChange(val || 2048);
                }}
                style={{ width: "100%" }}
              >
                <Label>DEFAULT ALLOCATION FOR NEW PROFILES</Label>
                <Slider.Output>
                  {({ state }) => `${state.values[0]} MB (${(state.values[0] / 1024).toFixed(1)} GB)`}
                </Slider.Output>
                <Slider.Track>
                  <Slider.Fill />
                  <Slider.Thumb />
                </Slider.Track>
              </Slider>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              {[2048, 4096, 6144, 8192, 12288].map((mb) => (
                <button
                  key={mb}
                  type="button"
                  className={ramMb === mb ? "button-primary button-sm" : "button-outline-on-dark button-sm"}
                  onClick={() => handleRamChange(mb)}
                >
                  {mb / 1024} GB
                </button>
              ))}
            </div>
          </div>

          {/* JVM Tuning Presets */}
          <div className="nv-card" style={{ padding: "28px" }}>
            <div className="corner-square" />
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#ffffff", textTransform: "uppercase" }}>
                JVM TUNING PROFILES
              </h3>
              <span style={{ fontSize: 13, color: "var(--nv-mute)" }}>
                Garbage collection and low-latency arguments for frame-rate consistency
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
              {[
                { id: "balanced", title: "GAME READY BALANCED", desc: "Recommended for gameplay stability and standard mods" },
                { id: "aggressive", title: "LOW-LATENCY ESPORTS", desc: "ZGC / Shenandoah flags for minimal garbage collector pauses" },
                { id: "default", title: "VANILLA DEFAULT", desc: "Standard Mojang launcher JVM configuration" },
              ].map((prof) => {
                const isSelected = config.default_jvm_profile === prof.id;
                return (
                  <div
                    key={prof.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onChange({ ...config, default_jvm_profile: prof.id })}
                    style={{
                      padding: "18px",
                      background: isSelected ? "var(--nv-surface-elevated)" : "var(--nv-surface-dark)",
                      border: `1px solid ${isSelected ? "var(--nv-primary)" : "var(--nv-hairline)"}`,
                      borderRadius: "var(--rounded-sm)",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: isSelected ? "#ffffff" : "var(--nv-on-dark-mute)" }}>
                        {prof.title}
                      </span>
                      {isSelected && (
                        <div style={{ width: 8, height: 8, background: "var(--nv-primary)" }} />
                      )}
                    </div>
                    <span style={{ fontSize: 12, color: "var(--nv-mute)" }}>{prof.desc}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Java Runtimes */}
      {tab === "java" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Toast Notification */}
          {runtimeToast && (
            <div
              style={{
                padding: "14px 20px",
                background: "rgba(118, 185, 0, 0.15)",
                border: "1px solid var(--nv-primary)",
                borderRadius: "var(--rounded-sm)",
                color: "#ffffff",
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <IconCheck size={18} style={{ color: "var(--nv-primary)" }} />
              <span>{runtimeToast}</span>
            </div>
          )}

          {/* Card 1: Auto-Download Runtime Setting */}
          <div className="nv-card" style={{ padding: "28px" }}>
            <div className="corner-square" />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 12 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "#ffffff", textTransform: "uppercase" }}>
                  AUTO-DOWNLOAD RUNTIME MANAGEMENT
                </h3>
                <span style={{ fontSize: 13, color: "var(--nv-mute)" }}>
                  Automatically download and configure the required OpenJDK Java runtime when launching Minecraft
                </span>
              </div>
              <button
                type="button"
                onClick={handleToggleAutoDownload}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: config.auto_download_java ? "rgba(118, 185, 0, 0.2)" : "var(--nv-surface-dark)",
                  border: `1px solid ${config.auto_download_java ? "var(--nv-primary)" : "var(--nv-hairline)"}`,
                  borderRadius: "20px",
                  padding: "8px 18px",
                  cursor: "pointer",
                  color: config.auto_download_java ? "#ffffff" : "var(--nv-mute)",
                  fontSize: 13,
                  fontWeight: 700,
                  transition: "all 0.2s ease",
                }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: config.auto_download_java ? "var(--nv-primary)" : "var(--nv-mute)",
                    boxShadow: config.auto_download_java ? "0 0 8px var(--nv-primary)" : "none",
                  }}
                />
                <span>{config.auto_download_java ? "AUTO-DOWNLOAD ENABLED" : "DISABLED"}</span>
              </button>
            </div>
            <p style={{ fontSize: 12, color: "var(--nv-on-dark-mute)", lineHeight: 1.5, marginTop: 6 }}>
              When enabled, the launcher resolves the target version requirement (e.g. Java 21 for 1.20.5+, Java 17 for 1.18+, or Java 8 for legacy) and automatically downloads official Eclipse Adoptium Temurin binaries if no suitable runtime is detected on your system.
            </p>
          </div>

          {/* Card 2: Official OpenJDK Temurin Runtimes Catalog */}
          <div className="nv-card" style={{ padding: "28px" }}>
            <div className="corner-square" />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "#ffffff", textTransform: "uppercase" }}>
                  OFFICIAL OPENJDK RUNTIMES (ADOPTIUM TEMURIN)
                </h3>
                <span style={{ fontSize: 13, color: "var(--nv-mute)" }}>
                  Pre-configured, high-performance Java builds optimized for Minecraft and modern mod loaders
                </span>
              </div>
              <button
                type="button"
                className="button-outline-on-dark button-sm"
                onClick={() => api.javaDetect().then(setJavaList)}
                title="Refresh detected runtimes"
              >
                <IconRefresh size={14} />
                <span>SCAN RUNTIMES</span>
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
              {[
                {
                  version: 21,
                  title: "JAVA 21 (LTS)",
                  tag: "MODERN RELEASES",
                  desc: "Required for Minecraft 1.20.5 - 1.21.x and modern Fabric/NeoForge",
                  recommendedFor: "1.21.4, 1.21.x, 1.20.6",
                },
                {
                  version: 17,
                  title: "JAVA 17 (LTS)",
                  tag: "STABLE EXTENDED",
                  desc: "Required for Minecraft 1.18 - 1.20.4, Forge, and Fabric",
                  recommendedFor: "1.20.4, 1.19.4, 1.18.2",
                },
                {
                  version: 8,
                  title: "JAVA 8 (LEGACY)",
                  tag: "RETRO & CLASSIC",
                  desc: "Required for Minecraft 1.16.5 and older vintage modpacks",
                  recommendedFor: "1.16.5, 1.12.2, 1.7.10",
                },
              ].map((rt) => {
                const isInstalled = javaList.some((j) => j.version === rt.version && j.path);
                const isDownloading = downloadingRuntime === rt.version;
                return (
                  <div
                    key={rt.version}
                    style={{
                      padding: "20px",
                      background: isInstalled ? "rgba(118, 185, 0, 0.04)" : "var(--nv-surface-dark)",
                      border: `1px solid ${isInstalled ? "rgba(118, 185, 0, 0.3)" : "var(--nv-hairline)"}`,
                      borderRadius: "var(--rounded-sm)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: 14,
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 16, fontWeight: 700, color: "#ffffff" }}>
                          {rt.title}
                        </span>
                        <span className={`badge-tag ${isInstalled ? "badge-tag-primary" : ""}`}>
                          {rt.tag}
                        </span>
                      </div>
                      <p style={{ fontSize: 12, color: "var(--nv-mute)", marginBottom: 8, lineHeight: 1.4 }}>
                        {rt.desc}
                      </p>
                      <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--nv-on-dark-mute)" }}>
                        Target: {rt.recommendedFor}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 10, borderTop: "1px solid var(--nv-hairline)" }}>
                      {isInstalled ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--nv-primary)", fontSize: 12, fontWeight: 700 }}>
                          <IconCheck size={14} />
                          <span>INSTALLED & READY</span>
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: "var(--nv-mute)" }}>
                          Not detected
                        </div>
                      )}

                      <button
                        type="button"
                        className={isInstalled ? "button-outline-on-dark button-sm" : "button-primary button-sm"}
                        disabled={isDownloading}
                        onClick={() => handleAutoDownloadJava(rt.version)}
                      >
                        {isDownloading ? (
                          <>
                            <IconRefresh size={14} className="spin" />
                            <span>DOWNLOADING...</span>
                          </>
                        ) : (
                          <>
                            <IconDownloads size={14} />
                            <span>{isInstalled ? "RE-DOWNLOAD" : "DOWNLOAD RUNTIME"}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Card 3: All Detected System Runtimes */}
          <div className="nv-card" style={{ padding: "28px" }}>
            <div className="corner-square" />
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#ffffff", textTransform: "uppercase", marginBottom: 6 }}>
              ALL DETECTED SYSTEM RUNTIMES
            </h3>
            <p style={{ fontSize: 13, color: "var(--nv-mute)", marginBottom: 20 }}>
              The launcher automatically catalogs JVMs found in standard locations, JAVA_HOME, and the launcher runtime directory.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {javaList.length === 0 ? (
                <div style={{ padding: "20px", textAlign: "center", color: "var(--nv-mute)", fontSize: 13 }}>
                  No Java runtimes detected. Click "DOWNLOAD RUNTIME" above to auto-download OpenJDK.
                </div>
              ) : (
                javaList.map((j) => (
                  <div
                    key={j.path}
                    style={{
                      padding: "16px 20px",
                      background: "var(--nv-surface-dark)",
                      border: "1px solid var(--nv-hairline)",
                      borderRadius: "var(--rounded-sm)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#ffffff" }}>
                        Java {j.version} ({j.vendor}) • {j.architecture}
                      </div>
                      <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--nv-mute)" }}>
                        {j.path}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="badge-tag badge-tag-primary">COMPLIANT</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ marginTop: 24, paddingTop: 18, borderTop: "1px solid var(--nv-hairline)", display: "flex", gap: 12 }}>
              <input
                type="text"
                className="text-input"
                placeholder="Specify custom Java executable path (e.g. /usr/bin/java)..."
                value={customJava}
                onChange={(e) => setCustomJava(e.target.value)}
              />
              <button
                type="button"
                className="button-primary"
                onClick={handleAddJava}
              >
                <IconPlus size={14} />
                <span>ADD MANUAL JAVA</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Folder & Storage Location */}
      {tab === "storage" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="nv-card" style={{ padding: "28px" }}>
            <div className="corner-square" />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#ffffff", textTransform: "uppercase" }}>
                GAME DATA & STORAGE FOLDER LOCATION
              </h3>
              <span className="badge-tag badge-tag-primary">CONFIGURABLE</span>
            </div>

            <p style={{ fontSize: 13, color: "var(--nv-on-dark-mute)", marginBottom: 20 }}>
              Configure where Minecraft profiles, world saves, resource packs, and game libraries are stored on your filesystem.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "var(--nv-mute)", marginBottom: 8 }}>
                  Active Storage Directory Path
                </label>
                <div style={{ display: "flex", gap: 10 }}>
                  <input
                    type="text"
                    className="text-input"
                    placeholder="Enter custom absolute directory path (e.g. /data/mc-launcher or D:\Games\Minecraft)..."
                    value={customDataDir}
                    onChange={(e) => setCustomDataDir(e.target.value)}
                  />
                  <button
                    type="button"
                    className="button-primary"
                    onClick={handleSaveDataDir}
                  >
                    <IconCheck size={14} />
                    <span>SAVE LOCATION</span>
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <button
                  type="button"
                  className="button-outline-on-dark button-sm"
                  onClick={() => handleCopyDir(customDataDir || currentFolder)}
                >
                  {copiedDir ? <IconCheck size={14} /> : <IconCopy size={14} />}
                  <span>{copiedDir ? "PATH COPIED!" : "COPY FOLDER PATH"}</span>
                </button>

                {config.data_dir_override && (
                  <button
                    type="button"
                    className="button-outline-on-dark button-sm"
                    style={{ color: "var(--nv-warning)" }}
                    onClick={handleResetDataDir}
                  >
                    <IconRefresh size={14} />
                    <span>RESTORE OS DEFAULT LOCATION</span>
                  </button>
                )}
              </div>

              {/* Directory Architecture Breakdown */}
              <div
                style={{
                  marginTop: 12,
                  padding: "16px 20px",
                  background: "var(--nv-surface-dark)",
                  border: "1px solid var(--nv-hairline)",
                  borderRadius: "var(--rounded-sm)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  fontSize: 13,
                }}
              >
                <div style={{ fontWeight: 700, color: "#ffffff", marginBottom: 4 }}>
                  Directory Layout Architecture:
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--nv-on-dark-mute)" }}>
                  ├── <strong>instances/</strong> — Isolated folders for each created Minecraft profile<br />
                  ├── <strong>assets/</strong> — Sound effects, textures, language assets, and Mojang hashes<br />
                  ├── <strong>libraries/</strong> — LWJGL, ASM, Netty, and Fabric/Forge runtime dependencies<br />
                  └── <strong>runtime/</strong> — Native libraries, client JARs, and session execution logs
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: General Preferences */}
      {tab === "general" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="nv-card" style={{ padding: "28px" }}>
            <div className="corner-square" />
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#ffffff", textTransform: "uppercase", marginBottom: 12 }}>
              APPLICATION & LAUNCH BEHAVIOR
            </h3>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 0", borderBottom: "1px solid var(--nv-hairline)" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#ffffff" }}>
                  Minimize/Close Launcher on Game Launch
                </div>
                <div style={{ fontSize: 12, color: "var(--nv-mute)" }}>
                  Frees background CPU cycles when Minecraft enters active rendering
                </div>
              </div>
              <button
                type="button"
                className={config.close_on_launch ? "button-primary button-sm" : "button-outline-on-dark button-sm"}
                onClick={() => onChange({ ...config, close_on_launch: !config.close_on_launch })}
              >
                {config.close_on_launch ? "ENABLED" : "DISABLED"}
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 0" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#ffffff" }}>
                  Show Developer Snapshots in Catalog
                </div>
                <div style={{ fontSize: 12, color: "var(--nv-mute)" }}>
                  Include experimental Mojang preview builds in version lists
                </div>
              </div>
              <button
                type="button"
                className={config.show_snapshots ? "button-primary button-sm" : "button-outline-on-dark button-sm"}
                onClick={() => onChange({ ...config, show_snapshots: !config.show_snapshots })}
              >
                {config.show_snapshots ? "ENABLED" : "DISABLED"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Settings;
