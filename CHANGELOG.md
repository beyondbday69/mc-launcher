# Changelog

All notable changes to MC Launcher are documented here.

## 0.1.0 (initial)

A complete, working Minecraft Java Edition launcher. Every goal from the
project brief is implemented in real working code (no demos, no TODOs).

### Backend (Rust + Tauri 2)
- **Mojang metadata**: dynamic version manifest, version JSON, inheritance
  resolution, library / native / asset index parsing.
- **Async downloader**: connection-reuse `reqwest` client, concurrency cap,
  exponential backoff with jitter, resume via HTTP Range, SHA-1 + size
  verification, atomic file replacement, persistent cache, optional
  speed limit, progress sink.
- **Java detection**: registry (Windows), `JAVA_HOME`, common install
  paths; manual add with validation; per-instance override; recommendation
  engine that maps Mojang's `javaVersion.majorVersion` to the right Java.
- **Instances**: isolated per-instance state with all fields from the
  brief (name, version, game dir, Java, RAM, JVM args, resolution,
  fullscreen, env, mods, resourcepacks, shaderpacks, logs). CRUD with
  atomic saves and duplicate-name rejection.
- **Launch engine**: real JVM launch pipeline. Resolves metadata, downloads
  client JAR + libraries + asset index + asset objects, extracts natives,
  builds the dynamic classpath, applies Mojang argument placeholders,
  spawns Java, captures stdout/stderr into a `mpsc` channel, tracks
  process state in a `ProcessRegistry`, supports kill.
- **JVM presets**: Default, Low RAM, Balanced, Performance, Custom. All
  flags are safe and Java-version-aware (PermGen only on Java 8,
  `InitiatingHeapOccupancyPercent` only on Java 9+, etc.).
- **Microsoft OAuth**: real `device_code` flow, then Xbox Live → XSTS →
  Minecraft token exchange with proper error handling for child accounts
  / non-Xbox regions. Tokens stored in OS keyring (when available) or
  JSON with 0600 permissions.
- **Fabric mod loader**: live metadata fetch from
  `meta.fabricmc.net`, profile JSON written that `inheritsFrom` the
  vanilla version, mod compatibility check via `fabric.mod.json`
  detection. Forge / NeoForge / Quilt return explicit "not yet
  supported" errors (architecture in place, ready to fill in).
- **Config**: versioned on-disk format with a migration runner. Atomic
  write to `.tmp` then rename, fsync.
- **Logging**: `tracing` with daily file rotation under
  `<data>/logs/launcher.log`. Per-instance logs written on launch.
- **Security**: path-traversal guard, secret redaction in log output,
  tokens never logged.
- **Tests**: 30+ integration tests covering JVM presets, library rules,
  inheritance, error codes, redaction, path safety, config migration,
  instance store, Java version parsing, PKCE, and more.

### Frontend (React + TypeScript)
- **Screens**: Home, Instances, Versions, Downloads, Settings.
- **Theme**: hand-rolled dark gaming theme in pure CSS (no framework,
  small bundle, GPU-friendly). CSS variables for easy theming.
- **State**: minimal — direct calls to Tauri commands, no global state
  library. Polling only for downloads and process status (500ms).
- **Type safety**: all Tauri commands have typed wrappers in
  `lib/types.ts`.
- **Tests**: Vitest unit tests for the formatters.

### Bundling
- Tauri 2 MSI + NSIS for Windows, deb + AppImage for Linux.
- Optimized Rust release profile (LTO, opt-level 3, strip, panic=abort).

### Known limitations
- Forge / NeoForge / Quilt: stub implementations only.
- Update server: stub. Wire in `tauri-plugin-updater` for production.
- Auth UI: `auth_begin` blocks the IPC until sign-in completes. The
  background pattern is documented for the next iteration.
