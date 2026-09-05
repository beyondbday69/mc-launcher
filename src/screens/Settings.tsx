import { useState, useEffect } from "react";
import { Label, Slider } from "@heroui/react";
import { api, Config, JavaInstallation } from "../lib/types";

interface SettingsProps {
  config: Config | null;
  onChange: (config: Config) => void;
}

export function Settings({ config, onChange }: SettingsProps) {
  const [tab, setTab] = useState<"perf" | "java" | "general" | "storage">("perf");
  const [javaList, setJavaList] = useState<JavaInstallation[]>([]);
  const [customJava, setCustomJava] = useState("");

  useEffect(() => {
    api.javaDetect()
      .then(setJavaList)
      .catch((err) => console.error("[NVIDIA Java Detect]:", err));
  }, []);

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Category Tab Bar (NVIDIA Control Panel Tabs) */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
        {[
          { id: "perf", label: "PERFORMANCE & RAM" },
          { id: "java", label: "JAVA RUNTIMES" },
          { id: "general", label: "GENERAL PREFERENCES" },
          { id: "storage", label: "STORAGE & DIRECTORIES" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? "btn-nvidia-primary" : "btn-nvidia-secondary"}
            style={{ padding: "8px 18px", fontSize: 12 }}
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
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: "#ffffff", textTransform: "uppercase" }}>
                  SYSTEM MEMORY ALLOCATION (RAM)
                </h3>
                <span style={{ fontSize: 12, color: "#656d7c" }}>
                  Maximum memory allocated to Minecraft instances and shader rendering
                </span>
              </div>
              <span className="badge-rtx">GEFORCE OPTIMAL</span>
            </div>

            <div style={{ margin: "12px 0" }}>
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
                <Label>DEFAULT MEMORY FOR NEW PROFILES</Label>
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
                  className={ramMb === mb ? "btn-nvidia-primary" : "btn-nvidia-secondary"}
                  style={{ padding: "6px 14px", fontSize: 11.5 }}
                  onClick={() => handleRamChange(mb)}
                >
                  {mb / 1024} GB
                </button>
              ))}
            </div>
          </div>

          {/* JVM Profile Presets */}
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: "#ffffff", textTransform: "uppercase" }}>
                JVM TUNING PROFILES
              </h3>
              <span style={{ fontSize: 12, color: "#656d7c" }}>
                Garbage collection and low-latency flags for optimal FPS stability
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              {[
                { id: "balanced", title: "GAME READY BALANCED", desc: "Recommended for most gameplay and shaders" },
                { id: "aggressive", title: "LOW-LATENCY ESPORTS", desc: "Minimal GC frame stutters with ZGC / Shenandoah" },
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
                      padding: "16px",
                      background: isSelected ? "var(--bg-surface-elevated)" : "var(--bg-canvas)",
                      border: `1px solid ${isSelected ? "var(--nvidia-green)" : "var(--border)"}`,
                      borderRadius: "var(--radius-xs)",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: isSelected ? "#ffffff" : "var(--text-secondary)" }}>
                        {prof.title}
                      </span>
                      {isSelected && (
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--nvidia-green)" }} />
                      )}
                    </div>
                    <span style={{ fontSize: 11.5, color: "#656d7c" }}>{prof.desc}</span>
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
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              padding: "24px",
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 800, color: "#ffffff", textTransform: "uppercase", marginBottom: 6 }}>
              DETECTED JAVA RUNTIMES
            </h3>
            <p style={{ fontSize: 12.5, color: "#656d7c", marginBottom: 18 }}>
              Modern versions of Minecraft (1.20+) require 64-Bit Java 17 or Java 21 for peak rendering and multithreading.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {javaList.map((j) => (
                <div
                  key={j.path}
                  style={{
                    padding: "14px 18px",
                    background: "var(--bg-canvas)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-xs)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#ffffff" }}>
                      Java {j.version} ({j.vendor}) • {j.architecture}
                    </div>
                    <div style={{ fontSize: 11.5, fontFamily: "var(--font-mono)", color: "#656d7c" }}>
                      {j.path}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="badge-rtx">WHQL COMPLIANT</span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 24, paddingTop: 18, borderTop: "1px solid var(--border)", display: "flex", gap: 12 }}>
              <input
                type="text"
                className="input-nvidia"
                placeholder="Specify custom Java executable path (e.g. /usr/bin/java)..."
                value={customJava}
                onChange={(e) => setCustomJava(e.target.value)}
              />
              <button
                type="button"
                className="btn-nvidia-primary"
                onClick={handleAddJava}
              >
                + ADD JAVA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: General Preferences */}
      {tab === "general" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: 18,
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 800, color: "#ffffff", textTransform: "uppercase" }}>
              APPLICATION & LAUNCH BEHAVIOR
            </h3>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid var(--border-subtle)" }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "#ffffff" }}>
                  Minimize/Close Launcher on Game Launch
                </div>
                <div style={{ fontSize: 12, color: "#656d7c" }}>
                  Frees background CPU cycles when Minecraft enters 3D rendering
                </div>
              </div>
              <button
                type="button"
                className={config.close_on_launch ? "btn-nvidia-primary" : "btn-nvidia-secondary"}
                style={{ padding: "6px 16px" }}
                onClick={() => onChange({ ...config, close_on_launch: !config.close_on_launch })}
              >
                {config.close_on_launch ? "ENABLED" : "DISABLED"}
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0" }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "#ffffff" }}>
                  Show Developer Snapshots in Catalog
                </div>
                <div style={{ fontSize: 12, color: "#656d7c" }}>
                  Include experimental Mojang preview builds in version lists
                </div>
              </div>
              <button
                type="button"
                className={config.show_snapshots ? "btn-nvidia-primary" : "btn-nvidia-secondary"}
                style={{ padding: "6px 16px" }}
                onClick={() => onChange({ ...config, show_snapshots: !config.show_snapshots })}
              >
                {config.show_snapshots ? "ENABLED" : "DISABLED"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Storage */}
      {tab === "storage" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              padding: "24px",
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 800, color: "#ffffff", textTransform: "uppercase", marginBottom: 6 }}>
              DATA DIRECTORIES & CACHE
            </h3>
            <p style={{ fontSize: 12.5, color: "#656d7c", marginBottom: 18 }}>
              Default Minecraft assets, libraries, and instance profiles are stored in the user local directory.
            </p>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#9da5b4", marginBottom: 6 }}>
                Primary Storage Location
              </label>
              <input
                type="text"
                className="input-nvidia"
                readOnly
                value="~/.local/share/mc-launcher (Default OS Storage)"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Settings;
