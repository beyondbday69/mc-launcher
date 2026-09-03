import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const SCREENS = [
  { id: "home", name: "01-home.png", label: "Home Screen" },
  { id: "instances", name: "02-instances.png", label: "Instances Screen" },
  { id: "versions", name: "03-versions.png", label: "Versions Catalog" },
  { id: "downloads", name: "04-downloads.png", label: "Downloads & Queue" },
  { id: "content", name: "05-content.png", label: "Content & Mods" },
  { id: "settings", name: "06-settings.png", label: "Settings & Config" },
];

const OUT_DIR = process.env.SCREENSHOT_DIR || "/tmp/screenshots";
fs.mkdirSync(OUT_DIR, { recursive: true });

async function main() {
  console.log("[sscap] Launching headless browser for screen captures...");
  const browser = await chromium.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 860 },
    deviceScaleFactor: 2,
    colorScheme: "dark",
  });

  const page = await context.newPage();

  for (const s of SCREENS) {
    const url = `http://localhost:4173/?screen=${s.id}`;
    console.log(`[sscap] Capturing ${s.label} (${url})...`);
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    const outPath = path.join(OUT_DIR, s.name);
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`[sscap] Saved ${outPath} (${fs.statSync(outPath).size} bytes)`);
  }

  await browser.close();
  console.log("[sscap] All screens captured successfully!");
}

main().catch((err) => {
  console.error("[sscap] Error:", err);
  process.exit(1);
});
