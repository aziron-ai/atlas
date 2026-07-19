const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");

const baseURL = process.env.ATLAS_BENCHMARK_URL || "http://127.0.0.1:4179/";
const site = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "data", "site-data.json"), "utf8")
);

// Every published data artifact must be free of local machine paths and
// personal identifiers — the same invariant scripts/sanitize-public-data.mjs
// enforces at build time, re-checked here against the committed files.
const BANNED = [/\/Users\//, /damirdarasu/, /\/tmp\/atlas-live/, /MsysTechnologies/i];

// Install commands that must appear VERBATIM under #install.
const INSTALL_COMMANDS = [
  "brew install --cask aziron-ai/atlas/atlas",
  "npm install -g @aziron-ai/atlas",
  "atlas index .",
  "atlas mcp --transport stdio",
];

const SECTIONS = [
  "hero", "summary", "knob", "languages", "versus",
  "field", "real", "agents", "graph", "evidence", "install",
];

const DOC_PAGES = [
  "getting-started", "installation", "indexing", "cli", "assistants", "mcp",
  "service", "configuration", "privacy", "languages", "benchmarks",
  "troubleshooting", "upgrade",
];

test.describe("atlas product and documentation", () => {
  test("overview makes the product, local model, and evidence paths clear", async ({ page }) => {
    await page.goto(`${baseURL}#overview`, { waitUntil: "networkidle" });
    const hero = page.getByTestId("product-hero");
    await expect(hero.getByRole("heading", { level: 1 })).toContainText("Atlas is the map");
    await expect(hero).toContainText("precise repository context");
    await expect(hero).toContainText("One local binary");
    await expect(page.getByTestId("product-install")).toContainText(
      "brew install --cask aziron-ai/atlas/atlas"
    );
    await expect(page.getByTestId("product-nav")).toContainText(`v${site.version}`);
    await expect(page.getByRole("link", { name: /View benchmark evidence/ })).toHaveAttribute("href", "#benchmarks");
  });

  test("all consumer documentation pages render with task content", async ({ page }) => {
    for (const slug of DOC_PAGES) {
      await page.goto(`${baseURL}#docs/${slug}`, { waitUntil: "networkidle" });
      const article = page.getByTestId("docs-article");
      await expect(article, slug).toBeVisible();
      await expect(article.locator("h1"), slug).not.toBeEmpty();
      await expect(article.locator("h2").first(), slug).toBeVisible();
    }
  });

  test("installation and assistant setup use current public coordinates", async ({ page }) => {
    await page.goto(`${baseURL}#docs/installation`, { waitUntil: "networkidle" });
    await expect(page.getByTestId("docs-article")).toContainText("aziron-ai/atlas/atlas");
    await expect(page.getByTestId("docs-article")).toContainText("@aziron-ai/atlas");
    await expect(page.getByTestId("docs-article")).toContainText(`@${site.version}`);

    await page.goto(`${baseURL}#docs/assistants`, { waitUntil: "networkidle" });
    await expect(page.getByTestId("docs-article")).toContainText("atlas bootstrap --dry-run");
    await expect(page.getByTestId("docs-article")).toContainText("codex,claude,claude-desktop");
  });

  test("primary navigation reaches docs, benchmarks, and downloadable data", async ({ page, request }) => {
    await page.goto(`${baseURL}#overview`, { waitUntil: "networkidle" });
    await page.getByTestId("product-nav").getByRole("link", { name: "Documentation", exact: true }).click();
    await expect(page).toHaveURL(/#docs\/getting-started$/);
    await expect(page.getByTestId("docs-article")).toBeVisible();

    const response = await request.get(new URL("data/site-data.json", baseURL).toString());
    expect(response.status()).toBe(200);
    expect((await response.json()).version).toBe(site.version);
  });
});

test.describe("atlas benchmark evidence", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${baseURL}#benchmarks`, { waitUntil: "networkidle" });
    await page.waitForSelector("#hero");
  });

  test("renders every section of the 11-section story", async ({ page }) => {
    for (const id of SECTIONS) {
      await expect(page.locator(`#${id}`), id).toHaveCount(1);
    }
  });

  test("agent-harness section: one panel per agent, honest caveat, runnable suite", async ({ page }) => {
    for (const a of site.agentBench.agents) {
      const panel = page.getByTestId(`agent-panel-${a.id}`);
      await expect(panel).toBeVisible();
      // every benchmarked mode appears with its mean total tokens
      for (const cell of site.agentBench.cells.filter((c) => c.agent === a.id)) {
        await expect(panel).toContainText(
          new Intl.NumberFormat("en-US").format(cell.totalTokens)
        );
      }
    }
    const run = page.getByTestId("agent-run-yourself");
    await expect(run).toContainText("agent-bench/agent_token_bench.py");
    await expect(page.getByTestId("agents")).toContainText("not comparable");
  });

  test("hero carries report headlines and fresh-run corroboration chips", async ({ page }) => {
    const hero = page.getByTestId("hero");
    await expect(hero).toContainText(String(site.report.headline.atlasF1All));
    await expect(hero).toContainText(`${site.report.headline.accPerToken}×`);
    const chips = page.getByTestId("fresh-chips");
    await expect(chips).toContainText(
      `${site.fresh.saturation.perfect}/${site.fresh.saturation.total}`
    );
    await expect(chips).toContainText(site.fresh.lspTruth.meanF1.toFixed(3));
    await expect(page.getByTestId("frontier").locator("svg")).toHaveCount(1);
  });

  test("maturity ladder offers both the viz and the table view", async ({ page }) => {
    await expect(page.getByTestId("maturity-ladder")).toBeVisible();
    // every one of the 40 code languages appears as a chip in the ladder
    await expect(page.getByTestId("maturity-lang")).toHaveCount(
      site.report.maturity.levels.reduce((s, l) => s + l.langs.length, 0)
    );
    // the 9 promoted languages carry the honest pending badge
    const pending = page.getByTestId("maturity-lang").filter({ hasText: "PENDING" });
    await expect(pending).toHaveCount(site.report.maturity.pending.langs.length);

    await page.getByTestId("maturity-view-table").click();
    await expect(page.getByTestId("maturity-table")).toBeVisible();
    await expect(
      page.getByTestId("maturity-table").locator("tbody tr")
    ).toHaveCount(site.report.maturity.totalCodeLanguages);
    await expect(page.getByTestId("maturity-table")).toContainText("pending real-repo proof");
  });

  test("win map covers all 37 benchmark languages", async ({ page }) => {
    await expect(page.getByTestId("winmap").locator("> div")).toHaveCount(
      site.report.perLanguage.length
    );
  });

  test("install commands are present verbatim", async ({ page }) => {
    // textContent, not innerText: inactive install tabs stay in the DOM
    // (hidden) so the verbatim commands are always auditable
    const text = await page.locator("#install").evaluate((el) => el.textContent);
    for (const cmd of INSTALL_COMMANDS) {
      expect(text, cmd).toContain(cmd);
    }
    // download URL tracks the released version (package.json → site-data.json)
    expect(text).toContain(`atlas_${site.version}_linux_amd64.tar.gz`);
  });

  test("nav chip shows the released version", async ({ page }) => {
    await expect(page.getByTestId("product-nav")).toContainText(`v${site.version}`);
  });

  test("evidence drawer links resolve", async ({ page, request }) => {
    const links = page.getByTestId("artifact-drawer").locator("a[download]");
    const hrefs = await links.evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    expect(hrefs.length).toBeGreaterThanOrEqual(site.artifacts.length);
    for (const href of hrefs) {
      const res = await request.get(new URL(href, baseURL).toString());
      expect(res.status(), href).toBe(200);
    }
  });

  test("published payloads carry no local paths or personal identifiers", async () => {
    const dataDir = path.join(__dirname, "..", "data");
    const files = [];
    for (const dir of [dataDir, path.join(dataDir, "raw")]) {
      for (const f of fs.readdirSync(dir)) {
        const p = path.join(dir, f);
        if (fs.statSync(p).isFile() && /\.(json|md)$/.test(f)) files.push(p);
      }
    }
    for (const p of files) {
      const text = fs.readFileSync(p, "utf8");
      for (const re of BANNED) {
        expect(re.test(text), `${path.basename(p)} matches ${re}`).toBe(false);
      }
    }
  });

  test("crawler-facing layer: static digest, structured data, robots, sitemap, llms.txt", async ({ page }) => {
    // What a no-JS crawler (GPTBot, ClaudeBot, first-pass Googlebot) receives.
    const raw = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
    expect(raw).toContain('rel="canonical"');
    expect(raw).toContain("application/ld+json");
    expect(raw).toContain('property="og:image"');
    expect(raw).toContain("Language maturity ladder");
    expect(raw).toContain(`Download v${site.version}`);
    expect(raw).toContain(String(site.report.headline.atlasF1All));
    for (const f of ["robots.txt", "sitemap.xml", "llms.txt"]) {
      expect(fs.existsSync(path.join(__dirname, "..", f)), f).toBe(true);
    }
    // and the digest actually renders without JavaScript
    const ctx = await page.context().browser().newContext({ javaScriptEnabled: false });
    const nojs = await ctx.newPage();
    await nojs.goto(baseURL, { waitUntil: "domcontentloaded" });
    await expect(nojs.locator("h1")).toHaveText("Atlas");
    await expect(nojs.locator("body")).toContainText("Product documentation");
    await expect(nojs.locator("table").first()).toBeVisible();
    await ctx.close();
  });

  test("L5 promotion panel matches the run artifact", async ({ page }) => {
    test.skip(!site.l5run, "no promotion run artifact in this payload");
    await expect(page.getByTestId("l5-promotion")).toBeVisible();
    await expect(
      page.getByTestId("l5-promotion-table").locator("tbody tr")
    ).toHaveCount(site.l5run.rows.length);
    // every promoted language renders a NEW badge chip at L5
    const promoted = site.report.maturity.promoted?.langs || [];
    const newChips = page.getByTestId("maturity-lang").filter({ hasText: "NEW" });
    await expect(newChips).toHaveCount(promoted.length);
  });

  test("no console errors on load", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => {
      if (m.type() === "error" && !/favicon/.test(m.text())) errors.push(m.text());
    });
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    expect(errors).toEqual([]);
  });
});
