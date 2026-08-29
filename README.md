# MC Launcher

A real, production-ready Minecraft Java Edition launcher. Fast, lightweight,
secure. Built with **Rust + Tauri + React/TypeScript**. Windows-first;
Linux-ready.

The launcher is **not a demo**: it implements the full Mojang launch
pipeline — manifest fetch, version inheritance, asset index resolution,
library + native extraction, dynamic classpath, argument substitution,
process spawn with stdout/stderr capture — and ships with a working
Microsoft OAuth flow.

## Architecture

```
src/                    React + TypeScript frontend
  App.tsx               Layout, screen routing
  screens/              Home, Instances, Versions, Downloads, Settings
  lib/types.ts          Typed Tauri command bindings
  styles.css            Dark gaming theme (no CSS framework)
src-tauri/              Rust backend
  src/
    auth/               Microsoft OAuth + Xbox Live + Minecraft flow
    config.rs           Versioned config with migrations
    config/migrate.rs   Migration runner (v0 -> vN)
    commands.rs         Tauri command surface
    downloads/          Async concurrent downloader + verify + progress
    error.rs            Typed errors with stable codes + suggestions
    instances/          Per-instance state, mods, store
    java/               Java detection (registry, JAVA_HOME, common paths)
    launcher/           JVM launch pipeline + prepare-launch
    launcher/jvm.rs     Presets (Default, Low RAM, Balanced, Performance, Custom)
    logging.rs          Structured logging (tracing + daily rotation)
    metadata/           Mojang manifest, version JSON, libraries, assets
    metadata/inherits.rs  Argument placeholder substitution
    mods/               Pluggable mod loaders (Fabric implemented)
    paths.rs            OS-aware data dir + path sanitization
    process.rs          Process registry (kill, list, log streaming)
    security.rs         Path validation + secret redaction
    state.rs            AppState
    update.rs           Update check stub
  tests/integration.rs  End-to-end tests
```

## Build (Windows)

Prerequisites:

* **Rust** 1.77+ (`rustup install stable`)
* **Node.js** 18+ and **npm**
* **Tauri 2.x** CLI: `cargo install tauri-cli --version "^2.0"`
* **Windows**: Microsoft C++ Build Tools, WebView2 (preinstalled on Win10+)
* **Linux**: `libwebkit2gtk-4.1-dev`, `libssl-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`

```bash
git clone <this-repo>
cd launcher
npm install
npm run tauri dev      # development with hot reload
npm run tauri build    # release build (MSI + NSIS on Windows)
```

Output: `src-tauri/target/release/bundle/msi/MC Launcher_0.1.0_x64_en-US.msi`
and `src-tauri/target/release/bundle/nsis/MC Launcher_0.1.0_x64-setup.exe`.

## Test

```bash
cd src-tauri
cargo test
```

Runs the full integration test suite (config, JVM, library rules,
inheritance, error codes, redaction, path safety, instance store, Java
parsing, PKCE).

## Run

1. Launch the app. The first launch creates the data directory
   (`%APPDATA%\MCLauncher` on Windows, `~/.local/share/mc-launcher` on Linux).
2. Go to **Settings → Java** and either click **Re-detect** or add your
   `java.exe` / `bin/java` manually. Java 17 or 21 is recommended for
   current Minecraft versions.
3. Go to **Versions** and pick a Minecraft release. Click **Create
   instance**.
4. On the **Home** screen, hit **Play**. The first launch downloads all
   libraries, assets, and the client JAR (verified with SHA-1). Subsequent
   launches reuse the cache.
5. To sign in for online play, click **Sign in** in the title bar. The
   launcher shows a code + URL; sign in at the URL with the code, and the
   launcher detects completion automatically.

## Design choices

* **No hardcoded versions, libraries, or classpaths.** Everything is
  fetched dynamically from Mojang's official manifest and resource
  endpoints.
* **No bundled JRE.** Detects installed Java. Optional: ship an MSI
  bundle that includes Eclipse Temurin if needed for end users.
* **Tauri, not Electron.** A Tauri app uses the OS WebView and a Rust
  backend — much lower idle RAM and CPU than an Electron equivalent.
* **Async I/O throughout.** Downloads, manifest fetches, asset
  resolution, and process spawn are all `async` on Tokio.
* **Lazy loading.** Screens render only when navigated to. The version
  list is paginated; the asset index is fetched on demand.
* **Idempotent downloads.** Files are SHA-1 + size verified. Corrupt
  files are deleted and re-downloaded; cached files that still verify
  are skipped.
* **Structured logging.** `tracing` writes daily-rotated files under
  `<data>/logs/`. Sensitive fields are redacted before they reach the log.

## Security

* Tokens are stored in the OS keyring when the `keyring` feature is
  enabled. The JSON fallback is written with `0600` permissions on POSIX.
* The downloader never logs tokens, headers, or URLs containing them.
* The `redact()` helper strips `Bearer …` and `access_token` /
  `refresh_token` / `client_secret` / `password` from any string passed
  through the logging layer.
* `validate_path()` rejects relative paths and `..` components before
  any FS operation; the AppPaths layer enforces canonicalization.

## Limitations (known)

* **Forge / NeoForge / Quilt** are not yet supported. The architecture
  is in place (`ModLoader` trait, `mods::registry()`); the `Fabric`
  implementation is the reference. Adding the others is a matter of
  implementing the trait for each.
* **Update server** is not wired up. `update.rs` currently returns a
  stub. Plug in `tauri-plugin-updater` for production.
* **Tauri 2 build requires a host with WebView2 / WebKitGTK.** The
  included `npm run tauri dev` is the supported dev workflow.

## Performance

The launcher is designed to keep idle CPU near zero. Concretely:

* The progress poller is the only place that polls (500ms). All other
  data is fetched on demand or on user action.
* The version manifest is cached for 1 hour before re-fetch.
* Screens are mounted/unmounted as the user navigates; nothing is
  rendered offscreen.
* The Rust release profile is set to `lto = true`, `codegen-units = 1`,
  `opt-level = 3`, `panic = abort`, `strip = true`.

## License

MIT.
