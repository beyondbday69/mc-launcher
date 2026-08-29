import { useEffect, useState } from "react";
import { api, Instance } from "../lib/types";

interface Props {
  instances: Instance[];
  onChange: () => void;
  onSelect: (i: Instance) => void;
}

export function Instances({ instances, onChange, onSelect }: Props) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Instance | null>(null);
  const [filter, setFilter] = useState("");

  const filtered = instances.filter((i) =>
    i.name.toLowerCase().includes(filter.toLowerCase()) ||
    i.version.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div>
      <div
        className="row between"
        style={{ marginBottom: 16 }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>Instances</h2>
        <div className="row" style={{ gap: 8 }}>
          <input
            placeholder="Filter…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ width: 180 }}
          />
          <button className="btn primary" onClick={() => setCreating(true)}>
            + New instance
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <div className="icon">▤</div>
          <p>No instances yet.</p>
          <p className="faint" style={{ fontSize: 12 }}>
            Create one to start playing.
          </p>
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Version</th>
              <th>Loader</th>
              <th>RAM</th>
              <th>Last played</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((i) => (
              <tr key={i.id} onClick={() => onSelect(i)}>
                <td>
                  <div className="row" style={{ gap: 8 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        background: i.color,
                        display: "inline-block",
                      }}
                    />
                    {i.name}
                  </div>
                </td>
                <td>{i.version}</td>
                <td>
                  {i.mod_loader ? (
                    <span className="tag">{i.mod_loader.kind}</span>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>{i.ram_mb ?? "—"} MB</td>
                <td className="muted">
                  {i.last_played
                    ? new Date(i.last_played).toLocaleDateString()
                    : "Never"}
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div className="row" style={{ gap: 4, justifyContent: "flex-end" }}>
                    <button
                      className="btn ghost"
                      onClick={() => setEditing(i)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn ghost"
                      onClick={async () => {
                        const name = prompt(
                          "New name for the duplicate:",
                          `${i.name} copy`,
                        );
                        if (!name) return;
                        try {
                          await api.instancesDuplicate(i.id, name);
                          onChange();
                        } catch (e) {
                          alert(String(e));
                        }
                      }}
                    >
                      Duplicate
                    </button>
                    <button
                      className="btn ghost"
                      style={{ color: "var(--danger)" }}
                      onClick={async () => {
                        if (!confirm(`Delete instance "${i.name}"?`)) return;
                        try {
                          await api.instancesDelete(i.id);
                          onChange();
                        } catch (e) {
                          alert(String(e));
                        }
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {creating && (
        <InstanceModal
          onClose={() => setCreating(false)}
          onSave={async (name, version) => {
            try {
              const inst = await api.instancesCreate(name, version);
              onChange();
              setCreating(false);
              onSelect(inst);
            } catch (e) {
              alert(String(e));
            }
          }}
        />
      )}

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

interface CreateProps {
  onClose: () => void;
  onSave: (name: string, version: string) => Promise<void>;
}

function InstanceModal({ onClose, onSave }: CreateProps) {
  const [name, setName] = useState("");
  const [version, setVersion] = useState("");
  const [versions, setVersions] = useState<{ id: string; type: string }[]>([]);
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
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>New instance</h2>
        <div className="field">
          <label>Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My survival world"
            autoFocus
          />
        </div>
        <div className="field">
          <label>Minecraft version</label>
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
        <div className="actions">
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={!name || !version || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onSave(name, version);
              } finally {
                setBusy(false);
              }
            }}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

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
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Edit instance</h2>
        <div className="form-grid">
          <div className="field">
            <label>Name</label>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Minecraft version</label>
            <input
              value={draft.version}
              onChange={(e) => setDraft({ ...draft, version: e.target.value })}
            />
          </div>
          <div className="field">
            <label>RAM (MB)</label>
            <input
              type="number"
              min={256}
              step={256}
              value={draft.ram_mb ?? 2048}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  ram_mb: parseInt(e.target.value || "0", 10) || null,
                })
              }
            />
          </div>
          <div className="field">
            <label>JVM profile</label>
            <select
              value={draft.jvm_profile}
              onChange={(e) =>
                setDraft({ ...draft, jvm_profile: e.target.value })
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
            <label>Window width</label>
            <input
              type="number"
              value={draft.resolution_width ?? ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  resolution_width: e.target.value
                    ? parseInt(e.target.value, 10)
                    : null,
                })
              }
            />
          </div>
          <div className="field">
            <label>Window height</label>
            <input
              type="number"
              value={draft.resolution_height ?? ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  resolution_height: e.target.value
                    ? parseInt(e.target.value, 10)
                    : null,
                })
              }
            />
          </div>
        </div>
        <div className="field" style={{ marginTop: 8 }}>
          <label>
            <input
              type="checkbox"
              checked={draft.fullscreen}
              onChange={(e) =>
                setDraft({ ...draft, fullscreen: e.target.checked })
              }
            />{" "}
            Launch in fullscreen
          </label>
        </div>
        {draft.jvm_profile === "custom" && (
          <div className="field">
            <label>Custom JVM arguments (one per line)</label>
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
            />
          </div>
        )}
        <div className="actions">
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            onClick={() => onSave(draft)}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
