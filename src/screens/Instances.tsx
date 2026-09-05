import { useState, useMemo } from "react";
import { api, Instance, ModInfo, formatDuration } from "../lib/types";
import {
  IconPlus,
  IconSearch,
  IconPlay,
  IconFolder,
  IconCopy,
  IconTrash,
  IconCheck,
} from "../lib/icons";

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
  const [customGameDir, setCustomGameDir] = useState("");
  const [creating, setCreating] = useState(false);

  // Mod Drawer State
  const [activeModDrawerInst, setActiveModDrawerInst] = useState<Instance | null>(null);
  const [modsList, setModsList] = useState<ModInfo[]>([]);
  const [loadingMods, setLoadingMods] = useState(false);

  // Folder modal state
  const [folderModalInst, setFolderModalInst] = useState<Instance | null>(null);
  const [copiedPath, setCopiedPath] = useState(false);

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
      if (customGameDir.trim()) {
        await api.instancesUpdate({
          ...created,
          game_dir_override: customGameDir.trim(),
        });
      }
      setShowCreateModal(false);
      setNewName("");
      setCustomGameDir("");
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

  const handleCopyFolder = (path: string) => {
    navigator.clipboard?.writeText(path);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 2000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Top Action Bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, maxWidth: 460, position: "relative" }}>
          <span style={{ position: "absolute", left: 14, color: "var(--nv-mute)", pointerEvents: "none", display: "flex", alignItems: "center" }}>
            <IconSearch size={16} />
          </span>
          <input
            type="text"
            className="text-input"
            placeholder="Search game profiles..."
            style={{ paddingLeft: 38 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <button
          type="button"
          className="button-primary"
          onClick={() => setShowCreateModal(true)}
        >
          <IconPlus size={16} />
          <span>NEW GAME PROFILE</span>
        </button>
      </div>

      {/* Game Profiles Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>
        {filteredInstances.map((inst) => {
          const effectiveDir = inst.game_dir_override || inst.game_dir;
          return (
            <div
              key={inst.id}
              className="nv-card"
              style={{
                background: "var(--nv-surface-card)",
                padding: 0,
                overflow: "hidden",
              }}
            >
              {/* Signature 12px Corner Square */}
              <div className="corner-square" />

              {/* Card Header */}
              <div
                style={{
                  padding: "20px 24px",
                  background: "var(--nv-surface-elevated)",
                  borderBottom: "1px solid var(--nv-hairline)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <span className="badge-tag badge-tag-primary">
                    {inst.mod_loader ? `${inst.mod_loader.kind.toUpperCase()} ${inst.mod_loader.version}` : "VANILLA"}
                  </span>
                  <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--nv-on-dark-mute)" }}>
                    MC {inst.version}
                  </span>
                </div>
                <h3 className="nv-card-title">{inst.name}</h3>
              </div>

              {/* Card Body with Telemetry & Folder Location */}
              <div style={{ padding: "18px 24px", display: "flex", flexDirection: "column", gap: 10, fontSize: 13, color: "var(--nv-on-dark-mute)" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Memory Allocated:</span>
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--nv-primary)", fontWeight: 700 }}>
                    {inst.ram_mb || 2048} MB
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Total Playtime:</span>
                  <span style={{ fontFamily: "var(--font-mono)", color: "#ffffff" }}>
                    {formatDuration(inst.play_time_secs)}
                  </span>
                </div>

                {/* Folder Location Row */}
                <div
                  style={{
                    marginTop: 6,
                    padding: "8px 12px",
                    background: "var(--nv-surface-dark)",
                    border: "1px solid var(--nv-hairline)",
                    borderRadius: "var(--rounded-sm)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    fontSize: 11.5,
                  }}
                >
                  <span style={{ color: "var(--nv-mute)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
                    <IconFolder size={14} style={{ color: "var(--nv-primary)", flexShrink: 0 }} />
                    <span>{effectiveDir}</span>
                  </span>
                  <button
                    type="button"
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--nv-primary)",
                      fontWeight: 700,
                      cursor: "pointer",
                      fontSize: 11,
                      flexShrink: 0,
                    }}
                    onClick={() => setFolderModalInst(inst)}
                  >
                    CONFIG DIR
                  </button>
                </div>
              </div>

              {/* Card Actions Footer */}
              <div
                style={{
                  padding: "14px 24px",
                  background: "var(--nv-surface-dark)",
                  borderTop: "1px solid var(--nv-hairline)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <button
                  type="button"
                  className="button-primary button-sm"
                  onClick={() => onSelect(inst)}
                >
                  <IconPlay size={14} />
                  <span>PLAY</span>
                </button>

                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button
                    type="button"
                    className="button-outline-on-dark button-sm"
                    onClick={() => handleOpenMods(inst)}
                  >
                    MODS
                  </button>
                  <button
                    type="button"
                    className="button-outline-on-dark button-sm"
                    onClick={() => handleDuplicate(inst)}
                    title="Duplicate Profile"
                  >
                    <IconCopy size={13} />
                    <span>CLONE</span>
                  </button>
                  <button
                    type="button"
                    className="button-outline-on-dark button-sm"
                    style={{ color: "var(--nv-error)" }}
                    onClick={() => handleDelete(inst.id)}
                    title="Delete Profile"
                  >
                    <IconTrash size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Instance Modal */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <div className="corner-square" />
            <div className="modal-header">
              <h3>CREATE NEW GAME PROFILE</h3>
              <button
                type="button"
                style={{ background: "none", border: "none", color: "var(--nv-on-dark-mute)", fontSize: 18, cursor: "pointer" }}
                onClick={() => setShowCreateModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "var(--nv-mute)", marginBottom: 6 }}>
                  Profile Name
                </label>
                <input
                  type="text"
                  className="text-input"
                  placeholder="e.g. Fabric 1.21.4 Survival"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "var(--nv-mute)", marginBottom: 6 }}>
                  Minecraft Release Version
                </label>
                <select
                  className="text-input"
                  value={newVersion}
                  onChange={(e) => setNewVersion(e.target.value)}
                  style={{ background: "var(--nv-surface-dark)" }}
                >
                  <option value="1.21.4">Minecraft 1.21.4 (Latest Game Ready)</option>
                  <option value="1.21.1">Minecraft 1.21.1</option>
                  <option value="1.20.4">Minecraft 1.20.4</option>
                  <option value="1.20.1">Minecraft 1.20.1</option>
                  <option value="24w45a">Snapshot 24w45a</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "var(--nv-mute)", marginBottom: 6 }}>
                  Game Folder Location (Optional Override)
                </label>
                <input
                  type="text"
                  className="text-input"
                  placeholder="Default: ~/.local/share/mc-launcher/instances/<id>"
                  value={customGameDir}
                  onChange={(e) => setCustomGameDir(e.target.value)}
                />
                <span style={{ fontSize: 11, color: "var(--nv-mute)", marginTop: 4, display: "block" }}>
                  Leave empty to use the default isolated folder.
                </span>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="button-outline-on-dark"
                onClick={() => setShowCreateModal(false)}
              >
                CANCEL
              </button>
              <button
                type="button"
                className="button-primary"
                disabled={creating || !newName.trim()}
                onClick={handleCreate}
              >
                {creating ? "CREATING..." : "CONFIRM PROFILE"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Folder Location Manager Modal */}
      {folderModalInst && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <div className="corner-square" />
            <div className="modal-header">
              <h3>GAME DIRECTORY LOCATION</h3>
              <button
                type="button"
                style={{ background: "none", border: "none", color: "var(--nv-on-dark-mute)", fontSize: 18, cursor: "pointer" }}
                onClick={() => setFolderModalInst(null)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <p style={{ fontSize: 13, color: "var(--nv-on-dark-mute)" }}>
                This is the isolated storage directory where saves, worlds, screenshots, options, and mods are stored for <strong>{folderModalInst.name}</strong>.
              </p>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "var(--nv-mute)", marginBottom: 6 }}>
                  Active Directory Path
                </label>
                <input
                  type="text"
                  className="text-input"
                  readOnly
                  value={folderModalInst.game_dir_override || folderModalInst.game_dir}
                />
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  className="button-outline"
                  onClick={() => handleCopyFolder(folderModalInst.game_dir_override || folderModalInst.game_dir)}
                >
                  {copiedPath ? <IconCheck size={14} /> : <IconCopy size={14} />}
                  <span>{copiedPath ? "COPIED TO CLIPBOARD!" : "COPY DIRECTORY PATH"}</span>
                </button>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="button-primary"
                onClick={() => setFolderModalInst(null)}
              >
                DONE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mod Management Modal */}
      {activeModDrawerInst && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: 640 }}>
            <div className="corner-square" />
            <div className="modal-header">
              <div>
                <h3>INSTALLED MODS & EXTENSIONS</h3>
                <span style={{ fontSize: 12, color: "var(--nv-primary)", fontWeight: 700 }}>
                  PROFILE: {activeModDrawerInst.name}
                </span>
              </div>
              <button
                type="button"
                style={{ background: "none", border: "none", color: "var(--nv-on-dark-mute)", fontSize: 18, cursor: "pointer" }}
                onClick={() => setActiveModDrawerInst(null)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ maxHeight: 400, overflowY: "auto" }}>
              {loadingMods ? (
                <div style={{ textAlign: "center", padding: 30, color: "var(--nv-mute)" }}>
                  Scanning mods directory...
                </div>
              ) : modsList.length === 0 ? (
                <div style={{ textAlign: "center", padding: 30, color: "var(--nv-mute)" }}>
                  No mods installed in this profile. Browse the Mods & Packs tab to add optimization or gameplay mods.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {modsList.map((m) => (
                    <div
                      key={m.file_name}
                      style={{
                        padding: "14px 18px",
                        background: "var(--nv-surface-dark)",
                        border: "1px solid var(--nv-hairline)",
                        borderRadius: "var(--rounded-sm)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: m.enabled ? "#ffffff" : "var(--nv-mute)" }}>
                          {m.file_name}
                        </div>
                        <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--nv-mute)" }}>
                          {(m.size / 1024 / 1024).toFixed(2)} MB • {m.loader_hint || "generic"}
                        </div>
                      </div>

                      <button
                        type="button"
                        className={m.enabled ? "button-primary button-sm" : "button-outline-on-dark button-sm"}
                        onClick={() => handleToggleMod(m.file_name, m.enabled)}
                      >
                        {m.enabled ? "ENABLED" : "DISABLED"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="button-primary"
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
