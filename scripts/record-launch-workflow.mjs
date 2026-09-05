import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const RECORD_DIR = process.env.RECORD_DIR || "/tmp/demo_recordings";
fs.mkdirSync(RECORD_DIR, { recursive: true });

async function smoothMove(page, targetSelector, steps = 25) {
  const el = await page.waitForSelector(targetSelector, { state: "visible", timeout: 10000 });
  const box = await el.boundingBox();
  if (!box) return el;
  const targetX = box.x + box.width / 2;
  const targetY = box.y + box.height / 2;

  await page.mouse.move(targetX, targetY, { steps });
  await page.waitForTimeout(350);
  return el;
}

async function main() {
  console.log("[record] Starting headless chromium with video recording in GitHub Actions...");
  const browser = await chromium.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1.5,
    colorScheme: "dark",
    recordVideo: {
      dir: RECORD_DIR,
      size: { width: 1280, height: 800 },
    },
  });

  const page = await context.newPage();

  console.log("[record] Navigating to http://localhost:4173/ ...");
  await page.goto("http://localhost:4173/", { waitUntil: "networkidle" });

  // Inject mouse indicator for visual clarity
  await page.evaluate(() => {
    const cursor = document.createElement("div");
    cursor.id = "demo-mouse-pointer";
    cursor.style.position = "fixed";
    cursor.style.width = "20px";
    cursor.style.height = "20px";
    cursor.style.background = "rgba(118, 185, 0, 0.9)";
    cursor.style.border = "2px solid #ffffff";
    cursor.style.borderRadius = "50%";
    cursor.style.pointerEvents = "none";
    cursor.style.zIndex = "99999999";
    cursor.style.boxShadow = "0 0 14px rgba(118, 185, 0, 1)";
    cursor.style.transform = "translate(-50%, -50%)";
    cursor.style.transition = "transform 0.1s ease, background 0.15s ease";
    document.body.appendChild(cursor);

    window.addEventListener("mousemove", (e) => {
      cursor.style.left = `${e.clientX}px`;
      cursor.style.top = `${e.clientY}px`;
    });
    window.addEventListener("mousedown", () => {
      cursor.style.transform = "translate(-50%, -50%) scale(0.75)";
      cursor.style.background = "#ffffff";
    });
    window.addEventListener("mouseup", () => {
      cursor.style.transform = "translate(-50%, -50%) scale(1)";
      cursor.style.background = "rgba(118, 185, 0, 0.9)";
    });
  });

  // Step 1: Initial dashboard view
  console.log("[record] Showing initial Dashboard...");
  await page.mouse.move(640, 400, { steps: 15 });
  await page.waitForTimeout(2000);

  // Step 2: Navigate to Driver Catalog
  console.log("[record] Navigating to Driver Catalog...");
  const navVersions = await smoothMove(page, "button:has-text('Driver Catalog')");
  await navVersions.click();
  await page.waitForTimeout(1800);

  // Step 3: Download Minecraft 1.21
  console.log("[record] Clicking Install for Release 1.21...");
  const installBtn = await page.waitForSelector(
    "button:has-text('INSTALL GAME READY'), button:has-text('CREATE PROFILE')",
    { state: "visible", timeout: 8000 }
  );
  const installBox = await installBtn.boundingBox();
  if (installBox) {
    await page.mouse.move(installBox.x + installBox.width / 2, installBox.y + installBox.height / 2, { steps: 20 });
    await page.waitForTimeout(400);
    await installBtn.click();
    console.log("[record] Triggered Minecraft 1.21 download");
  }

  // Observe download progress bar moving
  await page.waitForTimeout(3000);

  // Step 4: Switch to Transfers screen while download is active
  console.log("[record] Navigating to Transfers screen...");
  const navTransfers = await smoothMove(page, "button:has-text('Transfers')");
  await navTransfers.click();
  console.log("[record] Showing Transfers screen with active download...");
  await page.waitForTimeout(3000);

  // Step 5: Return to Dashboard
  console.log("[record] Returning to Dashboard...");
  const navHome = await smoothMove(page, "button:has-text('Dashboard')");
  await navHome.click();
  await page.waitForTimeout(1500);

  // Step 6: Launch Minecraft 1.21
  console.log("[record] Launching Minecraft 1.21 via PLAY GAME button...");
  const playBtn = await page.waitForSelector(
    "button:has-text('PLAY GAME'), button.button-primary:has-text('PLAY')",
    { state: "visible", timeout: 10000 }
  );
  const playBox = await playBtn.boundingBox();
  if (playBox) {
    await page.mouse.move(playBox.x + playBox.width / 2, playBox.y + playBox.height / 2, { steps: 20 });
    await page.waitForTimeout(400);
    await playBtn.click();
  }

  // Watch launch preparation stages and progress fill
  console.log("[record] Observing launch preparation stages (verifying -> assets -> JVM tuning)...");
  await page.waitForTimeout(3500);

  // Step 7: MINECRAFT GAME WINDOW LAUNCHES!
  console.log("[record] Waiting for Minecraft 1.21 Game Window to launch on screen...");
  const gameWin = await page.waitForSelector(".mc-game-window", { state: "visible", timeout: 12000 });
  const gameBox = await gameWin.boundingBox();

  if (gameBox) {
    console.log("[record] Minecraft 1.21 Game Window is open and running!");
    // Move cursor across game titlebar and in-game controls
    await page.mouse.move(gameBox.x + gameBox.width * 0.35, gameBox.y + 20, { steps: 20 });
    await page.waitForTimeout(1200);

    // Hover over game buttons area
    await page.mouse.move(gameBox.x + gameBox.width * 0.5, gameBox.y + gameBox.height * 0.65, { steps: 20 });
    await page.waitForTimeout(1500);

    // Hover over FPS and HUD info
    await page.mouse.move(gameBox.x + gameBox.width * 0.85, gameBox.y + gameBox.height * 0.2, { steps: 15 });
    await page.waitForTimeout(1800);
  }

  // Step 8: Minimize game window to launcher background
  console.log("[record] Switching to launcher background with game running in dock...");
  const toLauncherBtn = await page.waitForSelector(
    ".btn-to-launcher, .btn-min-game, button:has-text('SWITCH TO LAUNCHER')",
    { state: "visible", timeout: 8000 }
  );
  const minBox = await toLauncherBtn.boundingBox();
  if (minBox) {
    await page.mouse.move(minBox.x + minBox.width / 2, minBox.y + minBox.height / 2, { steps: 15 });
    await page.waitForTimeout(300);
    await toLauncherBtn.click();
  }
  await page.waitForTimeout(1500);

  // Step 9: Navigate to Game Library while game runs in background
  console.log("[record] Navigating to Game Library while game runs in background...");
  const navInstances = await smoothMove(page, "button:has-text('Game Library')");
  await navInstances.click();
  await page.waitForTimeout(2000);

  // Step 10: Navigate to Settings & Tuning
  console.log("[record] Navigating to Settings & Tuning...");
  const navSettings = await smoothMove(page, "button:has-text('Settings & Tuning')");
  await navSettings.click();
  await page.waitForTimeout(2000);

  // Step 11: Return to Dashboard
  console.log("[record] Returning to Dashboard...");
  const navHome2 = await smoothMove(page, "button:has-text('Dashboard')");
  await navHome2.click();
  await page.waitForTimeout(1500);

  // Step 12: Restore Game Window from dock
  console.log("[record] Restoring Minecraft Game Window from dock...");
  const showGameBtn = await page.waitForSelector(
    ".btn-show-game, button:has-text('SHOW GAME')",
    { state: "visible", timeout: 8000 }
  );
  const showBox = await showGameBtn.boundingBox();
  if (showBox) {
    await page.mouse.move(showBox.x + showBox.width / 2, showBox.y + showBox.height / 2, { steps: 15 });
    await page.waitForTimeout(300);
    await showGameBtn.click();
  }
  await page.waitForTimeout(2500);

  // Step 13: Terminate Game cleanly
  console.log("[record] Stopping game session via Game Window STOP controls...");
  const stopBtn = await page.waitForSelector(
    ".btn-game-toolbar-stop, .btn-close-game, .mc-win-ctrl-btn-close",
    { state: "visible", timeout: 8000 }
  );
  const stopBox = await stopBtn.boundingBox();
  if (stopBox) {
    await page.mouse.move(stopBox.x + stopBox.width / 2, stopBox.y + stopBox.height / 2, { steps: 20 });
    await page.waitForTimeout(400);
    await stopBtn.click({ force: true });
    console.log("[record] Game session stopped successfully!");
  }

  await page.waitForTimeout(2000);

  const videoObj = page.video();
  await page.close();
  await context.close();
  await browser.close();

  const videoTempPath = videoObj ? await videoObj.path() : null;
  console.log(`[record] Raw Playwright video finalized at: ${videoTempPath}`);

  if (videoTempPath && fs.existsSync(videoTempPath)) {
    const finalMp4 = path.join(RECORD_DIR, "minecraft_121_download_and_launch.mp4");
    const finalWebm = path.join(RECORD_DIR, "minecraft_121_download_and_launch.webm");
    const finalGif = path.join(RECORD_DIR, "minecraft_121_download_and_launch.gif");

    console.log("[record] Finalizing WebM recording copy...");
    fs.copyFileSync(videoTempPath, finalWebm);
    console.log(` - WEBM: ${finalWebm} (${fs.statSync(finalWebm).size} bytes)`);

    try {
      console.log("[record] Converting to high compatibility MP4 via ffmpeg...");
      execSync(
        `ffmpeg -y -i "${videoTempPath}" -c:v libx264 -pix_fmt yuv420p -profile:v high -crf 22 -preset medium -movflags +faststart "${finalMp4}"`,
        { stdio: "inherit" }
      );
      console.log(` - MP4:  ${finalMp4} (${fs.statSync(finalMp4).size} bytes)`);
    } catch (e) {
      console.warn("[record] Warning: ffmpeg MP4 conversion failed:", e.message);
    }

    try {
      console.log("[record] Generating optimized animated GIF for README and summaries...");
      execSync(
        `ffmpeg -y -i "${videoTempPath}" -vf "fps=10,scale=800:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" -loop 0 "${finalGif}"`,
        { stdio: "inherit" }
      );
      console.log(` - GIF:  ${finalGif} (${fs.statSync(finalGif).size} bytes)`);
    } catch (e) {
      console.warn("[record] Warning: ffmpeg GIF conversion failed:", e.message);
    }
  }
}

main().catch((err) => {
  console.error("[record] Error:", err);
  process.exit(1);
});
