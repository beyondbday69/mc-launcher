# MC Launcher — Architecture & Connectivity Blueprint (`base.md`)

> **Single Source of Truth** for UI/UX engineers and AI coding assistants.  
> This document details the complete backend architecture, IPC commands, TypeScript data models, state flows, design tokens, and CI/CD pipelines so any new UI can plug seamlessly into the launcher core.

---

## 1. System & Tech Stack Architecture

The launcher is architected as a high-performance, modular desktop application using **Tauri v2** with a native **Rust core engine** and a **React 18 / TypeScript / Vite** frontend.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React 18 + TS)                        │
│   src/screens/ (Home, Instances, Versions, Downloads, Content, Settings)│
│   src/components/ui/ (Reusable UI primitives + HeroUI v3 tokens)       │
│   src/lib/types.ts (`api.*` typed IPC wrapper with browser fallback)  │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                    Tauri v2 IPC (`invoke<T>()`)
                                     │
┌────────────────────────────────────▼───────────────────────────────────┐
│                      BACKEND (Tauri v2 IPC Layer)                      │
│   src-tauri/src/commands.rs (40+ registered Tauri commands)            │
│   src-tauri/src/state.rs (Managed AppState & CommandState)             │
│   src-tauri/src/paths.rs (Platform data/cache/instance paths)          │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
┌────────────────────────────────────▼───────────────────────────────────┐
│                        RUST CORE CRATE (`core/`)                       │
│   core/src/instances/ (Manifests, schema migration, mod loader info)   │
│   core/src/launcher/ (Minecraft launch arguments, classpath, JVM)      │
│   core/src/downloads/ (Multi-threaded chunked downloader, speed limits)│
│   core/src/java/ (JVM discovery, version detection, recommendations)   │
│   core/src/metadata/ (Mojang manifest parser, Fabric/NeoForge/Forge)   │
│   core/src/mods/ (Modrinth v2 API client, mod metadata parsing)        │
│   core/src/auth/ (Microsoft OAuth2 + offline fallback accounts)        │
└────────────────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
/root/mc-launcher/
├── src/                         # React Frontend
│   ├── App.tsx                  # Root layout, navigation sidebar, global state orchestration
│   ├── main.tsx                 # React DOM mount point
│   ├── styles.css               # Solid Black OLED theme tokens & HeroUI styles
│   ├── screens/                 # 6 Core Launcher Screens
│   │   ├── Home.tsx             # Dashboard, Quick Play, KPI metrics
│   │   ├── Instances.tsx        # Instance cards, management, creation modal
│   │   ├── Versions.tsx         # Mojang official release/snapshot catalog
│   │   ├── Downloads.tsx        # Active download progress, transfer speeds
│   │   ├── Content.tsx          # Modrinth mod / resource pack / shader browser
│   │   ├── Settings.tsx         # Java, RAM allocation, JVM flags, launcher config
│   │   └── AccountButton.tsx    # Header account switcher & login modal
│   ├── components/ui/           # Reusable UI primitives
│   └── lib/
│       ├── types.ts             # All TypeScript interfaces + `api.*` IPC layer
│       ├── icons.tsx            # SVG icon primitives (Home, Instance, Settings, etc.)
│       ├── format.ts            # Bytes, duration, speed formatters
│       └── format.test.ts       # Vitest unit test suite (100% pass rate)
├── src-tauri/                   # Tauri v2 Backend
│   ├── Cargo.toml               # Tauri dependencies & plugins
│   ├── tauri.conf.json          # Window configs, bundle IDs, security scopes
│   └── src/
│       ├── lib.rs               # Application entry, plugin setup, command registration
│       ├── commands.rs          # 40+ Tauri command handlers exposing core features
│       ├── state.rs             # Application memory state (Downloader, Cache, Paths)
│       └── paths.rs             # OS directory resolution (~/.minecraft, data, logs)
├── core/                        # Rust Core Engine (Independent Crate)
│   ├── Cargo.toml               # Engine dependencies (tokio, reqwest, serde, sha1, etc.)
│   └── src/                     # Auth, instances, downloads, java, launcher, metadata, mods
├── scripts/
│   └── capture-all-screens.mjs  # Playwright headless browser for screen previews
├── .github/workflows/
│   ├── ci.yml                   # Matrix CI (Rust build, frontend test, clippy)
│   ├── play-smoke.yml           # Headless launch smoke tests
│   ├── sscap.yml                # Playwright screenshot generator (displays in summary)
│   └── deploy-demo.yml          # Automatic deployment to GitHub Pages
└── vite.config.ts               # Vite configuration (`base: "./"`, Tailwind v4 plugin)
```

---

## 2. The Connectivity Layer (`src/lib/types.ts`)

### Dual-Mode Execution Architecture
The frontend uses a unified `api` export in `src/lib/types.ts`. It automatically detects the execution environment:

```ts
const isTauri = typeof window !== "undefined" && Boolean((window as any).__TAURI_INTERNALS__);
```

1. **Inside Desktop App (Tauri)**: Calls native Rust functions via `@tauri-apps/api/core` `invoke()`.
2. **In Browser / GitHub Pages / CI Preview**: Seamlessly returns realistic, structured mock data without throwing exceptions. **Any new UI must call `api.*` methods rather than invoking Tauri directly** so the web preview and CI pipelines remain fully operational.

---

## 3. Complete IPC Command Reference

Below is the complete table of all 42 Tauri IPC commands available to the frontend.

| Rust Command (`commands.rs`) | Frontend Method (`api.*`) | Input Arguments | Return Type | Description |
|---|---|---|---|---|
| `ping` | `api.ping()` | _None_ | `string` (`"pong"`) | Health check & IPC latency probe |
| `initial_screen` | `api.initialScreen()` | _None_ | `string` | Returns initial screen ID or override |
| `config_get` | `api.configGet()` | _None_ | `Config` | Fetches active launcher configuration |
| `config_update` | `api.configUpdate(c)` | `{ new: Config }` | `void` | Persists updated configuration to disk |
| `versions_list` | `api.versionsList(s, h)` | `{ showSnapshots: boolean, showHistorical: boolean }` | `VersionEntry[]` | Mojang version manifest list |
| `versions_latest` | `api.versionsLatest()` | _None_ | `LatestPair` | Latest stable release & snapshot IDs |
| `java_detect` | `api.javaDetect()` | _None_ | `JavaInstallation[]` | Scans OS for installed Java runtimes |
| `java_list` | `api.javaList()` | _None_ | `JavaInstallation[]` | Lists configured / cached Java runtimes |
| `java_add` | `api.javaAdd(path)` | `{ path: string }` | `JavaInstallation` | Validates and registers a custom Java binary |
| `java_recommend` | `api.javaRecommend(v)` | `{ minecraftMajor: number }` | `JavaInstallation` | Recommends appropriate JVM for MC version |
| `instances_list` | `api.instancesList()` | _None_ | `Instance[]` | Lists all created Minecraft instances |
| `instances_get` | `api.instancesGet(id)` | `{ id: string }` | `Instance` | Retrieves single instance manifest |
| `instances_create` | `api.instancesCreate(n, v)` | `{ name: string, version: string }` | `Instance` | Creates a new instance directory & manifest |
| `instances_update` | `api.instancesUpdate(inst)` | `{ instance: Instance }` | `void` | Saves edits to instance configuration |
| `instances_delete` | `api.instancesDelete(id)` | `{ id: string }` | `void` | Deletes instance and all associated files |
| `instances_duplicate` | `api.instancesDuplicate(id, n)` | `{ id: string, newName: string }` | `Instance` | Clones instance, worlds, and config |
| `instances_select` | `api.instancesSelect(id)` | `{ id: string }` | `void` | Sets active default instance in config |
| `instances_list_mods` | `api.instancesListMods(id)` | `{ instanceId: string }` | `ModInfo[]` | Lists all `.jar` files in `mods/` directory |
| `instances_set_mod_enabled`| `api.instancesSetModEnabled(id, f, e)` | `{ instanceId: string, fileName: string, enabled: boolean }` | `void` | Toggles mod active state (`.jar` ↔ `.jar.disabled`) |
| `downloads_progress` | `api.downloadsProgress()` | _None_ | `ProgressSnapshot` | Current speed, bytes, active downloads |
| `downloads_cancel` | `api.downloadsCancel()` | _None_ | `void` | Cancels all active background downloads |
| `prepare_launch` | `api.prepareLaunch(id)` | `{ instanceId: string }` | `void` | Downloads missing assets/libraries for launch |
| `launch_instance` | `api.launchInstance(id)` | `{ instanceId: string }` | `void` | Spawns Minecraft process with JVM arguments |
| `launch_kill` | `api.launchKill(id)` | `{ instanceId: string }` | `void` | Terminates running Minecraft instance process |
| `launch_list` | `api.launchList()` | _None_ | `[string, number][]` | Array of `[instanceId, pid]` running instances |
| `launch_next_log` | `api.launchNextLog(id)` | `{ instanceId: string }` | `LogLine \| null` | Pulls next buffered console log line |
| `auth_begin` | `api.authBegin()` | _None_ | `Account` | Starts Microsoft OAuth2 device code login |
| `auth_accounts` | `api.authAccounts()` | _None_ | `Account[]` | Lists authenticated user accounts |
| `auth_remove` | `api.authRemove(id)` | `{ id: string }` | `void` | Removes account and invalidates tokens |
| `auth_add_offline` | `invoke("auth_add_offline", ...)` | `{ username: string }` | `Account` | Creates offline player profile |
| `loader_versions` | `api.loaderVersions(kind, v)` | `{ kind: string, minecraftVersion: string }` | `string[]` | Available Fabric/NeoForge loader versions |
| `loader_install` | `api.loaderInstall(id)` | `{ instanceId: string }` | `void` | Installs mod loader metadata to instance |
| `modrinth_search` | `api.modrinthSearch(q, t, g, l, lim)` | `{ query, projectType, gameVersion, loader, limit }` | `ProjectHit[]` | Searches Modrinth catalog |
| `modrinth_project` | `api.modrinthProject(slug)` | `{ slugOrId: string }` | `ProjectHit` | Gets full project overview & details |
| `modrinth_versions` | `api.modrinthVersions(slug, g, l)` | `{ slugOrId, gameVersion, loader }` | `ProjectVersion[]` | Available downloadable files for a mod |
| `modrinth_get_version` | `api.modrinthGetVersion(id)` | `{ versionId: string }` | `ProjectVersion` | Fetches specific version details |
| `modrinth_get_version_by_hash` | `api.modrinthGetVersionByHash(h, a)` | `{ hash: string, algorithm: string }` | `VersionFileLookup \| null` | Identifies mod file from SHA1 checksum |
| `modrinth_project_dependencies` | `api.modrinthProjectDependencies(slug)`| `{ slugOrId: string }` | `ProjectDependency[]` | Resolves required dependency mods |
| `modrinth_loaders` | `api.modrinthLoaders()` | _None_ | `LoaderTag[]` | Supported mod loader metadata tags |
| `modrinth_game_versions` | `api.modrinthGameVersions()` | _None_ | `GameVersionTag[]` | Modrinth supported Minecraft version tags |
| `modrinth_categories` | `api.modrinthCategories()` | _None_ | `CategoryTag[]` | Modrinth category list (Optimization, Magic, etc.) |
| `instance_install_content` | `api.instanceInstallContent(...)` | `{ instanceId, projectType, fileUrl, fileName, fileSize, sha1Base64 }` | `string` | Queues and installs mod/shader/resource pack |
| `update_check` | `api.updateCheck()` | _None_ | `UpdateInfo` | Checks GitHub releases for app updates |

---

## 4. Complete Data Models & TypeScript Interfaces

All models are exported from `src/lib/types.ts`:

```ts
export interface Config {
  version: number;
  selected_instance: string | null;
  theme: string;
  language: string;
  close_on_launch: boolean;
  show_snapshots: boolean;
  show_historical: boolean;
  default_java_path: string | null;
  default_jvm_profile: string; // "default" | "balanced" | "aggressive"
  default_ram_mb: number;      // e.g. 2048, 4096, 8192
  default_custom_jvm_args: string[];
  data_dir_override: string | null;
  download_concurrency: number;
  download_speed_limit_kbps: number | null;
  telemetry: boolean;
  last_manifest_refresh: number | null;
  onboarded: boolean;
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

export interface VersionEntry {
  id: string;
  type: "release" | "snapshot" | "old_alpha" | "old_beta" | string;
  url: string;
  time: string;
  releaseTime: string;
  sha1: string;
  complianceLevel?: number;
}

export interface JavaInstallation {
  path: string;
  version: number;        // e.g. 8, 17, 21
  vendor: string;         // e.g. "Eclipse Adoptium", "Oracle"
  architecture: string;   // e.g. "x86_64", "aarch64"
  is_default: boolean;
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
  stream: "stdout" | "stderr" | string;
  text: string;
}

export interface ProjectHit {
  slug: string;
  title: string;
  description: string;
  project_type: string;  // "mod" | "modpack" | "resourcepack" | "shader"
  downloads: number;
  icon_url: string | null;
  author: string;
  versions: string[];
  follows: number;
}

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

export interface ProjectFile {
  url: string;
  filename: string;
  hashes: { sha1: string; sha512?: string };
  size: number;
  primary: boolean;
}
```

---

## 5. UI Architecture & State Flow

### Screen Orchestration in `src/App.tsx`

`src/App.tsx` maintains top-level state and routes between 6 distinct screens:

```ts
export type Screen = "home" | "instances" | "versions" | "downloads" | "content" | "settings";
```

#### Shared Top-Level State:
* `screen`: Active tab identifier (`home`, `instances`, `versions`, `downloads`, `content`, `settings`). Supports deep linking via URL query string `?screen=<id>`.
* `config`: Active launcher configuration, loaded on mount via `api.configGet()`.
* `instances`: List of all user instances, loaded on mount and refreshed via `refresh()`.
* `selected`: Currently active instance (synchronized with `config.selected_instance`).

#### Screen Prop Contracts:

```tsx
// 1. Home (Dashboard & Quick Play)
<Home
  config={config}
  instances={instances}
  selected={selected}
  onSelect={(inst) => handleSelect(inst)}
  onRefresh={() => refresh()}
/>

// 2. Instances (Instance Cards, Mod Drawer, Create Modal)
<Instances
  instances={instances}
  onChange={() => refresh()}
  onSelect={(inst) => { onSelect(inst); setScreen("home"); }}
/>

// 3. Versions (Mojang Catalog & 1-Click Install)
<Versions onInstalled={() => refresh()} />

// 4. Downloads (Live Transfer Speed & Queue Progress)
<Downloads />

// 5. Content (Modrinth Mods, Resource Packs & Shaders Browser)
<Content selected={selected} />

// 6. Settings (Java Runtimes, RAM Slider, JVM Flags)
<Settings config={config} onChange={(newConfig) => handleConfigChange(newConfig)} />
```

---

## 6. Design System & CSS Foundations

### Solid Black OLED Theme (`src/styles.css`)
The application is styled with a strict **solid black OLED theme** designed for maximum clarity, high contrast, and zero visual clutter.

#### Theme CSS Variables:
```css
:root {
  /* Surfaces */
  --bg-canvas: #000000;           /* Pure OLED black window background */
  --bg-subtle: #09090b;           /* Sidebar / subtle backdrops */
  --bg-surface: #121215;          /* Card and panel containers */
  --bg-surface-elevated: #18181b; /* Elevated cards, headers, tracks */
  --bg-interactive: #202024;      /* Inputs and inactive buttons */
  --bg-interactive-hover: #27272a;/* Button hover states */
  --bg-interactive-active: #323238;

  /* Borders */
  --border: #27272a;              /* Default component border */
  --border-subtle: #1c1c1f;       /* Subtle separators */
  --border-strong: #3f3f46;       /* Card outlines */
  --border-focus: #0070f3;        /* Active focus ring */

  /* Text Colors */
  --text-primary: #ffffff;
  --text-secondary: #a1a1aa;
  --text-muted: #71717a;
  --text-disabled: #52525b;

  /* Brand Accents */
  --solid-primary: #0070f3;       /* Action blue */
  --solid-primary-hover: #0060df;
  --solid-success: #10b981;       /* Ready / online status */
  --solid-warning: #f59e0b;       /* Snapshots */
  --solid-danger: #ef4444;        /* Delete / errors */

  /* Corner Radii */
  --radius-xs: 4px;
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-full: 9999px;
}
```

### HeroUI v3 Slider Anatomy (RAM Allocation)
When building range or volume sliders, follow the official HeroUI v3 specification implemented in `src/styles.css`:
* **Track (`.slider__track`)**: `height: 20px`, `background: #18181b`, `border-radius: 9999px`.
* **Fill (`.slider__fill`)**: Solid blue `#0070f3`, rounded capsule border.
* **Thumb (`.slider__thumb`)**: Outer capsule `28px x 20px` in `#0070f3` seamlessly joining the fill.
* **Inner Knob (`.slider__thumb::after`)**: White pill knob `20px x 14px`, `border-radius: 6px`, subtle drop shadow, scaling to `0.9` during active dragging.

---

## 7. Build, Verification & CI/CD Pipeline

All verification workflows run automatically on GitHub Actions. Local and remote builds must strictly pass:

```bash
# 1. Unit Tests (Vitest)
npm test

# 2. TypeScript Typecheck
npx tsc --noEmit

# 3. Production Vite Build
npm run build

# 4. Rust Core Verification
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path core/Cargo.toml
```

### GitHub Actions Workflows:
1. **`ci.yml`**: Comprehensive CI verifying Rust formatting, clippy, unit tests, and frontend build.
2. **`play-smoke.yml`**: Automated smoke testing verifying instance creation and launch pipeline.
3. **`sscap.yml`**: Playwright headless browser that navigates through all 6 screens (`?screen=home`, `instances`, `versions`, `downloads`, `content`, `settings`), captures full-resolution PNG screenshots, and publishes them directly into the GitHub Actions Step Summary.
4. **`deploy-demo.yml`**: Builds and deploys the web preview of the frontend to GitHub Pages on every commit:
   * **Live Web Demo**: `https://beyondbday69.github.io/mc-launcher/`

---

## 8. Golden Rules for Future UI Development

1. **Always Use `api.*` from `src/lib/types.ts`**: Do NOT call `@tauri-apps/api/core` `invoke()` directly in UI components. Calling `api.*` guarantees that mock fallbacks work in browser previews and CI.
2. **Preserve Component Props**: Ensure `Home`, `Instances`, `Versions`, `Downloads`, `Content`, and `Settings` accept their defined props so state stays synchronized.
3. **Preserve Relative Base in Vite**: Keep `base: "./"` in `vite.config.ts` so the GitHub Pages demo deploys with correct asset paths.
4. **Respect Design Tokens**: Use `var(--bg-canvas)`, `var(--bg-surface)`, and `var(--border)` rather than hardcoding arbitrary RGB values.
5. **Keep Tests Passing**: When adding utility functions, update or add tests in `src/lib/format.test.ts`.
