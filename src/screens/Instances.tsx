import { useState, useMemo } from "react";
import { api, Instance, ModInfo, formatDuration } from "../lib/types";

interface InstancesProps {
  instances: Instance[];
  onChange: () => Promise<void>;
  onSelect: (instance: Instance) => void;
}

export function Instances({ instances, onChange, onSelect }: InstancesProps) {
  const [search, setSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newVersion, setNewVersion] = useState("1.21.4");
  const [creating, setCreating] = useState(false);

  // Mod Drawer State
  const [activeModDrawerInst, setActiveModDrawerInst] = useState<Instance | null>(null);
  const [modsList, setModsList] = useState<ModInfo[]>([]);
  const [loadingMods, setLoadingMods] = useState(false);

  const filteredInstances = useMemo(() => {
    return instances.filter(
      (inst) =>
        inst.name.toLowerCase().includes(search.toLowerCase()) ||
        inst.version.toLowerCase().includes(search.toLowerCase())
    );
  }, [instances, search]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const created = await api.instancesCreate(newName.trim(), newVersion);
      setShowCreateModal(false);
      setNewName("");
      await onChange();
      onSelect(created);
    } catch (err) {
      console.error("[NVIDIA Create Instance]:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleDuplicate = async (inst: Instance) => {
    try {
      await api.instancesDuplicate(inst.id, `${inst.name} (Copy)`);
      await onChange();
    } catch (err) {
      console.error("[NVIDIA Duplicate Instance]:", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this game profile?")) return;
    try {
      await api.instancesDelete(id);
      await onChange();
    } catch (err) {
      console.error("[NVIDIA Delete Instance]:", err);
    }
  };

  const handleOpenMods = async (inst: Instance) => {
    setActiveModDrawerInst(inst);
    setLoadingMods(true);
    try {
      const mods = await api.instancesListMods(inst.id);
      setModsList(mods);
    } catch (err) {
      console.error("[NVIDIA List Mods]:", err);
    } finally {
      setLoadingMods(false);
    }
  };

  const handleToggleMod = async (fileName: string, currentEnabled: boolean) => {
    if (!activeModDrawerInst) return;
    try {
      await api.instancesSetModEnabled(activeModDrawerInst.id, fileName, !currentEnabled);
      const mods = await api.instancesListMods(activeModDrawerInst.id);
      setModsList(mods);
    } catch (err) {
      console.error("[NVIDIA Toggle Mod]:", err);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Top Toolbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, maxWidth: 420 }}>
          <input
            type="text"
            className="input-nvidia"
            placeholder="Search installed game profiles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <button
          type="button"
          className="btn-nvidia-primary"
          onClick={() => setShowCreateModal(true)}
        >
          <span>+ NEW GAME PROFILE</span>
        </button>
      </div>

      {/* Game Profile Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 18 }}>
        {filteredInstances.map((inst) => (
          <div
            key={inst.id}
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              transition: "all 0.15s ease",
            }}
          >
            {/* Tile Header */}
            <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-surface-elevated)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span className="badge-rtx">
                  {inst.mod_loader ? `${inst.mod_loader.kind.toUpperCase()} ${inst.mod_loader.version}` : "VANILLA"}
                </span>
                <span style={{ fontSize: 11.5, fontFamily: "var(--font-mono)", color: "#9da5b4" }}>
                  MC {inst.version}
                </span>
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: "#ffffff", letterSpacing: "-0.01em" }}>
                {inst.name}
              </h3>
            </div>

            {/* Tile Body Telemetry */}
            <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5, color: "#9da5b4" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Memory Allocation:</span>
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--nvidia-green)", fontWeight: 700 }}>
                  {inst.ram_mb || 2048} MB
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Total Playtime:</span>
                <span style={{ fontFamily: "var(--font-mono)", color: "#ffffff" }}>
                  {formatDuration(inst.play_time_secs)}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Last Played:</span>
                <span>{inst.last_played ? new Date(inst.last_played).toLocaleDateString() : "Never"}</span>
              </div>
            </div>

            {/* Tile Action Footer */}
            <div
              style={{
                padding: "12px 20px",
                background: "var(--bg-subtle)",
                borderTop: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <button
                type="button"
                className="btn-nvidia-primary"
                style={{ padding: "8px 18px", fontSize: 12.5 }}
                onClick={() => onSelect(inst)}
              >
                ▶ PLAY
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  type="button"
                  className="btn-nvidia-secondary"
                  style={{ padding: "8px 12px", fontSize: 12 }}
                  onClick={() => handleOpenMods(inst)}
                  title="Manage Mods"
                >
                  MODS
                </button>
                <button
                  type="button"
                  className="btn-nvidia-secondary"
                  style={{ padding: "8px 10px", fontSize: 12 }}
                  onClick={() => handleDuplicate(inst)}
                  title="Duplicate Profile"
                >
                  CLONE
                </button>
                <button
                  type="button"
                  className="btn-nvidia-secondary"
                  style={{ padding: "8px 10px", fontSize: 12, color: "#ef4444" }}
                  onClick={() => handleDelete(inst.id)}
                  title="Delete Profile"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create Instance Modal */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <div className="modal-header">
              <h3>CREATE NEW GAME PROFILE</h3>
              <button
                type="button"
                style={{ background: "none", border: "none", color: "#9da5b4", fontSize: 18, cursor: "pointer" }}
                onClick={() => setShowCreateModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#9da5b4", marginBottom: 6 }}>
                  Profile Name
                </label>
                <input
                  type="text"
                  className="input-nvidia"
                  placeholder="e.g. GeForce RTX Shader World"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#9da5b4", marginBottom: 6 }}>
                  Minecraft Target Version
                </label>
                <select
                  className="input-nvidia"
                  value={newVersion}
                  onChange={(e) => setNewVersion(e.target.value)}
                  style={{ background: "var(--bg-canvas)" }}
                >
                  <option value="1.21.4">Minecraft 1.21.4 (Latest Game Ready)</option>
                  <option value="1.21.1">Minecraft 1.21.1</option>
                  <option value="1.20.4">Minecraft 1.20.4</option>
                  <option value="1.20.1">Minecraft 1.20.1</option>
                  <option value="24w45a">Snapshot 24w45a</option>
                </select>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-nvidia-secondary"
                onClick={() => setShowCreateModal(false)}
              >
                CANCEL
              </button>
              <button
                type="button"
                className="btn-nvidia-primary"
                disabled={creating || !newName.trim()}
                onClick={handleCreate}
              >
                {creating ? "CREATING..." : "CONFIRM PROFILE"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mod Management Modal / Drawer */}
      {activeModDrawerInst && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <div>
                <h3>INSTALLED MODS & EXTENSIONS</h3>
                <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "#76b900" }}>
                  PROFILE: {activeModDrawerInst.name}
                </span>
              </div>
              <button
                type="button"
                style={{ background: "none", border: "none", color: "#9da5b4", fontSize: 18, cursor: "pointer" }}
                onClick={() => setActiveModDrawerInst(null)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ maxHeight: 400, overflowY: "auto" }}>
              {loadingMods ? (
                <div style={{ textAlign: "center", padding: 30, color: "#9da5b4" }}>
                  Scanning mods directory...
                </div>
              ) : modsList.length === 0 ? (
                <div style={{ textAlign: "center", padding: 30, color: "#656d7c" }}>
                  No mods installed in this profile. Browse the RTX Mods & Content tab to install shaders and optimization mods.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {modsList.map((m) => (
                    <div
                      key={m.file_name}
                      style={{
                        padding: "12px 16px",
                        background: "var(--bg-canvas)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-xs)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: m.enabled ? "#ffffff" : "#656d7c" }}>
                          {m.file_name}
                        </div>
                        <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "#656d7c" }}>
                          {(m.size / 1024 / 1024).toFixed(2)} MB • {m.loader_hint || "generic"}
                        </div>
                      </div>

                      <button
                        type="button"
                        className={m.enabled ? "btn-nvidia-primary" : "btn-nvidia-secondary"}
                        style={{ padding: "4px 14px", fontSize: 11 }}
                        onClick={() => handleToggleMod(m.file_name, m.enabled)}
                      >
                        {m.enabled ? "ACTIVE" : "DISABLED"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-nvidia-primary"
                onClick={() => setActiveModDrawerInst(null)}
              >
                DONE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Instances;
