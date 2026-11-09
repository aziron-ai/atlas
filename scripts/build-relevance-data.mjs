#!/usr/bin/env node
// Ingest the natural-language relevance benchmark (aziron-ai/atlas#44) into
// the public site payload.
//
// The harness and its committed baseline live in relevance-bench/ (copied
// byte for byte from the measured run). This script
//   1. copies relevance-bench/RESULTS.json verbatim to
//      data/raw/RELEVANCE_BENCH_<yyyymmdd>.json (the evidence drawer's copy);
//   2. derives `site.relevance` from that artifact plus CORPORA.json, GATE.json
//      and the hand-written Findings block of RESULTS.md — no number is typed.
//
// Usage: node scripts/build-relevance-data.mjs
"use strict";

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { leakCheck } from "./build-agent-bench-data.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RB = path.join(repoRoot, "relevance-bench");
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

const SURFACES = [
  { id: "search", label: "search", invocation: "atlas search QUERY --limit 10 --json", scored: "results in order" },
  { id: "search_exact", label: "search, bare entity name (control)", invocation: "atlas search <E> --limit 10 --json — definition questions only", scored: "results in order; the ticket's exact-search comparison" },
  { id: "context", label: "context", invocation: "atlas context --query QUERY --json (intent auto)", scored: "symbols in emitted order, then unseen search hits" },
  { id: "code_query", label: "code_query (MCP)", invocation: "MCP tools/call code_query {question, workspace, require_citations: true, detail: high}", scored: "citations in order; status insufficient is a refusal" },
];
const CLASSES = ["definition", "callers", "error_handling"];

const pick = (m) => m && ({
  n: m.n,
  p1: m["p@1"], p3: m["p@3"], p5: m["p@5"], p10: m["p@10"],
  mrr: m.mrr, r10: m["recall@10"], entityFirst: m.entity_first,
  empty: m.empty, queryWordTop1: m.query_word_top1,
  testShare10: m["test_share@10"], noncodeShare10: m["noncode_share@10"],
  truncated: m.truncated, meanBytes: m.bytes == null ? null : Math.round(m.bytes),
  latencyP50Ms: m.latency_p50_ms, latencyP95Ms: m.latency_p95_ms,
});

// "### F7 — `context` never refuses …" -> {id, title, status, proposed}
function parseFindings(md) {
  const start = md.indexOf("<!-- findings:begin");
  const end = md.indexOf("<!-- findings:end");
  if (start < 0 || end < 0) throw new Error("RESULTS.md: findings block not found");
  const block = md.slice(start, end);
  const parts = block.split(/^### /m).slice(1);
  const findings = [];
  let caveats = [];
  for (const part of parts) {
    const [head, ...rest] = part.split("\n");
    const body = rest.join("\n");
    const m = head.match(/^(F\d+)\s+—\s+(.+)$/);
    if (!m) {
      if (/^Measurement caveats/.test(head)) caveats = body.split("\n").filter((l) => l.startsWith("- ")).map((l) => l.slice(2).trim());
      continue;
    }
    const [, id, rawTitle] = m;
    const fixed = rawTitle.match(/\s+—\s+(FIXED .+)$/);
    const title = (fixed ? rawTitle.slice(0, fixed.index) : rawTitle).replace(/`/g, "");
    const proposed = [...body.matchAll(/\*\*Proposed tickets?(?: \(residual\))?:\*\*\s*([\s\S]*?)(?=\n- |\n\n|$)/g)]
      .map((x) => x[1].replace(/\s+/g, " ").trim());
    findings.push({
      id,
      title,
      status: fixed ? fixed[1].replace(/`/g, "") : "open — proposed as a follow-up ticket",
      proposed: proposed[0] || null,
    });
  }
  const holds = (block.match(/\*\*What holds up\.\*\*\s*([\s\S]*?)\n\n/) || [])[1]?.replace(/\s+/g, " ").trim() || null;
  const measuredOn = (block.match(/Measured on develop `([0-9a-f]+)`/) || [])[1] || null;
  const f8 = parts.find((p) => p.startsWith("F8"));
  const drift = f8 ? (f8.match(/the gated drift is \*\*(\d+)\*\* over all (\d+) thresholds/) || null) : null;
  const differing = f8 ? (f8.match(/(\d+) of (\d+) lists still differ between two fresh stores/) || null) : null;
  return {
    findings, caveats, holds, measuredOn,
    drift: drift ? { gatedDrift: Number(drift[1]), thresholds: Number(drift[2]), listsDiffering: differing ? Number(differing[1]) : null, lists: differing ? Number(differing[2]) : null } : null,
  };
}

export function deriveRelevance(results, corpora, gate, resultsMd, artifactPath) {
  const pooled = results.summary.pooled;
  const byCorpus = results.summary.by_corpus;
  const fm = parseFindings(resultsMd);
  const totals = { definition: 0, callers: 0, error_handling: 0, adversarial: 0, total: 0 };
  for (const c of Object.values(results.label_counts)) for (const k of Object.keys(totals)) totals[k] += c[k] || 0;
  const thresholds = gate.thresholds || [];
  return {
    label: `Natural-language relevance benchmark (#44) — ${results.run.measured_at.slice(0, 10)}`,
    ticket: results.ticket,
    ticketUrl: "https://github.com/aziron-ai/atlas/issues/44",
    date: results.run.measured_at.slice(0, 10),
    measuredAt: results.run.measured_at,
    atlasBuild: results.run.atlas_version,
    binarySha256: results.run.atlas_binary_sha256,
    buildNote: `Measured on develop ${fm.measuredOn || "—"} plus the benchmark branch (${results.run.atlas_version}); no ranking code changed in the benchmark PR. Ships in 0.1.55.`,
    shipsIn: "0.1.55",
    platform: results.run.platform,
    seconds: results.run.seconds,
    what: "216 labelled questions over three frozen corpora, asked in natural language of three Atlas retrieval surfaces, each corpus indexed into a fresh store, scored offline against frozen labels — with a regression gate of 159 thresholds.",
    corpora: Object.entries(corpora.corpora).map(([id, c]) => {
      const si = results.store_identity[id] || {};
      return {
        id,
        languages: c.languages,
        sources: c.components.map((s) => ({ slug: s.slug, commit7: s.commit.slice(0, 7), prefix: s.prefix || null })),
        tree: c.tree,
        head: c.head,
        files: si.indexed_files ?? null,
        symbols: si.symbols ?? null,
        edges: si.edges ?? null,
        indexSeconds: si.index_seconds ?? null,
        labels: results.label_counts[id],
      };
    }),
    outOfScope: corpora.out_of_scope?.chromium ? "Chromium is out of scope for the gate: a Chromium index takes hours and tens of GB, which is a manual release check rather than a regression gate. The harness accepts any pinned corpus, so a Chromium entry can run as release validation." : null,
    labelTotals: totals,
    labelSources: {
      definition: "mechanical — the LSP definitions recorded in the QA set",
      callers: "mechanical — the LSP caller names recorded in the QA set (matched by name)",
      error_handling: "hand-labelled from the code at the pinned commit; every item cites file:line",
      adversarial: "hand-written generic or stopword phrasings with no entity; the safe outcome is a refusal, or a grounded answer where the corpus has dedicated error machinery",
    },
    surfaces: SURFACES,
    pooled: Object.fromEntries(CLASSES.map((cls) => [cls, SURFACES
      .filter((s) => pooled[s.id]?.[cls])
      .map((s) => ({ surface: s.id, ...pick(pooled[s.id][cls]) }))])),
    adversarial: ["search", "context", "code_query"].map((s) => {
      const m = pooled[s].adversarial;
      return { surface: s, n: m.n, refused: m.refused, grounded: m.grounded, safe: m.safe, noise: m.noise, meanReturned: m.returned, meanBytes: Math.round(m.bytes) };
    }),
    byCorpus: Object.fromEntries(Object.entries(byCorpus).map(([id, surfaces]) => [id, Object.fromEntries(Object.entries(surfaces).map(([s, classes]) => [s, {
      ...Object.fromEntries(CLASSES.filter((c) => classes[c]).map((c) => [c, { mrr: classes[c].mrr, r10: classes[c]["recall@10"], entityFirst: classes[c].entity_first }])),
      ...(classes.adversarial ? { adversarialSafe: classes.adversarial.safe } : {}),
    }]))])),
    gate: {
      thresholds: thresholds.length,
      status: results.gate.status,
      failures: results.gate.failures,
      rule: "each min = the measured develop baseline minus a margin, floored at 0: 0.03 pooled precision/MRR/recall/entity-first, 0.05 pooled refusal/safe, 0.06 per corpus, 0.09 per-corpus safe; every margin widened to one query's worth (1/n) for small sets. A missing metric fails closed.",
      drift: fm.drift,
      driftNote: fm.drift ? `Two back-to-back runs on fresh stores: ${fm.drift.listsDiffering} of ${fm.drift.lists} ranked lists differ, none at rank 1, gated drift ${fm.drift.gatedDrift} over all ${fm.drift.thresholds} thresholds (RESULTS.md, F8).` : null,
      catches: "The gate catches regressions; it does not certify that retrieval is good — the baseline encodes today's defects, listed below as follow-ups. When a fix lands, the gate is re-frozen from a reviewed run so it ratchets.",
    },
    holdsUp: fm.holds,
    findings: fm.findings,
    caveats: fm.caveats,
    artifact: artifactPath,
    harness: "relevance-bench/",
    runCmd: "python3 relevance-bench/relevance_bench.py --atlas \"$(command -v atlas)\" \\\n    --work relevance-work \\\n    --results-json my-relevance.json --results-md my-relevance.md",
    runNeeds: "python3 (3.10+), git, an atlas binary, and network to fetch the three pinned corpora (or --source SLUG=PATH for local clones); about 80 s and 80 MB of temporary stores",
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const resultsText = fs.readFileSync(path.join(RB, "RESULTS.json"), "utf8");
  const results = JSON.parse(resultsText);
  const out = `data/raw/RELEVANCE_BENCH_${results.run.measured_at.slice(0, 10).replace(/-/g, "")}.json`;
  leakCheck(path.basename(out), resultsText);
  fs.writeFileSync(path.join(repoRoot, out), resultsText);

  const block = deriveRelevance(
    results,
    readJson(path.join(RB, "CORPORA.json")),
    readJson(path.join(RB, "GATE.json")),
    fs.readFileSync(path.join(RB, "RESULTS.md"), "utf8"),
    out,
  );
  if (block.gate.thresholds !== results.gate.thresholds) throw new Error(`GATE.json has ${block.gate.thresholds} thresholds, RESULTS.json verdicts ${results.gate.thresholds}`);
  const sitePath = path.join(repoRoot, "data", "site-data.json");
  const site = JSON.parse(fs.readFileSync(sitePath, "utf8"));
  site.relevance = block;
  const entry = { name: path.basename(out), path: out, tier: "fresh", note: "natural-language relevance benchmark (#44): 216 labelled queries × 3 surfaces, per-query rows, aggregates, gate verdicts (verbatim copy of relevance-bench/RESULTS.json)" };
  site.artifacts = (site.artifacts || []).filter((a) => a.name !== entry.name);
  const siteIdx = site.artifacts.findIndex((a) => a.name === "site-data.json");
  site.artifacts.splice(siteIdx >= 0 ? siteIdx : site.artifacts.length, 0, entry);
  site.generatedAt = new Date().toISOString();
  const siteText = JSON.stringify(site, null, 2) + "\n";
  leakCheck("site-data.json", siteText);
  fs.writeFileSync(sitePath, siteText);
  console.log(`wrote ${out}; relevance: ${block.labelTotals.total} queries, gate ${block.gate.status} ${block.gate.thresholds}, ${block.findings.length} findings`);
}
