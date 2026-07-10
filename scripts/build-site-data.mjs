#!/usr/bin/env node
// Build data/site-data.json — the single payload the redesigned page renders.
//
// Two evidence tiers, never blended:
//   report  the canonical July-2026 Benchmark & Field Comparison numbers
//           (real-LLM scored, 222 cells / 666 model calls, evidence-graded).
//           These are the headlines.
//   fresh   the Linux re-run of the deterministic benches (fixture-truth
//           callers F1, dimensions, gopls LSP-truth, cross-repo). These are
//           corroboration chips next to the headlines, never replacements.
//
// Everything here is public-site safe: internal repo names, handler symbols
// and local machine paths are reduced to counts, latencies and generic
// labels before they reach the payload. A leak check enforces it.
//
// Usage: node scripts/build-site-data.mjs /path/to/aziron-atlas/bench
"use strict";

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deriveAgentBench, AGENT_BENCH_ARTIFACT_ENTRY } from "./build-agent-bench-data.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const benchDir = path.resolve(process.argv[2] || process.env.ATLAS_BENCH_DIR || "");
if (!benchDir) throw new Error("Usage: node scripts/build-site-data.mjs /path/to/bench");

const readBench = (f) => JSON.parse(fs.readFileSync(path.join(benchDir, f), "utf8"));
const readData = (f) => JSON.parse(fs.readFileSync(path.join(repoRoot, "data", f), "utf8"));
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const round = (x, d = 1) => Math.round(x * 10 ** d) / 10 ** d;

/* ================= report canon — Benchmark & Field Comparison ==========
   Transcribed 1:1 from the July 2026 report. Do not "improve" these numbers
   from a local run — fresh runs corroborate, the report is the citation. */

const report = {
  label: "Benchmark & Field Comparison — July 2026",
  method: {
    scoringModel: "claude-haiku-4-5",
    sampling: "temperature 0 · 3 samples/cell · majority vote · no tools",
    cells: 222,
    modelCalls: 666,
    fixture: "per language: a function `target`, exactly 15 direct callers c01–c15, 3 decoys n01–n03 — truth by construction",
    evidenceClasses: [
      { id: "fixture-truth", desc: "constructed repos, ground truth by construction, 37 languages" },
      { id: "LSP-truth", desc: "independent language-server ground truth on a real repository" },
      { id: "perf-only", desc: "token / latency / build-time measurements, no accuracy claim" },
    ],
  },
  headline: {
    atlasF1All: 0.757, atlasTokAll: 21.2,
    atlasF1Supported: 1.0, atlasTokSupported: 27.1, supportedLangs: 28,
    graphifyF1: 0.539, graphifyTok: 96.5,
    accPerToken: 6.4, fewerTokens: 36,
  },
  // Figure 1 — every context source by accuracy vs cost (means, 37 languages)
  frontier: [
    { id: "atlas-low", label: "Atlas low", f1: 0.0, tokens: 3.2, kind: "atlas" },
    { id: "atlas-medium", label: "Atlas medium", f1: 0.673, tokens: 20.1, kind: "atlas" },
    { id: "atlas-high", label: "Atlas high", f1: 0.757, tokens: 21.2, kind: "atlas", star: true },
    { id: "atlas-xhigh", label: "Atlas xhigh", f1: 0.757, tokens: 287.8, kind: "atlas" },
    { id: "graphify", label: "Graph tool", f1: 0.539, tokens: 96.5, kind: "rival" },
    { id: "raw-file", label: "Raw file", f1: 1.0, tokens: 156.8, kind: "ceiling" },
  ],
  headlineTable: [
    { source: "atlas low", f1: 0.0, recall: 0.0, precision: 0.0, tokens: 3.2, per100: 0.0 },
    { source: "atlas medium", f1: 0.673, recall: 0.605, precision: 0.757, tokens: 20.1, per100: 3.35 },
    { source: "atlas high", f1: 0.757, recall: 0.757, precision: 0.757, tokens: 21.2, per100: 3.56 },
    { source: "atlas xhigh", f1: 0.757, recall: 0.757, precision: 0.757, tokens: 287.8, per100: 0.26 },
    { source: "graph tool", f1: 0.539, recall: 0.541, precision: 0.537, tokens: 96.5, per100: 0.56 },
    { source: "raw file (ceiling)", f1: 1.0, recall: 1.0, precision: 1.0, tokens: 156.8, per100: 0.64 },
  ],
  supported28: [
    { source: "atlas medium", f1: 0.889, tokens: 25.5, per100: 3.48 },
    { source: "atlas high", f1: 1.0, tokens: 27.1, per100: 3.69 },
    { source: "graph tool", f1: 0.605, tokens: 107.3, per100: 0.56 },
    { source: "raw file (ceiling)", f1: 1.0, tokens: 165.2, per100: 0.61 },
  ],
  detailKnob: {
    flag: "--detail low|medium|high|xhigh",
    defaultLevel: "high",
    floorNote: "Retrieval operations floor at high — an agent is never handed a truncated, and therefore wrong, caller list.",
    levels: [
      { id: "low", tokens: 3, f1: 0.0, what: "name + location stub", note: "not intended for caller retrieval" },
      { id: "medium", tokens: 20, f1: 0.67, what: "+ signatures / explained names", note: "cheapest useful answer" },
      { id: "high", tokens: 21, f1: 0.76, what: "full uncapped caller list", note: "the default — all the accuracy at 1/13th of xhigh's tokens" },
      { id: "xhigh", tokens: 288, f1: 0.76, what: "+ stable IDs, docs, scores", note: "14× the tokens for no accuracy gain — dominated by high" },
    ],
  },
  goFlagship: {
    repo: "sirupsen/logrus",
    truth: "gopls call-hierarchy (LSP-truth)",
    rows: [
      { tool: "Atlas", f1: 0.975, tokens: 169 },
      { tool: "Graph tool", f1: 0.084, tokens: 98 },
      { tool: "Raw file", f1: 0.017, tokens: 2227 },
    ],
    advantage: 12,
    why: "A production function has many more than 15 callers spread across files; summarized graph output and raw dumps both lose the LLM in noise. Atlas returns the precise, complete caller set as structured context.",
  },
  scorecard: {
    stats: [
      { label: "Answer accuracy (F1)", value: "+40%" },
      { label: "Faster queries", value: "17×" },
      { label: "Fewer query tokens", value: "36×" },
      { label: "Faster cold index", value: "2.3×" },
    ],
    rows: [
      { metric: "Answer accuracy (F1)", atlas: "0.757", graphify: "0.539", advantage: "+40%", evidence: "fixtures · 37 langs" },
      { metric: "Query latency", atlas: "7.4 ms", graphify: "128 ms", advantage: "17× faster", evidence: "real repos · 36 langs" },
      { metric: "Query tokens (per answer)", atlas: "2.6", graphify: "92.8", advantage: "36× fewer", evidence: "real repos · 36 langs" },
      { metric: "Answer context size", atlas: "21.2 tok", graphify: "96 tok", advantage: "4.5× smaller", evidence: "fixtures · 37 langs" },
      { metric: "Cold index build", atlas: "0.62 s", graphify: "1.39 s", advantage: "2.3× faster", evidence: "real repos · 36 langs" },
      { metric: "Incremental re-index", atlas: "0.10 s", graphify: "1.39 s", advantage: "14× faster", evidence: "real repos · Graphify rebuilds fully" },
      { metric: "Call edges extracted", atlas: "9,157", graphify: "1,161", advantage: "7.9× more", evidence: "real repo · typelevel/cats" },
      { metric: "Coverage vs native AST", atlas: "100.2%", graphify: "100%", advantage: "parity", evidence: "real repo · cats (tree-sitter)" },
    ],
    note: "Atlas is deterministic and LLM-free — the tool itself spends no tokens and never hallucinates. Only the agent reading its output spends tokens, and Atlas keeps that context small.",
  },
  // §09 — the whole code-intelligence stack over the 7 comparable languages
  field: [
    { tool: "atlas", type: "Atlas", langs: 7, indexS: 0.28, warmS: 0.03, oneTool: true },
    { tool: "graphify", type: "Graph tool", langs: 7, indexS: 0.76, oneTool: true },
    { tool: "clangd", type: "LSP server", langs: 2, indexS: 0.43, oneTool: false },
    { tool: "tsserver", type: "LSP server", langs: 2, indexS: 0.65, oneTool: false },
    { tool: "scip-typescript", type: "SCIP indexer", langs: 2, indexS: 1.25, oneTool: false },
    { tool: "scip-go", type: "SCIP indexer", langs: 1, indexS: 0.28, oneTool: false },
    { tool: "gopls", type: "LSP server", langs: 1, indexS: 0.65, oneTool: false },
    { tool: "pyright", type: "LSP server", langs: 1, indexS: 0.9, oneTool: false },
    { tool: "scip-python", type: "SCIP indexer", langs: 1, indexS: 2.62, oneTool: false },
    { tool: "jdtls", type: "LSP server", langs: 1, indexS: 8.83, oneTool: false },
    { tool: "scip-java", type: "SCIP indexer", langs: 1, indexS: 11.13, oneTool: false },
  ],
  fieldNote: "Matching Atlas's coverage with the accurate alternatives means running 5 separate LSP servers or 4 separate SCIP indexers. They are precise by construction and serve as the accuracy reference — Atlas's aim is to match them as one fast multi-language tool (F1 0.975 vs gopls on Go).",
  latencyAtScale: {
    meanMs: 7.4, minMs: 0.5, maxMs: 15, largestSymbols: 39161, sizeRange: 2611,
    why: "Answering `who calls X` costs proportional to the number of callers returned, not the size of the codebase — indexing absorbs scale up front.",
  },
  crossModel: {
    rows: [
      { source: "Atlas — explain high", haiku: 0.757, sonnet: 0.757, agreement: "identical" },
      { source: "Graphify", haiku: 0.539, sonnet: 0.541, agreement: "within 0.002" },
      { source: "Raw file (ceiling)", haiku: 1.0, sonnet: 1.0, agreement: "identical" },
    ],
    note: "Two independent models — one small, one large — score Atlas's high-detail context identically and rank the tools the same way: the result is a property of the context, not of any single model.",
  },
  limits: [
    "9 of 37 languages had parser gaps at report time (bash, blade, byond, ejs, objc, pascal, powershell, razor, ruby) — template/edge dialects pending native call-edge extraction. The Linux saturation run has since fixed all 9 on fixture-truth; real-repo proof is pending.",
    "On 3 gap languages the graph tool still answered — by dumping full source at ~161 tokens. Where Atlas parses a language it wins on cost and accuracy.",
    "Scoring correction disclosed: an earlier scorer under-credited the graph tool on Scala (rejected `c01()` for parentheses). The corrected scorer raised the competitor's score from 0.000 to 1.000 — the report carries the corrected number.",
  ],
  // §06 — full per-language table, nothing omitted
  perLanguage: [
    ["apex", 1, 30, 0, 52], ["astro", 1, 28, 0, 8], ["bash", 0, 4, 1, 161],
    ["blade", 0, 1, 0, 8], ["byond", 0, 1, 0, 8], ["c", 1, 27, 1, 161],
    ["cpp", 1, 27, 1, 162], ["csharp", 1, 27, 0.968, 166], ["dart", 1, 27, 0, 42],
    ["ejs", 0, 10, 0, 8], ["elixir", 1, 26, 0, 41], ["ets", 1, 28, 0, 8],
    ["fortran", 1, 26, 1, 161], ["go", 1, 27, 1, 162], ["groovy", 1, 28, 0, 8],
    ["java", 1, 27, 0.968, 166], ["javascript", 1, 27, 1, 162], ["julia", 1, 26, 1, 160],
    ["kotlin", 1, 27, 1, 162], ["lua", 1, 27, 1, 162], ["objc", 0, 1, 0, 8],
    ["pascal", 0, 3, 1, 161], ["php", 1, 27, 1, 162], ["powershell", 0, 3, 1, 162],
    ["python", 1, 27, 1, 162], ["r", 1, 27, 0, 8], ["razor", 0, 1, 0, 8],
    ["ruby", 0, 3, 0, 41], ["rust", 1, 27, 1, 162], ["scala", 1, 27, 1, 175],
    ["sql", 1, 27, 0, 8], ["svelte", 1, 28, 0, 8], ["swift", 1, 27, 1, 163],
    ["typescript", 1, 27, 1, 162], ["verilog", 1, 27, 0, 41], ["vue", 1, 26, 0, 8],
    ["zig", 1, 27, 1, 162],
  ].map(([lang, atlasF1, atlasTok, graphF1, graphTok]) => ({
    lang, atlasF1, atlasTok, graphF1, graphTok,
    status: atlasF1 === 1 ? "resolved" : "parser gap",
  })),
  // §10 — the five-level maturity ladder over the 40 code languages
  maturity: {
    totalCodeLanguages: 40,
    contentFormats: 24,
    note: "Levels reflect validation depth, not just support — an L2 language still indexes and searches; it simply has not reached verified call-graph resolution.",
    levels: [
      {
        id: "L5", name: "Reference-validated", short: "vs LSP / SCIP",
        desc: "call graph cross-checked against an LSP server or SCIP indexer",
        langs: ["c", "cpp", "go", "java", "javascript", "python", "typescript"],
      },
      {
        id: "L4", name: "Real-repo call graph", short: "who-calls proven",
        desc: "who-calls resolved and proven on a real repository",
        langs: ["apex", "astro", "csharp", "dart", "elixir", "ets", "fortran", "groovy", "julia", "kotlin", "lua", "php", "r", "rust", "scala", "sql", "svelte", "swift", "verilog", "vue", "zig"],
      },
      {
        id: "L2", name: "Real-repo tested", short: "indexes + searches",
        desc: "runs on real code; call graph not yet resolved",
        langs: ["bash", "blade", "byond", "delphi", "ejs", "objc", "pascal", "powershell", "razor", "ruby", "terraform"],
      },
      {
        id: "L1", name: "Indexed", short: "symbols extracted",
        desc: "parsed and symbols extracted",
        langs: ["p4"],
      },
    ],
    // The saturation run fixed all 9 fixture-benchmark gap languages
    // (fixture-truth F1 1.000). They are shown at L4 with an honest badge —
    // promotion completes when a real-repo call-graph run lands.
    pending: {
      toLevel: "L4",
      badge: "L4 · pending real-repo proof",
      langs: ["bash", "blade", "byond", "ejs", "objc", "pascal", "powershell", "razor", "ruby"],
      evidence: "fixture-truth F1 1.000 each on the Linux saturation run (CALLERS_F1_AFTER.json); real-repo call-graph validation not yet run",
    },
  },
};

/* ================= fresh — the Linux corroboration run ================== */

const after = readBench("CALLERS_F1_AFTER.json");
const before = readBench("CALLERS_F1_BEFORE.json");
const dims = readBench("DIMENSIONS_BENCH.json");
const lsp = readBench("LSP_F1_GO.json");
const toolsLinux = readBench("MATRIX_TOOL_VERSIONS_LINUX.json");

const dRows = dims.rows;
const gRows = dRows.filter((r) => r.graphify && r.graphify.latency_ms != null);
const atlasLat = median(dRows.map((r) => r.atlas_latency_ms));
const gfyLat = median(gRows.map((r) => r.graphify.latency_ms));

const beforePerfect = before.perfect_languages;
const fixedLangs = report.maturity.pending.langs;

// cross-repo: counts + latencies only — the workspace itself stays private
const xq = (dims.cross_repo && dims.cross_repo.queries) || {};
const xe = (dims.cross_repo && dims.cross_repo.extraction) || {};
const producerRoutes = Object.values(xe).reduce((s, r) => s + (r.producer || 0), 0);
const consumerRefs = Object.values(xe).reduce((s, r) => s + (r.consumer || 0), 0);

const fresh = {
  label: "Linux corroboration run",
  platform: (toolsLinux.platform || "Linux x86_64").replace(/\s+\S*$/, " x86_64"),
  what: "deterministic re-run of the fixture-truth, LSP-truth and cross-repo benches on independent hardware — corroborates the report, does not replace it",
  saturation: {
    perfect: after.perfect_languages,
    total: after.total_languages,
    before: beforePerfect,
    fixed: fixedLangs,
    truth: after.truth,
  },
  latency: {
    atlasMedianMs: round(atlasLat),
    graphifyMedianMs: round(gfyLat),
    ratio: round(gfyLat / atlasLat, 1),
    note: "median of 3 CLI invocations incl. process spawn, identical fixtures",
  },
  index: { medianMs: round(median(dRows.map((r) => r.index_ms))) },
  lspTruth: {
    meanF1: lsp.mean_f1,
    precision: lsp.mean_precision,
    recall: lsp.mean_recall,
    symbols: lsp.symbols_scored,
    repo: "a production Go service (private)",
    truth: "gopls call_hierarchy",
  },
  crossRepo: {
    note: "a real 2-repo workspace — a Go API server and the React app that calls it — indexed together",
    producerRoutes,
    consumerRefs,
    queries: Object.fromEntries(Object.entries(xq).map(([op, v]) => [op, { count: v.count ?? null, latencyMs: v.latency_ms ?? null }])),
    consumerRepoCount: ((xq.consumers || {}).consumer_repos || []).length,
  },
  perLanguage: dRows.map((r) => ({
    lang: r.language,
    f1: r.f1,
    graphifyF1: r.graphify ? r.graphify.f1 : null,
    atlasMs: r.atlas_latency_ms,
    graphifyMs: r.graphify ? r.graphify.latency_ms : null,
    atlasTok: r.atlas_tokens,
    graphifyTok: r.graphify ? r.graphify.tokens : null,
    indexMs: r.index_ms,
  })),
  tools: Object.entries(toolsLinux.tools || {}).map(([tool, t]) => ({
    tool, version: t.version || t.status,
  })),
};

/* ================= liveRepos — 36 real public repositories =============== */

const bm = readData("benchmark-data.json");
const liveRepos = (bm.liveBenchmarks || []).map((r) => {
  const q = r.querySummary || {};
  return {
    lang: r.language,
    repo: (r.repo || "").replace("https://github.com/", ""),
    symbols: r.atlas?.index?.symbols ?? null,
    coldS: r.atlas?.coldSeconds ?? null,
    reindexS: r.atlas?.reindexSeconds ?? null,
    coverageRatio: r.coverage?.ratio ?? null,
    queries: q.rows ?? null,
    perQueryMs: q.rows ? round(q.atlasMs / q.rows, 2) : null,
    tokenRatio: q.tokenRatio ?? null,
    latencyRatio: q.latencyRatio ?? null,
  };
}).filter((r) => r.symbols != null);

/* ============ publish sanitized fresh artifacts for the drawer ========== */

const rawDir = path.join(repoRoot, "data", "raw");
// CALLERS_F1_AFTER — fixture names only, safe as-is
fs.writeFileSync(path.join(rawDir, "CALLERS_F1_AFTER.json"), JSON.stringify(after, null, 2) + "\n");
// DIMENSIONS_BENCH — rows are fixture data; cross_repo is reduced to counts
const dimsPublic = { label: dims.label, rows: dims.rows, notes: dims.notes, cross_repo: fresh.crossRepo };
fs.writeFileSync(path.join(rawDir, "DIMENSIONS_BENCH_PUBLIC.json"), JSON.stringify(dimsPublic, null, 2) + "\n");
// LSP-truth — aggregates only; the repo and its symbols stay private
fs.writeFileSync(path.join(rawDir, "LSP_F1_SUMMARY.json"), JSON.stringify({
  truth_source: lsp.truth_source, scoring: lsp.scoring, repo: "a production Go service (private)",
  symbols_scored: lsp.symbols_scored, mean_f1: lsp.mean_f1,
  mean_precision: lsp.mean_precision, mean_recall: lsp.mean_recall,
}, null, 2) + "\n");
// Linux tool manifest — versions only, command paths dropped
fs.writeFileSync(path.join(rawDir, "MATRIX_TOOL_VERSIONS_LINUX.json"), JSON.stringify({
  platform: fresh.platform, tools: Object.fromEntries(fresh.tools.map((t) => [t.tool, t.version])),
}, null, 2) + "\n");

/* ============ agent-harness bench — from the public artifact ============ */
// Produced by scripts/build-agent-bench-data.mjs (which sanitizes the private
// AGENT_TOKEN_REPORT.json). Re-ingested here so full rebuilds keep the section.

let agentBench = null;
try {
  agentBench = deriveAgentBench(readData(path.join("raw", "AGENT_TOKEN_BENCH_PUBLIC.json")));
} catch {
  console.warn("agent bench: data/raw/AGENT_TOKEN_BENCH_PUBLIC.json missing — section omitted (run scripts/build-agent-bench-data.mjs)");
}

const artifacts = [
  { name: "benchmark-data.json", path: "data/benchmark-data.json", tier: "report", note: "full derived dataset behind the original page" },
  { name: "MATRIX_REPORT.json", path: "data/raw/MATRIX_REPORT.json", tier: "report", note: "core 7-language tool matrix" },
  { name: "SATURATION_REPORT.json", path: "data/raw/SATURATION_REPORT.json", tier: "report", note: "language saturation status" },
  { name: "GRAPHIFY_LANGUAGE_DISCOVERY.json", path: "data/raw/GRAPHIFY_LANGUAGE_DISCOVERY.json", tier: "report", note: "graphify per-language support probe" },
  { name: "CALLERS_F1_AFTER.json", path: "data/raw/CALLERS_F1_AFTER.json", tier: "fresh", note: "37/37 fixture-truth callers F1 (Linux)" },
  { name: "DIMENSIONS_BENCH_PUBLIC.json", path: "data/raw/DIMENSIONS_BENCH_PUBLIC.json", tier: "fresh", note: "per-language F1 / tokens / latency / index (Linux)" },
  { name: "LSP_F1_SUMMARY.json", path: "data/raw/LSP_F1_SUMMARY.json", tier: "fresh", note: "gopls LSP-truth aggregate (Linux)" },
  { name: "MATRIX_TOOL_VERSIONS_LINUX.json", path: "data/raw/MATRIX_TOOL_VERSIONS_LINUX.json", tier: "fresh", note: "tool pins for the Linux run" },
  { name: "site-data.json", path: "data/site-data.json", tier: "derived", note: "the exact payload this page renders" },
];
if (agentBench) artifacts.splice(artifacts.length - 1, 0, AGENT_BENCH_ARTIFACT_ENTRY);

/* ============================== emit ==================================== */

// Single source of truth for the released version: package.json. Bump it
// there when a release ships and re-run this script — the nav chip, footer
// and install URLs all follow.
const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));

const out = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  version: pkg.version,
  report,
  fresh,
  liveRepos,
  ...(agentBench ? { agentBench } : {}),
  artifacts,
};

const text = JSON.stringify(out, null, 2) + "\n";
const BANNED = [/\/Users\//, /\/home\//, /\/tmp\//, /\/root\//, /damirdarasu/, /aziron-ui/i, /aziron-pulse/i, /recallemit/i, /Msys/i];
for (const re of BANNED) {
  if (re.test(text)) throw new Error(`public payload leak: ${re}`);
}
fs.writeFileSync(path.join(repoRoot, "data", "site-data.json"), text);
console.log(
  `wrote data/site-data.json — report F1 ${report.headline.atlasF1All}@${report.headline.atlasTokAll}tok, ` +
  `fresh ${fresh.saturation.perfect}/${fresh.saturation.total} langs, ` +
  `latency ${fresh.latency.atlasMedianMs}ms vs ${fresh.latency.graphifyMedianMs}ms (${fresh.latency.ratio}×), ` +
  `gopls ${fresh.lspTruth.meanF1}, liveRepos ${liveRepos.length}, leak check CLEAN`
);
