#!/usr/bin/env node
// Ingest the tool-level callers accuracy run: `atlas callers <symbol> --json`
// straight from the CLI — no agent in the loop — against the same frozen
// LSP-truth QA sets the multi-language agent benchmark uses, each repository
// indexed into a brand-new store first.
//
//   private run directory (one <lang>.txt per language, the tool-f1 scorer's
//   output, plus <lang>.index.txt and summary.txt)
//     -> data/raw/TOOL_CALLERS_F1_LSP_<yyyymmdd>.json  (public: every question's
//        counts, the verbatim scorer lines, index stats, the binary)
//     -> site.lspTruthLanguages (derived ONLY from that artifact)
//
// Precision, recall and F1 are recomputed here from each question's counts
// (truth / returned / hit) and checked against the two-decimal values the
// scorer printed, so the published numbers carry full precision without
// being re-typed.
//
// Usage:
//   node scripts/build-lsp-truth-languages.mjs /path/to/run-dir [--same /path/to/other-run-dir ...]
//   --same: earlier runs on other builds; recorded only if every per-question
//           row is identical to the canonical run.
"use strict";

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { leakCheck, round } from "./build-agent-bench-data.mjs";
import { LANG_ORDER, qaSetFor } from "./build-agent-bench-languages.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LANG_LABEL = { go: "Go", python: "Python", c: "C", java: "Java", cpp: "C++", javascript: "JavaScript", typescript: "TypeScript", rust: "Rust" };
const ROW = /^(\S+)\s+(\d+)\s+(\d+)\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/;
const MEAN = /questions (\d+)\s+mean tool F1 ([\d.]+)\s+perfect (\d+)\/(\d+)/;

const prf = (truth, got, hit) => {
  const p = got ? hit / got : (truth ? 0 : 1);
  const r = truth ? hit / truth : (got ? 0 : 1);
  return { p, r, f: p + r ? (2 * p * r) / (p + r) : 0 };
};

function parseRun(dir) {
  const summary = fs.readFileSync(path.join(dir, "summary.txt"), "utf8");
  const binary = (summary.match(/^binary:\s*(.+)$/m) || [])[1]?.trim() || null;
  const langs = {};
  for (const lang of LANG_ORDER) {
    const p = path.join(dir, `${lang}.txt`);
    if (!fs.existsSync(p)) continue;
    const lines = fs.readFileSync(p, "utf8").split("\n");
    const rows = lines.filter((l) => ROW.test(l)).map((l) => l.replace(/\s+$/, ""));
    const meanLine = lines.find((l) => MEAN.test(l));
    langs[lang] = { rows, meanLine, header: lines[0] };
  }
  return { dir, binary, langs, mtime: fs.statSync(path.join(dir, "summary.txt")).mtime };
}

function indexStats(dir, lang) {
  const p = path.join(dir, `${lang}.index.txt`);
  if (!fs.existsSync(p)) return null;
  const t = fs.readFileSync(p, "utf8");
  const num = (re) => { const m = t.match(re); return m ? Number(m[1]) : null; };
  return {
    commit: (t.match(/"commit_sha":\s*"([0-9a-f]{40})"/) || [])[1] || null,
    files: num(/"indexed_files":\s*(\d+)/),
    symbols: num(/"symbols":\s*(\d+)/),
    edges: num(/"edges":\s*(\d+)/),
    durationMs: num(/atlas index: done .*duration=(\d+)ms/),
  };
}

export function toPublicArtifact(run, sameRuns = []) {
  const date = run.mtime.toISOString().slice(0, 10);
  const languages = LANG_ORDER.filter((l) => run.langs[l]).map((lang) => {
    const qa = JSON.parse(fs.readFileSync(path.join(repoRoot, qaSetFor(lang)), "utf8"));
    const { rows, meanLine, header } = run.langs[lang];
    const questions = rows.map((line) => {
      const [, symbol, t, g, h, pp, rr, ff] = line.match(ROW);
      const truth = Number(t), got = Number(g), hit = Number(h);
      const { p, r, f } = prf(truth, got, hit);
      for (const [mine, printed, what] of [[p, pp, "P"], [r, rr, "R"], [f, ff, "F1"]]) {
        if (Math.abs(mine - Number(printed)) > 0.005 + 1e-9) throw new Error(`${lang} ${symbol}: recomputed ${what} ${mine} != printed ${printed}`);
      }
      return { symbol, truth, got, hit, precision: round(p, 4), recall: round(r, 4), f1: round(f, 4) };
    });
    const [, n, meanPrinted, perfect] = meanLine.match(MEAN);
    const meanF1 = questions.reduce((s, q) => s + prf(q.truth, q.got, q.hit).f, 0) / questions.length;
    if (Math.abs(meanF1 - Number(meanPrinted)) > 0.0005) throw new Error(`${lang}: recomputed mean ${meanF1} != printed ${meanPrinted}`);
    if (Number(n) !== questions.length) throw new Error(`${lang}: ${questions.length} rows, scorer says ${n}`);
    const index = indexStats(run.dir, lang);
    if (index?.commit && index.commit !== qa.meta.commit) throw new Error(`${lang}: indexed ${index.commit}, QA set pinned ${qa.meta.commit}`);
    return {
      lang,
      repo_slug: qa.meta.repo_slug,
      repo_commit: qa.meta.commit,
      truth: qa.meta.truth,
      qa_set: qaSetFor(lang),
      index,
      n_questions: questions.length,
      mean_f1: round(meanF1, 4),
      mean_f1_printed: meanPrinted,
      perfect: Number(perfect),
      questions,
      scorer_output: [header.replace(/\s+$/, ""), ...rows, "", meanLine.trim()],
    };
  });
  const identicalOn = sameRuns
    .filter((s) => LANG_ORDER.every((l) => !run.langs[l] || (s.langs[l] && s.langs[l].rows.join("\n") === run.langs[l].rows.join("\n"))))
    .map((s) => s.binary);
  const differentOn = sameRuns.filter((s) => !identicalOn.includes(s.binary)).map((s) => s.binary);
  if (differentOn.length) throw new Error(`--same runs differ from the canonical run: ${differentOn.join(", ")}`);
  return {
    label: "Tool-level callers F1 against LSP truth",
    what: "`atlas callers <symbol> --json` from the CLI (no agent), each repository indexed into a brand-new store, scored by caller name against the frozen LSP-truth QA sets of the multi-language agent benchmark",
    date,
    atlas_build: run.binary,
    identical_on: identicalOn,
    scoring: "per question: P = hits / names returned, R = hits / truth names, F1 = 2PR/(P+R); a question whose truth and answer are both empty scores 1. Mean over the 19 questions; perfect = F1 1.000.",
    languages,
  };
}

export function deriveLspTruthLanguages(artifact, artifactPath) {
  return {
    label: `Tool-level callers F1 vs LSP truth — ${artifact.date} · ${artifact.languages.length} languages, fresh index each`,
    date: artifact.date,
    atlasBuild: artifact.atlas_build,
    shipsIn: "0.1.55",
    buildNote: `Measured on ${artifact.atlas_build}, a commit of the fix branch that develop merged at 3790ba95 (ships in 0.1.55); it was not re-run on the merge commit itself. Every per-question row was identical on the ${artifact.identical_on.length} builds measured before it that night (${artifact.identical_on.map((b) => (b.match(/\(([0-9a-f]{7,}),/) || [])[1] || b).join(", ")}).`,
    what: "The ceiling an agent gets from the tool: `atlas callers <symbol> --json` straight from the CLI, no model in the loop, on a store built from scratch, scored by caller name against the same frozen LSP-truth QA sets as the agent benchmark.",
    scoring: artifact.scoring,
    artifact: artifactPath,
    languages: artifact.languages.map((l) => ({
      lang: l.lang,
      label: LANG_LABEL[l.lang] || l.lang,
      repo: l.repo_slug,
      commit7: String(l.repo_commit).slice(0, 7),
      truthTool: String(l.truth).split(/\s+(?:LSP\b|call_hierarchy\b)/)[0].trim(),
      n: l.n_questions,
      meanF1: l.mean_f1,
      perfect: l.perfect,
      minF1: Math.min(...l.questions.map((q) => q.f1)),
      weakest: [...l.questions].sort((a, b) => a.f1 - b.f1).slice(0, 3).filter((q) => q.f1 < 0.95).map((q) => ({ symbol: q.symbol, f1: q.f1, truth: q.truth, got: q.got, hit: q.hit })),
      index: l.index ? { files: l.index.files, symbols: l.index.symbols, edges: l.index.edges, durationMs: l.index.durationMs } : null,
      qaSet: l.qa_set,
    })),
  };
}

/* ------------------------------ CLI ------------------------------------- */

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const same = [];
  for (let i = args.indexOf("--same"); i >= 0; i = args.indexOf("--same")) same.push(args.splice(i, 2)[1]);
  if (!args[0]) throw new Error("Usage: node scripts/build-lsp-truth-languages.mjs /path/to/run-dir [--same /path/to/other-run-dir ...]");
  const artifact = toPublicArtifact(parseRun(args[0]), same.map(parseRun));
  const out = `data/raw/TOOL_CALLERS_F1_LSP_${artifact.date.replace(/-/g, "")}.json`;
  const text = JSON.stringify(artifact, null, 2) + "\n";
  leakCheck(path.basename(out), text);
  fs.writeFileSync(path.join(repoRoot, out), text);

  const block = deriveLspTruthLanguages(artifact, out);
  const sitePath = path.join(repoRoot, "data", "site-data.json");
  const site = JSON.parse(fs.readFileSync(sitePath, "utf8"));
  site.lspTruthLanguages = block;
  const entry = { name: path.basename(out), path: out, tier: "fresh", note: "tool-level callers F1 vs LSP truth, 8 languages, fresh index each — per-question counts + verbatim scorer output" };
  site.artifacts = (site.artifacts || []).filter((a) => a.name !== entry.name);
  const siteIdx = site.artifacts.findIndex((a) => a.name === "site-data.json");
  site.artifacts.splice(siteIdx >= 0 ? siteIdx : site.artifacts.length, 0, entry);
  site.generatedAt = new Date().toISOString();
  const siteText = JSON.stringify(site, null, 2) + "\n";
  leakCheck("site-data.json", siteText);
  fs.writeFileSync(sitePath, siteText);
  console.log(`wrote ${out}: ` + block.languages.map((l) => `${l.lang} ${l.meanF1.toFixed(3)}`).join(", ") + ` — ${artifact.atlas_build}; identical on ${artifact.identical_on.length} earlier builds`);
}
