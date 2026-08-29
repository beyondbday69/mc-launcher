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

export const api = {
  ping: () => invoke<string>("ping"),
  configGet: () => invoke<Config>("config_get"),
  configUpdate: (c: Config) => invoke<void>("config_update", { new: c }),

  versionsList: (showSnapshots: boolean, showHistorical: boolean) =>
    invoke<VersionEntry[]>("versions_list", {
      showSnapshots,
      showHistorical,
    }),
  versionsLatest: () => invoke<LatestPair>("versions_latest"),

  javaDetect: () => invoke<JavaInstallation[]>("java_detect"),
  javaList: () => invoke<JavaInstallation[]>("java_list"),
  javaAdd: (path: string) =>
    invoke<JavaInstallation>("java_add", { path }),
  javaRecommend: (minecraftMajor: number) =>
    invoke<JavaInstallation>("java_recommend", { minecraftMajor }),

  instancesList: () => invoke<Instance[]>("instances_list"),
  instancesGet: (id: string) => invoke<Instance>("instances_get", { id }),
  instancesCreate: (name: string, version: string) =>
    invoke<Instance>("instances_create", { name, version }),
  instancesUpdate: (instance: Instance) =>
    invoke<void>("instances_update", { instance }),
  instancesDelete: (id: string) =>
    invoke<void>("instances_delete", { id }),
  instancesDuplicate: (id: string, newName: string) =>
    invoke<Instance>("instances_duplicate", { id, newName }),
  instancesSelect: (id: string) =>
    invoke<void>("instances_select", { id }),
  instancesListMods: (instanceId: string) =>
    invoke<ModInfo[]>("instances_list_mods", { instanceId }),
  instancesSetModEnabled: (
    instanceId: string,
    fileName: string,
    enabled: boolean,
  ) =>
    invoke<void>("instances_set_mod_enabled", {
      instanceId,
      fileName,
      enabled,
    }),

  downloadsProgress: () => invoke<ProgressSnapshot>("downloads_progress"),
  downloadsCancel: () => invoke<void>("downloads_cancel"),

  prepareLaunch: (instanceId: string) =>
    invoke<void>("prepare_launch", { instanceId }),
  launchInstance: (instanceId: string) =>
    invoke<void>("launch_instance", { instanceId }),
  launchKill: (instanceId: string) =>
    invoke<void>("launch_kill", { instanceId }),
  launchList: () => invoke<[string, number][]>("launch_list"),
  launchNextLog: (instanceId: string) =>
    invoke<LogLine | null>("launch_next_log", { instanceId }),

  authBegin: () => invoke<Account>("auth_begin"),
  authAccounts: () => invoke<Account[]>("auth_accounts"),
  authRemove: (id: string) => invoke<void>("auth_remove", { id }),

  loaderVersions: (kind: string, minecraftVersion: string) =>
    invoke<string[]>("loader_versions", { kind, minecraftVersion }),
  loaderInstall: (instanceId: string) =>
    invoke<void>("loader_install", { instanceId }),

  updateCheck: () => invoke<UpdateInfo>("update_check"),
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
