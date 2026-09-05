/**
 * Typed wrappers around the Tauri command surface.
 * Mirrors `src-tauri/src/commands.rs`.
 */
import { invoke } from "@tauri-apps/api/core";

export interface Config {
  version: number;
  selected_instance: string | null;
  theme: string;
  language: string;
  close_on_launch: boolean;
  show_snapshots: boolean;
  show_historical: boolean;
  default_java_path: string | null;
  default_jvm_profile: string;
  default_ram_mb: number;
  default_custom_jvm_args: string[];
  data_dir_override: string | null;
  download_concurrency: number;
  download_speed_limit_kbps: number | null;
  telemetry: boolean;
  last_manifest_refresh: number | null;
  onboarded: boolean;
  auto_download_java: boolean;
}

export const DEFAULT_CONFIG: Config = {
  version: 1,
  selected_instance: null,
  theme: "dark",
  language: "en-US",
  close_on_launch: false,
  show_snapshots: false,
  show_historical: false,
  default_java_path: null,
  default_jvm_profile: "balanced",
  default_ram_mb: 2048,
  default_custom_jvm_args: [],
  data_dir_override: null,
  download_concurrency: 8,
  download_speed_limit_kbps: null,
  telemetry: false,
  last_manifest_refresh: null,
  onboarded: false,
  auto_download_java: true,
};

export interface VersionEntry {
  id: string;
  type: "release" | "snapshot" | "old_alpha" | "old_beta" | string;
  url: string;
  time: string;
  releaseTime: string;
  sha1: string;
  complianceLevel?: number;
}

export interface LatestPair {
  release: string;
  snapshot: string;
}

export interface JavaInstallation {
  path: string;
  version: number;
  vendor: string;
  architecture: string;
  is_default: boolean;
}

export interface Instance {
  id: string;
  name: string;
  version: string;
  mod_loader: { kind: string; version: string } | null;
  game_dir: string;
  java_path: string | null;
  ram_mb: number | null;
  jvm_profile: string;
  custom_jvm_args: string[];
  resolution_width: number | null;
  resolution_height: number | null;
  fullscreen: boolean;
  env: Record<string, string>;
  game_dir_override: string | null;
  color: string;
  notes: string;
  created: string;
  last_played: string | null;
  play_time_secs: number;
  schema: number;
}

export interface ModInfo {
  file_name: string;
  enabled: boolean;
  size: number;
  loader_hint: string | null;
}

export interface ProgressSnapshot {
  active: number;
  completed: number;
  failed: number;
  bytes_downloaded: number;
  bytes_total: number;
  speed_bps: number;
}

export interface Account {
  id: string;
  username: string;
  uuid: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  is_msa: boolean;
}

export interface LogLine {
  stream: string;
  text: string;
}

export interface UpdateInfo {
  current_version: string;
  latest_version: string;
  update_available: boolean;
  release_notes: string;
  download_url: string | null;
}

/** Modrinth project search hit. */
export interface ProjectHit {
  slug: string;
  title: string;
  description: string;
  project_type: string;
  downloads: number;
  icon_url: string | null;
  author: string;
  versions: string[];
  follows: number;
}

/** Modrinth project version. */
export interface ProjectVersion {
  id: string;
  project_id: string;
  name: string;
  version_number: string;
  game_versions: string[];
  loaders: string[];
  files: ProjectFile[];
  date_published: string;
  downloads: number;
}

/** Modrinth version file (downloadable artifact). */
export interface ProjectFile {
  url: string;
  filename: string;
  /** SHA-1 is the hex form returned by Modrinth's public API. */
  hashes: {
    sha1: string;
    sha512?: string;
  };
  size: number;
  primary: boolean;
}

/** One loader tag from `GET /v2/tag/loader`. */
export interface LoaderTag {
  icon: string;
  name: string;
  supported_project_types: string[];
}

/** One Minecraft version from `GET /v2/tag/game_version`. */
export interface GameVersionTag {
  version: string;
  version_type: string;
  date: string;
  major: boolean;
}

/** One project category from `GET /v2/tag/category`. */
export interface CategoryTag {
  icon: string;
  name: string;
  project_type: string;
  header: string | null;
}

/** One dependency node from `GET /v2/project/{id}/dependencies`. */
export interface ProjectDependency {
  version_id: string | null;
  project_id: string;
  file_name: string | null;
  dependency_type: "required" | "optional" | "incompatible" | "embedded";
}

/** Response of `GET /v2/version_file/{hash}` (when found). */
export interface VersionFileLookup {
  version: ProjectVersion;
  file: ProjectFile | null;
}

export const isTauri = typeof window !== "undefined" && Boolean((window as any).__TAURI_INTERNALS__);

export const SAMPLE_INSTANCES: Instance[] = [
  {
    id: "fabric-1-21-4",
    name: "Fabric 1.21.4 (Main)",
    version: "1.21.4",
    mod_loader: { kind: "fabric", version: "0.16.9" },
    game_dir: "/home/user/.minecraft/instances/fabric-1-21-4",
    java_path: null,
    ram_mb: 4096,
    jvm_profile: "balanced",
    custom_jvm_args: [],
    resolution_width: 1280,
    resolution_height: 720,
    fullscreen: false,
    env: {},
    game_dir_override: null,
    color: "#0070f3",
    notes: "Main gaming instance",
    created: "2026-09-01T00:00:00Z",
    last_played: "2026-09-03T10:00:00Z",
    play_time_secs: 14400,
    schema: 1,
  },
  {
    id: "vanilla-1-21-4",
    name: "Vanilla Survival",
    version: "1.21.4",
    mod_loader: null,
    game_dir: "/home/user/.minecraft/instances/vanilla-1-21-4",
    java_path: null,
    ram_mb: 2048,
    jvm_profile: "default",
    custom_jvm_args: [],
    resolution_width: 1280,
    resolution_height: 720,
    fullscreen: false,
    env: {},
    game_dir_override: null,
    color: "#10b981",
    notes: "Pure vanilla world",
    created: "2026-09-02T00:00:00Z",
    last_played: null,
    play_time_secs: 3600,
    schema: 1,
  },
  {
    id: "snapshot-testing",
    name: "Snapshot Testing",
    version: "24w45a",
    mod_loader: null,
    game_dir: "/home/user/.minecraft/instances/snapshot-testing",
    java_path: null,
    ram_mb: 2048,
    jvm_profile: "default",
    custom_jvm_args: [],
    resolution_width: 1280,
    resolution_height: 720,
    fullscreen: false,
    env: {},
    game_dir_override: null,
    color: "#f59e0b",
    notes: "Snapshot testbed",
    created: "2026-09-03T00:00:00Z",
    last_played: null,
    play_time_secs: 600,
    schema: 1,
  },
];

const SAMPLE_VERSIONS: VersionEntry[] = [
  { id: "1.21.4", type: "release", url: "", time: "2024-12-03", releaseTime: "2024-12-03", sha1: "" },
  { id: "1.21.3", type: "release", url: "", time: "2024-10-22", releaseTime: "2024-10-22", sha1: "" },
  { id: "1.21.1", type: "release", url: "", time: "2024-08-08", releaseTime: "2024-08-08", sha1: "" },
  { id: "1.21", type: "release", url: "", time: "2024-06-13", releaseTime: "2024-06-13", sha1: "" },
  { id: "1.20.4", type: "release", url: "", time: "2023-12-07", releaseTime: "2023-12-07", sha1: "" },
  { id: "24w45a", type: "snapshot", url: "", time: "2024-11-06", releaseTime: "2024-11-06", sha1: "" },
  { id: "24w44a", type: "snapshot", url: "", time: "2024-10-30", releaseTime: "2024-10-30", sha1: "" },
];

const SAMPLE_MODS: ProjectHit[] = [
  {
    slug: "sodium",
    author: "jellysquid3",
    title: "Sodium",
    description: "A modern rendering engine and optimization mod for Minecraft.",
    follows: 142050,
    project_type: "mod",
    downloads: 38491204,
    icon_url: "https://cdn.modrinth.com/data/AANobbMI/icon.png",
    versions: ["1.21.4", "1.21.1", "1.20.4"],
  },
  {
    slug: "iris",
    author: "coderbot",
    title: "Iris Shaders",
    description: "A modern shaders mod for Minecraft compatible with existing shaders.",
    follows: 98120,
    project_type: "mod",
    downloads: 24190812,
    icon_url: "https://cdn.modrinth.com/data/YL57xq9U/icon.png",
    versions: ["1.21.4", "1.21.1", "1.20.4"],
  },
  {
    slug: "lithium",
    author: "jellysquid3",
    title: "Lithium",
    description: "General-purpose optimization mod for Minecraft physics, mob AI, and world gen.",
    follows: 81200,
    project_type: "mod",
    downloads: 19820411,
    icon_url: "https://cdn.modrinth.com/data/gvQqBUqZ/icon.png",
    versions: ["1.21.4", "1.21.1", "1.20.4"],
  },
  {
    slug: "fabric-api",
    author: "modmuss50",
    title: "Fabric API",
    description: "Lightweight and modular API providing common hooks and interop for Fabric mods.",
    follows: 240100,
    project_type: "mod",
    downloads: 72109482,
    icon_url: "https://cdn.modrinth.com/data/P7dR8mSH/icon.png",
    versions: ["1.21.4", "1.21.1", "1.20.4"],
  },
];

export const api = {
  ping: () => (isTauri ? invoke<string>("ping") : Promise.resolve("pong")),
  initialScreen: () =>
    isTauri
      ? invoke<string>("initial_screen")
      : Promise.resolve(new URLSearchParams(window.location.search).get("screen") || "home"),
  configGet: () =>
    isTauri
      ? invoke<Config>("config_get")
      : Promise.resolve({ ...DEFAULT_CONFIG, selected_instance: "fabric-1-21-4" }),
  configUpdate: (c: Config) => (isTauri ? invoke<void>("config_update", { new: c }) : Promise.resolve()),

  versionsList: (showSnapshots: boolean, showHistorical: boolean) =>
    isTauri
      ? invoke<VersionEntry[]>("versions_list", { showSnapshots, showHistorical })
      : Promise.resolve(SAMPLE_VERSIONS.filter((v) => (v.type === "snapshot" ? showSnapshots : true))),
  versionsLatest: () =>
    isTauri ? invoke<LatestPair>("versions_latest") : Promise.resolve({ release: "1.21.4", snapshot: "24w45a" }),

  javaDetect: () =>
    isTauri
      ? invoke<JavaInstallation[]>("java_detect")
      : Promise.resolve([
          {
            path: "/usr/lib/jvm/java-21-openjdk/bin/java",
            version: 21,
            vendor: "Eclipse Adoptium",
            architecture: "x86_64",
            is_default: true,
          },
        ]),
  javaList: () =>
    isTauri
      ? invoke<JavaInstallation[]>("java_list")
      : Promise.resolve([
          {
            path: "/usr/lib/jvm/java-21-openjdk/bin/java",
            version: 21,
            vendor: "Eclipse Adoptium",
            architecture: "x86_64",
            is_default: true,
          },
        ]),
  javaAdd: (path: string) =>
    isTauri
      ? invoke<JavaInstallation>("java_add", { path })
      : Promise.resolve({
          path,
          version: 21,
          vendor: "Custom",
          architecture: "x86_64",
          is_default: true,
        }),
  javaRecommend: (minecraftMajor: number) =>
    isTauri
      ? invoke<JavaInstallation>("java_recommend", { minecraftMajor })
      : Promise.resolve({
          path: "/usr/lib/jvm/java-21-openjdk/bin/java",
          version: 21,
          vendor: "Adoptium",
          architecture: "x86_64",
          is_default: true,
        }),
  javaAutoDownload: (version: number) =>
    isTauri
      ? invoke<JavaInstallation>("java_auto_download", { version })
      : new Promise<JavaInstallation>((resolve) => {
          setTimeout(() => {
            resolve({
              path: `/opt/java/jdk-${version}/bin/java`,
              version,
              vendor: "Eclipse Adoptium Temurin",
              architecture: "x64",
              is_default: false,
            });
          }, 1200);
        }),

  instancesList: () => (isTauri ? invoke<Instance[]>("instances_list") : Promise.resolve(SAMPLE_INSTANCES)),
  instancesGet: (id: string) =>
    isTauri
      ? invoke<Instance>("instances_get", { id })
      : Promise.resolve(SAMPLE_INSTANCES.find((i) => i.id === id) || SAMPLE_INSTANCES[0]),
  instancesCreate: (name: string, version: string) =>
    isTauri
      ? invoke<Instance>("instances_create", { name, version })
      : Promise.resolve({
          id: `inst-${Date.now()}`,
          name,
          version,
          mod_loader: null,
          game_dir: `/home/user/.minecraft/instances/${name}`,
          java_path: null,
          ram_mb: 2048,
          jvm_profile: "default",
          custom_jvm_args: [],
          resolution_width: null,
          resolution_height: null,
          fullscreen: false,
          env: {},
          game_dir_override: null,
          color: "#0070f3",
          notes: "",
          created: new Date().toISOString(),
          last_played: null,
          play_time_secs: 0,
          schema: 1,
        }),
  instancesUpdate: (instance: Instance) =>
    isTauri ? invoke<void>("instances_update", { instance }) : Promise.resolve(),
  instancesDelete: (id: string) => (isTauri ? invoke<void>("instances_delete", { id }) : Promise.resolve()),
  instancesDuplicate: (id: string, newName: string) =>
    isTauri
      ? invoke<Instance>("instances_duplicate", { id, newName })
      : Promise.resolve({ ...SAMPLE_INSTANCES[0], id: `inst-${Date.now()}`, name: newName }),
  instancesSelect: (id: string) => (isTauri ? invoke<void>("instances_select", { id }) : Promise.resolve()),
  instancesListMods: (_instanceId: string) =>
    isTauri
      ? invoke<ModInfo[]>("instances_list_mods", { instanceId: _instanceId })
      : Promise.resolve([
          {
            file_name: "sodium-mc1.21.4-0.6.0.jar",
            enabled: true,
            size: 1048576,
            loader_hint: "fabric",
          },
        ]),
  instancesSetModEnabled: (
    instanceId: string,
    fileName: string,
    enabled: boolean,
  ) =>
    isTauri
      ? invoke<void>("instances_set_mod_enabled", {
          instanceId,
          fileName,
          enabled,
        })
      : Promise.resolve(),

  downloadsProgress: () =>
    isTauri
      ? invoke<ProgressSnapshot>("downloads_progress")
      : Promise.resolve({
          active: 0,
          completed: 48,
          failed: 0,
          bytes_downloaded: 245000000,
          bytes_total: 245000000,
          speed_bps: 0,
        }),
  downloadsCancel: () => (isTauri ? invoke<void>("downloads_cancel") : Promise.resolve()),

  prepareLaunch: (instanceId: string) =>
    isTauri ? invoke<void>("prepare_launch", { instanceId }) : Promise.resolve(),
  launchInstance: (instanceId: string) =>
    isTauri ? invoke<void>("launch_instance", { instanceId }) : Promise.resolve(),
  launchKill: (instanceId: string) =>
    isTauri ? invoke<void>("launch_kill", { instanceId }) : Promise.resolve(),
  launchList: () => (isTauri ? invoke<[string, number][]>("launch_list") : Promise.resolve([])),
  launchNextLog: (instanceId: string) =>
    isTauri ? invoke<LogLine | null>("launch_next_log", { instanceId }) : Promise.resolve(null),

  authBegin: () =>
    isTauri
      ? invoke<Account>("auth_begin")
      : Promise.resolve({
          id: "acc-1",
          username: "Player",
          uuid: "00000000-0000-0000-0000-000000000000",
          access_token: "mock-token",
          refresh_token: "mock-refresh",
          expires_at: "2099-01-01T00:00:00Z",
          is_msa: true,
        }),
  authAccounts: () =>
    isTauri
      ? invoke<Account[]>("auth_accounts")
      : Promise.resolve([
          {
            id: "acc-1",
            username: "Player",
            uuid: "00000000-0000-0000-0000-000000000000",
            access_token: "mock-token",
            refresh_token: "mock-refresh",
            expires_at: "2099-01-01T00:00:00Z",
            is_msa: true,
          },
        ]),
  authRemove: (id: string) => (isTauri ? invoke<void>("auth_remove", { id }) : Promise.resolve()),

  loaderVersions: (kind: string, minecraftVersion: string) =>
    isTauri
      ? invoke<string[]>("loader_versions", { kind, minecraftVersion })
      : Promise.resolve(["0.16.9", "0.16.8", "0.16.7"]),
  loaderInstall: (instanceId: string) =>
    isTauri ? invoke<void>("loader_install", { instanceId }) : Promise.resolve(),

  updateCheck: () =>
    isTauri
      ? invoke<UpdateInfo>("update_check")
      : Promise.resolve({ has_update: false, latest_version: "0.1.0", release_notes: "", download_url: "" }),

  modrinthSearch: (
    query: string,
    projectType: string,
    gameVersion?: string,
    loader?: string,
    limit = 20,
  ) =>
    isTauri
      ? invoke<ProjectHit[]>("modrinth_search", {
          query,
          projectType,
          gameVersion,
          loader,
          limit,
        })
      : Promise.resolve(SAMPLE_MODS),
  modrinthProject: (slugOrId: string) =>
    isTauri
      ? invoke<ProjectHit>("modrinth_project", { slugOrId })
      : Promise.resolve(SAMPLE_MODS[0]),
  modrinthVersions: (
    slugOrId: string,
    gameVersion?: string,
    loader?: string,
  ) =>
    isTauri
      ? invoke<ProjectVersion[]>("modrinth_versions", {
          slugOrId,
          gameVersion,
          loader,
        })
      : Promise.resolve([]),
  modrinthGetVersion: (versionId: string) =>
    isTauri
      ? invoke<ProjectVersion>("modrinth_get_version", { versionId })
      : Promise.resolve({} as any),
  modrinthGetVersionByHash: (hash: string, algorithm = "sha1") =>
    isTauri
      ? invoke<VersionFileLookup | null>("modrinth_get_version_by_hash", {
          hash,
          algorithm,
        })
      : Promise.resolve(null),
  modrinthProjectDependencies: (slugOrId: string) =>
    isTauri
      ? invoke<ProjectDependency[]>("modrinth_project_dependencies", {
          slugOrId,
        })
      : Promise.resolve([]),
  modrinthLoaders: () =>
    isTauri
      ? invoke<LoaderTag[]>("modrinth_loaders")
      : Promise.resolve([
          { icon: "", name: "fabric", supported_project_types: ["mod"] },
          { icon: "", name: "neoforge", supported_project_types: ["mod"] },
        ]),
  modrinthGameVersions: () =>
    isTauri
      ? invoke<GameVersionTag[]>("modrinth_game_versions")
      : Promise.resolve([
          { version: "1.21.4", version_type: "release", date: "2024-12-03", major: true },
          { version: "1.21.1", version_type: "release", date: "2024-08-08", major: true },
        ]),
  modrinthCategories: () =>
    isTauri
      ? invoke<CategoryTag[]>("modrinth_categories")
      : Promise.resolve([
          { icon: "", name: "optimization", project_type: "mod", header: "Performance" },
        ]),
  instanceInstallContent: (
    instanceId: string,
    projectType: string,
    fileUrl: string,
    fileName: string,
    fileSize: number,
    sha1Base64: string,
  ) =>
    isTauri
      ? invoke<string>("instance_install_content", {
          instanceId,
          projectType,
          fileUrl,
          fileName,
          fileSize,
          sha1Base64,
        })
      : Promise.resolve("ok"),
};

/** Format bytes for display. */
export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/** Format a duration in seconds to mm:ss / h:mm:ss. */
export function formatDuration(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "—";
  s = Math.round(s);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m < 60) return `${m}m ${sec}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

/** Format speed in B/s. */
export function formatSpeed(bps: number): string {
  if (!Number.isFinite(bps) || bps < 1) return "0 B/s";
  return `${formatBytes(bps)}/s`;
}
