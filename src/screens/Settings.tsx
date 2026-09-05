import { useState, useEffect } from "react";
import { Label, Slider } from "@heroui/react";
import { api, Config, JavaInstallation } from "../lib/types";

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
      const added = await api.javaAdd(customJava.trim());
      setJavaList((prev) => [...prev, added]);
      setCustomJava("");
    } catch (err) {
      console.error("[NVIDIA Java Add]:", err);
    }
  };

  const handleSaveDataDir = () => {
    const val = customDataDir.trim() ? customDataDir.trim() : null;
    onChange({
      ...config,
      data_dir_override: val,
    });
    alert("Storage folder location updated successfully!");
  };

  const handleResetDataDir = () => {
    setCustomDataDir("");
    onChange({
      ...config,
      data_dir_override: null,
    });
  };

  const handleCopyDir = (path: string) => {
    navigator.clipboard?.writeText(path);
    setCopiedDir(true);
    setTimeout(() => setCopiedDir(false), 2000);
  };

  const currentFolder = config.data_dir_override || "~/.local/share/mc-launcher (Default OS Storage)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Category Tabs */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid var(--nv-hairline)", paddingBottom: 14 }}>
        {[
          { id: "perf", label: "PERFORMANCE & RAM" },
          { id: "java", label: "JAVA RUNTIMES" },
          { id: "storage", label: "FOLDER & STORAGE LOCATION" },
          { id: "general", label: "GENERAL PREFERENCES" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            className={`pill-tab ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id as any)}
          >
            {t.label}
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
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="nv-card" style={{ padding: "28px" }}>
            <div className="corner-square" />
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#ffffff", textTransform: "uppercase", marginBottom: 6 }}>
              DETECTED JAVA RUNTIMES
            </h3>
            <p style={{ fontSize: 13, color: "var(--nv-mute)", marginBottom: 20 }}>
              Modern Minecraft (1.20+) requires 64-Bit Java 17 or Java 21 for peak rendering throughput.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {javaList.map((j) => (
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
              ))}
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
                + ADD JAVA
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
                    SAVE LOCATION
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <button
                  type="button"
                  className="button-outline-on-dark button-sm"
                  onClick={() => handleCopyDir(customDataDir || currentFolder)}
                >
                  {copiedDir ? "PATH COPIED!" : "COPY FOLDER PATH"}
                </button>

                {config.data_dir_override && (
                  <button
                    type="button"
                    className="button-outline-on-dark button-sm"
                    style={{ color: "var(--nv-warning)" }}
                    onClick={handleResetDataDir}
                  >
                    RESTORE OS DEFAULT LOCATION
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
