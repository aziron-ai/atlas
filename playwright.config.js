// Runs against a locally served build (npm run build; python3 -m http.server).
// CI/sandbox images pre-install a pinned Chromium outside Playwright's cache —
// point at it via PW_CHROMIUM_PATH instead of downloading browsers.
const { defineConfig } = require("@playwright/test");
const fs = require("node:fs");

const pinned = process.env.PW_CHROMIUM_PATH || "/opt/pw-browsers/chromium";
const executablePath = fs.existsSync(pinned) ? pinned : undefined;

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  use: {
    launchOptions: executablePath ? { executablePath } : {},
  },
});
