#!/usr/bin/env node
// Ingest the multi-language agent-harness benchmark: the same harness as the
// logrus run (agent-bench/agent_token_bench.py), one pinned public repository
// per language, 19 LSP-truth caller questions each, claude and codex, three
// modes. Writes one public raw artifact per language and the
// `agentBenchLanguages` section of data/site-data.json.
//
//   private AGENT_TOKEN_REPORT.json (per language)
//     -> data/raw/AGENT_TOKEN_BENCH_<LANG>_<yyyymmdd>.json   (public, scrubbed)
//     -> site.agentBenchLanguages                            (derived ONLY from
//        the public artifacts and agent-bench/QA_SET_<lang>.json)
//
// Usage:
//   node scripts/build-agent-bench-languages.mjs go=/path/AGENT_TOKEN_REPORT.json \
//       python=/path/AGENT_TOKEN_REPORT.json ...
"use strict";

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { toPublicArtifact, cellsOf, ratiosOf, verdictOf, leakCheck, MODE_LABELS } from "./build-agent-bench-data.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const LANG_ORDER = ["go", "python", "c", "java", "cpp", "javascript", "typescript", "rust"];
const LANG_LABEL = { go: "Go", python: "Python", c: "C", java: "Java", cpp: "C++", javascript: "JavaScript", typescript: "TypeScript", rust: "Rust" };
export const qaSetFor = (lang) => `agent-bench/QA_SET_${lang === "go" ? "logrus" : lang}.json`;
export const rawNameFor = (lang, date) => `data/raw/AGENT_TOKEN_BENCH_${lang.toUpperCase()}_${String(date).replace(/-/g, "")}.json`;

// The language server behind each frozen truth set, read from the QA set's own
// metadata ("clangd LSP call_hierarchy, union over …" -> "clangd").
const truthTool = (truth) => String(truth || "").split(/\s+(?:LSP\b|call_hierarchy\b)/)[0].trim() || null;

// Why a language's numbers moved after the run, in words. Only where the
// artifact's own re-score record shows the change; the reason is the one the
// regenerated QA set's metadata dates (generated 2026-10-29).
const RESCORE_REASON = {
  javascript: "the QA set was regenerated on 2026-10-29 after the truth generator stopped counting references passed as values (for example bind(…)) as calls, and the stored answers were re-scored against it",
  typescript: "the QA set was regenerated on 2026-10-29 after the truth generator stopped counting references passed as values (for example bind(…)) as calls, and the stored answers were re-scored against it",
  cpp: "the scorer learned to strip C++ qualifiers (\"Class::method\" scores as \"method\") and a destructor's leading \"~\", which the clangd truth set spells without it",
  rust: "the scorer learned to strip Rust path qualifiers (\"module::function\" scores as \"function\")",
  go: "the scorer learned to strip \"::\" qualifiers",
};

function languageNotes(lang, artifact) {
  const notes = [];
  const builds = Object.entries(artifact.atlas_cells_per_build || {});
  if (builds.length > 1) {
    notes.push(`Atlas cells came from ${builds.length} builds of the same branch: ${builds.map(([b, n]) => `${n} on ${b}`).join("; ")}. The later build answered only cells re-run after a timeout or provider error; each atlas run's build is recorded in the artifact.`);
  }
  const reruns = artifact.reruns || [];
  if (reruns.length) {
    const okCells = reruns.reduce((s, r) => s + r.ok, 0);
    notes.push(`${reruns.length} re-run pass${reruns.length > 1 ? "es" : ""} completed cells that timed out or hit provider errors (${okCells} ok results came back from re-runs); every final cell is ok.`);
  }
  const changes = (artifact.rescores || []).flatMap((p) => (p.changes || []).map((c) => ({ ...c, base: !!p.applied_to })));
  const published = new Set(artifact.runs.map((r) => `${r.qid}|${r.agent}|${r.mode}`));
  const visible = changes.filter((c) => published.has(`${c.qid}|${c.agent}|${c.mode}`) && !(c.base && c.mode === "atlas"));
  if (visible.length && RESCORE_REASON[lang]) {
    const byMode = {};
    for (const c of visible) byMode[c.mode] = (byMode[c.mode] || 0) + 1;
    notes.push(`Re-scored after the run: ${RESCORE_REASON[lang]}. ${visible.length} stored answer${visible.length > 1 ? "s" : ""} changed score (${Object.entries(byMode).map(([m, n]) => `${MODE_LABELS[m] || m} ${n}`).join(", ")}); the answers themselves did not change, and every pass is listed in the artifact.`);
  }
  const empties = artifact.runs.filter((r) => r.empty_answer);
  if (empties.length) {
    const byMode = {};
    for (const r of empties) byMode[`${r.agent} · ${MODE_LABELS[r.mode] || r.mode}`] = (byMode[`${r.agent} · ${MODE_LABELS[r.mode] || r.mode}`] || 0) + 1;
    notes.push(`${empties.length} run${empties.length > 1 ? "s" : ""} finished without naming any function (${Object.entries(byMode).map(([k, n]) => `${k} ${n}`).join(", ")}); each is scored F1 0, not dropped.`);
  }
  return notes;
}

/* ------- public artifacts + QA sets -> the section the page renders ------ */

export function deriveAgentBenchLanguages(entries) {
  const languages = entries
    .sort((a, b) => LANG_ORDER.indexOf(a.lang) - LANG_ORDER.indexOf(b.lang))
    .map(({ lang, artifact, artifactPath, qa }) => {
      if (qa.meta.commit !== artifact.repo_commit) throw new Error(`${lang}: QA set commit ${qa.meta.commit} != run commit ${artifact.repo_commit}`);
      const cells = cellsOf(artifact);
      const modes = ["atlas", "baseline", "graphify"];
      return {
        lang,
        label: LANG_LABEL[lang] || lang,
        repo: artifact.repo_slug,
        repoUrl: artifact.repo_url,
        commit: artifact.repo_commit,
        commit7: String(artifact.repo_commit).slice(0, 7),
        nQuestions: artifact.n_questions,
        truthTool: truthTool(qa.meta.truth),
        truth: qa.meta.truth,
        qaSet: qaSetFor(lang),
        artifact: artifactPath,
        atlasBuilds: Object.entries(artifact.atlas_cells_per_build || {}).map(([build, cellsN]) => ({ build, cells: cellsN })),
        calibration: Object.fromEntries(Object.entries(artifact.calibration || {}).map(([a, c]) => [a, c.total_tokens ?? null])),
        cells: cells
          .sort((x, y) => x.agent.localeCompare(y.agent) || modes.indexOf(x.mode) - modes.indexOf(y.mode))
          .map(({ raw, outputTokens, ...c }) => c),
        vsAtlas: Object.fromEntries(artifact.agents.map((a) => [a, ratiosOf(cells, a, modes)])),
        verdict: Object.fromEntries(artifact.agents.map((a) => [a, verdictOf(cells, a)])),
        notes: languageNotes(lang, artifact),
      };
    });

  const all = languages.flatMap((l) => Object.values(l.verdict));
  const first = entries[0].artifact;
  const tv = first.tool_versions || {};
  for (const e of entries) {
    for (const k of ["claude", "codex", "graphify"]) {
      if ((e.artifact.tool_versions || {})[k] !== tv[k]) throw new Error(`${e.lang}: ${k} version differs (${e.artifact.tool_versions?.[k]} vs ${tv[k]}) — the section states one version per tool`);
    }
  }
  const builds = [...new Set(languages.flatMap((l) => l.atlasBuilds.map((b) => b.build)))].sort();
  return {
    label: `Multi-language agent benchmark — ${first.date} · ${languages.length} languages × 2 agents × 3 modes`,
    date: first.date,
    what: "The logrus harness, generalized: one pinned public repository per language, 19 caller questions each with the language's own server as ground truth, Claude Code and Codex restricted to one code-intelligence CLI per run, each harness's own token accounting.",
    shipsIn: "0.1.55",
    atlasBuildNote: `Atlas cells ran on develop working-tree builds made during the campaign (${builds.length} distinct builds, listed per language); the changes merged to develop the same night and ship in 0.1.55. The tool-level table below re-measures the merged code on fresh indexes.`,
    atlasBuilds: builds,
    agents: first.agents.map((a) => ({
      id: a,
      model: first.models?.[a] || null,
      harness: a === "claude" ? `Claude Code ${String(tv.claude || "").replace(/\s*\(Claude Code\)\s*$/, "")}` : tv.codex || null,
    })),
    graphifyVersion: tv.graphify || null,
    modes: ["atlas", "baseline", "graphify"],
    nQuestionsPerLanguage: [...new Set(languages.map((l) => l.nQuestions))].length === 1 ? languages[0].nQuestions : null,
    totalRuns: entries.reduce((s, e) => s + e.artifact.runs.length, 0),
    okRuns: entries.reduce((s, e) => s + e.artifact.runs.filter((r) => r.status === "ok").length, 0),
    verdictRule: "A cell passes when Atlas's mean F1 is higher than BOTH the no-tool baseline's and the graph tool's, AND its mean total tokens are lower than both — for that agent, on that language.",
    verdict: { pass: all.filter((v) => v && v.pass).length, total: all.length },
    caveat: "Cross-agent and cross-language absolute totals are not comparable — different tokenizers, system-prompt floors and repositories. Compare modes within one agent on one language.",
    ratioNote: "Token ratios are the other mode's mean total tokens over Atlas's, from the unrounded per-run means.",
    suiteCmd: "python3 agent-bench/agent_token_bench.py --setup --agents auto \\\n    --modes atlas,graphify,baseline \\\n    --qa-set agent-bench/QA_SET_<lang>.json --workdir agentbench-<lang>",
    languages,
  };
}

export const languageArtifactEntries = (block) => block.languages.map((l) => ({
  name: path.basename(l.artifact),
  path: l.artifact,
  tier: "fresh",
  note: `multi-language agent benchmark — ${l.label} (${l.repo}), claude + codex × atlas/baseline/graph tool, per-run records`,
}));

export function loadLanguageEntries(dir = repoRoot, date) {
  return LANG_ORDER.map((lang) => {
    const artifactPath = rawNameFor(lang, date);
    const abs = path.join(dir, artifactPath);
    if (!fs.existsSync(abs)) return null;
    return {
      lang,
      artifactPath,
      artifact: JSON.parse(fs.readFileSync(abs, "utf8")),
      qa: JSON.parse(fs.readFileSync(path.join(dir, qaSetFor(lang)), "utf8")),
    };
  }).filter(Boolean);
}

/* ------------------------------ CLI ------------------------------------- */

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const pairs = process.argv.slice(2).map((a) => a.split("="));
  if (!pairs.length) throw new Error("Usage: node scripts/build-agent-bench-languages.mjs go=/path/AGENT_TOKEN_REPORT.json python=… ");
  let date = null;
  for (const [lang, src] of pairs) {
    if (!LANG_ORDER.includes(lang)) throw new Error(`unknown language ${lang}`);
    const report = JSON.parse(fs.readFileSync(src, "utf8"));
    const artifact = toPublicArtifact(report, { reportPath: src, label: `Multi-language agent-harness benchmark — ${LANG_LABEL[lang]}` });
    if (artifact.language !== lang) throw new Error(`${src}: report language ${artifact.language} != ${lang}`);
    date = date || artifact.date;
    if (artifact.date !== date) throw new Error(`${lang}: run date ${artifact.date} != ${date}`);
    const out = rawNameFor(lang, date);
    const text = JSON.stringify(artifact, null, 2) + "\n";
    leakCheck(path.basename(out), text);
    fs.writeFileSync(path.join(repoRoot, out), text);
  }

  const block = deriveAgentBenchLanguages(loadLanguageEntries(repoRoot, date));
  const sitePath = path.join(repoRoot, "data", "site-data.json");
  const site = JSON.parse(fs.readFileSync(sitePath, "utf8"));
  site.agentBenchLanguages = block;
  const entries = languageArtifactEntries(block);
  const names = new Set(entries.map((e) => e.name));
  site.artifacts = (site.artifacts || []).filter((a) => !names.has(a.name));
  const siteIdx = site.artifacts.findIndex((a) => a.name === "site-data.json");
  site.artifacts.splice(siteIdx >= 0 ? siteIdx : site.artifacts.length, 0, ...entries);
  site.generatedAt = new Date().toISOString();
  const siteText = JSON.stringify(site, null, 2) + "\n";
  leakCheck("site-data.json", siteText);
  fs.writeFileSync(sitePath, siteText);

  console.log(`agentBenchLanguages: ${block.verdict.pass}/${block.verdict.total} cells pass, ${block.okRuns}/${block.totalRuns} runs ok`);
  for (const l of block.languages) {
    const f = (a, m) => l.cells.find((c) => c.agent === a && c.mode === m);
    console.log(
      `  ${l.lang.padEnd(11)} ${l.repo.padEnd(20)} ` +
      ["claude", "codex"].map((a) => `${a} F1 ${f(a, "atlas").f1}/${f(a, "baseline").f1}/${f(a, "graphify").f1} tok×${l.vsAtlas[a].baseline.totalTokens}/${l.vsAtlas[a].graphify.totalTokens} ${l.verdict[a].pass ? "PASS" : "FAIL"}`).join(" | ")
    );
  }
}
