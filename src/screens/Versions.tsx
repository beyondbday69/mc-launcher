import { useEffect, useMemo, useState } from "react";
import { api, VersionEntry } from "../lib/types";

interface Props {
  onInstalled: () => void;
}

export function Versions({ onInstalled }: Props) {
  const [all, setAll] = useState<VersionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [type, setType] = useState<"all" | "release" | "snapshot">("release");
  const [latest, setLatest] = useState<{ release: string; snapshot: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [vs, lt] = await Promise.all([
          api.versionsList(true, false),
          api.versionsLatest(),
        ]);
        setAll(vs);
        setLatest(lt);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    return all.filter((v) => {
      if (filter && !v.id.toLowerCase().includes(filter.toLowerCase()))
        return false;
      if (type === "release" && v.type !== "release") return false;
      if (type === "snapshot" && v.type !== "snapshot") return false;
      return true;
    });
  }, [all, filter, type]);

  return (
    <div>
      <div
        className="row between"
        style={{ marginBottom: 16 }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>Minecraft versions</h2>
        <div className="row" style={{ gap: 8 }}>
          <input
            placeholder="Search…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ width: 200 }}
          />
          <select value={type} onChange={(e) => setType(e.target.value as any)}>
            <option value="release">Releases</option>
            <option value="snapshot">Snapshots</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>

      {latest && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>Latest</h3>
          <div className="row" style={{ gap: 12 }}>
            <span className="tag success">{latest.release} (release)</span>
            <span className="tag warning">{latest.snapshot} (snapshot)</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="empty">
          <div className="icon">⟳</div>
          <p>Fetching version manifest from Mojang…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty">
          <div className="icon">—</div>
          <p>No versions match.</p>
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Version</th>
              <th>Type</th>
              <th>Released</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 200).map((v) => (
              <tr key={v.id}>
                <td>{v.id}</td>
                <td>
                  <span
                    className={`tag ${
                      v.type === "release"
                        ? "success"
                        : v.type === "snapshot"
                          ? "warning"
                          : ""
                    }`}
                  >
                    {v.type}
                  </span>
                </td>
                <td className="muted">
                  {new Date(v.releaseTime).toLocaleDateString()}
                </td>
                <td style={{ textAlign: "right" }}>
                  <button
                    className="btn"
                    onClick={async () => {
                      const name = prompt(
                        "Create instance using " + v.id,
                        "Instance " + v.id,
                      );
                      if (!name) return;
                      try {
                        await api.instancesCreate(name, v.id);
                        onInstalled();
                        alert(
                          "Instance created. It will download its files the first time you launch.",
                        );
                      } catch (e) {
                        alert(String(e));
                      }
                    }}
                  >
                    Create instance
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {filtered.length > 200 && (
        <p className="faint" style={{ marginTop: 8, fontSize: 12 }}>
          Showing first 200 of {filtered.length} matches. Use search to narrow down.
        </p>
      )}
    </div>
  );
}
