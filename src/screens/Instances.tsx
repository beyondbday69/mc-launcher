import { useEffect, useState } from "react";
import { api, Instance, VersionEntry } from "../lib/types";
import {
  IconPlus,
  IconPlay,
  IconEdit,
  IconCopy,
  IconTrash,
  IconFolder,
  IconGrid,
  IconList,
  IconCheck,
  IconCube,
  IconRam,
  IconClock,
} from "../lib/icons";

interface Props {
  instances: Instance[];
  onChange: () => void;
  onSelect: (i: Instance) => void;
}

const COLOR_PALETTE = [
  "#38bdf8", // Sky / Cyan
  "#a78bfa", // Violet / Purple
  "#34d399", // Emerald / Green
  "#f59e0b", // Amber / Orange
  "#f87171", // Coral / Red
  "#ec4899", // Pink
  "#06b6d4", // Teal
  "#6366f1", // Indigo
];

export function Instances({ instances, onChange, onSelect }: Props) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Instance | null>(null);
  const [filter, setFilter] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [copiedFolderId, setCopiedFolderId] = useState<string | null>(null);

  const filtered = instances.filter(
    (i) =>
      i.name.toLowerCase().includes(filter.toLowerCase()) ||
      i.version.toLowerCase().includes(filter.toLowerCase()) ||
      (i.mod_loader && i.mod_loader.kind.toLowerCase().includes(filter.toLowerCase())),
  );

  const handleCopyFolder = (i: Instance) => {
    navigator.clipboard.writeText(i.game_dir);
    setCopiedFolderId(i.id);
    setTimeout(() => setCopiedFolderId(null), 2000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Top Search & Actions Bar */}
      <div className="row between" style={{ flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em" }}>
            Instances
          </h2>
          <span className="chip" style={{ fontSize: 11 }}>
            {filtered.length} {filtered.length === 1 ? "instance" : "instances"}
          </span>
        </div>

        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          {/* Material 3 Search Bar */}
          <div style={{ position: "relative" }}>
            <input
              type="text"
              placeholder="Search instances…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{ width: 220, fontSize: 13 }}
            />
            {filter && (
              <button
                className="btn ghost"
                onClick={() => setFilter("")}
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  padding: "2px 6px",
                  fontSize: 12,
                  color: "var(--md-sys-color-on-surface-variant)",
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* View Mode Toggle */}
          <div
            style={{
              display: "flex",
              background: "var(--md-sys-color-surface-container)",
              borderRadius: "var(--md-sys-shape-corner-full)",
              padding: 2,
              border: "1px solid var(--md-sys-color-outline-variant)",
            }}
          >
            <button
              className="btn ghost"
              onClick={() => setViewMode("grid")}
              style={{
                padding: "6px 10px",
                borderRadius: "var(--md-sys-shape-corner-full)",
                background: viewMode === "grid" ? "var(--md-sys-color-surface-container-highest)" : "transparent",
                color: viewMode === "grid" ? "var(--md-sys-color-primary)" : "var(--md-sys-color-on-surface-variant)",
              }}
              title="Grid View"
            >
              <IconGrid size={15} />
            </button>
            <button
              className="btn ghost"
              onClick={() => setViewMode("list")}
              style={{
                padding: "6px 10px",
                borderRadius: "var(--md-sys-shape-corner-full)",
                background: viewMode === "list" ? "var(--md-sys-color-surface-container-highest)" : "transparent",
                color: viewMode === "list" ? "var(--md-sys-color-primary)" : "var(--md-sys-color-on-surface-variant)",
              }}
              title="List View"
            >
              <IconList size={15} />
            </button>
          </div>

          {/* Create Button */}
          <button
            className="btn primary"
            onClick={() => setCreating(true)}
            style={{ padding: "8px 16px", gap: 6 }}
          >
            <IconPlus size={16} />
            <span>New Instance</span>
          </button>
        </div>
      </div>

      {/* Empty State */}
      {filtered.length === 0 ? (
        <div className="empty">
          <div className="icon">
            <IconCube size={44} />
          </div>
          <p style={{ fontSize: 16, fontWeight: 600 }}>No instances found</p>
          <p className="faint" style={{ fontSize: 13 }}>
            {instances.length === 0
              ? "Create an instance to start your Minecraft journey."
              : "Try adjusting your search query."}
          </p>
          {instances.length === 0 && (
            <button
              className="btn primary"
              onClick={() => setCreating(true)}
              style={{ marginTop: 12 }}
            >
              <IconPlus size={16} />
              <span>Create First Instance</span>
            </button>
          )}
        </div>
      ) : viewMode === "grid" ? (
        /* Expressive Cards Grid */
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))",
            gap: 16,
          }}
        >
          {filtered.map((i) => (
            <div
              key={i.id}
              className="instance-card"
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 16,
                cursor: "pointer",
                borderLeft: `4px solid ${i.color || "var(--md-sys-color-primary)"}`,
              }}
              onClick={() => onSelect(i)}
            >
              <div>
                {/* Header with Avatar & Title */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "var(--md-sys-shape-corner-md)",
                      background: i.color || "var(--md-sys-color-primary)",
                      color: "#ffffff",
                      fontWeight: 800,
                      fontSize: 16,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: `0 2px 10px ${i.color ? i.color + "55" : "rgba(56, 189, 248, 0.35)"}`,
                      flexShrink: 0,
                    }}
                  >
                    {i.name.charAt(0).toUpperCase()}
                  </div>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: "var(--md-sys-color-on-surface)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={i.name}
                    >
                      {i.name}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                      <span className="chip success" style={{ fontSize: 10.5, padding: "1px 7px" }}>
                        {i.version}
                      </span>
                      {i.mod_loader && (
                        <span
                          className="chip"
                          style={{
                            fontSize: 10.5,
                            padding: "1px 7px",
                            background: "rgba(167, 139, 250, 0.15)",
                            borderColor: "rgba(167, 139, 250, 0.3)",
                            color: "var(--md-sys-color-secondary)",
                          }}
                        >
                          {i.mod_loader.kind}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Instance Details Row */}
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 10,
                    fontSize: 11.5,
                    color: "var(--md-sys-color-on-surface-variant)",
                    background: "var(--md-sys-color-surface-container-lowest)",
                    padding: "8px 12px",
                    borderRadius: "var(--md-sys-shape-corner-md)",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <IconRam size={13} style={{ color: "var(--md-sys-color-primary)" }} />
                    {i.ram_mb ?? 2048} MB
                  </span>
                  <span style={{ opacity: 0.4 }}>•</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <IconClock size={13} />
                    {i.last_played ? formatDate(i.last_played) : "Never played"}
                  </span>
                </div>
              </div>

              {/* Quick Actions Footer */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingTop: 10,
                  borderTop: "1px solid var(--md-sys-color-outline-variant)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="btn primary"
                  onClick={() => onSelect(i)}
                  style={{ padding: "4px 14px", fontSize: 12, gap: 5 }}
                >
                  <IconPlay size={13} />
                  <span>Play</span>
                </button>

                <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <button
                    className="btn ghost"
                    onClick={() => handleCopyFolder(i)}
                    title={copiedFolderId === i.id ? "Path copied!" : `Game Dir: ${i.game_dir}`}
                    style={{
                      padding: "6px 8px",
                      color: copiedFolderId === i.id ? "var(--md-sys-color-tertiary)" : undefined,
                    }}
                  >
                    {copiedFolderId === i.id ? <IconCheck size={14} /> : <IconFolder size={14} />}
                  </button>

                  <button
                    className="btn ghost"
                    onClick={() => setEditing(i)}
                    title="Edit instance settings"
                    style={{ padding: "6px 8px" }}
                  >
                    <IconEdit size={14} />
                  </button>

                  <button
                    className="btn ghost"
                    onClick={async () => {
                      const name = prompt("New name for duplicate:", `${i.name} copy`);
                      if (!name) return;
                      try {
                        await api.instancesDuplicate(i.id, name);
                        onChange();
                      } catch (e) {
                        alert(String(e));
                      }
                    }}
                    title="Duplicate instance"
                    style={{ padding: "6px 8px" }}
                  >
                    <IconCopy size={14} />
                  </button>

                  <button
                    className="btn ghost"
                    onClick={async () => {
                      if (!confirm(`Delete instance "${i.name}"?`)) return;
                      try {
                        await api.instancesDelete(i.id);
                        onChange();
                      } catch (e) {
                        alert(String(e));
                      }
                    }}
                    title="Delete instance"
                    style={{ padding: "6px 8px", color: "var(--md-sys-color-error)" }}
                  >
                    <IconTrash size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List View */
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Instance</th>
                <th>Version</th>
                <th>Loader</th>
                <th>RAM</th>
                <th>Last played</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => (
                <tr key={i.id} onClick={() => onSelect(i)}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: i.color || "var(--md-sys-color-primary)",
                          boxShadow: `0 0 6px ${i.color || "var(--md-sys-color-primary)"}`,
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontWeight: 600, color: "var(--md-sys-color-on-surface)" }}>
                        {i.name}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="chip success" style={{ fontSize: 11, padding: "1px 6px" }}>
                      {i.version}
                    </span>
                  </td>
                  <td>
                    {i.mod_loader ? (
                      <span className="chip" style={{ fontSize: 11, padding: "1px 6px" }}>
                        {i.mod_loader.kind}
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
                    {i.ram_mb ?? 2048} MB
                  </td>
                  <td className="muted" style={{ fontSize: 12 }}>
                    {i.last_played ? formatDate(i.last_played) : "Never"}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                      <button
                        className="btn primary"
                        onClick={() => onSelect(i)}
                        style={{ padding: "3px 10px", fontSize: 12 }}
                      >
                        Play
                      </button>
                      <button
                        className="btn ghost"
                        onClick={() => handleCopyFolder(i)}
                        title="Copy game folder path"
                        style={{ padding: "4px 8px" }}
                      >
                        {copiedFolderId === i.id ? <IconCheck size={14} /> : <IconFolder size={14} />}
                      </button>
                      <button
                        className="btn ghost"
                        onClick={() => setEditing(i)}
                        style={{ padding: "4px 8px" }}
                      >
                        <IconEdit size={14} />
                      </button>
                      <button
                        className="btn ghost"
                        onClick={async () => {
                          const name = prompt("New name for duplicate:", `${i.name} copy`);
                          if (!name) return;
                          try {
                            await api.instancesDuplicate(i.id, name);
                            onChange();
                          } catch (e) {
                            alert(String(e));
                          }
                        }}
                        style={{ padding: "4px 8px" }}
                      >
                        <IconCopy size={14} />
                      </button>
                      <button
                        className="btn ghost"
                        onClick={async () => {
                          if (!confirm(`Delete instance "${i.name}"?`)) return;
                          try {
                            await api.instancesDelete(i.id);
                            onChange();
                          } catch (e) {
                            alert(String(e));
                          }
                        }}
                        style={{ padding: "4px 8px", color: "var(--md-sys-color-error)" }}
                      >
                        <IconTrash size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Instance Dialog */}
      {creating && (
        <CreateModal
          onClose={() => setCreating(false)}
          onSave={async (name, version, color, ramMb) => {
            try {
              const inst = await api.instancesCreate(name, version);
              inst.color = color;
              inst.ram_mb = ramMb;
              await api.instancesUpdate(inst);
              onChange();
              setCreating(false);
              onSelect(inst);
            } catch (e) {
              alert(String(e));
            }
          }}
        />
      )}

      {/* Edit Instance Dialog */}
      {editing && (
        <EditModal
          instance={editing}
          onClose={() => setEditing(null)}
          onSave={async (inst) => {
            try {
              await api.instancesUpdate(inst);
              onChange();
              setEditing(null);
            } catch (e) {
              alert(String(e));
            }
          }}
        />
      )}
    </div>
  );
}

/* ==========================================================================
   Create Instance Modal
   ========================================================================== */

interface CreateProps {
  onClose: () => void;
  onSave: (name: string, version: string, color: string, ramMb: number) => Promise<void>;
}

function CreateModal({ onClose, onSave }: CreateProps) {
  const [name, setName] = useState("");
  const [version, setVersion] = useState("");
  const [color, setColor] = useState(COLOR_PALETTE[0]!);
  const [ramMb, setRamMb] = useState(2048);
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .versionsList(false, false)
      .then((vs) => {
        setVersions(vs);
        if (vs[0]) setVersion(vs[0].id);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 500 }}>
        <h2>Create New Instance</h2>

        {/* Instance Name */}
        <div className="field">
          <label>Instance Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Modern Survival 1.21"
            autoFocus
          />
        </div>

        {/* Colored Avatar Picker */}
        <div className="field">
          <label>Theme Color</label>
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            {COLOR_PALETTE.map((c) => {
              const isSelected = color === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: c,
                    border: isSelected ? "3px solid #ffffff" : "2px solid transparent",
                    boxShadow: isSelected ? `0 0 12px ${c}` : "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#ffffff",
                    transition: "transform 0.15s ease",
                    transform: isSelected ? "scale(1.15)" : "scale(1)",
                  }}
                  title={c}
                >
                  {isSelected && <IconCheck size={16} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Minecraft Version Dropdown */}
        <div className="field">
          <label>Minecraft Version</label>
          <select
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            style={{ width: "100%" }}
          >
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.id} {v.type === "snapshot" ? "(snapshot)" : ""}
              </option>
            ))}
          </select>
        </div>

        {/* RAM Slider */}
        <div className="field">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label>Memory (RAM)</label>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--md-sys-color-primary)" }}>
              {ramMb} MB ({(ramMb / 1024).toFixed(1)} GB)
            </span>
          </div>
          <input
            type="range"
            min={1024}
            max={16384}
            step={512}
            value={ramMb}
            onChange={(e) => setRamMb(parseInt(e.target.value, 10))}
            style={{ width: "100%", margin: "8px 0" }}
          />
          {/* Preset Buttons */}
          <div style={{ display: "flex", gap: 8 }}>
            {[2048, 4096, 6144, 8192].map((mb) => (
              <button
                key={mb}
                type="button"
                className={`chip ${ramMb === mb ? "active" : ""}`}
                onClick={() => setRamMb(mb)}
                style={{ fontSize: 11, padding: "2px 10px", cursor: "pointer" }}
              >
                {mb / 1024} GB
              </button>
            ))}
          </div>
        </div>

        <div className="actions">
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={!name.trim() || !version || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onSave(name.trim(), version, color, ramMb);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Creating…" : "Create Instance"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   Edit Instance Modal
   ========================================================================== */

function EditModal({
  instance,
  onClose,
  onSave,
}: {
  instance: Instance;
  onClose: () => void;
  onSave: (i: Instance) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Instance>({ ...instance });
  const [busy, setBusy] = useState(false);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 560 }}>
        <h2>Edit Instance: {instance.name}</h2>

        <div className="form-grid">
          <div className="field">
            <label>Instance Name</label>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>

          <div className="field">
            <label>Minecraft Version</label>
            <input
              value={draft.version}
              onChange={(e) => setDraft({ ...draft, version: e.target.value })}
            />
          </div>
        </div>

        {/* Color Avatar Picker */}
        <div className="field">
          <label>Theme Color</label>
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            {COLOR_PALETTE.map((c) => {
              const isSelected = draft.color === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setDraft({ ...draft, color: c })}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: c,
                    border: isSelected ? "3px solid #ffffff" : "2px solid transparent",
                    boxShadow: isSelected ? `0 0 12px ${c}` : "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#ffffff",
                    transform: isSelected ? "scale(1.15)" : "scale(1)",
                    transition: "transform 0.15s ease",
                  }}
                  title={c}
                >
                  {isSelected && <IconCheck size={16} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* RAM Slider */}
        <div className="field">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <label>Memory (RAM)</label>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--md-sys-color-primary)" }}>
              {draft.ram_mb ?? 2048} MB ({(((draft.ram_mb ?? 2048)) / 1024).toFixed(1)} GB)
            </span>
          </div>
          <input
            type="range"
            min={1024}
            max={16384}
            step={512}
            value={draft.ram_mb ?? 2048}
            onChange={(e) =>
              setDraft({
                ...draft,
                ram_mb: parseInt(e.target.value || "2048", 10),
              })
            }
            style={{ width: "100%", margin: "8px 0" }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            {[2048, 4096, 6144, 8192].map((mb) => (
              <button
                key={mb}
                type="button"
                className={`chip ${(draft.ram_mb ?? 2048) === mb ? "active" : ""}`}
                onClick={() => setDraft({ ...draft, ram_mb: mb })}
                style={{ fontSize: 11, padding: "2px 10px", cursor: "pointer" }}
              >
                {mb / 1024} GB
              </button>
            ))}
          </div>
        </div>

        <div className="form-grid">
          <div className="field">
            <label>JVM Profile</label>
            <select
              value={draft.jvm_profile}
              onChange={(e) => setDraft({ ...draft, jvm_profile: e.target.value })}
            >
              <option value="default">Default</option>
              <option value="low_ram">Low RAM</option>
              <option value="balanced">Balanced</option>
              <option value="performance">Performance</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          <div className="field">
            <label>Window Dimensions</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="number"
                placeholder="Width (854)"
                value={draft.resolution_width ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    resolution_width: e.target.value ? parseInt(e.target.value, 10) : null,
                  })
                }
                style={{ flex: 1 }}
              />
              <input
                type="number"
                placeholder="Height (480)"
                value={draft.resolution_height ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    resolution_height: e.target.value ? parseInt(e.target.value, 10) : null,
                  })
                }
                style={{ flex: 1 }}
              />
            </div>
          </div>
        </div>

        {/* Fullscreen Toggle */}
        <div className="field" style={{ marginTop: 4 }}>
          <label style={{ display: "inline-flex", alignItems: "center", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={draft.fullscreen}
              onChange={(e) => setDraft({ ...draft, fullscreen: e.target.checked })}
            />
            <span>Launch in Fullscreen</span>
          </label>
        </div>

        {/* Custom JVM Args */}
        {draft.jvm_profile === "custom" && (
          <div className="field">
            <label>Custom JVM Arguments (one per line)</label>
            <textarea
              value={draft.custom_jvm_args.join("\n")}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  custom_jvm_args: e.target.value
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              rows={3}
            />
          </div>
        )}

        <div className="actions">
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onSave(draft);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}
