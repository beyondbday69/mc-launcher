import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { api, Config, JavaInstallation } from "../lib/types";

interface Props {
  config: Config;
  onChange: (c: Config) => void;
}

type Tab = "general" | "java" | "jvm" | "downloads" | "about";

const TABS: { id: Tab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "java", label: "Java" },
  { id: "jvm", label: "JVM" },
  { id: "downloads", label: "Downloads" },
  { id: "about", label: "About" },
];

export function Settings({ config, onChange }: Props) {
  const [tab, setTab] = useState<Tab>("general");
  const [java, setJava] = useState<JavaInstallation[]>([]);

  useEffect(() => {
    api.javaList().then(setJava).catch(() => {});
  }, []);

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
        Settings
      </h2>
      <div className="settings">
        <div className="settings-nav">
          {TABS.map((t) => (
            <div
              key={t.id}
              className={`settings-nav-item ${tab === t.id ? "active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </div>
          ))}
        </div>
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

function GeneralTab({
  config,
  onChange,
}: {
  config: Config;
  onChange: (c: Config) => void;
}) {
  return (
    <div className="card">
      <h3>General</h3>
      <div className="field">
        <label>Default RAM (MB)</label>
        <input
          type="number"
          min={512}
          step={256}
          value={config.default_ram_mb}
          onChange={(e) =>
            onChange({
              ...config,
              default_ram_mb: parseInt(e.target.value, 10) || 2048,
            })
          }
        />
      </div>
      <div className="field">
        <label>Theme</label>
        <select
          value={config.theme}
          onChange={(e) => onChange({ ...config, theme: e.target.value })}
        >
          <option value="dark">Dark</option>
        </select>
      </div>
      <div className="field">
        <label>Language</label>
        <select
          value={config.language}
          onChange={(e) => onChange({ ...config, language: e.target.value })}
        >
          <option value="en-US">English (US)</option>
        </select>
      </div>
      <div className="field">
        <label>
          <input
            type="checkbox"
            checked={config.close_on_launch}
            onChange={(e) =>
              onChange({ ...config, close_on_launch: e.target.checked })
            }
          />{" "}
          Close launcher when the game starts
        </label>
      </div>
      <div className="field">
        <label>
          <input
            type="checkbox"
            checked={config.show_snapshots}
            onChange={(e) =>
              onChange({ ...config, show_snapshots: e.target.checked })
            }
          />{" "}
          Show snapshots in the version list
        </label>
      </div>
      <div className="field">
        <label>
          <input
            type="checkbox"
            checked={config.show_historical}
            onChange={(e) =>
              onChange({ ...config, show_historical: e.target.checked })
            }
          />{" "}
          Show historical (alpha/beta) versions
        </label>
      </div>
    </div>
  );
}

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
    <div className="card">
      <h3>Java installations</h3>
      <p className="muted" style={{ marginBottom: 12, fontSize: 13 }}>
        The launcher detects Java in common install locations and
        <code> JAVA_HOME</code>. You can also add a path manually.
      </p>
      <div className="row" style={{ gap: 8, marginBottom: 12 }}>
        <button
          className="btn"
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
        >
          {detecting ? "Detecting…" : "Re-detect"}
        </button>
        <button
          className="btn"
          onClick={async () => {
            const path = await open({
              multiple: false,
              directory: false,
              title: "Select java executable",
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
        >
          Add manually…
        </button>
      </div>
      {installations.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>
          No Java installations detected. Install Java 17 or 21, or click
          "Add manually…".
        </p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Version</th>
              <th>Vendor</th>
              <th>Path</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {installations.map((j) => (
              <tr key={j.path}>
                <td>{j.version}</td>
                <td className="muted">{j.vendor}</td>
                <td className="mono" style={{ fontSize: 11, color: "var(--text-dim)" }}>
                  {j.path}
                </td>
                <td style={{ textAlign: "right" }}>
                  <button
                    className="btn ghost"
                    onClick={() =>
                      onChange({ ...config, default_java_path: j.path })
                    }
                  >
                    {config.default_java_path === j.path ? "Default ✓" : "Set default"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function JvmTab({
  config,
  onChange,
}: {
  config: Config;
  onChange: (c: Config) => void;
}) {
  return (
    <div className="card">
      <h3>JVM</h3>
      <p className="muted" style={{ marginBottom: 12, fontSize: 13 }}>
        Default JVM profile used for new instances. Each instance can override this.
      </p>
      <div className="field">
        <label>Default profile</label>
        <select
          value={config.default_jvm_profile}
          onChange={(e) =>
            onChange({ ...config, default_jvm_profile: e.target.value })
          }
        >
          <option value="default">Default</option>
          <option value="low_ram">Low RAM</option>
          <option value="balanced">Balanced</option>
          <option value="performance">Performance</option>
          <option value="custom">Custom</option>
        </select>
      </div>
      <div className="field">
        <label>Custom JVM args (used when "Custom" is selected)</label>
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
          rows={4}
        />
      </div>
    </div>
  );
}

function DownloadsTab({
  config,
  onChange,
}: {
  config: Config;
  onChange: (c: Config) => void;
}) {
  return (
    <div className="card">
      <h3>Downloads</h3>
      <div className="field">
        <label>Concurrent downloads</label>
        <input
          type="number"
          min={1}
          max={32}
          value={config.download_concurrency}
          onChange={(e) =>
            onChange({
              ...config,
              download_concurrency: Math.max(
                1,
                Math.min(32, parseInt(e.target.value, 10) || 8),
              ),
            })
          }
        />
      </div>
      <div className="field">
        <label>Speed limit (KB/s, 0 = unlimited)</label>
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
        />
      </div>
    </div>
  );
}

function AboutTab() {
  return (
    <div className="card">
      <h3>About</h3>
      <p style={{ marginBottom: 6 }}>
        <strong>MC Launcher</strong>
      </p>
      <p className="muted" style={{ fontSize: 13 }}>
        A fast, lightweight, secure Minecraft Java Edition launcher.
      </p>
      <div className="divider" />
      <p className="faint" style={{ fontSize: 12 }}>
        Built with Tauri, React, and Rust. No telemetry. No tracking.
      </p>
    </div>
  );
}
