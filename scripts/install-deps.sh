#!/usr/bin/env bash
# Bootstrap the build environment for the launcher.
# Run on a fresh clone. Tested on Ubuntu 22.04 and Windows (Git Bash).

set -euo pipefail

# ---- Detect OS ----
case "$(uname -s)" in
  Linux*)  OS=linux ;;
  Darwin*) OS=macos ;;
  MINGW*|MSYS*|CYGWIN*) OS=windows ;;
  *) echo "Unsupported OS"; exit 1 ;;
esac

# ---- Install Rust ----
if ! command -v cargo >/dev/null; then
  echo "Installing Rust…"
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
  source "$HOME/.cargo/env"
fi

# ---- Install Node.js ----
if ! command -v node >/dev/null; then
  echo "Installing Node.js…"
  if [ "$OS" = "windows" ]; then
    echo "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
  fi
  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

# ---- OS-specific build deps ----
case "$OS" in
  linux)
    sudo apt-get update
    sudo apt-get install -y \
      libwebkit2gtk-4.1-dev \
      libgtk-3-dev \
      libayatana-appindicator3-dev \
      librsvg2-dev \
      patchelf \
      build-essential \
      curl \
      wget \
      file
    ;;
  macos)
    if ! command -v brew >/dev/null; then
      echo "Please install Homebrew from https://brew.sh"
      exit 1
    fi
    ;;
esac

# ---- Tauri CLI ----
if ! command -v cargo-tauri >/dev/null; then
  echo "Installing Tauri CLI…"
  cargo install tauri-cli --version "^2.0" --locked
fi

# ---- npm deps ----
echo "Installing npm dependencies…"
npm install

echo
echo "Done. Run:"
echo "  npm run tauri dev    # development"
echo "  npm run tauri build  # release"
