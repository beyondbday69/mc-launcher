import { useState, useEffect } from "react";
import { api, Instance, ProjectHit } from "../lib/types";

interface ContentProps {
  selected: Instance | null;
}

export function Content({ selected }: ContentProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("mod");
  const [projects, setProjects] = useState<ProjectHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [installingSlug, setInstallingSlug] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .modrinthSearch(query, category, selected?.version || "1.21.4")
      .then((hits) => {
        if (active) setProjects(hits);
      })
      .catch((err) => console.error("[NVIDIA Content Search]:", err))
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [query, category, selected]);

  const handleInstall = async (hit: ProjectHit) => {
    if (!selected) {
      alert("Please select a game profile first!");
      return;
    }
    setInstallingSlug(hit.slug);
    try {
      const versions = await api.modrinthVersions(
        hit.slug,
        selected.version,
        selected.mod_loader?.kind
      );
      if (!versions || versions.length === 0) {
        alert("No compatible release found for this Minecraft version/loader.");
        return;
      }
      const targetVersion = versions[0];
      const primaryFile =
        targetVersion.files.find((f) => f.primary) || targetVersion.files[0];
      if (!primaryFile) {
        alert("No downloadable file artifact found.");
        return;
      }

      await api.instanceInstallContent(
        selected.id,
        category,
        primaryFile.url,
        primaryFile.filename,
        primaryFile.size,
        primaryFile.hashes.sha1
      );
      alert(`Installed '${hit.title}' to ${selected.name}!`);
    } catch (err: any) {
      console.error("[NVIDIA Install Content]:", err);
      alert(`Install failed: ${err?.message || err}`);
    } finally {
      setInstallingSlug(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Category Pills & Search Filter */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {[
            { id: "mod", label: "OPTIMIZATION & MODS" },
            { id: "shader", label: "RTX SHADERS & LIGHTING" },
            { id: "resourcepack", label: "HD TEXTURES & PACKS" },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={category === cat.id ? "btn-nvidia-primary" : "btn-nvidia-secondary"}
              style={{ padding: "8px 16px", fontSize: 12 }}
              onClick={() => setCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <input
          type="text"
          className="input-nvidia"
          placeholder="Search mods, shaders, optimization..."
          style={{ maxWidth: 320 }}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Target Instance Banner */}
      <div
        style={{
          padding: "10px 18px",
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-xs)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 12,
        }}
      >
        <span style={{ color: "#9da5b4" }}>
          Target Profile: <strong style={{ color: "#ffffff" }}>{selected ? selected.name : "None Selected"}</strong>
          {selected && ` (Minecraft ${selected.version} • ${selected.mod_loader?.kind?.toUpperCase() || "VANILLA"})`}
        </span>
        <span className="badge-rtx">MODRINTH REPOSITORY CONNECTED</span>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: "#9da5b4", fontFamily: "var(--font-mono)" }}>
          QUERYING REPOSITORY CATALOG...
        </div>
      ) : projects.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, color: "#656d7c" }}>
          No content matches your search criteria.
        </div>
      ) : (
        <div className="content-grid">
          {projects.map((hit) => (
            <div key={hit.slug} className="mod-card">
              <div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
                  {hit.icon_url ? (
                    <img
                      src={hit.icon_url}
                      alt=""
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: "var(--radius-xs)",
                        background: "var(--bg-canvas)",
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: "var(--radius-xs)",
                        background: "var(--bg-interactive)",
                        border: "1px solid var(--border)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 20,
                        flexShrink: 0,
                      }}
                    >
                      📦
                    </div>
                  )}

                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span className="badge-channel" style={{ fontSize: 10, padding: "1px 5px" }}>
                        {hit.project_type.toUpperCase()}
                      </span>
                    </div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: "#ffffff", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {hit.title}
                    </h3>
                    <div style={{ fontSize: 11.5, color: "#656d7c", fontFamily: "var(--font-mono)" }}>
                      by {hit.author}
                    </div>
                  </div>
                </div>

                <p style={{ fontSize: 12.5, color: "#9da5b4", lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {hit.description}
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTop: "1px solid var(--border-subtle)" }}>
                <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "#656d7c" }}>
                  {(hit.downloads / 1000000).toFixed(1)}M DLs
                </span>

                <button
                  type="button"
                  className="btn-nvidia-primary"
                  style={{ padding: "6px 14px", fontSize: 11.5 }}
                  disabled={installingSlug === hit.slug}
                  onClick={() => handleInstall(hit)}
                >
                  {installingSlug === hit.slug ? "INSTALLING..." : "+ INSTALL"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Content;
