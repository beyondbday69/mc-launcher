#!/usr/bin/env bash
set -eo pipefail

echo "================================================================="
echo "  🎬 MINECRAFT 1.21 REAL EXECUTION & SCREEN RECORDER"
echo "================================================================="

DISPLAY="${DISPLAY:-:99}"
export DISPLAY
export LIBGL_ALWAYS_SOFTWARE=1
export GALLIUM_HUD="fps"
export GALLIUM_HUD_DUMP_DIR="/tmp/gallium_hud"
export XDG_DATA_HOME="/tmp/play-smoke-data"
export MC_LAUNCHER_JAVA="${JAVA:-/usr/lib/jvm/java-21-openjdk-amd64/bin/java}"

mkdir -p /tmp/gallium_hud
mkdir -p /tmp/gameplay_recordings

# 1. Start lightweight window manager for clean window borders & focus management
if command -v fluxbox >/dev/null 2>&1; then
  echo "[Display] Starting fluxbox window manager..."
  fluxbox &
  sleep 1
fi

# 2. Set dark background
if command -v xsetroot >/dev/null 2>&1; then
  xsetroot -solid "#0b0f19" || true
fi

# 3. Start ffmpeg screen recording on :99
RAW_VIDEO="/tmp/gameplay_recordings/raw_capture.mp4"
echo "[Recorder] Starting ffmpeg x11grab on $DISPLAY (1280x720 @ 25fps)..."
ffmpeg -y -video_size 1280x720 -framerate 25 -f x11grab -draw_mouse 1 -i "${DISPLAY}.0" \
  -c:v libx264 -preset ultrafast -pix_fmt yuv420p "$RAW_VIDEO" \
  >/tmp/ffmpeg_record.log 2>&1 &
RECORDER_PID=$!
echo "RECORDER_PID=$RECORDER_PID"
sleep 2

# Cleanup trap to ensure recorder and background processes are finalized
cleanup() {
  echo "[Cleanup] Finalizing recording and processes..."
  if [ -n "$MC_PID" ] && kill -0 "$MC_PID" 2>/dev/null; then
    kill "$MC_PID" 2>/dev/null || true
    sleep 1
    kill -9 "$MC_PID" 2>/dev/null || true
  fi
  if [ -n "$LC_PID" ] && kill -0 "$LC_PID" 2>/dev/null; then
    kill "$LC_PID" 2>/dev/null || true
  fi
  if [ -n "$RECORDER_PID" ] && kill -0 "$RECORDER_PID" 2>/dev/null; then
    echo "[Recorder] Stopping ffmpeg (PID: $RECORDER_PID)..."
    kill -2 "$RECORDER_PID" 2>/dev/null || kill "$RECORDER_PID" 2>/dev/null || true
    wait "$RECORDER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# 4. Show launcher terminal on screen performing download verification
echo "[Launcher] Downloading Minecraft 1.21.4 + Fabric Loader..."
LOADER=$(curl -sS "https://meta.fabricmc.net/v2/versions/loader/1.21.4" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d[0]['loader']['version'])" 2>/dev/null || echo "0.16.10")
echo "[Launcher] Using Fabric loader: $LOADER"

# Run install in xterm if available so the video shows the launcher terminal downloading
if command -v xterm >/dev/null 2>&1; then
  echo "[Launcher] Displaying install progress in launcher console window..."
  xterm -geometry 120x32+80+60 -bg "#0d1117" -fg "#76b900" -fa "Monospace" -fs 11 \
    -title "NVIDIA GeForce NOW Minecraft Launcher - Download Engine" \
    -e bash -c "
      echo '================================================================='
      echo '  🎮 NVIDIA GEFORCE NOW MINECRAFT LAUNCHER ENGINE'
      echo '  Action: Download & Verify Minecraft 1.21.4 + Fabric'
      echo '================================================================='
      echo ''
      echo '[Download] Fetching Fabric Loader $LOADER...'
      echo '[Download] Downloading Mojang Minecraft 1.21.4 Client JAR...'
      echo '[Download] Verifying SHA-1 checksums & assets...'
      echo ''
      ./src-tauri/target/debug/install-cli --version 1.21.4 --fabric '$LOADER' --instance-name smoke-1-21-4
      STATUS=\$?
      if [ \$STATUS -eq 0 ]; then
        echo ''
        echo '================================================================='
        echo '  ✅ [READY] Minecraft 1.21.4 Download Complete!'
        echo '================================================================='
        sleep 2
      fi
      exit \$STATUS
    " || {
      echo "[Launcher] xterm install exited; falling back to direct install-cli if needed..."
      ./src-tauri/target/debug/install-cli --version 1.21.4 --fabric "$LOADER" --instance-name smoke-1-21-4
    }
else
  ./src-tauri/target/debug/install-cli --version 1.21.4 --fabric "$LOADER" --instance-name smoke-1-21-4
fi

sleep 1

# 5. Launch Minecraft under Xvfb
echo "[Launcher] Launching Minecraft 1.21.4..."
./src-tauri/target/debug/launch-cli \
  --instance-name smoke-1-21-4 \
  --username Player \
  --resolution 1280x720 \
  --max-ram 2048 \
  >/tmp/launch-cli.log 2>&1 &
LC_PID=$!
echo "LAUNCH_CLI_PID=$LC_PID"

# Wait for Minecraft Java PID
MC_PID=""
for i in $(seq 1 60); do
  sleep 1
  if [ -s /tmp/launch-cli.pid ]; then
    MC_PID=$(cat /tmp/launch-cli.pid)
    echo "[Launcher] Minecraft Java PID = $MC_PID"
    break
  fi
  if ! kill -0 "$LC_PID" 2>/dev/null; then
    echo "[Launcher] launch-cli exited early!"
    cat /tmp/launch-cli.log
    exit 1
  fi
done

if [ -z "$MC_PID" ]; then
  echo "[Launcher] Timed out waiting for Minecraft to spawn."
  exit 1
fi

# 6. Wait for Minecraft window to appear on X11
echo "[Player] Waiting for Minecraft window to render..."
MC_WIN=""
for i in $(seq 1 45); do
  sleep 1
  MC_WIN=$(xdotool search --name "Minecraft" 2>/dev/null | head -n 1 || true)
  if [ -n "$MC_WIN" ]; then
    echo "[Player] Found Minecraft Window ID: $MC_WIN"
    break
  fi
done

# Wait for Mojang splash loading screen to finish and reach main menu (~15s)
echo "[Player] Allowing Mojang splash screen to load assets..."
sleep 15

# Focus window
if [ -n "$MC_WIN" ]; then
  xdotool windowactivate "$MC_WIN" 2>/dev/null || true
  xdotool windowfocus "$MC_WIN" 2>/dev/null || true
fi

# 7. Interactive Gameplay Automation via xdotool
echo "[Player] Starting interactive gameplay actions..."

# Dismiss "Welcome to Minecraft" popup if present (click Continue at center-bottom)
xdotool mousemove 640 540 click 1 2>/dev/null || true
sleep 1
xdotool key Return 2>/dev/null || true
sleep 2

# Hover over Singleplayer
echo "[Player] Navigating to Singleplayer..."
xdotool mousemove 640 320 2>/dev/null || true
sleep 2

# Hover over Multiplayer
echo "[Player] Navigating to Multiplayer..."
xdotool mousemove 640 360 2>/dev/null || true
sleep 2

# Click Options...
echo "[Player] Opening Options menu..."
xdotool mousemove 530 460 click 1 2>/dev/null || true
sleep 3

# Hover over Video Settings
echo "[Player] Checking Video Settings..."
xdotool mousemove 530 340 click 1 2>/dev/null || true
sleep 3

# Click Done in Video Settings
xdotool mousemove 640 650 click 1 2>/dev/null || true
sleep 2

# Click Done in Options back to Main Menu
xdotool mousemove 640 650 click 1 2>/dev/null || true
sleep 2

# Toggle F3 Debug HUD
echo "[Player] Toggling F3 Debug HUD..."
xdotool key F3 2>/dev/null || true
sleep 3

# Capture high-res in-game screenshot
echo "[Player] Capturing in-game screenshot..."
import -window root /tmp/play-smoke.png || true

# Run stats monitor
python3 scripts/smoke-stats.py \
  --pid "$MC_PID" \
  --duration 5 \
  --interval 1 \
  --max-ram 2048 \
  --display "$DISPLAY" \
  --hud-dir /tmp/gallium_hud \
  --output-json /tmp/play-smoke-stats.json \
  --output-md /tmp/play-smoke-stats.md || true

# Annotate screenshot with HUD overlay
python3 scripts/smoke-stats.py --annotate /tmp/play-smoke.png /tmp/play-smoke.png || true

# Allow 3 more seconds of live gameplay capture
sleep 3

# 8. Clean Shutdown
echo "[Player] Stopping Minecraft cleanly..."
kill "$MC_PID" 2>/dev/null || true
sleep 2
kill -9 "$MC_PID" 2>/dev/null || true
kill "$LC_PID" 2>/dev/null || true
MC_PID=""
LC_PID=""

# Stop recorder cleanly
if [ -n "$RECORDER_PID" ] && kill -0 "$RECORDER_PID" 2>/dev/null; then
  echo "[Recorder] Finalizing raw video recording..."
  kill -2 "$RECORDER_PID" 2>/dev/null || true
  wait "$RECORDER_PID" 2>/dev/null || true
  RECORDER_PID=""
fi

# 9. Encode High Quality Videos
echo "[Encoder] Encoding MP4, WebM, and GIF..."
if [ -f "$RAW_VIDEO" ] && [ -s "$RAW_VIDEO" ]; then
  # MP4 H.264
  ffmpeg -y -i "$RAW_VIDEO" \
    -c:v libx264 -crf 22 -preset fast -pix_fmt yuv420p -movflags +faststart \
    /tmp/real_minecraft_121_launch.mp4

  # WebM VP9
  ffmpeg -y -i "$RAW_VIDEO" \
    -c:v libvpx-vp9 -b:v 1.5M -crf 30 -cpu-used 4 \
    /tmp/real_minecraft_121_launch.webm

  # High Quality Animated GIF Preview
  ffmpeg -y -ss 00:00:08 -t 25 -i "$RAW_VIDEO" \
    -vf "fps=12,scale=800:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3" \
    /tmp/real_minecraft_121_launch.gif

  echo "[Encoder] Generated videos:"
  ls -lh /tmp/real_minecraft_121_launch.*
else
  echo "[Encoder] Warning: raw capture file missing or empty!"
  ls -la /tmp/gameplay_recordings/
fi

echo "================================================================="
echo "  🎬 RECORDING & GAMEPLAY EXECUTION COMPLETE!"
echo "================================================================="
