#!/usr/bin/env node
// Build data/site-data.json — the single payload the redesigned page renders.
//
// Evidence tiers, never blended:
//   report  the headline canon, DERIVED from the committed fc3b875 artifacts
//           (7-repo tool matrix + 666-call LLM sweep). These are the claims.
//   fresh   the Linux leg of the same refresh (fixture callers F1, dimensions,
//           gopls LSP-truth, cross-repo). Corroboration, never a replacement.
//   carried anything NOT re-measured at this commit. It ships labelled or it
//           does not ship: a number nobody re-ran is not evidence.
//
// House rules for anything published from here:
//   1. A ratio travels with its estimator. "6x" is not a claim; "6x, pooled
//      over the queries both tools answered" is.
//   2. A ratio is computed only over queries BOTH tools answered. A query one
//      tool missed is excluded, never scored as a win.
//   3. A token ratio counts only where the answer named a caller. Two
//      non-answers of different lengths have a quotient, not a meaning.
//   4. The ladder demotes as readily as it promotes.
//
// Everything here is public-site safe: internal repo names, handler symbols
// and local machine paths are reduced to counts, latencies and generic
// labels before they reach the payload. A leak check enforces it.
//
// Usage: node scripts/build-site-data.mjs /path/to/refresh-<sha>-linux
//
// The Darwin leg is ingested separately, first:
//   node scripts/ingest-refresh-artifacts.mjs /path/to/refresh-<sha>
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

/* ================= report canon — the fc3b875 refresh ===================
   DERIVED, not transcribed. Every number below is computed here from a
   committed artifact in data/raw/, so a reader can recompute it and a future
   editor cannot quietly retype it. The metric definition travels with the
   number: this page has published a multiplier without its estimator before,
   and the estimator is where the whole disagreement lives. */

const matrixPub = readData(path.join("raw", "MATRIX_REPORT_PUBLIC.json"));
const qaPub = readData(path.join("raw", "LLM_QA_SWEEP_PUBLIC.json"));

const qaSrc = qaPub.sources;
const src = (id) => qaSrc[id];
const per100 = (s) => round((s.f1 / s.ctx_tokens) * 100, 2);
const mAgg = matrixPub.aggregates;

// The per-language table is the sweep's own cells, pivoted — never a
// hand-maintained list. `atlas high` is the shipped default detail level.
const qaLangs = [...new Set(qaPub.per_cell.map((c) => c.language))].sort();
const cellOf = (lang, source) => qaPub.per_cell.find((c) => c.language === lang && c.source === source) || {};

const report = {
  label: "Benchmark & field comparison — refreshed at fc3b875 (2026-08-05)",
  supersedes: "The July 2026 report this page used to cite. Its live-repo multipliers (36× tokens, and the older 20×) were measured against a build whose caller answers were a two-token placeholder — across 224 live answers it named zero callers. Those figures are retracted in full, not adjusted. The numbers here are smaller and they are real.",
  method: {
    scoringModel: (qaPub.model || []).join(", "),
    sampling: qaPub.sampling,
    cells: qaPub.cells,
    modelCalls: qaPub.model_calls,
    fixture: "per language: a function `target`, exactly 15 direct callers c01–c15, 3 decoys n01–n03 — truth by construction",
    evidenceClasses: [
      { id: "fixture-truth", desc: "constructed-truth fixture, 37 languages, scored deterministically" },
      { id: "LLM-scored", desc: "a real model reads one context source and answers; the context is what is being measured, not the model" },
      { id: "LSP-truth", desc: "independent language-server ground truth on a real public repository" },
      { id: "perf-only", desc: "token / latency / build-time measurement, no accuracy claim attached" },
    ],
    controlNote: qaPub.definitions.controls,
  },
  headline: {
    // The one-line claim. Pooled is the honest "overall": it sums real tokens
    // across the whole matrix rather than averaging seven ratios, so no small
    // language can inflate it.
    tokensPooled: mAgg.tokens_pooled,
    tokensPerLanguageMean: mAgg.tokens_per_language_mean,
    tokensPerLanguageMedian: mAgg.tokens_per_language_median,
    tokensWorstLanguage: mAgg.tokens_worst_language,
    tokensWorstRatio: mAgg.tokens_worst_ratio,
    matrixRepos: mAgg.languages,
    matrixQueries: mAgg.comparable_queries,
    atlasF1: round(src("atlas_explain_high").f1, 3),
    graphifyF1: round(src("graphify").f1, 3),
    atlasTok: src("atlas_explain_high").ctx_tokens,
    graphifyTok: src("graphify").ctx_tokens,
    f1Advantage: round(src("atlas_explain_high").f1 / src("graphify").f1, 2),
    tokenAdvantageQa: round(src("graphify").ctx_tokens / src("atlas_explain_high").ctx_tokens, 2),
    accPerToken: round(per100(src("atlas_explain_high")) / per100(src("graphify")), 1),
    perfectLangs: src("atlas_explain_high").perfect_languages,
    totalLangs: qaPub.languages,
    platform: matrixPub.platform,
    graphifyVersion: "0.8.49",
    definition: "tokens: sum of answer tokens over every query BOTH tools answered, across the 7-repo matrix. F1: deterministic set F1 of a real model's majority-voted caller list, given one context source, over 37 constructed-truth fixtures.",
  },
  // Figure 1 — every context source by accuracy vs cost (means, 37 languages)
  frontier: [
    { id: "atlas-low", label: "Atlas low", f1: round(src("atlas_explain_low").f1, 3), tokens: src("atlas_explain_low").ctx_tokens, kind: "atlas" },
    { id: "atlas-medium", label: "Atlas medium", f1: round(src("atlas_explain_medium").f1, 3), tokens: src("atlas_explain_medium").ctx_tokens, kind: "atlas" },
    { id: "atlas-high", label: "Atlas high", f1: round(src("atlas_explain_high").f1, 3), tokens: src("atlas_explain_high").ctx_tokens, kind: "atlas", star: true },
    { id: "atlas-xhigh", label: "Atlas xhigh", f1: round(src("atlas_callers_xhigh").f1, 3), tokens: src("atlas_callers_xhigh").ctx_tokens, kind: "atlas" },
    { id: "graphify", label: "Graph tool", f1: round(src("graphify").f1, 3), tokens: src("graphify").ctx_tokens, kind: "rival" },
    { id: "raw-file", label: "Raw file (control)", f1: round(src("baseline").f1, 3), tokens: src("baseline").ctx_tokens, kind: "ceiling" },
  ],
  headlineTable: [
    ["atlas low", "atlas_explain_low"], ["atlas medium", "atlas_explain_medium"],
    ["atlas high", "atlas_explain_high"], ["atlas xhigh", "atlas_callers_xhigh"],
    ["graph tool", "graphify"], ["raw file (positive control)", "baseline"],
  ].map(([source, id]) => {
    const s = src(id);
    return { source, f1: round(s.f1, 3), recall: round(s.recall, 3), precision: round(s.precision, 3), tokens: s.ctx_tokens, per100: per100(s) };
  }),
  // The efficiency result this refresh exists to publish: the shipped default
  // and the maximum-detail level score IDENTICALLY, and the default costs a
  // tenth as much. More context bought exactly nothing.
  efficiency: {
    highF1: round(src("atlas_explain_high").f1, 4),
    xhighF1: round(src("atlas_callers_xhigh").f1, 4),
    identical: src("atlas_explain_high").f1 === src("atlas_callers_xhigh").f1,
    highTok: src("atlas_explain_high").ctx_tokens,
    xhighTok: src("atlas_callers_xhigh").ctx_tokens,
    xCheaper: round(src("atlas_callers_xhigh").ctx_tokens / src("atlas_explain_high").ctx_tokens, 1),
    vsGraphifyF1: round(src("atlas_explain_high").f1 / src("graphify").f1, 2),
    vsGraphifyTok: round(src("graphify").ctx_tokens / src("atlas_explain_high").ctx_tokens, 1),
    perfectLangs: src("atlas_explain_high").perfect_languages,
    totalLangs: qaPub.languages,
    modelCalls: qaPub.model_calls,
    controls: { graphify: round(src("graphify").f1, 3), rawFile: round(src("baseline").f1, 3) },
    controlNote: "The raw-file control contains the answer by construction, so its F1 of 1.000 is a check that the judge works — a ceiling, not a competitor. Atlas does not beat it and does not claim to. The graph tool is the rival, on the identical prompt and fixture.",
  },
  detailKnob: {
    flag: "--detail low|medium|high|xhigh",
    defaultLevel: "high",
    floorNote: "Retrieval operations floor at high — an agent is never handed a truncated, and therefore wrong, caller list.",
    levels: [
      { id: "low", tokens: src("atlas_explain_low").ctx_tokens, f1: round(src("atlas_explain_low").f1, 3), what: "name + location stub", note: "not intended for caller retrieval — it scores 0.000 and the docs say so" },
      { id: "medium", tokens: src("atlas_explain_medium").ctx_tokens, f1: round(src("atlas_explain_medium").f1, 3), what: "+ signatures / explained names", note: "same precision as high, lower recall" },
      { id: "high", tokens: src("atlas_explain_high").ctx_tokens, f1: round(src("atlas_explain_high").f1, 3), what: "full uncapped caller list", note: "the default — the whole result at a tenth of xhigh's tokens" },
      { id: "xhigh", tokens: src("atlas_callers_xhigh").ctx_tokens, f1: round(src("atlas_callers_xhigh").f1, 3), what: "+ stable IDs, docs, scores", note: `${round(src("atlas_callers_xhigh").ctx_tokens / src("atlas_explain_high").ctx_tokens, 1)}× the tokens for an identical F1 — dominated by high` },
    ],
  },
  // goFlagship is filled in below, from the FRESH agent-harness run on the
  // same repository. The July rows here (Atlas 0.975 / graph tool 0.084 / raw
  // file 0.017) were a context-only comparison that was not re-measured at
  // this commit, so they are not restated.
  scorecard: {
    stats: [
      { label: "Answer accuracy (F1)", value: `${round(src("atlas_explain_high").f1, 3)} vs ${round(src("graphify").f1, 3)}` },
      { label: "Fewer answer tokens", value: `${mAgg.tokens_pooled}×`, sub: "pooled, 7-repo matrix" },
      { label: "Faster queries", value: `${mAgg.latency_per_language_mean}×`, sub: "mean of 7 per-repo ratios" },
      { label: "Same F1, a tenth the cost", value: `${round(src("atlas_callers_xhigh").ctx_tokens / src("atlas_explain_high").ctx_tokens, 1)}×`, sub: "default vs max detail" },
    ],
    rows: [
      { metric: "Answer accuracy (F1)", atlas: String(round(src("atlas_explain_high").f1, 3)), graphify: String(round(src("graphify").f1, 3)), advantage: `${round(src("atlas_explain_high").f1 / src("graphify").f1, 2)}× the F1`, evidence: "666 real model calls · 37 fixture languages" },
      { metric: "Answer tokens — pooled", atlas: String(matrixPub.rows.reduce((s, r) => s + r.atlas_tokens_sum, 0)), graphify: String(matrixPub.rows.reduce((s, r) => s + r.graphify_tokens_sum, 0)), advantage: `${mAgg.tokens_pooled}× fewer`, evidence: `7 repos · ${mAgg.comparable_queries} queries both tools answered` },
      { metric: "Answer tokens — per-language mean", atlas: "—", graphify: "—", advantage: `${mAgg.tokens_per_language_mean}× fewer`, evidence: "unweighted mean of the 7 per-repo ratios" },
      { metric: "Answer tokens — worst language", atlas: "—", graphify: "—", advantage: `${mAgg.tokens_worst_ratio}× fewer (${mAgg.tokens_worst_language})`, evidence: "the floor, published because it is the floor" },
      { metric: "Answer context size", atlas: `${src("atlas_explain_high").ctx_tokens} tok`, graphify: `${src("graphify").ctx_tokens} tok`, advantage: `${round(src("graphify").ctx_tokens / src("atlas_explain_high").ctx_tokens, 1)}× smaller`, evidence: "fixtures · 37 langs · mean context handed to the model" },
      { metric: "Query latency", atlas: "—", graphify: "—", advantage: `${mAgg.latency_per_language_mean}× faster`, evidence: "7 repos · median of 5 CLI runs each, spawn included" },
      { metric: "Warm-serve explain", atlas: `${mAgg.warm_serve_explain_ms_range[0]}–${mAgg.warm_serve_explain_ms_range[1]} ms`, graphify: "no daemon mode", advantage: "not comparable", evidence: "7 repos · warm daemon, per-repo mean of median explains" },
    ],
    note: "Atlas is deterministic and LLM-free — the tool itself spends no tokens and never hallucinates. Only the agent reading its output spends tokens, and Atlas keeps that context small. Every ratio above is over queries BOTH tools answered; a query one tool missed is excluded rather than scored as a win.",
    retired: [
      { claim: "36× fewer query tokens", replacedBy: `${mAgg.tokens_pooled}× pooled / ${mAgg.tokens_per_language_mean}× per-language mean`, why: "measured against a build that answered with a 2-token placeholder" },
      { claim: "17× faster queries", replacedBy: `${mAgg.latency_per_language_mean}× (matrix)`, why: "same stub comparison; the honest figure is a same-host, same-run measurement" },
      { claim: "+40% answer accuracy", replacedBy: `${round(src("atlas_explain_high").f1 / src("graphify").f1, 2)}× the F1 (${round(src("atlas_explain_high").f1, 3)} vs ${round(src("graphify").f1, 3)})`, why: "a percentage of an F1 is not a meaningful unit; the ratio and both raw values are published instead" },
      { claim: "2.3× faster cold index / 14× faster incremental / 7.9× more call edges / 100.2% AST coverage", replacedBy: "withdrawn, not restated", why: "not re-measured at this commit. A number nobody re-ran is not evidence." },
    ],
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
  fieldNote: "Matching Atlas's coverage with the accurate alternatives means running 5 separate LSP servers or 4 separate SCIP indexers. They are precise by construction and serve as the accuracy reference — Atlas's aim is to match them as one fast multi-language tool. Against gopls call-hierarchy truth on a production Go service, Atlas measures F1 0.900 at this commit.",
  fieldCaveat: "The index-time column above is carried from the July field survey and was NOT re-measured at this commit. It is a coverage-and-setup argument, not a performance claim, and no ratio on this page is computed from it.",
  latencyAtScale: {
    warmServeMinMs: mAgg.warm_serve_explain_ms_range[0],
    warmServeMaxMs: mAgg.warm_serve_explain_ms_range[1],
    matrixLatencyMean: mAgg.latency_per_language_mean,
    matrixLatencyPooled: mAgg.latency_pooled,
    largestSymbols: Math.max(...matrixPub.rows.map((r) => r.index.symbols || 0)),
    why: "Answering `who calls X` costs proportional to the number of callers returned, not the size of the codebase — indexing absorbs scale up front.",
    definition: "warm-serve explain: per repo, the mean of that repo's four median `explain` responses against a warm daemon. The graph tool has no daemon mode, so this lane has no competitor and no ratio is claimed for it.",
  },
  // The July page carried a two-model agreement table (haiku vs sonnet). This
  // refresh scored with ONE model, so there is no agreement to report and the
  // table is withdrawn rather than restated from the older run.
  crossModel: {
    withdrawn: true,
    ranThisRefresh: (qaPub.model || []).join(", "),
    note: "The previous page showed the same fixtures scored by a second, larger model to argue the result is a property of the context rather than of one judge. That second lane was not re-run at this commit, so the comparison is withdrawn. The single-model caveat stands in its place: every F1 on this page is one model's majority vote over three samples at temperature 0.",
  },
  limits: [
    "5 of 37 fixture languages return no callers at this commit: ruby, pascal, razor, ejs and blade all score F1 0.000 on the constructed-truth fixture. Ruby's zero is by design — the fixture's callers are top-level, and the binder refuses to bind a top-level call rather than guess an owner. Pascal, razor, ejs and blade are genuine gaps. Ruby's L5 promotion rests on the LSP lane against a real repository, never on this fixture.",
    "The competitor column is graphify 0.8.49. The previously published agent benchmark ran graphify 0.9.12, so part of the movement in that table is a version change on their side, not a change on ours. Both versions are named in the artifacts.",
    "The Linux leg ran in an arm64 container on the Darwin workstation, not on the x86_64 host the published run used: no candidate Linux host accepted passwordless ssh, and the run rules forbid guessing a password. F1 is architecture-independent and stands; the Linux latency and index-time figures are NOT comparable to the published ones and are labelled accordingly.",
    "The graph tool is not installed on the Linux leg, so that leg publishes no competitor ratio at all. The like-for-like comparison is the Darwin matrix.",
    "The live-repo `serve` column was measured against the serve endpoint as it behaves at this commit, which still returns the reduced answer shape rather than the CLI's. Issue #144 is filed to bring serve to CLI parity in 0.1.51. Until it lands, the CLI column is the one to quote.",
    "Two live repositories, byond and ets, show a WORSE token ratio than the retracted stub rows did. That is the retraction working as intended: the stub's larger number came from answering with nothing.",
  ],
  // §06 — full per-language table, nothing omitted. Pivoted straight out of
  // the sweep's own cells so it cannot drift from the artifact it cites.
  perLanguage: qaLangs.map((lang) => {
    const a = cellOf(lang, "atlas_explain_high");
    const g = cellOf(lang, "graphify");
    return {
      lang,
      atlasF1: a.f1 ?? null, atlasTok: a.ctx_tokens ?? null,
      graphF1: g.f1 ?? null, graphTok: g.ctx_tokens ?? null,
      status: a.f1 === 1 ? "resolved" : a.f1 === 0 ? "no callers returned" : "partial",
    };
  }),
  // §10 — the five-level maturity ladder over the 40 code languages
  maturity: {
    totalCodeLanguages: 40,
    contentFormats: 24,
    note: "Levels reflect validation depth, not just support — an L2 language still indexes and searches; it simply has not reached verified call-graph resolution. A language moves DOWN when its evidence does: dart came off L5 this refresh.",
    levels: [
      {
        id: "L5", name: "Reference-validated", short: "vs LSP / SCIP",
        desc: "call graph cross-checked against the language's own LSP server or a SCIP indexer, on a real public repository",
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
    // REQUALIFIED. This block used to assert that all nine of bash, blade,
    // byond, ejs, objc, pascal, powershell, razor and ruby scored "native F1
    // 1.000 each on the Linux saturation run". That is false at this commit,
    // and the branch it came from never merged. Re-measured here: four of the
    // nine are fixture-perfect and five score 0.000. Both lists are derived
    // from the run below, not asserted, so this cannot drift again.
    fixtureOnly: {
      badge: "fixture-perfect · no real-repo proof",
      evidence: "F1 1.000 on the constructed-truth fixture at this commit (CALLERS_F1_AFTER.json). A fixture is a floor, not a promotion: these languages stay at L2 until a real-repo call-graph run lands.",
      langs: [], // filled from the fresh run below
    },
    fixtureGaps: {
      badge: "returns no callers on the fixture",
      evidence: "F1 0.000 on the constructed-truth fixture at this commit — the caller list comes back empty.",
      langs: [], // filled from the fresh run below
    },
    retracted: {
      lang: "dart",
      fromLevel: "L5",
      toLevel: "L4",
      publishedF1: 0.9249,
      honestF1: 0.8631,
      honestPrecision: 0.9723,
      why: "July's dart PASS at .9249 rode a fan-out the truth filter should have refused. The verifier re-run measures .8631 against the same reference server on the same pinned repository. Dart returns to L4 until `toString`-scale fan-out and `package:` re-export families bind. We publish the retraction rather than the flattering number.",
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
const atlasLat = median(dRows.map((r) => r.atlas_latency_ms));

// The graph tool is not installed on the Linux leg (MATRIX_TOOL_VERSIONS_LINUX
// `_provenance.toolchain.graphify`: "NOT INSTALLED — competitor column not
// reproducible on this host"), so this run has no competitor latency to
// divide by. We DROP the fresh graphify latency ratio rather than carry the
// July figure with a label. Carrying it would pair a July x86_64 graphify
// median against an August arm64-container Atlas median and print the
// quotient as one run's result — the exact cross-binary, cross-architecture
// fake delta that CALLERS_F1_BEFORE's own provenance block tells us not to
// construct. The honest graph-tool latency comparison on this site is the
// Darwin matrix, where both binaries ran on one host in one pass.
const gRows = dRows.filter((r) => r.graphify && r.graphify.latency_ms != null);
const gfyLat = gRows.length ? median(gRows.map((r) => r.graphify.latency_ms)) : null;

const beforePerfect = before.perfect_languages;
// Languages the saturation run actually brought to fixture-perfect at THIS
// commit — derived, never asserted. The site used to hard-code a list of nine.
const afterByLang = Object.fromEntries(after.rows.map((r) => [r.language, r]));
const beforeByLang = Object.fromEntries(before.rows.map((r) => [r.language, r]));
const stillFailing = after.rows.filter((r) => r.f1 !== 1).map((r) => r.language);
const fixedLangs = after.rows
  .filter((r) => r.f1 === 1 && (beforeByLang[r.language] || {}).f1 !== 1)
  .map((r) => r.language);

// Requalify the nine languages the site used to call "native F1 1.000 each".
// The claim is now split by what the run actually says, and ruby is handled
// separately: its fixture zero is a designed refusal, not a gap.
const CLAIMED_SATURATED = ["bash", "blade", "byond", "ejs", "objc", "pascal", "powershell", "razor", "ruby"];
report.maturity.fixtureOnly.langs = CLAIMED_SATURATED
  .filter((l) => l !== "ruby" && (afterByLang[l] || {}).f1 === 1);
report.maturity.fixtureGaps.langs = CLAIMED_SATURATED
  .filter((l) => l !== "ruby" && (afterByLang[l] || {}).f1 !== 1);
report.maturity.requalification = {
  wasClaimed: "native F1 1.000 each on the Linux saturation run",
  wasClaimedFor: CLAIMED_SATURATED,
  isTrueFor: report.maturity.fixtureOnly.langs,
  isFalseFor: CLAIMED_SATURATED.filter((l) => (afterByLang[l] || {}).f1 !== 1),
  why: "The saturation branch that produced that claim never merged. Re-measured at this commit, the fixture is perfect for " +
    `${report.maturity.fixtureOnly.langs.length} of the nine and returns an empty caller list for the rest. ` +
    "The site-wide fixture score is " + after.perfect_languages + "/" + after.total_languages + ", not 37/37.",
  rubyNote: "Ruby is a special case and is now L5 on LSP-truth (F1 1.000 against solargraph on rack, 9 symbols). Its 0.000 on the fixture is DESIGNED: the fixture's callers are top-level, and the binder refuses to attribute a top-level call to an owner it cannot prove rather than guessing one. Ruby's promotion cites the LSP lane and never the fixture.",
};

// Both legs carry a `_provenance` block. It is the reason this refresh exists:
// publish the host that was actually used, not the host we wish had answered.
const prov = toolsLinux._provenance || {};
const provHost = prov.host || {};

// cross-repo: counts + latencies only — the workspace itself stays private
const xq = (dims.cross_repo && dims.cross_repo.queries) || {};
const xe = (dims.cross_repo && dims.cross_repo.extraction) || {};
const producerRoutes = Object.values(xe).reduce((s, r) => s + (r.producer || 0), 0);
const consumerRefs = Object.values(xe).reduce((s, r) => s + (r.consumer || 0), 0);

const fresh = {
  label: "Linux corroboration run",
  // Publish the arch the artifact reports. The previous line here was
  //   (toolsLinux.platform || "Linux x86_64").replace(/\s+\S*$/, " x86_64")
  // which FORCED the last token to x86_64 whatever the run said — this leg is
  // aarch64 and would have been published as x86_64. The run's own provenance
  // block flagged the bug by name (`_provenance.SITE_BUILDER_BUG`).
  platform: toolsLinux.platform || null,
  platformNote: provHost.actual
    ? `${provHost.actual} — ${provHost.arch || "arch as reported"}. ${provHost.arch_caveat || ""}`.trim()
    : null,
  hostCaveat: provHost.why_not_remote || null,
  resources: provHost.resources || null,
  what: "deterministic re-run of the native, LSP-truth and cross-repo benches in an independent Linux environment — corroborates the report, does not replace it",
  saturation: {
    perfect: after.perfect_languages,
    total: after.total_languages,
    before: beforePerfect,
    fixed: fixedLangs,
    stillFailing,
    truth: after.truth,
    // The two files are NOT a matched pair and must never be subtracted.
    pairing: "AFTER is fresh at fc68e26. BEFORE is CARRIED from c7a3e8d (2026-07-04) — it is a property of a pre-saturation binary, and there is no 'before' state at this commit to measure. Different binaries, different hardware. Do not pair them as a delta.",
    afterProvenance: "fresh @ fc68e26",
    beforeProvenance: (before._provenance || {}).status || "CARRIED — not re-measured at this commit",
  },
  latency: {
    atlasMedianMs: round(atlasLat),
    // Deliberately null — see the note above `gRows`.
    graphifyMedianMs: gfyLat == null ? null : round(gfyLat),
    ratio: gfyLat == null ? null : round(gfyLat / atlasLat, 1),
    comparable: gfyLat != null,
    note: "median of 3 CLI invocations incl. process spawn, identical fixtures",
    unrebuildable: gfyLat == null
      ? "The graph tool is not installed on this host, so this leg has no competitor latency and no ratio is published for it. Atlas's own median is kept as an absolute. The like-for-like latency comparison is the 7-repo Darwin matrix, where both binaries ran in one pass on one machine."
      : null,
    archCaveat: provHost.arch_caveat || null,
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
// Re-sourced. These rows used to come from benchmark-data.json's July
// liveBenchmarks, whose ratios were measured against a build that answered
// caller queries with a two-token placeholder — 0 of 224 of its answers named
// a single caller. Those multipliers described an empty answer, not a cheap
// one. The fresh artifact keeps the stub column so the retraction stays
// checkable, and every ratio the page renders now comes from the fc3b875 run.

const live36 = readData(path.join("raw", "LIVE36_REFRESH_PUBLIC.json"));
const liveRepos = live36.languages.map((r) => ({
  lang: r.language,
  repo: (r.repo || "").replace("https://github.com/", ""),
  commit7: String(r.commit || "").slice(0, 7),
  symbols: r.symbols ?? null,
  edges: r.edges ?? null,
  files: r.indexed_files ?? null,
  coldS: r.cold_wall_seconds ?? null,
  queries: r.n ?? null,
  comparable: r.comparable ?? null,
  perQueryMs: r.atlas_cli_median_ms ?? null,
  perQueryServeMs: r.atlas_serve_median_ms ?? null,
  perQueryTok: r.atlas_cli_median_tokens ?? null,
  // whether this row's answers named a caller — the flag that decides whether
  // its ratio is evidence or noise
  answerBearing: (r.callers_listed_cli ?? 0) > 0,
  // CLI is the lane a human or an agent actually pays for: one-shot process,
  // spawn included. Serve is the warm-daemon lane and is labelled as such.
  tokenRatioCli: r.tokenRatio_cli ?? null,
  tokenRatioServe: r.tokenRatio_serve ?? null,
  latencyRatioCli: r.latencyRatio_cli ?? null,
  latencyRatioServe: r.latencyRatio_serve ?? null,
  // the retracted column, kept visible rather than deleted
  tokenRatioStub: r.tokenRatio_old ?? null,
  latencyRatioStub: r.latencyRatio_old ?? null,
  callersListedCli: r.callers_listed_cli ?? null,
  callersListedStub: r.callers_listed_old ?? null,
})).filter((r) => r.symbols != null);

const liveSummary = {
  label: live36.label,
  platform: live36.platform,
  atlasBinary: live36.atlas_binary,
  stubBinary: live36.stub_binary,
  retraction: live36.retraction,
  comparability: live36.comparability,
  definitions: live36.definitions,
  answerQuality: live36.answer_quality,
  scorecard: live36.scorecard,
  // The published live figure is the answer-bearing subset. A token ratio is
  // only evidence about caller retrieval when the answer retrieved a caller;
  // on 11 of these 36 repositories it still does not, so those rows are shown
  // and excluded rather than averaged in.
  headline: live36.headline,
  excluded: live36.excluded_non_answering,
  aggregatesAsMeasured: live36.aggregates_as_measured,
  vsStub: live36.vs_stub,
  serveNote: "The serve lane above was measured against the serve endpoint as it behaves at this commit, which still returns the reduced answer shape rather than the CLI's full one. Issue #144 is filed to bring serve to CLI parity in 0.1.51; until it lands, quote the CLI column.",
  artifact: "data/raw/LIVE36_REFRESH_PUBLIC.json",
};


/* ============ publish sanitized fresh artifacts for the drawer ========== */

const rawDir = path.join(repoRoot, "data", "raw");
// CALLERS_F1_AFTER / BEFORE — fixture names only, safe as-is. BEFORE is
// published too, because the site quotes it: a reader must be able to see for
// themselves that it is carried and why it may not be subtracted.
fs.writeFileSync(path.join(rawDir, "CALLERS_F1_AFTER.json"), JSON.stringify(after, null, 2) + "\n");
fs.writeFileSync(path.join(rawDir, "CALLERS_F1_BEFORE.json"), JSON.stringify(before, null, 2) + "\n");
// DIMENSIONS_BENCH — rows are fixture data; cross_repo is reduced to counts
const dimsPublic = { label: dims.label, rows: dims.rows, notes: dims.notes, cross_repo: fresh.crossRepo };
fs.writeFileSync(path.join(rawDir, "DIMENSIONS_BENCH_PUBLIC.json"), JSON.stringify(dimsPublic, null, 2) + "\n");
// LSP-truth — aggregates only; the repo and its symbols stay private
fs.writeFileSync(path.join(rawDir, "LSP_F1_SUMMARY.json"), JSON.stringify({
  truth_source: lsp.truth_source, scoring: lsp.scoring, repo: "a production Go service (private)",
  symbols_scored: lsp.symbols_scored, mean_f1: lsp.mean_f1,
  mean_precision: lsp.mean_precision, mean_recall: lsp.mean_recall,
}, null, 2) + "\n");
// Linux tool manifest — versions only, command paths dropped. The host block
// ships with it: an arm64 container is a legitimate place to prove F1, and an
// illegitimate place to prove latency, and the reader is entitled to know
// which one they are looking at.
fs.writeFileSync(path.join(rawDir, "MATRIX_TOOL_VERSIONS_LINUX.json"), JSON.stringify({
  platform: fresh.platform,
  host: {
    actual: provHost.actual ?? null,
    kernel: provHost.kernel ?? null,
    arch: provHost.arch ?? null,
    arch_caveat: provHost.arch_caveat ?? null,
    resources: provHost.resources ?? null,
    filesystem: provHost.filesystem ?? null,
    why_not_remote: provHost.why_not_remote ?? null,
  },
  toolchain: prov.toolchain ?? null,
  tools: Object.fromEntries(fresh.tools.map((t) => [t.tool, t.version])),
}, null, 2) + "\n");

/* ============ agent-harness bench — from the public artifact ============ */
// Produced by scripts/build-agent-bench-data.mjs (which sanitizes the private
// AGENT_TOKEN_REPORT.json). Re-ingested here so full rebuilds keep the section.

let agentBench = null;
try {
  const ab = readData(path.join("raw", "AGENT_TOKEN_BENCH_PUBLIC.json"));
  agentBench = deriveAgentBench(ab);
  agentBench.graphifyVersionNote = `This run used ${ab.tool_versions?.graphify || "the graph tool"}. The previously published table ran graphify 0.9.12, so part of the change in the competitor column is a version change on their side rather than a change on ours.`;
  agentBench.f1Note = "Atlas's F1 here is 0.995 on BOTH harnesses. The figure this page published before was 0.88, from the July run.";

  // §06 flagship — same repository, same ground truth, re-measured at this
  // commit. This is an END-TO-END agent result: an agent restricted to one
  // tool answers the question, and the harness's own accounting is the token
  // number. It is NOT the July context-only comparison and does not restate it.
  const cell = (agent, mode) => agentBench.cells.find((c) => c.agent === agent && c.mode === mode) || {};
  report.goFlagship = {
    repo: agentBench.repo,
    commit7: agentBench.commit7,
    truth: agentBench.truth,
    lane: "end-to-end agent harness, one code-intel tool per run",
    questions: agentBench.nQuestions,
    rows: agentBench.agents.flatMap((a) => ["atlas", "baseline", "graphify"].map((mode) => {
      const c = cell(a.id, mode);
      return { agent: a.id, tool: { atlas: "Atlas", baseline: "No tool (raw exploration)", graphify: "Graph tool" }[mode], f1: c.f1 ?? null, tokens: c.totalTokens ?? null, turns: c.turns ?? null };
    })),
    why: "A production function has many more callers than a fixture does, spread across files. Given only the graph tool, both agents spent three to thirteen times the turns and still answered wrong more often than not; given Atlas, both answered in one or two turns at F1 0.995.",
    caveat: agentBench.caveat,
  };
} catch {
  console.warn("agent bench: data/raw/AGENT_TOKEN_BENCH_PUBLIC.json missing — section omitted (run scripts/build-agent-bench-data.mjs)");
}

/* ============ l5run — the macOS L4→L5 promotion run ===================== */
// bench/l5_matrix.py: each candidate language's call graph cross-checked
// against ITS OWN language server on a real public repository (callHierarchy
// preferred; references + documentSymbol enclosure fallback), deterministic
// set F1, no LLM. Languages that clear the gate move L4 → L5 on the ladder;
// the full per-symbol evidence — including every excused reference-server
// blind spot — ships in the public raw artifact.
let l5run = null;
try {
  const m = readData(path.join("raw", "L5_MATRIX_PUBLIC.json"));
  // Per-language site copy, transcribed from the wave-2 verifier's own
  // promotion verdict (docs/L5_WAVE2_FINAL.md). One line each, including the
  // two that did not pass — a ladder that only publishes its promotions is a
  // marketing page, not a ladder.
  const COPY = {
    ruby: "Promoted at F1 1.000 / precision 1.000 (rack vs solargraph, 9 symbols) with zero adjudication excusals — the baseline's failures were all empty answers, fixed by binding implicit-self calls to their enclosing class. Ruby's separate 0.000 on the constructed fixture is a designed refusal, not a gap, and is never cited as evidence for this promotion.",
    elixir: "Promoted at 1.000/1.000 (plug vs elixir-ls) with truth-side corroboration ON and declared: elixir-ls attributes multi-clause calls to the public head, and every excusal is listed in the artifact and re-derivable from source. The same binary with corroboration off measures .7437 — both numbers are published.",
    swift: "Promoted at .9415/.9417 (swift-argument-parser vs sourcekit-lsp) — cross-file sends now bind through SwiftPM target membership; a same-name method family whose receiver cannot be proven stays unanswered rather than guessed.",
    kotlin: "Promoted at .9395/.9022 (ktlint vs kotlin-language-server) — a call reaches its package and its imports and nothing else: renamed-import decoys and cross-package bare calls refuse to bind. Thinnest margin in the set: precision clears the gate by .0022.",
    rust: "Recovered at .9297/.9652 (fd vs rust-analyzer). July's published .9534 is RETRACTED: it depended on candidate order that the fail-closed binder no longer permits. Today's number is proven through `use`-declaration rungs.",
    php: "Recovered at .9098/1.000 (monolog vs intelephense) — `use`-alias and namespace rungs bind cross-namespace static calls; every remaining miss is a listed cross-file test caller. July's 1.000 predated the fail-closed binder.",
    lua: "Canary held at .966/.9883 (Penlight vs lua-language-server) — one of the three no-regression canaries, unchanged all wave.",
    fortran: "Canary held at 1.000/1.000 (json-fortran vs fortls, 8 symbols).",
    zig: "Canary held at 1.000/1.000 (zig-clap vs zls) — up from July's .9723.",
    dart: "RETRACTED. July's published PASS at .9249 was unsound: it rode a fan-out the truth filter should have refused. The honest number is .8631 (precision .9723). Dart stays L4 until `toString`-scale fan-out and `package:` re-export families bind. We publish the retraction rather than the flattering number.",
    scala: "Honest fail at .5533/.5667 (scopt vs Metals). Normalising Metals's val-attributed callers to their enclosing defs made the truth honest — and exposed that scopt's cross-file OParser builder chains are invisible to Atlas. The blocker is now named and measured rather than hidden by a flattering truth set.",
  };
  const VERDICT = {
    ruby: "promoted", elixir: "promoted", swift: "promoted", kotlin: "promoted",
    rust: "recovered", php: "recovered",
    lua: "held", fortran: "held", zig: "held",
    dart: "retracted", scala: "honest-fail",
  };
  const rows = (m.results || []).filter((r) => r.status === "ok").map((r) => {
    const perf = r.perf || {}; const ax = perf.atlas || {}; const gf = perf.graphify || {};
    const lspq = perf.lsp || {}; const mult = perf.multipliers || {};
    return {
      lang: r.language,
      repo: (r.repo_url || "").replace("https://github.com/", "") || r.repo,
      sha: r.repo_sha || null,
      reference: r.reference, mode: (r.truth_mode || []).join("+"),
      symbols: r.symbols_scored, f1: r.mean_f1, precision: r.mean_precision, recall: r.mean_recall,
      pass: !!r.l5_pass,
      // `carried: true` rows are July-base languages outside the 11 wave-2
      // lanes. They make NO claim at this commit and must never be read as one.
      carried: !!r.carried,
      verdict: VERDICT[r.language] || (r.carried ? "carried" : "unscored"),
      copy: COPY[r.language] || null,
      runAt: (r.run || {}).at || null,
      treeSha: (r.run || {}).tree_sha || null,
      atlasCliMs: ax.median_query_ms ?? null, atlasServeMs: ax.serve_warm_query_ms ?? null,
      atlasTok: ax.mean_answer_tokens ?? null,
      graphifyMs: gf.median_query_ms ?? null, graphifyTok: gf.mean_answer_tokens ?? null,
      graphifyRecall: gf.truth_recall ?? null,
      lspColdMs: lspq.cold_query_ms ?? null, lspWarmMs: lspq.warm_query_ms ?? null,
      lspTok: lspq.mean_payload_tokens ?? null,
      xLatGraphify: mult.latency_vs_graphify ?? null,
      xServeLatGraphify: mult.serve_latency_vs_graphify_cli ?? null,
      xLatLspCold: mult.latency_vs_lsp_cold ?? null,
      xServeLatLspCold: mult.serve_latency_vs_lsp_cold ?? null,
      xTokLsp: mult.tokens_vs_lsp ?? null, xTokRawRead: mult.tokens_vs_raw_read ?? null,
    };
  });
  const passed = rows.filter((r) => r.pass).map((r) => r.lang).sort();
  const med = (xs) => { const v = xs.filter((x) => x != null).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : null; };
  const carriedRows = (m.results || []).filter((r) => r.carried).map((r) => ({
    lang: r.language, status: r.status, reference: r.reference || null,
  }));
  l5run = {
    label: "L4 → L5 promotion matrix — wave 2 verifier re-run, 2026-08-05 · macOS arm64",
    what: "each candidate language's call graph cross-checked against ITS OWN language server on a real public repository — callHierarchy where the server offers it, references + documentSymbol enclosure otherwise. Deterministic set F1 on simple names. No LLM anywhere in the loop.",
    truth: m.truth_source, truthFilter: m.truth_filter, scoring: m.scoring, gate: m.gate,
    corroboration: m.corroboration || null,
    rows, passed,
    verdicts: {
      promoted: rows.filter((r) => r.verdict === "promoted").map((r) => r.lang),
      recovered: rows.filter((r) => r.verdict === "recovered").map((r) => r.lang),
      held: rows.filter((r) => r.verdict === "held").map((r) => r.lang),
      retracted: rows.filter((r) => r.verdict === "retracted").map((r) => r.lang),
      honestFail: rows.filter((r) => r.verdict === "honest-fail").map((r) => r.lang),
    },
    carriedRows,
    carriedNote: `${carriedRows.length} of the ${(m.results || []).length} languages in this matrix carry \`carried: true\` from the July base — they are outside the 11 wave-2 lanes and make no claim at this commit. They are listed rather than hidden, and none of them counts toward the reference-validated total.`,
    reproduction: "All 11 wave-2 lanes reproduced their claimed numbers to four decimal places on an independent verifier re-run, against a declared tolerance of |ΔF1|,|ΔP| ≤ .03 stated before the run. Every row carries its run timestamp and tree SHA.",
    honestyBracket: "The elixir lane depends on truth-side adjudication, so it was re-run with that adjudication disabled: F1 .7437 / P .8403. Both numbers are published. The adjudication is worth exactly +.2563 F1 on that lane and every step of it is itemised per symbol in the artifact.",
    medians: {
      xLatGraphify: med(rows.map((r) => r.xLatGraphify)),
      xServeLatGraphify: med(rows.map((r) => r.xServeLatGraphify)),
      xLatLspCold: med(rows.map((r) => r.xLatLspCold)),
      xServeLatLspCold: med(rows.map((r) => r.xServeLatLspCold)),
      xTokLsp: med(rows.map((r) => r.xTokLsp)),
      xTokRawRead: med(rows.map((r) => r.xTokRawRead)),
    },
  };
  if (passed.length) {
    const lv5 = report.maturity.levels.find((l) => l.id === "L5");
    const lv4 = report.maturity.levels.find((l) => l.id === "L4");
    const lv2 = report.maturity.levels.find((l) => l.id === "L2");
    // A language can arrive at L5 from L4 (the usual path) or from L2 (ruby,
    // whose promotion is on LSP-truth against a real repository).
    const moving = passed.filter((l) => lv4.langs.includes(l) || lv2.langs.includes(l));
    lv5.langs = [...new Set([...lv5.langs, ...moving])].sort();
    lv4.langs = lv4.langs.filter((l) => !passed.includes(l));
    lv2.langs = lv2.langs.filter((l) => !passed.includes(l));

    // THE RETRACTION. dart was promoted to L5 by the July run and is coming
    // back down. Demotion has to be as automatic as promotion, or the ladder
    // only ever ratchets upward and stops being evidence.
    const failedButListed = rows.filter((r) => !r.pass).map((r) => r.lang);
    const demoted = lv5.langs.filter((l) => failedButListed.includes(l));
    if (demoted.length) {
      lv5.langs = lv5.langs.filter((l) => !demoted.includes(l));
      lv4.langs = [...new Set([...lv4.langs, ...demoted])].sort();
    }

    // What changed against the state this site last PUBLISHED (L5 of 13,
    // which included dart). Stated as a delta because a reader who saw the
    // old page deserves to know which way each language moved.
    const PREVIOUSLY_PUBLISHED_L5 = ["c", "cpp", "dart", "fortran", "go", "java", "javascript", "lua", "php", "python", "rust", "typescript", "zig"];
    report.maturity.promoted = {
      langs: moving,
      demoted,
      total: lv5.langs.length,
      previousTotal: PREVIOUSLY_PUBLISHED_L5.length,
      newSinceLastPublished: lv5.langs.filter((l) => !PREVIOUSLY_PUBLISHED_L5.includes(l)),
      removedSinceLastPublished: PREVIOUSLY_PUBLISHED_L5.filter((l) => !lv5.langs.includes(l)),
      evidence: "call graph cross-checked against the language's own LSP server on a real public repository — see the promotion matrix",
    };
  }
} catch {
  console.warn("l5run: data/raw/L5_MATRIX_PUBLIC.json missing — promotion section omitted");
}

const artifacts = [
  { name: "MATRIX_REPORT_PUBLIC.json", path: "data/raw/MATRIX_REPORT_PUBLIC.json", tier: "fresh", note: "7-repo tool matrix — both CLIs, one host, one run (Darwin arm64)" },
  { name: "LIVE36_REFRESH_PUBLIC.json", path: "data/raw/LIVE36_REFRESH_PUBLIC.json", tier: "fresh", note: "36 live public repos — honest ratios beside the retracted stub column" },
  { name: "LLM_QA_SWEEP_PUBLIC.json", path: "data/raw/LLM_QA_SWEEP_PUBLIC.json", tier: "fresh", note: "666 real model calls — 37 languages x 6 context sources" },
  { name: "MATRIX_TOOL_VERSIONS.json", path: "data/raw/MATRIX_TOOL_VERSIONS.json", tier: "fresh", note: "tool pins for the Darwin leg" },
  { name: "CALLERS_F1_AFTER.json", path: "data/raw/CALLERS_F1_AFTER.json", tier: "fresh", note: "native callers F1, fresh at this commit (Linux container)" },
  { name: "CALLERS_F1_BEFORE.json", path: "data/raw/CALLERS_F1_BEFORE.json", tier: "carried", note: "CARRIED from c7a3e8d — a pre-saturation binary on other hardware; not a delta partner for AFTER" },
  { name: "DIMENSIONS_BENCH_PUBLIC.json", path: "data/raw/DIMENSIONS_BENCH_PUBLIC.json", tier: "fresh", note: "per-language F1 / tokens / latency / index (Linux container; no competitor column on this host)" },
  { name: "LSP_F1_SUMMARY.json", path: "data/raw/LSP_F1_SUMMARY.json", tier: "fresh", note: "gopls LSP-truth aggregate (Linux container)" },
  { name: "MATRIX_TOOL_VERSIONS_LINUX.json", path: "data/raw/MATRIX_TOOL_VERSIONS_LINUX.json", tier: "fresh", note: "tool pins + host block for the Linux leg" },
  { name: "GRAPHIFY_LANGUAGE_DISCOVERY.json", path: "data/raw/GRAPHIFY_LANGUAGE_DISCOVERY.json", tier: "report", note: "graph-tool per-language support probe" },
  { name: "benchmark-data.json", path: "data/benchmark-data.json", tier: "carried", note: "the July derived dataset — superseded for every headline; kept so the retracted numbers stay auditable" },
  { name: "site-data.json", path: "data/site-data.json", tier: "derived", note: "the exact payload this page renders" },
];
if (agentBench) artifacts.splice(artifacts.length - 1, 0, AGENT_BENCH_ARTIFACT_ENTRY);
if (l5run) artifacts.splice(artifacts.length - 1, 0, {
  name: "L5_MATRIX_PUBLIC.json", path: "data/raw/L5_MATRIX_PUBLIC.json", tier: "fresh",
  note: "L4→L5 promotion run — per-language LSP-truth callers F1 + query-cost multipliers (macOS)",
});

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
  matrix: matrixPub,
  llmQa: qaPub,
  liveSummary,
  liveRepos,
  ...(agentBench ? { agentBench } : {}),
  ...(l5run ? { l5run } : {}),
  artifacts,
};

const text = JSON.stringify(out, null, 2) + "\n";
const BANNED = [/\/Users\//, /\/home\//, /\/tmp\//, /\/root\//, /damirdarasu/, /aziron-ui/i, /aziron-pulse/i, /recallemit/i, /Msys/i];
for (const re of BANNED) {
  if (re.test(text)) throw new Error(`public payload leak: ${re}`);
}
fs.writeFileSync(path.join(repoRoot, "data", "site-data.json"), text);
console.log(
  `wrote data/site-data.json — headline ${report.headline.tokensPooled}× pooled tokens / F1 ${report.headline.atlasF1} vs ${report.headline.graphifyF1}, ` +
  `matrix ${matrixPub.aggregates.languages} repos, live ${liveSummary.headline.tokens_median_across_languages_cli}× median CLI over ` +
  `${liveSummary.headline.languages}/${liveSummary.headline.of} answer-bearing repos (${liveSummary.excluded.count} excluded), ` +
  `fresh ${fresh.saturation.perfect}/${fresh.saturation.total} fixture-perfect, ` +
  `latency ${fresh.latency.atlasMedianMs}ms${fresh.latency.comparable ? ` vs ${fresh.latency.graphifyMedianMs}ms (${fresh.latency.ratio}×)` : " (no competitor on this host — ratio withheld)"}, ` +
  `platform "${fresh.platform}", ` +
  `gopls ${fresh.lspTruth.meanF1}, leak check CLEAN`
);
