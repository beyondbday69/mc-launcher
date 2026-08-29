import { useEffect, useState } from "react";
import {
  api,
  formatBytes,
  Instance,
  ProjectFile,
  ProjectHit,
  ProjectVersion,
} from "../lib/types";

type ContentTab = "mod" | "modpack" | "resourcepack" | "shader";

interface TabDef {
  id: ContentTab;
  label: string;
}

const TABS: TabDef[] = [
  { id: "mod", label: "Mods" },
  { id: "resourcepack", label: "Resource Packs" },
  { id: "shader", label: "Shaders" },
  { id: "modpack", label: "Modpacks" },
];

const LOADER_OPTIONS = ["any", "fabric", "forge", "neoforge", "quilt"];

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

  // Sync filters with the currently selected instance.
  useEffect(() => {
    if (!selected) return;
    setGameVersion(selected.version);
    setLoader(selected.mod_loader?.kind ?? "any");
  }, [selected?.id, selected?.version, selected?.mod_loader?.kind]);

  // Reset results when the user switches tab.
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
        20,
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
          "No matching version found for the selected game version/loader.",
        );
      }
      const version = pickLatest(versions);
      const file = pickPrimaryFile(version);
      if (!file) {
        throw new Error("Version has no downloadable files.");
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
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
          Content
        </h2>
        <div className="empty">
          <div className="icon">✦</div>
          <p>No instance selected.</p>
          <p className="faint" style={{ fontSize: 12 }}>
            Create or select an instance first, then come back here to browse
            and install mods, resource packs, and shaders from Modrinth.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="row between" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>Content</h2>
        <span className="muted" style={{ fontSize: 12 }}>
          Installing into: <strong>{selected.name}</strong> ·{" "}
          {selected.version}
          {selected.mod_loader ? ` · ${selected.mod_loader.kind}` : ""}
        </span>
      </div>

      <div
        className="row"
        style={{
          gap: 4,
          marginBottom: 16,
          borderBottom: "1px solid var(--border)",
        }}
      >
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                background: "transparent",
                border: "none",
                color: active ? "var(--accent)" : "var(--text-dim)",
                padding: "8px 14px",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                borderBottom: active
                  ? "2px solid var(--accent)"
                  : "2px solid transparent",
                marginBottom: -1,
                borderRadius: 0,
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <input
            placeholder="Search Modrinth…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSearch();
            }}
            style={{ flex: 1, minWidth: 200 }}
          />
          <input
            placeholder="Game version"
            value={gameVersion}
            onChange={(e) => setGameVersion(e.target.value)}
            style={{ width: 130 }}
            title="Minecraft version"
          />
          {tab === "mod" && (
            <select
              value={loader}
              onChange={(e) => setLoader(e.target.value)}
              style={{ width: 140 }}
              title="Mod loader"
            >
              {LOADER_OPTIONS.map((l) => (
                <option key={l} value={l}>
                  {l === "any" ? "Any loader" : l}
                </option>
              ))}
            </select>
          )}
          <button
            className="btn primary"
            onClick={onSearch}
            disabled={searching || !query.trim()}
          >
            {searching ? "Searching…" : "Search"}
          </button>
        </div>
        <p className="faint" style={{ fontSize: 11, marginTop: 8 }}>
          Files are downloaded from Modrinth, verified by SHA-1, and placed in
          the instance's {tabDir(tab)} folder.
        </p>
      </div>

      {error && (
        <div
          className="card"
          style={{ marginBottom: 16, color: "var(--danger)" }}
        >
          {error}
        </div>
      )}

      {searching ? (
        <div className="empty">
          <div className="icon">⟳</div>
          <p>Searching Modrinth…</p>
        </div>
      ) : hits.length === 0 ? (
        <div className="empty">
          <div className="icon">—</div>
          <p>
            {hasSearched
              ? "No results. Try a different query or relax filters."
              : "Run a search to see results from Modrinth."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {hits.map((h) => (
            <ResultRow
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

function ResultRow({
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
    description.length > 200
      ? description.slice(0, 200).trimEnd() + "…"
      : description;

  return (
    <div
      className="card"
      style={{
        display: "flex",
        flexDirection: "row",
        gap: 12,
        alignItems: "center",
        padding: 12,
      }}
    >
      {hit.icon_url ? (
        <img
          src={hit.icon_url}
          alt=""
          width={48}
          height={48}
          style={{
            width: 48,
            height: 48,
            borderRadius: 6,
            background: "var(--bg-2)",
            objectFit: "cover",
            flexShrink: 0,
          }}
        />
      ) : (
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 6,
            background: "var(--bg-2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-faint)",
            fontSize: 18,
            flexShrink: 0,
          }}
        >
          ✦
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className="row"
          style={{ gap: 8, marginBottom: 4, flexWrap: "wrap" }}
        >
          <strong style={{ fontWeight: 600 }}>{hit.title}</strong>
          <span className="muted" style={{ fontSize: 12 }}>
            by {hit.author}
          </span>
        </div>
        <p
          className="muted"
          style={{
            fontSize: 12,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={description}
        >
          {truncated}
        </p>
        <p className="faint" style={{ fontSize: 11, marginTop: 4 }}>
          {hit.downloads.toLocaleString()} downloads
        </p>
      </div>
      <div
        style={{
          minWidth: 150,
          textAlign: "right",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 4,
        }}
      >
        {installing ? (
          <span className="tag warning">Installing…</span>
        ) : installed && status?.kind === "installed" ? (
          <>
            <span className="tag success" title={status.path}>
              Installed
            </span>
            <span className="faint" style={{ fontSize: 10 }}>
              {formatBytes(status.size)}
            </span>
          </>
        ) : errored && status?.kind === "error" ? (
          <>
            <span className="tag danger" title={status.message}>
              Error
            </span>
            <button
              className="btn"
              onClick={onInstall}
              style={{ fontSize: 11, padding: "2px 8px" }}
            >
              Retry
            </button>
            <span
              className="faint"
              style={{ fontSize: 10, maxWidth: 150, textAlign: "right" }}
              title={status.message}
            >
              {truncate(status.message, 60)}
            </span>
          </>
        ) : (
          <button
            className="btn primary"
            onClick={onInstall}
            style={{ minWidth: 90 }}
          >
            Install
          </button>
        )}
      </div>
    </div>
  );
}

function pickLatest(versions: ProjectVersion[]): ProjectVersion {
  // Prefer the most recently published matching version.
  let best = versions[0]!;
  for (const v of versions) {
    if (v.date_published > best.date_published) best = v;
  }
  return best;
}

function pickPrimaryFile(version: ProjectVersion): ProjectFile | undefined {
  return version.files.find((f) => f.primary) ?? version.files[0];
}

function tabDir(tab: ContentTab): string {
  switch (tab) {
    case "mod":
      return "mods";
    case "modpack":
      return "modpacks";
    case "resourcepack":
      return "resourcepacks";
    case "shader":
      return "shaderpacks";
  }
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
