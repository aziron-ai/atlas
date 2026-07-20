// Runs against a locally served build (npm run build; python3 -m http.server).
// CI/sandbox images pre-install a pinned Chromium outside Playwright's cache —
// point at it via PW_CHROMIUM_PATH instead of downloading browsers.
const { defineConfig } = require("@playwright/test");
const fs = require("node:fs");

const pinned = process.env.PW_CHROMIUM_PATH || "/opt/pw-browsers/chromium";
const executablePath = fs.existsSync(pinned) ? pinned : undefined;

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 120_000,
  // Shared/loaded VMs stretch page loads well past the 5s expect default;
  // the assertions themselves are cheap once the page is up.
  expect: { timeout: 30_000 },
  use: {
    launchOptions: executablePath ? { executablePath } : {},
  },
});
