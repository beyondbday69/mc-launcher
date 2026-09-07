import { useState, useEffect } from "react";
import { api, Instance, ProjectHit, ProjectDetail, ProjectDependency } from "../lib/types";
import { IconSearch, IconPlus, IconCube, IconCheck, IconChevronLeft } from "../lib/icons";
import { useTaskManager } from "../lib/taskManager";

interface ContentProps {
  selected: Instance | null;
}

function ProjectDetailView({ 
  hit, 
  onBack, 
  onInstall,
  installing
}: { 
  hit: ProjectHit, 
  onBack: () => void, 
  onInstall: () => void,
  installing: boolean
}) {
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [deps, setDeps] = useState<ProjectDependency[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [d, ds] = await Promise.all([
          api.modrinthProject(hit.slug),
          api.modrinthProjectDependencies(hit.slug)
        ]);
        if (active) {
          setDetail(d);
          setDeps(ds);
          setLoading(false);
        }
      } catch (e) {
        console.error(e);
      }
    })();
    return () => { active = false; };
  }, [hit.slug]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, animation: "fadeIn 0.2s ease" }}>
      <button 
        type="button" 
        onClick={onBack}
        style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", color: "var(--nv-primary)", cursor: "pointer", padding: 0, fontWeight: 700 }}
      >
        <IconChevronLeft size={16} /> BACK TO SEARCH
      </button>

      <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
        {hit.icon_url && (
          <img src={hit.icon_url} alt="" style={{ width: 96, height: 96, borderRadius: "var(--rounded-md)", flexShrink: 0 }} />
        )}
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 32, margin: 0, color: "#fff" }}>{hit.title}</h2>
          <p style={{ color: "var(--nv-mute)", margin: "4px 0 16px 0", fontSize: 16 }}>by {hit.author}</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button 
              className="button-primary" 
              onClick={onInstall} 
              disabled={installing}
            >
              <IconPlus size={16} /> {installing ? "INSTALLING..." : "INSTALL"}
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ color: "var(--nv-mute)", padding: 40, textAlign: "center" }}>LOADING ASSETS & METADATA...</div>
      ) : detail && (
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {/* Gallery Carousel */}
          {detail.gallery && detail.gallery.length > 0 && (
            <div>
              <h3 style={{ color: "var(--nv-mute)", fontSize: 12, letterSpacing: "0.06em", marginBottom: 12 }}>MEDIA GALLERY</h3>
              <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 12 }}>
                {detail.gallery.map((img, i) => (
                  <img 
                    key={i} 
                    src={img.url} 
                    alt={img.title || "Gallery image"} 
                    style={{ height: 200, borderRadius: "var(--rounded-sm)", objectFit: "cover", flexShrink: 0, border: "1px solid var(--nv-surface-card)" }} 
                  />
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 32 }}>
            <div style={{ flex: 2 }}>
              <h3 style={{ color: "var(--nv-mute)", fontSize: 12, letterSpacing: "0.06em", marginBottom: 12 }}>DESCRIPTION</h3>
              <div 
                style={{ 
                  color: "#e2e2e2", 
                  lineHeight: 1.6, 
                  background: "var(--nv-surface-card)",
                  padding: 24,
                  borderRadius: "var(--rounded-md)",
                  border: "1px solid var(--nv-hairline)",
                  whiteSpace: "pre-wrap",
                  fontFamily: "var(--font-sans)"
                }}
              >
                {detail.body.substring(0, 1000)}{detail.body.length > 1000 ? "..." : ""}
              </div>
            </div>

            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 24 }}>
              {/* Dependencies */}
              {deps.length > 0 && (
                <div>
                  <h3 style={{ color: "var(--nv-mute)", fontSize: 12, letterSpacing: "0.06em", marginBottom: 12 }}>DEPENDENCIES</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {deps.map((dep, i) => (
                      <div key={i} style={{ padding: 12, background: "var(--nv-surface-card)", borderRadius: "var(--rounded-sm)", border: "1px solid var(--nv-hairline)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>{dep.project_id}</span>
                          <span className="badge-tag" style={{ fontSize: 10 }}>{dep.dependency_type.toUpperCase()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div>
                <h3 style={{ color: "var(--nv-mute)", fontSize: 12, letterSpacing: "0.06em", marginBottom: 12 }}>INFO</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13, color: "var(--nv-mute)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>Downloads:</span> <span style={{color: "#fff"}}>{detail.downloads.toLocaleString()}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>Followers:</span> <span style={{color: "#fff"}}>{hit.follows.toLocaleString()}</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Content({ selected }: ContentProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("mod");
  const [projects, setProjects] = useState<ProjectHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewing, setViewing] = useState<ProjectHit | null>(null);
  const { installTasks, installContent } = useTaskManager();

  useEffect(() => {
    let active = true;
    const fetchModrinth = async () => {
      setLoading(true);
      try {
        const hits = await api.modrinthSearch(
          query,
          category,
          selected?.version,
          selected?.mod_loader?.kind
        );
        if (active) setProjects(hits);
      } catch (err) {
        console.error("Failed to search modrinth", err);
      } finally {
        if (active) setLoading(false);
      }
    };

    const timer = setTimeout(fetchModrinth, 400);
    return () => {
      clearTimeout(timer);
      active = false;
    };
  }, [query, category, selected]);

  const handleInstall = (hit: ProjectHit) => {
    if (!selected) {
      alert("Please select a game profile first!");
      return;
    }
    installContent(selected.id, hit, category);
  };

  if (viewing) {
    return (
      <ProjectDetailView 
        hit={viewing} 
        onBack={() => setViewing(null)} 
        onInstall={() => handleInstall(viewing)}
        installing={!!installTasks[`content-${viewing.slug}`]}
      />
    );
  }

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
              onClick={() => {
                setCategory(cat.id);
                setViewing(null);
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div style={{ position: "relative", width: 280 }}>
          <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--nv-mute)", display: "flex" }}>
            <IconSearch size={14} />
          </div>
          <input
            type="text"
            className="input-text"
            placeholder="Search Modrinth library..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: "100%", paddingLeft: 36, background: "rgba(0,0,0,0.2)" }}
          />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {loading ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: "var(--nv-mute)" }}>
            SCANNING REPOSITORIES...
          </div>
        ) : projects.length === 0 ? (
          <div style={{ padding: "40px 0", textAlign: "center", color: "var(--nv-mute)" }}>
            NO ASSETS FOUND FOR CURRENT FILTERS
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
            {projects.map((hit) => {
              const taskId = `content-${hit.slug}`;
              const task = installTasks[taskId];
              const isInstalled = task?.status === "completed";
              const isDownloading = task?.status === "downloading";

              return (
                <div 
                  key={hit.slug} 
                  className="nv-card" 
                  style={{ padding: "20px", cursor: "pointer", transition: "border-color 0.2s" }}
                  onClick={() => setViewing(hit)}
                >
                  <div className="corner-square" style={{ width: 8, height: 8 }} />
                  
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
                          background: "var(--nv-surface-dark)",
                          border: "1px solid var(--nv-hairline)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          color: "var(--nv-mute)",
                        }}
                      >
                        <IconCube size={20} />
                      </div>
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#ffffff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {hit.title}
                      </h4>
                      <div style={{ fontSize: 12, color: "var(--nv-mute)", marginTop: 2 }}>
                        by {hit.author}
                      </div>
                    </div>
                  </div>

                  <p
                    style={{
                      fontSize: 13,
                      lineHeight: 1.5,
                      color: "var(--nv-mute)",
                      margin: "0 0 16px 0",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      height: 38,
                    }}
                  >
                    {hit.description}
                  </p>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <span className="badge-tag">{(hit.downloads / 1000000).toFixed(1)}M DLs</span>
                    </div>

                    {isInstalled ? (
                      <span className="badge-tag badge-tag-primary" style={{ fontSize: 11 }}>
                        ✓ INSTALLED
                      </span>
                    ) : isDownloading ? (
                      <span className="badge-tag" style={{ color: "var(--nv-primary)", borderColor: "var(--nv-primary)" }}>
                        {task.progress}%
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="button-outline-on-dark button-sm"
                        onClick={(e) => { e.stopPropagation(); handleInstall(hit); }}
                      >
                        <IconPlus size={13} />
                        <span>INSTALL</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export { Content };
