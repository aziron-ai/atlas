#!/usr/bin/env node
// Ingest the Darwin leg of a refresh run into public-safe data/raw/ artifacts.
//
// The Linux leg (CALLERS_F1_*, DIMENSIONS_BENCH, LSP_F1_GO,
// MATRIX_TOOL_VERSIONS_LINUX) is ingested by build-site-data.mjs, which reads
// it straight from the bench directory. The Darwin leg is bigger and noisier:
// the raw matrix carries absolute checkout paths, the live-repo files are 36
// separate documents totalling several MB, and the LLM sweep carries 539 KB of
// per-sample model output. This script reduces each to the smallest artifact
// that still lets a reader recompute every number the site publishes, and
// stamps the metric DEFINITION next to the number so nobody has to guess which
// estimator produced it.
//
// Emits into data/raw/:
//   MATRIX_REPORT_PUBLIC.json     7-repo tool matrix (Darwin arm64, both CLIs)
//   LIVE36_REFRESH_PUBLIC.json    36 live public repos, ratios + aggregates
//   LLM_QA_SWEEP_PUBLIC.json      real-LLM caller-QA sweep, 37 langs x 6 sources
//   MATRIX_TOOL_VERSIONS.json     tool pins for the Darwin leg (versions only)
//
// Usage: node scripts/ingest-refresh-artifacts.mjs /path/to/.ci-artifacts/refresh-<sha>
"use strict";

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.resolve(process.argv[2] || process.env.ATLAS_REFRESH_DIR || "");
if (!process.argv[2] && !process.env.ATLAS_REFRESH_DIR) {
  throw new Error("Usage: node scripts/ingest-refresh-artifacts.mjs /path/to/refresh-<sha>");
}
const rawDir = path.join(repoRoot, "data", "raw");

const read = (f) => JSON.parse(fs.readFileSync(path.join(srcDir, f), "utf8"));
const round = (x, d = 2) => (x == null || Number.isNaN(x) ? null : Math.round(x * 10 ** d) / 10 ** d);
const sum = (xs) => xs.reduce((s, x) => s + (x || 0), 0);
const median = (xs) => {
  const v = xs.filter((x) => x != null).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};

const BANNED = [/\/Users\//, /\/home\//, /\/tmp\//, /\/root\//, /damirdarasu/, /aziron-ui/i, /aziron-pulse/i, /Msys/i];
function emit(name, obj) {
  const text = JSON.stringify(obj, null, 2) + "\n";
  for (const re of BANNED) {
    if (re.test(text)) throw new Error(`refusing to publish ${name}: leak ${re}`);
  }
  fs.writeFileSync(path.join(rawDir, name), text);
  return text.length;
}

/* ============ 1. the 7-repo tool matrix (Darwin, both CLIs) ============== */
// Every row was measured on ONE host in ONE run with BOTH binaries present,
// so the graphify columns here are a like-for-like comparison. Local checkout
// paths (`target`) are dropped; nothing else is reduced.

const matrix = read("MATRIX_REPORT.json");
const matrixRows = matrix.map((r) => {
  const qs = (r.queries || []).filter((q) => !q.atlas_missing && !q.graphify_missing);
  const atlasTok = sum(qs.map((q) => q.atlas_tokens));
  const graphifyTok = sum(qs.map((q) => q.graphify_tokens));
  const atlasMs = sum(qs.map((q) => q.atlas_ms));
  const graphifyMs = sum(qs.map((q) => q.graphify_ms));
  const explain = ((r.atlas_warm_serve || {}).explain || []).map((e) => e.median_ms);
  const idx = ((r.tools || {}).atlas || {}).metrics || {};
  return {
    language: r.language,
    repo: (r.repo || "").replace("https://github.com/", ""),
    subdir: r.subdir || null,
    comparable_queries: qs.length,
    total_queries: (r.queries || []).length,
    atlas_tokens_sum: atlasTok,
    graphify_tokens_sum: graphifyTok,
    token_ratio: round(graphifyTok / atlasTok),
    atlas_ms_sum: round(atlasMs),
    graphify_ms_sum: round(graphifyMs),
    latency_ratio: round(graphifyMs / atlasMs),
    warm_serve_explain_median_ms: explain.map((x) => round(x, 3)),
    warm_serve_explain_mean_ms: round(explain.length ? sum(explain) / explain.length : null, 2),
    index: { files: idx.files ?? null, symbols: idx.symbols ?? null, edges: idx.edges ?? null },
    queries: qs.map((q) => ({
      symbol: q.symbol,
      atlas_tokens: q.atlas_tokens, graphify_tokens: q.graphify_tokens,
      atlas_ms: q.atlas_ms, graphify_ms: q.graphify_ms,
    })),
  };
});
const mTokAtlas = sum(matrixRows.map((r) => r.atlas_tokens_sum));
const mTokGraphify = sum(matrixRows.map((r) => r.graphify_tokens_sum));
const mLatAtlas = sum(matrixRows.map((r) => r.atlas_ms_sum));
const mLatGraphify = sum(matrixRows.map((r) => r.graphify_ms_sum));
const tokRatios = matrixRows.map((r) => r.token_ratio);
const latRatios = matrixRows.map((r) => r.latency_ratio);
const explainMeans = matrixRows.map((r) => r.warm_serve_explain_mean_ms).filter((x) => x != null);

const matrixPublic = {
  label: "7-repo tool matrix",
  platform: "Darwin arm64 (macOS)",
  what: "one host, one run, both CLIs present: `atlas explain <symbol> --format plain` against the graph tool's equivalent query, on seven public repositories",
  comparability: "a query counts only when BOTH tools returned an answer; queries either tool missed are excluded from every ratio below",
  definitions: {
    token_ratio: "sum(graphify answer tokens) / sum(atlas answer tokens) over that language's comparable queries",
    latency_ratio: "sum(graphify ms) / sum(atlas ms) over the same queries; each ms is the median of 5 CLI invocations including process spawn",
    pooled: "the same sums taken across all seven languages at once — the honest 'overall' figure, dominated by the languages with the most tokens",
    per_language_mean: "the unweighted mean of the seven per-language ratios — every language counts once, so a small language can lift it",
  },
  aggregates: {
    languages: matrixRows.length,
    comparable_queries: sum(matrixRows.map((r) => r.comparable_queries)),
    tokens_pooled: round(mTokGraphify / mTokAtlas),
    tokens_per_language_mean: round(sum(tokRatios) / tokRatios.length),
    tokens_per_language_median: round(median(tokRatios)),
    tokens_worst_language: matrixRows.reduce((a, b) => (a.token_ratio <= b.token_ratio ? a : b)).language,
    tokens_worst_ratio: round(Math.min(...tokRatios)),
    latency_pooled: round(mLatGraphify / mLatAtlas),
    latency_per_language_mean: round(sum(latRatios) / latRatios.length),
    latency_per_language_median: round(median(latRatios)),
    warm_serve_explain_ms_range: [round(Math.min(...explainMeans), 1), round(Math.max(...explainMeans), 1)],
  },
  rows: matrixRows,
};

/* ============ 2. the 36 live public repositories ======================== */
// The old rows on this page compared against a STUB build of atlas that
// answered `who calls X` with a 2-token placeholder. This artifact keeps the
// stub column (`*_old`) so the retraction is auditable, and adds the two
// honest columns measured at this SHA.

const live = read("LIVE36_REFRESH_SUMMARY.json");
const liveFiles = fs.readdirSync(path.join(srcDir, "live36"))
  .filter((f) => /^LIVE_.*_BENCHMARK\.json$/.test(f)).sort();

// THE ONE THAT MATTERS. A token ratio is only evidence about caller retrieval
// if the answer being measured actually retrieved a caller. On 11 of these 36
// repositories the current CLI still answers with a bare name or a name and a
// location — `Loader.load`, `HiArgs c@hiargs:36` — and the graph tool answers
// with a paragraph, so the quotient is large and means nothing. That is the
// SAME defect this refresh exists to retract, one order of magnitude smaller.
// So the headline live figure is computed over the languages whose answers
// name at least one caller, and the all-36 figure is published beside it,
// labelled, rather than led with.
const bearing = new Set(live.languages.filter((x) => x.callers_listed_cli > 0).map((x) => x.language));
const nonBearing = live.languages.filter((x) => x.callers_listed_cli === 0).map((x) => x.language).sort();

let lg = 0, lc = 0, ls = 0, llg = 0, llc = 0, lls = 0, comparable = 0, totalQ = 0;
let bg = 0, bc = 0, bs = 0, blg = 0, blc = 0, bComparable = 0;
const perQueryTok = [], perQueryLat = [], perQueryTokServe = [], perQueryLatServe = [];
for (const f of liveFiles) {
  const d = JSON.parse(fs.readFileSync(path.join(srcDir, "live36", f), "utf8"));
  const isBearing = bearing.has(d.language);
  totalQ += (d.queries || []).length;
  for (const q of d.queries || []) {
    if (q.graphify_missing || q.atlas_missing) continue;
    comparable++;
    lg += q.graphify_tokens; lc += q.cli_tokens; ls += q.atlas_tokens;
    llg += q.graphify_ms; llc += q.cli_ms; lls += q.atlas_ms;
    if (isBearing) {
      bComparable++;
      bg += q.graphify_tokens; bc += q.cli_tokens; bs += q.atlas_tokens;
      blg += q.graphify_ms; blc += q.cli_ms;
    }
    if (q.cli_tokens) perQueryTok.push(q.graphify_tokens / q.cli_tokens);
    if (q.atlas_tokens) perQueryTokServe.push(q.graphify_tokens / q.atlas_tokens);
    if (q.cli_ms) perQueryLat.push(q.graphify_ms / q.cli_ms);
    if (q.atlas_ms) perQueryLatServe.push(q.graphify_ms / q.atlas_ms);
  }
}
const bearingLangs = live.languages.filter((x) => bearing.has(x.language));
const livePublic = {
  label: "36 live public repositories",
  platform: "Darwin arm64 (macOS)",
  atlas_binary: live.atlas_binary,
  stub_binary: live.old_atlas_binary,
  what: "one caller query per pinned symbol on 36 public repositories, one language each",
  retraction: "the `*_old` columns are the binary this page's previous live-repo multipliers were measured against. That build answered caller queries with a 2-token placeholder: across all 224 live answers it listed ZERO callers. Its ratios measured an empty answer, not a cheaper one, and are published here only so the retraction can be checked.",
  comparability: "a query counts only when BOTH tools returned an answer; the stub column keeps its own comparability set because the stub answered where the current CLI sometimes declines",
  definitions: {
    per_language_ratio: "median(graphify tokens) / median(atlas tokens) over that language's comparable queries — a ratio of medians, robust to one runaway symbol",
    median_across_languages: "the median of the 36 per-language ratios; each language counts once regardless of how many queries it contributed",
    pooled_sum: "sum(graphify) / sum(atlas) over all comparable queries at once",
    per_query_median: "the median of the per-query ratios across all comparable queries",
    cli: "`atlas explain` run as a one-shot process, spawn included — what a shell loop or an agent shelling out actually pays",
    serve: "the same query against a warm `atlas serve` daemon. NOTE: at this SHA the serve endpoint still returns the reduced answer shape; see the serve-parity note in the methods section",
  },
  answer_quality: {
    callers_listed_stub: live.summary.callers_listed_old,
    callers_listed_cli: live.summary.callers_listed_cli,
    total_answers: totalQ,
    note: "number of live answers that named at least one caller. The stub scored 0 of " + totalQ + ".",
  },
  scorecard: {
    threshold: live.targetRatio,
    token_at_or_above_threshold_cli: live.summary.token10x_cli,
    token_at_or_above_threshold_serve: live.summary.token10x_serve,
    token_at_or_above_threshold_stub: live.summary.token10x_old,
    latency_at_or_above_threshold_cli: live.summary.latency10x_cli,
    latency_at_or_above_threshold_serve: live.summary.latency10x_serve,
    latency_at_or_above_threshold_stub: live.summary.latency10x_old,
    of: live.summary.liveLanguages,
  },
  // The published live figure. Restricted to repositories whose Atlas answer
  // actually named a caller — the only rows where a token ratio is evidence
  // about caller retrieval rather than about two different non-answers.
  headline: {
    basis: "answer-bearing languages only",
    definition: "a language counts when its Atlas CLI answers named at least one caller across the run. On the excluded repositories Atlas returns a bare name or a name and a location, so the ratio measures a non-answer and is not published as a win.",
    languages: bearingLangs.length,
    of: live.languages.length,
    comparable_queries: bComparable,
    tokens_median_across_languages_cli: round(median(bearingLangs.map((x) => x.tokenRatio_cli))),
    tokens_median_across_languages_serve: round(median(bearingLangs.map((x) => x.tokenRatio_serve))),
    tokens_pooled_sum_cli: round(bg / bc),
    tokens_pooled_sum_serve: round(bg / bs),
    latency_median_across_languages_cli: round(median(bearingLangs.map((x) => x.latencyRatio_cli))),
    latency_pooled_sum_cli: round(blg / blc),
    token_at_or_above_threshold_cli: bearingLangs.filter((x) => x.tokenRatio_cli >= live.targetRatio).length,
  },
  excluded_non_answering: {
    languages: nonBearing,
    count: nonBearing.length,
    why: "the Atlas CLI named no caller on these repositories at this commit, so their token ratios describe the size difference between two non-answers. Several are large (lua 35.8×, rust 46.1×, terraform 38.5×) and every one of them is excluded from the headline for that reason.",
    note: "Some of these are probe artefacts rather than binder gaps — byond's probes are markdown headings, rust's are type names — but the ratio is unusable either way, so the distinction does not rescue the number.",
  },
  aggregates_as_measured: {
    note: "all 36 languages, including the 11 that named no caller. Published for completeness and for comparison with the retracted rows; NOT the headline.",
    languages: live.languages.length,
    comparable_queries: comparable,
    total_queries: totalQ,
    tokens_median_across_languages_cli: round(median(live.languages.map((x) => x.tokenRatio_cli))),
    tokens_median_across_languages_serve: round(median(live.languages.map((x) => x.tokenRatio_serve))),
    tokens_pooled_sum_cli: round(lg / lc),
    tokens_pooled_sum_serve: round(lg / ls),
    tokens_per_query_median_cli: round(median(perQueryTok)),
    tokens_per_query_median_serve: round(median(perQueryTokServe)),
    latency_median_across_languages_cli: round(median(live.languages.map((x) => x.latencyRatio_cli))),
    latency_median_across_languages_serve: round(median(live.languages.map((x) => x.latencyRatio_serve))),
    latency_pooled_sum_cli: round(llg / llc),
    latency_pooled_sum_serve: round(llg / lls),
    latency_per_query_median_cli: round(median(perQueryLat)),
    latency_per_query_median_serve: round(median(perQueryLatServe)),
  },
  // Most languages' multipliers FELL against the stub rows, because the stub's
  // number came from answering with nothing. That is the retraction working,
  // not a regression, so it is summarised rather than listed row by row. The
  // two rows that went the other way are named, because a multiplier that
  // GREW deserves more scrutiny than one that shrank, not less.
  vs_stub: {
    fell: live.languages.filter((x) => x.tokenRatio_cli < x.tokenRatio_old).length,
    rose: live.languages.filter((x) => x.tokenRatio_cli > x.tokenRatio_old).map((x) => ({
      language: x.language,
      token_ratio_stub: x.tokenRatio_old,
      token_ratio_cli: x.tokenRatio_cli,
      callers_listed_cli: x.callers_listed_cli,
    })),
    why_fell: "the stub's larger ratio came from a two-token non-answer. The current CLI returns a real answer and therefore spends real tokens, so almost every honest multiplier is SMALLER than the one it replaces.",
    why_rose: "byond's ratio grew while still naming zero callers — a bigger multiplier for the same empty answer, which is why it is excluded from the headline. r's 274× is a single-language outlier on a detector-only comparison and is not representative of anything.",
    biggest_drops: [...live.languages]
      .sort((a, b) => (b.tokenRatio_old - b.tokenRatio_cli) - (a.tokenRatio_old - a.tokenRatio_cli))
      .slice(0, 5)
      .map((x) => ({ language: x.language, from: x.tokenRatio_old, to: x.tokenRatio_cli })),
  },
  languages: live.languages,
};

/* ============ 3. the real-LLM caller-QA sweep =========================== */
// 37 languages x 6 context sources x 3 samples at temperature 0, majority
// vote, scored deterministically against the fixture's constructed truth.
// The per-sample model text is dropped; the per-cell scores are kept.

const qa = read("LLM_QA_SWEEP_RESULTS.json");
const bySource = qa.summary_by_source;
const perfect = (src) => qa.per_cell.filter((c) => c.source === src && c.f1 === 1).length;
const qaPublic = {
  label: "Real-LLM caller-QA sweep",
  what: "a real model is handed ONE context source and asked which functions call `target`; the answer is scored against the fixture's constructed truth. This measures the context, not the model.",
  model: qa.actual_models,
  sampling: `temperature ${qa.temperature} · ${qa.samples_per_cell} samples/cell · majority vote (threshold ${qa.majority_threshold}) · no tools`,
  cells: qa.per_cell.length,
  model_calls: qa.per_cell.length * qa.samples_per_cell,
  languages: [...new Set(qa.per_cell.map((c) => c.language))].length,
  prompt: qa.prompt,
  definitions: {
    f1: "deterministic set F1 of the majority-voted caller-name list against the fixture truth (15 callers, 3 decoys, truth by construction)",
    ctx_tokens: "mean size of the context handed to the model, in tokens",
    controls: "`baseline` is a positive control — the raw fixture file, which contains the truth by construction, so its F1 of 1.000 confirms the judge works. It is a CEILING, not a competitor: Atlas does not beat it and does not claim to. `graphify` is the rival tool on the identical prompt and fixture.",
  },
  sources: Object.fromEntries(Object.entries(bySource).map(([k, v]) => [k, {
    cells: v.cells,
    f1: round(v.avg_f1, 4),
    precision: round(v.avg_precision, 4),
    recall: round(v.avg_recall, 4),
    ctx_tokens: round(v.avg_ctx_tokens, 1),
    perfect_languages: perfect(k),
  }])),
  detail_curve: qa.detail_curve.map((r) => ({
    source: r.source, f1: round(r.avg_f1, 4), ctx_tokens: round(r.avg_ctx_tokens, 1),
  })),
  per_cell: qa.per_cell.map((c) => ({
    language: c.language, source: c.source,
    precision: c.precision, recall: c.recall, f1: c.f1, ctx_tokens: c.ctx_tokens,
  })),
};

/* ============ 4. Darwin tool pins ======================================= */

const tv = read("MATRIX_TOOL_VERSIONS.json");
const toolsPublic = {
  platform: `${tv.platform.system} ${tv.platform.release} ${tv.platform.machine}`,
  tools: Object.fromEntries((tv.core_tools || []).map((t) => [t.tool, t.version || t.status])),
};

/* ============================== emit ==================================== */

const wrote = [
  ["MATRIX_REPORT_PUBLIC.json", matrixPublic],
  ["LIVE36_REFRESH_PUBLIC.json", livePublic],
  ["LLM_QA_SWEEP_PUBLIC.json", qaPublic],
  ["MATRIX_TOOL_VERSIONS.json", toolsPublic],
].map(([n, o]) => `${n} (${(emit(n, o) / 1024).toFixed(0)} KB)`);

console.log(
  `ingested ${wrote.length} Darwin artifacts, leak check CLEAN\n  ` + wrote.join("\n  ") +
  `\n  matrix pooled ${matrixPublic.aggregates.tokens_pooled}× tokens / ${matrixPublic.aggregates.latency_per_language_mean}× latency (mean)` +
  `\n  live36 headline ${livePublic.headline.tokens_median_across_languages_cli}× median / ${livePublic.headline.tokens_pooled_sum_cli}× pooled over ${livePublic.headline.languages}/${livePublic.headline.of} answer-bearing langs (${livePublic.excluded_non_answering.count} excluded: named no caller)` +
  `\n  llm-qa explain_high F1 ${qaPublic.sources.atlas_explain_high.f1} @ ${qaPublic.sources.atlas_explain_high.ctx_tokens} tok vs graphify ${qaPublic.sources.graphify.f1} @ ${qaPublic.sources.graphify.ctx_tokens} tok`
);
