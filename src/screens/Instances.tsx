import { useEffect, useState } from "react";
import {
  Avatar,
  Button,
  ButtonGroup,
  Card,
  Chip,
  Input,
  Label,
  Modal,
  Slider,
} from "@heroui/react";
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
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Top Search & Actions Bar */}
      <div className="row between" style={{ flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em", margin: 0, color: "#ffffff" }}>
            Instances
          </h2>
          <Chip size="sm">
            {filtered.length}
          </Chip>
        </div>

        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          {/* Search Input */}
          <div style={{ position: "relative" }}>
            <Input
              type="text"
              className="search-bar"
              placeholder="Search instances…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{
                width: 200,
                fontSize: 13,
              }}
            />
            {filter && (
              <Button
                variant="ghost"
                size="sm"
                onPress={() => setFilter("")}
                style={{
                  position: "absolute",
                  right: 6,
                  top: "50%",
                  transform: "translateY(-50%)",
                  padding: "2px 6px",
                  fontSize: 12,
                  color: "#a1a1aa",
                }}
              >
                ✕
              </Button>
            )}
          </div>

          {/* View Mode Toggle */}
          <ButtonGroup>
            <Button
              variant={viewMode === "grid" ? "primary" : "secondary"}
              size="sm"
              onPress={() => setViewMode("grid")}
              aria-label="Grid View"
            >
              <IconGrid size={15} />
            </Button>
            <Button
              variant={viewMode === "list" ? "primary" : "secondary"}
              size="sm"
              onPress={() => setViewMode("list")}
              aria-label="List View"
            >
              <IconList size={15} />
            </Button>
          </ButtonGroup>

          {/* Create Button */}
          <Button
            variant="primary"
            size="sm"
            onPress={() => setCreating(true)}
            style={{ padding: "6px 14px", gap: 6 }}
          >
            <IconPlus size={15} />
            <span>New Instance</span>
          </Button>
        </div>
      </div>

      {/* Empty State */}
      {filtered.length === 0 ? (
        <div className="empty">
          <div className="icon">
            <IconCube size={40} />
          </div>
          <p style={{ fontSize: 16, fontWeight: 600, color: "#ffffff" }}>No instances found</p>
          <p className="faint" style={{ fontSize: 13 }}>
            {instances.length === 0
              ? "Create an instance to start your Minecraft journey."
              : "Try adjusting your search query."}
          </p>
          {instances.length === 0 && (
            <Button
              variant="primary"
              size="sm"
              onPress={() => setCreating(true)}
              style={{ marginTop: 12 }}
            >
              <IconPlus size={16} />
              <span>Create First Instance</span>
            </Button>
          )}
        </div>
      ) : viewMode === "grid" ? (
        /* Clean Solid Cards Grid */
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 14,
          }}
        >
          {filtered.map((i) => (
            <Card
              key={i.id}
              className="instance-card"
              style={{
                cursor: "pointer",
                borderLeft: `3px solid ${i.color || "#0070f3"}`,
                padding: "16px 18px",
              }}
              onClick={() => onSelect(i)}
            >
              <Card.Content style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Header with Avatar & Title */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Avatar
                    size="sm"
                    style={{
                      background: i.color || "#18181b",
                      border: "1px solid #27272a",
                      color: "#ffffff",
                      fontWeight: 800,
                      fontSize: 14,
                      flexShrink: 0,
                    }}
                  >
                    <Avatar.Fallback>{i.name.charAt(0).toUpperCase()}</Avatar.Fallback>
                  </Avatar>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: "#ffffff",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={i.name}
                    >
                      {i.name}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                      <Chip color="success" size="sm" style={{ padding: "1px 6px", fontSize: 11 }}>
                        {i.version}
                      </Chip>
                      {i.mod_loader && (
                        <Chip
                          variant="secondary"
                          size="sm"
                          style={{
                            fontSize: 10.5,
                            padding: "1px 6px",
                          }}
                        >
                          {i.mod_loader.kind}
                        </Chip>
                      )}
                    </div>
                  </div>
                </div>

                {/* Instance Details Row */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    fontSize: 11.5,
                    color: "#a1a1aa",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <IconRam size={13} style={{ color: "#0070f3" }} />
                    <span>{i.ram_mb ?? 2048} MB</span>
                  </span>
                  <span>·</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <IconClock size={13} />
                    <span>{i.last_played ? formatDate(i.last_played) : "Never played"}</span>
                  </span>
                </div>

                {/* Quick Actions Footer */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingTop: 8,
                    borderTop: "1px solid #27272a",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="primary"
                    size="sm"
                    onPress={() => onSelect(i)}
                    style={{ padding: "3px 12px", fontSize: 12, gap: 5 }}
                  >
                    <IconPlay size={12} />
                    <span>Play</span>
                  </Button>

                  <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onPress={() => handleCopyFolder(i)}
                      aria-label={copiedFolderId === i.id ? "Folder path copied!" : `Game Dir: ${i.game_dir}`}
                      style={{
                        padding: "5px 7px",
                        color: copiedFolderId === i.id ? "#10b981" : "#a1a1aa",
                      }}
                    >
                      {copiedFolderId === i.id ? <IconCheck size={14} /> : <IconFolder size={14} />}
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onPress={() => setEditing(i)}
                      aria-label="Edit instance settings"
                      style={{ padding: "5px 7px", color: "#a1a1aa" }}
                    >
                      <IconEdit size={14} />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onPress={async () => {
                        const name = prompt("New name for duplicate:", `${i.name} copy`);
                        if (!name) return;
                        try {
                          await api.instancesDuplicate(i.id, name);
                          onChange();
                        } catch (e) {
                          alert(String(e));
                        }
                      }}
                      aria-label="Duplicate instance"
                      style={{ padding: "5px 7px", color: "#a1a1aa" }}
                    >
                      <IconCopy size={14} />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onPress={async () => {
                        if (!confirm(`Delete instance "${i.name}"?`)) return;
                        try {
                          await api.instancesDelete(i.id);
                          onChange();
                        } catch (e) {
                          alert(String(e));
                        }
                      }}
                      aria-label="Delete instance"
                      style={{ padding: "5px 7px", color: "#ef4444" }}
                    >
                      <IconTrash size={14} />
                    </Button>
                  </div>
                </div>
              </Card.Content>
            </Card>
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
                <tr key={i.id} onClick={() => onSelect(i)} style={{ cursor: "pointer" }}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: i.color || "#0070f3",
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontWeight: 600, color: "#ffffff" }}>
                        {i.name}
                      </span>
                    </div>
                  </td>
                  <td>
                    <Chip color="success" size="sm">
                      {i.version}
                    </Chip>
                  </td>
                  <td>
                    {i.mod_loader ? (
                      <Chip variant="secondary" size="sm">
                        {i.mod_loader.kind}
                      </Chip>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 12, color: "#a1a1aa" }}>
                    {i.ram_mb ?? 2048} MB
                  </td>
                  <td className="muted" style={{ fontSize: 12 }}>
                    {i.last_played ? formatDate(i.last_played) : "Never"}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                      <Button
                        variant="primary"
                        size="sm"
                        onPress={() => onSelect(i)}
                        style={{ padding: "2px 10px", fontSize: 12 }}
                      >
                        Play
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onPress={() => handleCopyFolder(i)}
                        aria-label="Copy game folder path"
                        style={{ padding: "4px 6px" }}
                      >
                        {copiedFolderId === i.id ? <IconCheck size={14} /> : <IconFolder size={14} />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onPress={() => setEditing(i)}
                        aria-label="Edit instance"
                        style={{ padding: "4px 6px" }}
                      >
                        <IconEdit size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onPress={async () => {
                          const name = prompt("New name for duplicate:", `${i.name} copy`);
                          if (!name) return;
                          try {
                            await api.instancesDuplicate(i.id, name);
                            onChange();
                          } catch (e) {
                            alert(String(e));
                          }
                        }}
                        aria-label="Duplicate"
                        style={{ padding: "4px 6px" }}
                      >
                        <IconCopy size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onPress={async () => {
                          if (!confirm(`Delete instance "${i.name}"?`)) return;
                          try {
                            await api.instancesDelete(i.id);
                            onChange();
                          } catch (e) {
                            alert(String(e));
                          }
                        }}
                        aria-label="Delete"
                        style={{ padding: "4px 6px", color: "#ef4444" }}
                      >
                        <IconTrash size={14} />
                      </Button>
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
          isOpen={creating}
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
          isOpen={Boolean(editing)}
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
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, version: string, color: string, ramMb: number) => Promise<void>;
}

function CreateModal({ isOpen, onClose, onSave }: CreateProps) {
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
    <Modal isOpen={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog style={{ width: 480, maxWidth: "90vw" }}>
            <Modal.Header>
              <Modal.Heading>Create New Instance</Modal.Heading>
            </Modal.Header>

            <Modal.Body>
              <div className="field">
                <label>Instance Name</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Survival 1.21"
                  autoFocus
                />
              </div>

              <div className="field">
                <label>Theme Color</label>
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  {COLOR_PALETTE.map((c) => {
                    const isSelected = color === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          background: c,
                          border: isSelected ? "2px solid #ffffff" : "2px solid transparent",
                          boxShadow: isSelected ? `0 0 10px ${c}` : "none",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#ffffff",
                          transition: "transform 0.15s ease",
                          transform: isSelected ? "scale(1.1)" : "scale(1)",
                        }}
                        title={c}
                      >
                        {isSelected && <IconCheck size={14} />}
                      </button>
                    );
                  })}
                </div>
              </div>

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

              <div className="field">
                <Slider
                  className="w-full"
                  minValue={1024}
                  maxValue={16384}
                  step={512}
                  value={ramMb}
                  onChange={(v) => setRamMb(Array.isArray(v) ? v[0] : v)}
                  style={{ width: "100%", margin: "8px 0" }}
                >
                  <Label>Memory (RAM)</Label>
                  <Slider.Output>
                    {({ state }) => `${state.values[0]} MB (${(state.values[0] / 1024).toFixed(1)} GB)`}
                  </Slider.Output>
                  <Slider.Track>
                    <Slider.Fill />
                    <Slider.Thumb />
                  </Slider.Track>
                </Slider>
                <div style={{ display: "flex", gap: 6 }}>
                  {[2048, 4096, 6144, 8192].map((mb) => (
                    <Chip
                      key={mb}
                      variant={ramMb === mb ? "primary" : "secondary"}
                      onClick={() => setRamMb(mb)}
                      style={{ fontSize: 11, padding: "2px 8px", cursor: "pointer" }}
                    >
                      {mb / 1024} GB
                    </Chip>
                  ))}
                </div>
              </div>
            </Modal.Body>

            <Modal.Footer>
              <Button variant="ghost" size="sm" onPress={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                isDisabled={!name.trim() || !version || busy}
                onPress={async () => {
                  setBusy(true);
                  try {
                    await onSave(name.trim(), version, color, ramMb);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Creating…" : "Create Instance"}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

/* ==========================================================================
   Edit Instance Modal
   ========================================================================== */

interface EditProps {
  isOpen: boolean;
  instance: Instance;
  onClose: () => void;
  onSave: (i: Instance) => Promise<void>;
}

function EditModal({
  isOpen,
  instance,
  onClose,
  onSave,
}: EditProps) {
  const [draft, setDraft] = useState<Instance>({ ...instance });
  const [busy, setBusy] = useState(false);

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog style={{ width: 520, maxWidth: "90vw" }}>
            <Modal.Header>
              <Modal.Heading>Edit Instance: {instance.name}</Modal.Heading>
            </Modal.Header>

            <Modal.Body>
              <div className="form-grid">
                <div className="field">
                  <label>Instance Name</label>
                  <Input
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  />
                </div>

                <div className="field">
                  <label>Minecraft Version</label>
                  <Input
                    value={draft.version}
                    onChange={(e) => setDraft({ ...draft, version: e.target.value })}
                  />
                </div>
              </div>

              <div className="field">
                <label>Theme Color</label>
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  {COLOR_PALETTE.map((c) => {
                    const isSelected = draft.color === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setDraft({ ...draft, color: c })}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          background: c,
                          border: isSelected ? "2px solid #ffffff" : "2px solid transparent",
                          boxShadow: isSelected ? `0 0 10px ${c}` : "none",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#ffffff",
                          transition: "transform 0.15s ease",
                          transform: isSelected ? "scale(1.1)" : "scale(1)",
                        }}
                        title={c}
                      >
                        {isSelected && <IconCheck size={14} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="field">
                <Slider
                  className="w-full"
                  minValue={1024}
                  maxValue={16384}
                  step={512}
                  value={draft.ram_mb ?? 2048}
                  onChange={(v) =>
                    setDraft({ ...draft, ram_mb: Array.isArray(v) ? v[0] : v })
                  }
                  style={{ width: "100%", margin: "8px 0" }}
                >
                  <Label>Allocated RAM</Label>
                  <Slider.Output>
                    {({ state }) => `${state.values[0]} MB (${(state.values[0] / 1024).toFixed(1)} GB)`}
                  </Slider.Output>
                  <Slider.Track>
                    <Slider.Fill />
                    <Slider.Thumb />
                  </Slider.Track>
                </Slider>
              </div>

              <div className="field">
                <label>JVM Optimization Profile</label>
                <select
                  value={draft.jvm_profile}
                  onChange={(e) => setDraft({ ...draft, jvm_profile: e.target.value })}
                >
                  <option value="default">Default JVM Arguments</option>
                  <option value="low_ram">Low RAM Preset (Optimized for ≤ 2GB)</option>
                  <option value="balanced">Balanced (Shenandoah/G1GC Optimized)</option>
                  <option value="performance">High Performance (ZGC / High Heap)</option>
                  <option value="custom">Custom Arguments</option>
                </select>
              </div>

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
                    rows={4}
                    style={{ fontFamily: "var(--mono)", fontSize: 12 }}
                  />
                </div>
              )}
            </Modal.Body>

            <Modal.Footer>
              <Button variant="ghost" size="sm" onPress={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                isDisabled={!draft.name.trim() || !draft.version || busy}
                onPress={async () => {
                  setBusy(true);
                  try {
                    await onSave(draft);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Saving…" : "Save Changes"}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
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
