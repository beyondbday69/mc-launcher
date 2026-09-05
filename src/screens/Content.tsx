import { useState, useEffect } from "react";
import { api, Instance, ProjectHit } from "../lib/types";
import { IconSearch, IconPlus, IconCube } from "../lib/icons";

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
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Category Tabs & Search Bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {[
            { id: "mod", label: "OPTIMIZATION & MODS" },
            { id: "shader", label: "SHADERS & LIGHTING" },
            { id: "resourcepack", label: "RESOURCE PACKS" },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`pill-tab ${category === cat.id ? "active" : ""}`}
              onClick={() => setCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div style={{ position: "relative", display: "flex", alignItems: "center", maxWidth: 320, width: "100%" }}>
          <span style={{ position: "absolute", left: 12, color: "var(--nv-mute)", pointerEvents: "none", display: "flex", alignItems: "center" }}>
            <IconSearch size={15} />
          </span>
          <input
            type="text"
            className="text-input"
            placeholder="Search mods, shaders, textures..."
            style={{ paddingLeft: 34 }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Target Profile Status */}
      <div
        style={{
          padding: "12px 20px",
          background: "var(--nv-surface-card)",
          border: "1px solid var(--nv-hairline)",
          borderRadius: "var(--rounded-sm)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 13,
        }}
      >
        <span style={{ color: "var(--nv-on-dark-mute)" }}>
          Active Target: <strong style={{ color: "#ffffff" }}>{selected ? selected.name : "None Selected"}</strong>
          {selected && ` (MC ${selected.version} • ${selected.mod_loader?.kind?.toUpperCase() || "VANILLA"})`}
        </span>
        <span className="badge-tag badge-tag-primary">MODRINTH CATALOG CONNECTED</span>
      </div>

      {/* Content Grid */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: "var(--nv-mute)", fontFamily: "var(--font-mono)" }}>
          QUERYING REPOSITORY CATALOG...
        </div>
      ) : projects.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, color: "var(--nv-mute)" }}>
          No content matches your search criteria.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {projects.map((hit) => (
            <div key={hit.slug} className="nv-card" style={{ padding: "20px" }}>
              <div className="corner-square" style={{ width: 8, height: 8 }} />

              <div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
                  {hit.icon_url ? (
                    <img
                      src={hit.icon_url}
                      alt=""
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: "var(--rounded-sm)",
                        background: "var(--nv-surface-dark)",
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: "var(--rounded-sm)",
                        background: "var(--nv-surface-elevated)",
                        border: "1px solid var(--nv-hairline)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--nv-primary)",
                        flexShrink: 0,
                      }}
                    >
                      <IconCube size={22} />
                    </div>
                  )}

                  <div style={{ minWidth: 0 }}>
                    <span className="badge-tag" style={{ fontSize: 10, padding: "2px 6px" }}>
                      {hit.project_type.toUpperCase()}
                    </span>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: "#ffffff", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {hit.title}
                    </h3>
                    <div style={{ fontSize: 12, color: "var(--nv-mute)" }}>
                      by {hit.author}
                    </div>
                  </div>
                </div>

                <p style={{ fontSize: 13, color: "var(--nv-on-dark-mute)", lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {hit.description}
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTop: "1px solid var(--nv-hairline)" }}>
                <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--nv-mute)" }}>
                  {(hit.downloads / 1000000).toFixed(1)}M DLs
                </span>

                <button
                  type="button"
                  className="button-primary button-sm"
                  disabled={installingSlug === hit.slug}
                  onClick={() => handleInstall(hit)}
                >
                  <IconPlus size={13} />
                  <span>{installingSlug === hit.slug ? "INSTALLING..." : "INSTALL"}</span>
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
