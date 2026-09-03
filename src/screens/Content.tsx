import { useEffect, useMemo, useState } from "react";
import {
  api,
  formatBytes,
  GameVersionTag,
  Instance,
  LoaderTag,
  ProjectFile,
  ProjectHit,
  ProjectVersion,
} from "../lib/types";
import {
  IconSearch,
  IconCheck,
  IconDownloads,
  IconRefresh,
  IconCube,
  IconContent,
} from "../lib/icons";

type ContentTab = "mod" | "modpack" | "resourcepack" | "shader";

interface TabDef {
  id: ContentTab;
  label: string;
  icon: string;
}

const TABS: TabDef[] = [
  { id: "mod", label: "Mods", icon: "✦" },
  { id: "resourcepack", label: "Resource Packs", icon: "▤" },
  { id: "shader", label: "Shaders", icon: "☀" },
  { id: "modpack", label: "Modpacks", icon: "📦" },
];

const ALLOWED_LOADER_PREFIXES = ["fabric", "forge", "neoforge", "quilt", "legacy-fabric"];

type InstallStatus =
  | { kind: "idle" }
  | { kind: "installing" }
  | { kind: "installed"; path: string; size: number }
  | { kind: "error"; message: string };

interface Props {
  selected: Instance | null;
}

export function Content({ selected }: Props) {
  const [tab, setTab] = useState<ContentTab>("mod");
  const [query, setQuery] = useState("");
  const [gameVersion, setGameVersion] = useState<string>(selected?.version ?? "");
  const [loader, setLoader] = useState<string>(
    selected?.mod_loader?.kind ?? "any",
  );
  const [hits, setHits] = useState<ProjectHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, InstallStatus>>({});
  const [hasSearched, setHasSearched] = useState(false);

  const [allLoaders, setAllLoaders] = useState<LoaderTag[]>([]);
  const [allGameVersions, setAllGameVersions] = useState<GameVersionTag[]>([]);
  const [tagsError, setTagsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [ls, gvs] = await Promise.all([
          api.modrinthLoaders(),
          api.modrinthGameVersions(),
        ]);
        if (cancelled) return;
        setAllLoaders(ls);
        setAllGameVersions(gvs);
      } catch (e) {
        if (!cancelled) setTagsError(errMsg(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loaderOptions = useMemo(() => {
    const projectType = tab;
    return allLoaders.filter(
      (l) =>
        ALLOWED_LOADER_PREFIXES.includes(l.name) &&
        l.supported_project_types.includes(projectType),
    );
  }, [allLoaders, tab]);

  useEffect(() => {
    if (loader !== "any" && !loaderOptions.some((l) => l.name === loader)) {
      setLoader("any");
    }
  }, [loaderOptions, loader]);

  useEffect(() => {
    if (!selected) return;
    setGameVersion(selected.version);
    setLoader(selected.mod_loader?.kind ?? "any");
  }, [selected?.id, selected?.version, selected?.mod_loader?.kind]);

  useEffect(() => {
    setHits([]);
    setError(null);
    setStatus({});
    setHasSearched(false);
  }, [tab]);

  const onSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setError(null);
    setStatus({});
    try {
      const res = await api.modrinthSearch(
        q,
        tab,
        gameVersion.trim() || undefined,
        tab === "mod" && loader !== "any" ? loader : undefined,
        24,
      );
      setHits(res);
      setHasSearched(true);
    } catch (e) {
      setError(errMsg(e));
      setHits([]);
      setHasSearched(true);
    } finally {
      setSearching(false);
    }
  };

  const onInstall = async (hit: ProjectHit) => {
    if (!selected) return;
    const id = hit.slug;
    setStatus((s) => ({ ...s, [id]: { kind: "installing" } }));
    try {
      const versions = await api.modrinthVersions(
        hit.slug,
        gameVersion.trim() || undefined,
        tab === "mod" && loader !== "any" ? loader : undefined,
      );
      if (versions.length === 0) {
        throw new Error(
          "No matching version found for selected Minecraft version and mod loader.",
        );
      }
      const version = pickLatest(versions);
      const file = pickPrimaryFile(version);
      if (!file) {
        throw new Error("Target version has no downloadable files.");
      }
      const sha1Base64 = hexToBase64(file.hashes.sha1);
      const path = await api.instanceInstallContent(
        selected.id,
        tab,
        file.url,
        file.filename,
        file.size,
        sha1Base64,
      );
      setStatus((s) => ({
        ...s,
        [id]: { kind: "installed", path, size: file.size },
      }));
    } catch (e) {
      setStatus((s) => ({ ...s, [id]: { kind: "error", message: errMsg(e) } }));
    }
  };

  if (!selected) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em" }}>
          Content & Mods
        </h2>
        <div className="empty">
          <div className="icon">
            <IconContent size={44} />
          </div>
          <p style={{ fontSize: 16, fontWeight: 600 }}>No instance selected</p>
          <p className="faint" style={{ fontSize: 13, maxWidth: 440 }}>
            Please select or create a Minecraft instance in the sidebar before
            installing mods, resource packs, shaders, or modpacks.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Top Header */}
      <div className="row between" style={{ flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em" }}>
            Content & Mods
          </h2>
          <span className="muted" style={{ fontSize: 12 }}>
            Browse and install community packages directly from Modrinth
          </span>
        </div>

        {/* Target Instance Indicator */}
        <div
          className="chip"
          style={{
            background: "var(--md-sys-color-surface-container-high)",
            padding: "4px 12px",
            gap: 8,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: selected.color || "var(--md-sys-color-primary)",
              boxShadow: `0 0 6px ${selected.color || "var(--md-sys-color-primary)"}`,
            }}
          />
          <span style={{ fontWeight: 600, color: "var(--md-sys-color-on-surface)" }}>
            {selected.name}
          </span>
          <span style={{ fontSize: 11, color: "var(--md-sys-color-on-surface-variant)" }}>
            ({selected.version}{selected.mod_loader ? ` · ${selected.mod_loader.kind}` : ""})
          </span>
        </div>
      </div>

      {/* Category Filter Chips */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {TABS.map((t) => {
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              className={`chip ${isActive ? "active" : ""}`}
              onClick={() => setTab(t.id)}
              style={{
                cursor: "pointer",
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
              }}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Frosted Glass Search & Filters Bar */}
      <div className="card" style={{ padding: "16px 20px" }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {/* Pill Glass Search Input */}
          <div style={{ position: "relative", flex: 1, minWidth: 240 }}>
            <input
              type="text"
              className="search-bar frosted-glass-input"
              placeholder={`Search ${tab === "mod" ? "mods" : tab === "shader" ? "shaders" : "content"} (e.g. Sodium, Iris, Complementary)…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSearch();
              }}
              style={{
                width: "100%",
                fontSize: 13,
                background: "var(--glass-bg-interactive)",
                backdropFilter: "var(--glass-blur-sm)",
                WebkitBackdropFilter: "var(--glass-blur-sm)",
                borderColor: "var(--glass-border)",
                borderRadius: "var(--glass-radius-full)",
                paddingLeft: 16,
              }}
            />
            {query && (
              <button
                className="btn ghost"
                onClick={() => setQuery("")}
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

          {/* Version Filter */}
          <select
            value={gameVersion}
            onChange={(e) => setGameVersion(e.target.value)}
            style={{ width: 150, fontSize: 13 }}
            title="Minecraft Version filter"
            disabled={allGameVersions.length === 0}
          >
            <option value="">Any Version</option>
            {allGameVersions.map((v) => (
              <option key={v.version} value={v.version}>
                {v.version} {v.version_type === "snapshot" ? "(snap)" : ""}
              </option>
            ))}
          </select>

          {/* Loader Filter */}
          {tab === "mod" && (
            <select
              value={loader}
              onChange={(e) => setLoader(e.target.value)}
              style={{ width: 140, fontSize: 13 }}
              title="Mod Loader filter"
            >
              <option value="any">Any Loader</option>
              {loaderOptions.map((l) => (
                <option key={l.name} value={l.name}>
                  {l.name}
                </option>
              ))}
            </select>
          )}

          {/* Search Button */}
          <button
            className="btn primary"
            onClick={onSearch}
            disabled={searching || !query.trim()}
            style={{ padding: "8px 20px", gap: 6 }}
          >
            {searching ? (
              <IconRefresh size={15} style={{ animation: "indeterminate 1.5s infinite linear" }} />
            ) : (
              <IconSearch size={15} />
            )}
            <span>{searching ? "Searching…" : "Search"}</span>
          </button>
        </div>

        {tagsError && (
          <p style={{ color: "var(--md-sys-color-error)", fontSize: 12, marginTop: 8, marginBottom: 0 }}>
            Could not retrieve filter tags: {tagsError}
          </p>
        )}
      </div>

      {error && (
        <div
          className="card"
          style={{
            background: "var(--md-sys-color-error-container)",
            color: "var(--md-sys-color-error)",
            fontSize: 13,
            padding: "12px 16px",
          }}
        >
          {error}
        </div>
      )}

      {/* Results View */}
      {searching ? (
        <div className="empty">
          <div className="icon">
            <IconRefresh size={44} style={{ animation: "indeterminate 1.5s infinite linear" }} />
          </div>
          <p style={{ fontSize: 16, fontWeight: 600 }}>Searching Modrinth database…</p>
          <span className="muted" style={{ fontSize: 12 }}>
            Filtering compatible {tab} packages
          </span>
        </div>
      ) : hits.length === 0 ? (
        <div className="empty">
          <div className="icon">
            <IconSearch size={44} />
          </div>
          <p style={{ fontSize: 16, fontWeight: 600 }}>
            {hasSearched ? "No matching packages found" : "Ready to discover content"}
          </p>
          <p className="faint" style={{ fontSize: 13, maxWidth: 440 }}>
            {hasSearched
              ? "Try searching for a broader term or loosening your version and loader filters."
              : `Type a name or keyword above to search through thousands of ${tab} packages on Modrinth.`}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {hits.map((h) => (
            <ModCard
              key={h.slug}
              hit={h}
              status={status[h.slug]}
              onInstall={() => onInstall(h)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   Expressive Mod Card Component
   ========================================================================== */

function ModCard({
  hit,
  status,
  onInstall,
}: {
  hit: ProjectHit;
  status: InstallStatus | undefined;
  onInstall: () => void;
}) {
  const installing = status?.kind === "installing";
  const installed = status?.kind === "installed";
  const errored = status?.kind === "error";
  const description = stripHtml(hit.description);
  const truncated =
    description.length > 180
      ? description.slice(0, 180).trimEnd() + "…"
      : description;

  return (
    <div
      className="mod-card"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "16px 20px",
        position: "relative",
      }}
    >
      <div className="liquid-refraction-line" aria-hidden="true" style={{ opacity: 0.35 }} />
      {/* Icon */}
      {hit.icon_url ? (
        <img
          src={hit.icon_url}
          alt={hit.title}
          width={52}
          height={52}
          style={{
            width: 52,
            height: 52,
            borderRadius: "var(--glass-radius-md)",
            background: "var(--glass-bg-interactive)",
            objectFit: "cover",
            flexShrink: 0,
            border: "var(--glass-border-subtle)",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.35)",
          }}
        />
      ) : (
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: "var(--glass-radius-md)",
            background: "var(--glass-bg-interactive)",
            border: "var(--glass-border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--liquid-sky)",
            fontSize: 22,
            flexShrink: 0,
          }}
        >
          ✦
        </div>
      )}

      {/* Info Section */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
          <strong
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "var(--md-sys-color-on-surface)",
            }}
          >
            {hit.title}
          </strong>
          <span className="muted" style={{ fontSize: 12 }}>
            by {hit.author}
          </span>
          <span className="tag" style={{ fontSize: 10.5, padding: "1px 6px" }}>
            {hit.project_type}
          </span>
        </div>

        <p
          className="muted"
          style={{
            fontSize: 12.5,
            lineHeight: 1.4,
            marginBottom: 8,
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {truncated || "No description provided."}
        </p>

        {/* Stats Row with Glass Download Badges */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11.5 }}>
          <span className="glass-badge">
            <IconDownloads size={13} style={{ color: "var(--liquid-sky)" }} />
            {hit.downloads.toLocaleString()} downloads
          </span>

          {hit.versions.length > 0 && (
            <span className="glass-badge">
              <IconCube size={13} style={{ color: "var(--liquid-mint)" }} />
              {hit.versions.slice(0, 3).join(", ")}
              {hit.versions.length > 3 ? "…" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Action / Install Button */}
      <div
        style={{
          minWidth: 140,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 6,
          flexShrink: 0,
        }}
      >
        {installing ? (
          <span
            className="chip warning"
            style={{
              fontSize: 12,
              padding: "6px 14px",
              gap: 6,
            }}
          >
            <IconRefresh size={13} style={{ animation: "indeterminate 1.5s infinite linear" }} />
            <span>Installing…</span>
          </span>
        ) : installed && status?.kind === "installed" ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
            <span
              className="chip success"
              style={{
                fontSize: 12,
                padding: "6px 14px",
                gap: 6,
              }}
              title={status.path}
            >
              <IconCheck size={14} />
              <span>Installed</span>
            </span>
            <span className="faint" style={{ fontSize: 10, fontFamily: "var(--mono)" }}>
              {formatBytes(status.size)}
            </span>
          </div>
        ) : errored && status?.kind === "error" ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <span className="chip danger" style={{ fontSize: 11, padding: "4px 8px" }}>
              Install Failed
            </span>
            <button
              className="btn tonal"
              onClick={onInstall}
              style={{ fontSize: 11, padding: "3px 10px" }}
            >
              Retry
            </button>
            <span
              className="faint"
              style={{
                fontSize: 10,
                maxWidth: 160,
                textAlign: "right",
                color: "var(--md-sys-color-error)",
              }}
              title={status.message}
            >
              {truncate(status.message, 50)}
            </span>
          </div>
        ) : (
          <button
            className="btn primary"
            onClick={onInstall}
            style={{ minWidth: 100, padding: "6px 18px", fontSize: 12.5 }}
          >
            Install
          </button>
        )}
      </div>
    </div>
  );
}

function pickLatest(versions: ProjectVersion[]): ProjectVersion {
  let best = versions[0]!;
  for (const v of versions) {
    if (v.date_published > best.date_published) best = v;
  }
  return best;
}

function pickPrimaryFile(version: ProjectVersion): ProjectFile | undefined {
  return version.files.find((f) => f.primary) ?? version.files[0];
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + "…";
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function hexToBase64(hex: string): string {
  const clean = hex.toLowerCase();
  if (clean.length % 2 !== 0) {
    throw new Error("Invalid SHA-1 length");
  }
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16);
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function errMsg(e: unknown): string {
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}
