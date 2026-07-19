#!/usr/bin/env node
// Make the site legible to crawlers that never run JavaScript.
//
// The page is a client-rendered React app: Googlebot eventually renders it,
// but LLM crawlers (GPTBot, ClaudeBot, PerplexityBot, CCBot) and most search
// engines' first-pass fetchers read raw HTML only — without this step they
// see an empty <div id="root">. This script injects, between stable markers:
//
//   index.html <head>   canonical + Open Graph + Twitter card + JSON-LD
//                       (SoftwareApplication + Dataset)
//   index.html #root    a complete static HTML digest of the benchmark story
//                       — real headings, tables and numbers. React's
//                       createRoot().render() replaces it the moment the app
//                       mounts, so humans see the live page; crawlers and
//                       no-JS readers get the full content.
//   robots.txt          allow-all (incl. AI crawlers) + sitemap pointer
//   sitemap.xml         the single canonical URL
//   llms.txt            llmstxt.org summary pointing at the raw data
//
// Idempotent: re-running replaces the marked blocks in place.
// Usage: node scripts/build-seo.mjs   (run after build-site-data.mjs)
"use strict";

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const site = JSON.parse(fs.readFileSync(path.join(repoRoot, "data", "site-data.json"), "utf8"));
const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));

const ORIGIN = "https://aziron-ai.github.io";
const BASE = `${ORIGIN}/atlas/`;
const r = site.report;
const h = r.headline;
const f = site.fresh;
const today = site.generatedAt.slice(0, 10);

const TITLE = "Atlas | Local code intelligence for developers and AI assistants";
const DESC =
  "Atlas indexes repositories locally and returns focused, source-grounded context about symbols, callers, references, routes, and change impact through CLI, MCP, and HTTP.";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ----------------------------- head block ------------------------------- */

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Atlas",
    applicationCategory: "DeveloperApplication",
    operatingSystem: "macOS, Linux, Windows",
    softwareVersion: pkg.version,
    url: BASE,
    downloadUrl: `https://github.com/aziron-ai/atlas/releases/download/v${pkg.version}/atlas_${pkg.version}_linux_amd64.tar.gz`,
    installUrl: "https://github.com/aziron-ai/atlas/releases/latest",
    description: DESC,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    publisher: { "@type": "Organization", name: "Aziron", url: "https://github.com/aziron-ai" },
  },
  {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "Atlas Benchmark & Field Comparison — July 2026",
    description:
      "Per-language code-intelligence benchmark: answer accuracy (F1), context tokens, query latency and index speed for Atlas vs a graph tool, an LSP-truth real-repository flagship, and a 40-language maturity ladder. Fixture-truth ground truth by construction; real-LLM scored (222 cells, 666 model calls).",
    url: BASE,
    isAccessibleForFree: true,
    creator: { "@type": "Organization", name: "Aziron" },
    distribution: [
      { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${BASE}data/site-data.json` },
      { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${BASE}data/raw/CALLERS_F1_AFTER.json` },
      { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${BASE}data/raw/AGENT_TOKEN_BENCH_PUBLIC.json` },
    ],
  },
];

const head = `
    <link rel="canonical" href="${BASE}">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Aziron Atlas">
    <meta property="og:title" content="${esc(TITLE)}">
    <meta property="og:description" content="${esc(DESC)}">
    <meta property="og:url" content="${BASE}">
    <meta property="og:image" content="${BASE}assets/og.png">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${esc(TITLE)}">
    <meta name="twitter:description" content="${esc(DESC)}">
    <meta name="twitter:image" content="${BASE}assets/og.png">
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
`;

/* ------------------------- static content digest ------------------------ */

const langLabel = (v) => ({ cpp: "C++", javascript: "JavaScript", typescript: "TypeScript", objc: "Objective-C", csharp: "C#", ejs: "EJS", ets: "ETS", sql: "SQL", php: "PHP", r: "R", c: "C", powershell: "PowerShell", p4: "P4", byond: "BYOND" }[v] || v.charAt(0).toUpperCase() + v.slice(1));

const pendingSet = new Set(r.maturity.pending.langs);
const maturityRows = r.maturity.levels
  .map((lv) => {
    const langs = lv.langs.map((l) => (pendingSet.has(l) && lv.id === "L2" ? null : esc(langLabel(l)))).filter(Boolean);
    const extra = lv.id === "L4" ? r.maturity.pending.langs.map((l) => `${esc(langLabel(l))} (pending real-repo proof)`) : [];
    return `<tr><td>${lv.id} — ${esc(lv.name)}</td><td>${esc(lv.desc)}</td><td>${[...langs, ...extra].join(", ")}</td></tr>`;
  })
  .join("\n          ");

const scorecardRows = r.scorecard.rows
  .map((row) => `<tr><td>${esc(row.metric)}</td><td>${esc(row.atlas)}</td><td>${esc(row.graphify)}</td><td>${esc(row.advantage)}</td><td>${esc(row.evidence)}</td></tr>`)
  .join("\n          ");

// agent-harness bench digest — present only when the section has shipped
const ab = site.agentBench;
const MODE_LABELS = { atlas: "Atlas", graphify: "Graph tool", baseline: "No tool (raw exploration)" };
const agentBenchBlock = !ab ? "" : `
        <h2>What a real agent actually spends — ${esc(ab.label)}</h2>
        <p>Claude Code and OpenAI Codex, run headless in ${esc(ab.repo)} (@${esc(ab.commit7)}) and restricted to one
           code-intelligence CLI per run; token numbers are each harness's own usage accounting over
           ${ab.nQuestions} caller questions with ${esc(ab.truth)}. ${esc(ab.caveat)}</p>
        <table>
          <thead><tr><th>Agent</th><th>Context source</th><th>Mean total tokens</th><th>Mean tool calls</th><th>Mean F1</th></tr></thead>
          <tbody>
          ${ab.agents.map((a) =>
            ab.cells.filter((c) => c.agent === a.id)
              .map((c) => `<tr><td>${esc(a.id)} (${esc(a.model || "default")})</td><td>${esc(MODE_LABELS[c.mode] || c.mode)}</td><td>${c.totalTokens?.toLocaleString("en-US") ?? "—"}</td><td>${c.turns ?? "—"}</td><td>${c.f1?.toFixed(3) ?? "—"}</td></tr>`)
              .join("\n          ")
          ).join("\n          ")}
          </tbody>
        </table>
        <p>Reproducible from any machine: the suite ships in
           <a href="https://github.com/aziron-ai/atlas/tree/main/agent-bench">agent-bench/</a> (pinned commit, frozen
           gopls question set, isolation flags baked in); per-run records in
           <a href="data/raw/AGENT_TOKEN_BENCH_PUBLIC.json">AGENT_TOKEN_BENCH_PUBLIC.json</a>.</p>`;

const knobRows = r.detailKnob.levels
  .map((lv) => `<tr><td>--detail ${lv.id}${lv.id === r.detailKnob.defaultLevel ? " (default)" : ""}</td><td>${esc(lv.what)}</td><td>${lv.tokens}</td><td>${lv.f1.toFixed(2)}</td></tr>`)
  .join("\n          ");

const body = `
      <div class="shell" style="padding:48px 0 64px;max-width:820px">
        <h1>Atlas</h1>
        <p>${esc(DESC)}</p>
        <p><a href="https://github.com/aziron-ai/atlas">GitHub</a> ·
           <a href="https://github.com/aziron-ai/atlas/releases/latest">Download v${pkg.version}</a> ·
           <a href="data/site-data.json">Benchmark data (JSON)</a></p>

        <h2>Get started</h2>
        <p>Install with <code>brew install --cask aziron-ai/atlas/atlas</code> or
           <code>npm install -g @aziron/atlas</code>. Then run <code>atlas index .</code>,
           inspect readiness with <code>atlas status</code>, and preview assistant setup with
           <code>atlas bootstrap --dry-run</code>.</p>

        <h2>Product documentation</h2>
        <ul>
          <li><a href="#docs/getting-started">Getting started</a> — first index, query, and assistant connection.</li>
          <li><a href="#docs/installation">Installation</a> — Homebrew, npm, archives, and Linux packages.</li>
          <li><a href="#docs/indexing">Indexing and reindexing</a> — freshness, watch mode, and recovery.</li>
          <li><a href="#docs/cli">CLI reference</a> — search, symbols, relationships, impact, and routes.</li>
          <li><a href="#docs/assistants">AI assistant setup</a> and <a href="#docs/mcp">MCP tools</a>.</li>
          <li><a href="#docs/troubleshooting">Troubleshooting</a>, privacy, configuration, and upgrades.</li>
        </ul>

        <h2>Headline results — ${esc(r.label)}</h2>
        <ul>
          <li>Atlas F1 ${h.atlasF1All} at ${h.atlasTokAll} context tokens, mean across all 37 languages (fixture-truth, real-LLM scored, ${r.method.cells} cells / ${r.method.modelCalls} model calls).</li>
          <li>F1 ${h.atlasF1Supported.toFixed(3)} at ${h.atlasTokSupported} tokens on the ${h.supportedLangs} fully-supported languages — full-file-dump accuracy at 6.1× fewer tokens.</li>
          <li>Graph-tool comparison: ${h.graphifyF1} F1 at ${Math.round(h.graphifyTok)} tokens — Atlas delivers ${h.accPerToken}× the accuracy per token and ${h.fewerTokens}× fewer query tokens.</li>
          <li>Real repository (${esc(r.goFlagship.repo)}, gopls call-hierarchy ground truth): Atlas F1 0.975 vs graph tool 0.084 vs raw file 0.017.</li>
          <li>Query latency ~${r.latencyAtScale.meanMs} ms, flat from 15 to ${r.latencyAtScale.largestSymbols.toLocaleString("en-US")} symbols across 36 real repositories.</li>
          <li>Corroborated by an independent Linux re-run: ${f.saturation.perfect}/${f.saturation.total} languages fixture-perfect, ${f.latency.ratio}× faster queries than the graph tool, gopls-truth F1 ${f.lspTruth.meanF1.toFixed(3)}.</li>
        </ul>

        <h2>Atlas vs Graphify — scorecard</h2>
        <table>
          <thead><tr><th>Metric</th><th>Atlas</th><th>Graphify</th><th>Advantage</th><th>Evidence</th></tr></thead>
          <tbody>
          ${scorecardRows}
          </tbody>
        </table>
${agentBenchBlock}
        <h2>The --detail knob</h2>
        <p>${esc(r.detailKnob.floorNote)}</p>
        <table>
          <thead><tr><th>Level</th><th>What the agent sees</th><th>Tokens</th><th>F1</th></tr></thead>
          <tbody>
          ${knobRows}
          </tbody>
        </table>

        <h2>Language maturity ladder — ${r.maturity.totalCodeLanguages} code languages</h2>
        <p>${esc(r.maturity.note)} Atlas also indexes ~${r.maturity.contentFormats} content formats (JSON, YAML, HTML, PDF, …) for search.</p>
        <table>
          <thead><tr><th>Level</th><th>Meaning</th><th>Languages</th></tr></thead>
          <tbody>
          ${maturityRows}
          </tbody>
        </table>

        <h2>Install</h2>
        <p>Homebrew: <code>brew install --cask aziron-ai/atlas/atlas</code> ·
           npm: <code>npm install -g @aziron/atlas</code> ·
           Linux: <a href="https://github.com/aziron-ai/atlas/releases/latest">tar.gz / .deb / .rpm / .apk from releases</a>.
           Then <code>atlas index .</code> and <code>atlas mcp --transport stdio</code> for agents.</p>
        <p>Every number above is reproducible from the committed artifacts under <a href="data/">data/</a>.
           This static digest is replaced by the interactive page when JavaScript is available.</p>
      </div>
`;

/* ------------------------------ inject ---------------------------------- */

const idx = path.join(repoRoot, "index.html");
let html = fs.readFileSync(idx, "utf8");

const inject = (text, startMark, endMark, payload, anchorRe) => {
  const block = `${startMark}${payload}    ${endMark}`;
  const re = new RegExp(`${startMark}[\\s\\S]*?${endMark}`);
  if (re.test(text)) return text.replace(re, block);
  return text.replace(anchorRe, (m) => `${m}\n    ${block}`);
};

html = inject(html, "<!-- seo-head:start -->", "<!-- seo-head:end -->", head, /<meta name="color-scheme"[^>]*>/);
html = inject(html, "<!-- seo-body:start -->", "<!-- seo-body:end -->", body, /<div id="root">/);
fs.writeFileSync(idx, html);

/* --------------------------- crawler files ------------------------------ */

fs.writeFileSync(path.join(repoRoot, "robots.txt"), `# Atlas product documentation and benchmark evidence.
# Public benchmark data lives under /atlas/data/.
User-agent: *
Allow: /

User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: CCBot
Allow: /

Sitemap: ${BASE}sitemap.xml
`);

fs.writeFileSync(path.join(repoRoot, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${BASE}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
  </url>
</urlset>
`);

fs.writeFileSync(path.join(repoRoot, "llms.txt"), `# Atlas - local code intelligence

> Atlas is a local code-intelligence CLI: one native binary that indexes a
> repository into a SQLite symbol and relationship graph and answers focused context queries
> (definition, callers, callees, imports, routes) in ~${r.latencyAtScale.meanMs} ms and ~${h.atlasTokAll} tokens.
> Benchmark (July 2026, real-LLM scored, 37 languages): Atlas F1 ${h.atlasF1All} @ ${h.atlasTokAll} tokens vs
> graph tool ${h.graphifyF1} @ ${Math.round(h.graphifyTok)} tokens — ${h.accPerToken}× accuracy per token, ${h.fewerTokens}× fewer tokens.
> Real-repo (gopls ground truth): Atlas F1 0.975 vs graph tool 0.084. ${r.maturity.totalCodeLanguages} code languages on a
> five-level maturity ladder. Version ${pkg.version}.

## Benchmark data
- [site-data.json](${BASE}data/site-data.json): the full payload the page renders — headline table, efficiency frontier, detail knob, maturity ladder, scorecard, per-language results
- [CALLERS_F1_AFTER.json](${BASE}data/raw/CALLERS_F1_AFTER.json): 37/37 fixture-truth callers F1 (Linux corroboration run)
- [DIMENSIONS_BENCH_PUBLIC.json](${BASE}data/raw/DIMENSIONS_BENCH_PUBLIC.json): per-language F1 / tokens / latency / index speed
- [LSP_F1_SUMMARY.json](${BASE}data/raw/LSP_F1_SUMMARY.json): gopls LSP-truth aggregate
- [AGENT_TOKEN_BENCH_PUBLIC.json](${BASE}data/raw/AGENT_TOKEN_BENCH_PUBLIC.json): end-to-end token usage of real agent harnesses (Claude Code, OpenAI Codex) with Atlas vs graph tool vs no tool — reproducible via agent-bench/ in the GitHub repo

## Project
- [Product documentation](${BASE}#docs/getting-started): install, index, query, configure, connect, troubleshoot, and upgrade
- [Benchmark & comparison](${BASE}#benchmarks): interactive version of the published evidence
- [GitHub repository](https://github.com/aziron-ai/atlas): releases (macOS, Linux, Windows), issues
- [GitHub Wiki](https://github.com/aziron-ai/atlas/wiki): mirror of the consumer product guide
- [npm package](https://www.npmjs.com/package/@aziron/atlas): \`npm install -g @aziron/atlas\`
`);

/* ------------------------------ verify ---------------------------------- */

const finalHtml = fs.readFileSync(idx, "utf8");
for (const probe of ["seo-head:start", "seo-body:start", "application/ld+json", "canonical", "maturity ladder"]) {
  if (!finalHtml.toLowerCase().includes(probe.toLowerCase())) throw new Error(`index.html missing: ${probe}`);
}
const BANNED = [/\/Users\//, /\/home\//, /\/tmp\//, /damirdarasu/, /aziron-ui/i, /aziron-pulse/i];
for (const p of ["index.html", "robots.txt", "sitemap.xml", "llms.txt"]) {
  const t = fs.readFileSync(path.join(repoRoot, p), "utf8");
  for (const re of BANNED) if (re.test(t)) throw new Error(`${p} leak: ${re}`);
}
console.log(`seo layer written: index.html digest (${Math.round(body.length / 1024)}kb), robots.txt, sitemap.xml, llms.txt — v${pkg.version}, ${today}`);
