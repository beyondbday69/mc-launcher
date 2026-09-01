// Suppress the console window on Windows in release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // `tauri::generate_context!()` is the one place that validates
    // `tauri.conf.json`'s `frontendDist` path at compile time. We
    // invoke it here in the GUI binary (which always builds with a
    // frontend dist present — see `ci.yml`) instead of in the lib,
    // so the headless CLI bins (`install-cli`, `launch-cli`) can build
    // without compiling the frontend.
    mc_launcher::run_with_context(tauri::generate_context!());
}
