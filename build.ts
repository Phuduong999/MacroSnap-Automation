import { copyFileSync, mkdirSync, existsSync, readdirSync, renameSync } from "fs";
import { join } from "path";

const outDir = "dist";

async function build() {
  // Clean
  if (existsSync(outDir)) {
    const { rmSync } = await import("fs");
    rmSync(outDir, { recursive: true });
  }
  mkdirSync(outDir, { recursive: true });

  // Build background service worker
  const bgResult = await Bun.build({
    entrypoints: ["src/background/index.ts"],
    outdir: outDir,
    target: "browser",
    minify: false,
  });
  if (!bgResult.success) {
    console.error("Background build failed:", bgResult.logs);
    process.exit(1);
  }
  renameSync(join(outDir, "index.js"), join(outDir, "background.js"));

  // Build content script
  const contentResult = await Bun.build({
    entrypoints: ["src/content/index.ts"],
    outdir: outDir,
    target: "browser",
    minify: false,
  });
  if (!contentResult.success) {
    console.error("Content build failed:", contentResult.logs);
    process.exit(1);
  }
  renameSync(join(outDir, "index.js"), join(outDir, "content.js"));

  // Build side panel (React app)
  const panelResult = await Bun.build({
    entrypoints: ["src/sidepanel/index.tsx"],
    outdir: outDir,
    target: "browser",
    minify: false,
  });
  if (!panelResult.success) {
    console.error("Side panel build failed:", panelResult.logs);
    process.exit(1);
  }
  renameSync(join(outDir, "index.js"), join(outDir, "sidepanel.js"));

  // Copy public files
  const publicDir = "public";
  if (existsSync(publicDir)) {
    for (const file of readdirSync(publicDir)) {
      copyFileSync(join(publicDir, file), join(outDir, file));
    }
  }

  // Copy sidepanel HTML
  copyFileSync("src/sidepanel/index.html", join(outDir, "sidepanel.html"));

  console.log("Build complete! Output in dist/");
}

build().catch(console.error);
