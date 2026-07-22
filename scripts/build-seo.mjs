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

/* --------------------- docs: indexable static pages --------------------- */
// The interactive docs live at hash routes (#docs/<slug>) that search engines
// cannot index as distinct URLs. To make each guide separately discoverable we
// render a real HTML page per doc under /atlas/docs/<slug>/ from the consumer
// markdown in content/docs/. Content mirrors the GitHub Wiki guide.

const DOCS = [
  { slug: "getting-started", title: "Getting Started", desc: "Create a local Atlas index, run the first cited queries, and connect an AI coding assistant." },
  { slug: "installation", title: "Installation", desc: "Install Atlas via Homebrew, npm, release archives, or native Linux packages, then verify it." },
  { slug: "concepts", title: "Core Concepts", desc: "The Atlas mental model: the code knowledge graph, snapshots, workspace resolution, output control, and the CLI, HTTP, and MCP surfaces." },
  { slug: "indexing", title: "Indexing and Reindexing", desc: "Keep the Atlas index fresh: incremental updates, watch mode, exclusions, and recovery." },
  { slug: "cli", title: "CLI Reference", desc: "Atlas command-line reference: search, symbols, relationships, impact, routes, and maintenance." },
  { slug: "assistants", title: "AI Assistant Setup", desc: "Connect Claude, Codex, and other MCP-compatible assistants to Atlas." },
  { slug: "mcp", title: "MCP Tools", desc: "Atlas MCP tools that give coding assistants bounded, cited code context." },
  { slug: "service", title: "Dashboard and HTTP API", desc: "Run the local Atlas dashboard and the HTTP / MCP service." },
  { slug: "configuration", title: "Configuration", desc: "Configure Atlas limits, storage location, and runtime behavior." },
  { slug: "privacy", title: "Privacy and Data Handling", desc: "How Atlas stores repository intelligence locally and what stays on your machine." },
  { slug: "languages", title: "Supported Languages and Formats", desc: "Languages and formats Atlas indexes, with capability levels." },
  { slug: "benchmarks", title: "Benchmarks and Methodology", desc: "How to read and reproduce the published Atlas benchmark evidence." },
  { slug: "troubleshooting", title: "Troubleshooting", desc: "Diagnose stale, missing, or incomplete Atlas results." },
  { slug: "upgrade", title: "Upgrade and Uninstall", desc: "Update Atlas safely, or remove it and its local data." },
];

// Wiki page name -> doc slug, for rewriting the guides' internal links.
const WIKI_TO_SLUG = {
  "Getting-Started": "getting-started", "Installation": "installation",
  "Indexing-and-Reindexing": "indexing", "CLI-Reference": "cli", "Core-Concepts": "concepts",
  "AI-Assistant-Setup": "assistants", "MCP-Tools": "mcp",
  "Dashboard-and-HTTP-API": "service", "Configuration": "configuration",
  "Privacy-and-Data-Handling": "privacy", "Supported-Languages": "languages",
  "Benchmarks-and-Methodology": "benchmarks", "Troubleshooting": "troubleshooting",
  "Upgrade-and-Uninstall": "upgrade",
};
const slugSet = new Set(DOCS.map((d) => d.slug));

const rewriteHref = (href) => {
  if (/^https?:\/\//.test(href) || href.startsWith("#") || href.startsWith("mailto:")) return href;
  if (href === "Home") return `${BASE}`;
  if (WIKI_TO_SLUG[href]) return `../${WIKI_TO_SLUG[href]}/`;
  if (slugSet.has(href)) return `../${href}/`;
  return href;
};

// Inline markdown: operate on already HTML-escaped text (markers survive escaping).
const inline = (t) =>
  esc(t)
    .replace(/`([^`]+)`/g, (_m, c) => `<code>${c}</code>`)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, txt, href) => `<a href="${esc(rewriteHref(href))}">${txt}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

// Block markdown -> HTML for the constructs the guides use.
function mdToHtml(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let i = 0;
  const flushList = (buf) => { if (buf.length) { out.push(`<ul>${buf.map((li) => `<li>${inline(li)}</li>`).join("")}</ul>`); buf.length = 0; } };
  const listBuf = [];
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {                                   // fenced code
      flushList(listBuf);
      const code = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) { code.push(lines[i]); i++; }
      i++;
      out.push(`<pre><code>${esc(code.join("\n"))}</code></pre>`);
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      flushList(listBuf);                                      // table
      const cells = (row) => row.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const header = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { rows.push(cells(lines[i])); i++; }
      out.push(`<table><thead><tr>${header.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${rows.map((rw) => `<tr>${rw.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
      continue;
    }
    const hm = line.match(/^(#{1,4})\s+(.*)$/);
    if (hm) { flushList(listBuf); const n = hm[1].length; out.push(`<h${n}>${inline(hm[2])}</h${n}>`); i++; continue; }
    if (/^\s*[-*]\s+/.test(line)) { listBuf.push(line.replace(/^\s*[-*]\s+/, "")); i++; continue; }
    if (line.trim() === "") { flushList(listBuf); i++; continue; }
    // paragraph: gather until blank line
    flushList(listBuf);
    const para = [line];
    i++;
    while (i < lines.length && lines[i].trim() !== "" && !/^(#{1,4}\s|```|\s*[-*]\s|\s*\|)/.test(lines[i])) { para.push(lines[i]); i++; }
    out.push(`<p>${inline(para.join(" "))}</p>`);
  }
  flushList(listBuf);
  return out.join("\n");
}

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
        <p>Install with <code>brew install --cask aziron-ai/atlas/atlas</code> or from the public
           npm registry with <code>npm install -g @aziron/atlas</code>. The
           <a href="docs/installation/">installation guide</a> also covers the authenticated
           GitHub Packages coordinate.
           Then run <code>atlas index .</code>,
           inspect readiness with <code>atlas status</code>, and preview assistant setup with
           <code>atlas bootstrap --dry-run</code>.</p>

        <h2>Product documentation</h2>
        <ul>
          <li><a href="docs/getting-started/">Getting started</a> — first index, query, and assistant connection.</li>
          <li><a href="docs/installation/">Installation</a> — Homebrew, npm, archives, and Linux packages.</li>
          <li><a href="docs/indexing/">Indexing and reindexing</a> — freshness, watch mode, and recovery.</li>
          <li><a href="docs/cli/">CLI reference</a> — search, symbols, relationships, impact, and routes.</li>
          <li><a href="docs/assistants/">AI assistant setup</a> and <a href="docs/mcp/">MCP tools</a>.</li>
          <li><a href="docs/troubleshooting/">Troubleshooting</a>, <a href="docs/privacy/">privacy</a>, <a href="docs/configuration/">configuration</a>, and <a href="docs/upgrade/">upgrades</a>.</li>
          <li><a href="docs/">Browse all documentation →</a></li>
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

const sitemapUrls = [
  `  <url>\n    <loc>${BASE}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>`,
  ...DOCS.map((d) => `  <url>\n    <loc>${BASE}docs/${d.slug}/</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>`),
];
fs.writeFileSync(path.join(repoRoot, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls.join("\n")}
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
- [GitHub Packages](https://github.com/aziron-ai/atlas/pkgs/npm/atlas): authenticated alternative \`@aziron-ai/atlas\`
`);

/* --------------------- per-doc indexable pages -------------------------- */

const DOC_CSS = `
  :root { color-scheme:light; --bg:#f9fafb; --panel:#fff; --raised:#f3f5f7; --text:#111827; --muted:#64748b; --line:#e2e8f0; --primary:#2563eb; --link:#0284c7; --shadow:0 1px 2px rgba(15,23,42,.06),0 1px 3px rgba(15,23,42,.08); }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--text); font:16px/1.65 Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
  .wrap { max-width:820px; margin:0 auto; padding:0 20px 72px; }
  a { color:var(--link); } a:hover { text-decoration:underline; }
  header.site { border-bottom:1px solid var(--line); position:sticky; top:0; background:rgba(255,255,255,.92); backdrop-filter:blur(12px); box-shadow:0 1px 2px rgba(15,23,42,.05); }
  header.site .row { max-width:820px; margin:0 auto; padding:12px 20px; display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
  .brand { display:inline-flex; align-items:center; gap:8px; font-weight:700; color:var(--text); text-decoration:none; }
  .mark { width:24px; height:24px; border-radius:6px; background:var(--primary); color:#fff; display:grid; place-items:center; font-weight:800; }
  nav.crumbs { color:var(--muted); font-size:14px; }
  nav.crumbs a { color:var(--muted); }
  .open-app { margin-left:auto; font-size:14px; border:1px solid var(--line); padding:6px 12px; border-radius:8px; text-decoration:none; color:var(--text); }
  main { padding-top:8px; }
  article h1 { font-size:2rem; line-height:1.2; margin:28px 0 8px; }
  article h2 { font-size:1.35rem; margin:34px 0 10px; padding-top:8px; border-top:1px solid var(--line); }
  article h3 { font-size:1.1rem; margin:24px 0 8px; }
  article code { background:#eef2f7; border:1px solid var(--line); padding:.12em .38em; border-radius:5px; font-size:.9em; }
  article pre { background:var(--raised); border:1px solid var(--line); border-radius:10px; padding:14px 16px; overflow:auto; box-shadow:var(--shadow); }
  article pre code { background:none; padding:0; }
  article table { width:100%; border-collapse:collapse; margin:16px 0; font-size:.95em; display:block; overflow-x:auto; }
  article th, article td { border:1px solid var(--line); padding:8px 10px; text-align:left; vertical-align:top; }
  article th { background:#f8fafc; }
  .doclist { display:flex; flex-wrap:wrap; gap:8px 16px; padding:14px 0; border-top:1px solid var(--line); margin-top:40px; font-size:14px; }
  .prevnext { display:flex; justify-content:space-between; gap:16px; margin-top:24px; font-size:14px; }
  footer.site { color:var(--muted); font-size:13px; border-top:1px solid var(--line); margin-top:40px; padding-top:16px; }
`;

const docsNav = DOCS.map((d) => `<a href="../${d.slug}/">${esc(d.title)}</a>`).join("\n        ");

const docPage = (doc, idx) => {
  const md = fs.readFileSync(path.join(repoRoot, "content", "docs", `${doc.slug}.md`), "utf8");
  const bodyHtml = mdToHtml(md);
  const url = `${BASE}docs/${doc.slug}/`;
  const prev = idx > 0 ? DOCS[idx - 1] : null;
  const next = idx < DOCS.length - 1 ? DOCS[idx + 1] : null;
  const ld = [
    { "@context": "https://schema.org", "@type": "TechArticle", headline: doc.title, description: doc.desc, url, inLanguage: "en",
      isPartOf: { "@type": "WebSite", name: "Aziron Atlas", url: BASE },
      publisher: { "@type": "Organization", name: "Aziron", url: "https://github.com/aziron-ai" }, dateModified: today },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Atlas", item: BASE },
      { "@type": "ListItem", position: 2, name: "Documentation", item: `${BASE}docs/` },
      { "@type": "ListItem", position: 3, name: doc.title, item: url },
    ] },
  ];
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(doc.title)} — Atlas documentation</title>
  <meta name="description" content="${esc(doc.desc)}">
  <meta name="robots" content="index,follow,max-image-preview:large">
  <meta name="color-scheme" content="light">
  <link rel="icon" href="../../assets/og.png" type="image/png">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Aziron Atlas">
  <meta property="og:title" content="${esc(doc.title)} — Atlas">
  <meta property="og:description" content="${esc(doc.desc)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${BASE}assets/og.png">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(doc.title)} — Atlas">
  <meta name="twitter:description" content="${esc(doc.desc)}">
  <meta name="twitter:image" content="${BASE}assets/og.png">
  <script type="application/ld+json">${JSON.stringify(ld)}</script>
  <style>${DOC_CSS}</style>
</head>
<body>
  <header class="site">
    <div class="row">
      <a class="brand" href="${BASE}"><span class="mark">A</span> ATLAS</a>
      <nav class="crumbs" aria-label="Breadcrumb"><a href="${BASE}">Home</a> / <a href="${BASE}docs/">Docs</a> / ${esc(doc.title)}</nav>
      <a class="open-app" href="${BASE}#docs/${doc.slug}">Open interactive docs →</a>
    </div>
  </header>
  <main class="wrap">
    <article>
${bodyHtml}
    </article>
    <nav class="prevnext">
      <span>${prev ? `<a href="../${prev.slug}/">← ${esc(prev.title)}</a>` : ""}</span>
      <span>${next ? `<a href="../${next.slug}/">${esc(next.title)} →</a>` : ""}</span>
    </nav>
    <nav class="doclist" aria-label="All documentation">
        ${docsNav}
    </nav>
    <footer class="site">
      Atlas v${pkg.version} · <a href="${BASE}">product site</a> · <a href="https://github.com/aziron-ai/atlas">GitHub</a> · <a href="https://github.com/aziron-ai/atlas/wiki">Wiki</a>.
      This page mirrors the interactive documentation for search engines and AI assistants.
    </footer>
  </main>
</body>
</html>
`;
};

DOCS.forEach((doc, idx) => {
  const dir = path.join(repoRoot, "docs", doc.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), docPage(doc, idx));
});

// docs hub
const docsIndex = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Documentation — Atlas</title>
  <meta name="description" content="Atlas product documentation: install, index, query, connect an AI assistant, configure, troubleshoot, and upgrade.">
  <meta name="robots" content="index,follow">
  <meta name="color-scheme" content="light">
  <link rel="canonical" href="${BASE}docs/">
  <link rel="icon" href="../assets/og.png" type="image/png">
  <style>${DOC_CSS}</style>
</head>
<body>
  <header class="site"><div class="row">
    <a class="brand" href="${BASE}"><span class="mark">A</span> ATLAS</a>
    <nav class="crumbs"><a href="${BASE}">Home</a> / Docs</nav>
    <a class="open-app" href="${BASE}#docs/getting-started">Open interactive docs →</a>
  </div></header>
  <main class="wrap">
    <article>
      <h1>Atlas documentation</h1>
      <p>Local code intelligence for developers and AI coding assistants. Install Atlas, index a repository, and return focused, source-grounded context through the CLI, MCP, and a local HTTP service.</p>
      <ul>
        ${DOCS.map((d) => `<li><a href="${d.slug}/">${esc(d.title)}</a> — ${esc(d.desc)}</li>`).join("\n        ")}
      </ul>
    </article>
    <footer class="site">Atlas v${pkg.version} · <a href="${BASE}">product site</a> · <a href="https://github.com/aziron-ai/atlas">GitHub</a> · <a href="https://github.com/aziron-ai/atlas/wiki">Wiki</a>.</footer>
  </main>
</body>
</html>
`;
fs.writeFileSync(path.join(repoRoot, "docs", "index.html"), docsIndex);

/* -------------------------- llms-full.txt ------------------------------- */
// Full-content dump for AI crawlers/agents that ingest a single file.
const llmsFull = `# Atlas — full documentation for LLMs

> Atlas is a local code-intelligence CLI: one native binary that indexes a
> repository into a SQLite symbol and relationship graph and answers focused
> context queries (definition, callers, callees, imports, routes) in
> ~${r.latencyAtScale.meanMs} ms and ~${h.atlasTokAll} tokens. Benchmark (July 2026, real-LLM
> scored, 37 languages): Atlas F1 ${h.atlasF1All} @ ${h.atlasTokAll} tokens vs graph tool
> ${h.graphifyF1} @ ${Math.round(h.graphifyTok)} tokens. Version ${pkg.version}.
>
> This file inlines the complete consumer documentation. Canonical HTML pages
> live at ${BASE}docs/<slug>/ ; the interactive site is at ${BASE}.

- Product site: ${BASE}
- Benchmarks: ${BASE}#benchmarks
- GitHub: https://github.com/aziron-ai/atlas
- Wiki: https://github.com/aziron-ai/atlas/wiki
- npm: https://www.npmjs.com/package/@aziron/atlas
- GitHub Packages: https://github.com/aziron-ai/atlas/pkgs/npm/atlas

${DOCS.map((d) => {
  const md = fs.readFileSync(path.join(repoRoot, "content", "docs", `${d.slug}.md`), "utf8").trim();
  return `\n---\n\n# ${d.title}\nURL: ${BASE}docs/${d.slug}/\n\n${md}`;
}).join("\n")}
`;
fs.writeFileSync(path.join(repoRoot, "llms-full.txt"), llmsFull);

/* ------------------------------ verify ---------------------------------- */

const finalHtml = fs.readFileSync(idx, "utf8");
for (const probe of ["seo-head:start", "seo-body:start", "application/ld+json", "canonical", "maturity ladder"]) {
  if (!finalHtml.toLowerCase().includes(probe.toLowerCase())) throw new Error(`index.html missing: ${probe}`);
}
const docFiles = DOCS.map((d) => `docs/${d.slug}/index.html`);
const BANNED = [/\/Users\//, /\/home\//, /\/tmp\//, /damirdarasu/, /aziron-ui/i, /aziron-pulse/i];
for (const p of ["index.html", "robots.txt", "sitemap.xml", "llms.txt", "llms-full.txt", "docs/index.html", ...docFiles]) {
  const t = fs.readFileSync(path.join(repoRoot, p), "utf8");
  for (const re of BANNED) if (re.test(t)) throw new Error(`${p} leak: ${re}`);
}
// every doc page must carry its canonical + real content
for (const d of DOCS) {
  const t = fs.readFileSync(path.join(repoRoot, "docs", d.slug, "index.html"), "utf8");
  if (!t.includes(`canonical" href="${BASE}docs/${d.slug}/"`)) throw new Error(`doc ${d.slug}: missing canonical`);
  if (!/<article>[\s\S]*<h1>[\s\S]*<\/article>/.test(t)) throw new Error(`doc ${d.slug}: missing article/h1`);
}
if (!fs.readFileSync(path.join(repoRoot, "llms-full.txt"), "utf8").includes("# Installation")) throw new Error("llms-full.txt missing doc content");
console.log(`seo layer written: index.html digest (${Math.round(body.length / 1024)}kb), ${DOCS.length} doc pages, docs/ hub, robots.txt, sitemap.xml (${DOCS.length + 1} urls), llms.txt, llms-full.txt — v${pkg.version}, ${today}`);
