#!/usr/bin/env node
// Ingest the agent-harness token benchmark (agent_token_bench.py in the
// private bench tree, published as agent-bench/) into the public site payload.
//
// Two steps, never blended:
//   1. private AGENT_TOKEN_REPORT.json -> a public-safe raw artifact in
//      data/raw/ (no local paths, no machine identifiers, every per-run record
//      kept, re-scores and re-runs summarised with what they changed);
//   2. public raw artifact -> the section the page renders (`agentBench`).
//      Step 2 reads ONLY the public artifact, so a reader can recompute every
//      number on the page from data/raw/.
//
// Additive by design: the rest of site-data.json is left byte-identical, so
// this runs without the full build-site-data.mjs input set. build-site-data.mjs
// re-derives the section (via deriveAgentBench below) on full rebuilds.
//
// Usage:
//   node scripts/build-agent-bench-data.mjs /path/to/AGENT_TOKEN_REPORT.json \
//       [--out data/raw/AGENT_TOKEN_BENCH_PUBLIC_<yyyymmdd>.json] \
//       [--supersedes data/raw/AGENT_TOKEN_BENCH_PUBLIC.json]
//
// The per-language runs reuse toPublicArtifact/cellsOf/ratiosOf from here —
// see scripts/build-agent-bench-languages.mjs.
"use strict";

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const round = (x, d = 1) => (x == null || Number.isNaN(x) ? null : Math.round(x * 10 ** d) / 10 ** d);
export const mean = (xs) => {
  const v = xs.filter((x) => typeof x === "number" && !Number.isNaN(x));
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
};

export const MODE_LABELS = { atlas: "Atlas", baseline: "No tool (raw exploration)", graphify: "Graph tool" };

const BANNED = [/\/Users\//, /\/home\//, /\/tmp\//, /\/root\//, /\/private\/var\//, /damirdarasu/, /aziron-ui/i, /aziron-pulse/i, /recallemit/i, /Msys/i];
export function leakCheck(name, text) {
  for (const re of BANNED) if (re.test(text)) throw new Error(`public payload leak in ${name}: ${re}`);
}

/* A version string is published only when it carries no filesystem path. */
const pathFree = (v) => (typeof v === "string" && !/(^|[\s(])\/[^\s]*\//.test(v) ? v : null);

/* --------- which Atlas build answered each atlas-mode cell -------------- */
// A report can be completed in passes: the first run, then `--cells failed
// --merge-into` re-runs of cells that timed out, each pass recording the build
// the agent resolved. Replay the passes in order so every atlas cell is
// attributed to the build that produced the record that survived.

export function atlasBuildsByCell(report) {
  const tv = report.meta.tool_versions || {};
  const base = tv.atlas_on_agent_path || tv.atlas_at_start || tv.atlas || null;
  const byCell = new Map();
  for (const r of report.runs) byCell.set(`${r.agent}:${r.mode}:${r.symbol}`, base);
  for (const rr of report.meta.reruns || []) {
    const kept = new Set(rr.kept_previous_ok || []);
    for (const cell of rr.cells || []) {
      if (kept.has(cell)) continue;
      byCell.set(cell, rr.atlas_on_agent_path || base);
    }
  }
  return byCell;
}

/* ------- re-score passes: what each one changed, from its backup -------- */
// The re-score tool keeps a numbered backup beside the report it rewrote. A
// report completed by a later pass (`--merge-into` a copy) inherits its meta,
// so the backups can sit in the FIRST pass's run directory — the one meta.db
// points into. Look there too, and diff each backup against the state that
// followed it in the same directory.

function rescoreChanges(report, reportPath) {
  if (!reportPath) return [];
  const own = path.dirname(reportPath);
  const dbPath = String(report.meta.db || "").replace(/^sqlite:\/\//, "");
  const baseRun = dbPath ? path.dirname(path.dirname(dbPath)) : null;
  const dirs = [own, baseRun].filter(Boolean);
  const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
  const key = (r) => `${r.qid}|${r.agent}|${r.mode}|${r.rep ?? 1}`;
  const passes = report.meta.rescores || [];
  return passes.map((pass, i) => {
    const name = pass.backup ? path.basename(pass.backup) : null;
    const dir = name ? dirs.find((d) => fs.existsSync(path.join(d, name))) : null;
    let changes = null;
    if (dir) {
      const nextName = passes[i + 1]?.backup ? path.basename(passes[i + 1].backup) : null;
      const afterPath = nextName && fs.existsSync(path.join(dir, nextName)) ? path.join(dir, nextName) : path.join(dir, "AGENT_TOKEN_REPORT.json");
      const before = new Map(read(path.join(dir, name)).runs.map((r) => [key(r), r]));
      changes = read(afterPath).runs
        .filter((r) => before.has(key(r)) && typeof r.f1 === "number" && typeof before.get(key(r)).f1 === "number" && Math.abs(before.get(key(r)).f1 - r.f1) > 1e-9)
        .map((r) => ({ qid: r.qid, agent: r.agent, mode: r.mode, f1_before: round(before.get(key(r)).f1, 3), f1_after: round(r.f1, 3) }));
    }
    return {
      date: pass.date,
      cells_changed: pass.cells_changed,
      ...(dir && dir !== own ? { applied_to: "the first-pass report this one was completed from" } : {}),
      changes,
    };
  });
}

/* ------- private report -> public raw artifact (paths stripped) --------- */

export function toPublicArtifact(report, { reportPath = null, label = "Agent-harness token benchmark", notes = [] } = {}) {
  const builds = atlasBuildsByCell(report);
  const atlasBuildOf = (r) => (r.mode === "atlas" ? pathFree(builds.get(`${r.agent}:${r.mode}:${r.symbol}`)) : undefined);
  const distinctAtlasBuilds = [...new Set(report.runs.filter((r) => r.mode === "atlas").map(atlasBuildOf))];
  const runs = report.runs.map((r) => ({
    qid: r.qid, symbol: r.symbol, agent: r.agent, mode: r.mode, rep: r.rep ?? 1,
    status: r.status,
    ...(r.empty_answer ? { empty_answer: true } : {}),
    input_fresh: r.input_fresh ?? null,
    cache_write: r.cache_write ?? null,
    cache_read: r.cache_read ?? null,
    output_tokens: r.output_tokens ?? null,
    total_tokens: r.total_tokens ?? null,
    billed_proxy_tokens: r.billed_proxy_tokens ?? null,
    turns: r.turns ?? null,
    f1: r.f1 ?? null, precision: r.precision ?? null, recall: r.recall ?? null,
    wall_s: round(r.wall_s, 2),
    model: r.model ?? null,
    ...(distinctAtlasBuilds.length > 1 && r.mode === "atlas" ? { atlas_build: atlasBuildOf(r) } : {}),
    answer: r.answer ?? null, // function-name lists from a public OSS repo
  }));
  const calibration = Object.fromEntries(
    Object.entries(report.calibration || {}).map(([agent, c]) => [agent, {
      model: c.model ?? null,
      input_fresh: c.input_fresh ?? null,
      cache_write: c.cache_write ?? null,
      cache_read: c.cache_read ?? null,
      output_tokens: c.output_tokens ?? null,
      total_tokens: c.total_tokens ?? null,
    }])
  );
  const m = report.meta;
  const tool_versions = Object.fromEntries(
    Object.entries(m.tool_versions || {}).map(([k, v]) => [k, pathFree(v)]).filter(([, v]) => v)
  );
  // The harness writes "codex default" when no model is pinned; the model the
  // run actually used is what codex reported, recorded on the calibration run.
  const models = {
    claude: m.claude_model || calibration.claude?.model || null,
    codex: calibration.codex?.model || (m.codex_model !== "codex default" ? m.codex_model : null),
  };
  const atlasCellsPerBuild = {};
  for (const r of runs.filter((x) => x.mode === "atlas")) {
    const b = atlasBuildOf(r);
    atlasCellsPerBuild[b] = (atlasCellsPerBuild[b] || 0) + 1;
  }
  const qaFile = m.language && m.language !== "go" ? `agent-bench/QA_SET_${m.language}.json` : "agent-bench/QA_SET_logrus.json";
  return {
    label,
    what: "end-to-end token usage reported by real coding-agent harnesses (claude -p, codex exec) answering LSP-ground-truth caller questions, restricted per run to one code-intel tool",
    repo_slug: m.repo_slug,
    repo_url: m.repo_url,
    repo_commit: m.repo_commit,
    language: m.language || "go",
    truth: m.truth || "gopls call_hierarchy",
    qa_set: qaFile,
    n_questions: m.n_questions,
    agents: m.agents,
    modes: m.modes,
    repeats: m.repeats ?? 1,
    date: m.date,
    models,
    tool_versions,
    atlas_cells_per_build: atlasCellsPerBuild,
    ...(m.reruns?.length ? {
      reruns: m.reruns.map((rr) => {
        const statuses = Object.values(rr.statuses || {});
        return {
          date: rr.date,
          cells: (rr.cells || []).length,
          ok: statuses.filter((s) => s === "ok").length,
          kept_previous_ok: (rr.kept_previous_ok || []).length,
          atlas_on_agent_path: pathFree(rr.atlas_on_agent_path),
        };
      }),
    } : {}),
    ...(m.rescores?.length ? { rescores: rescoreChanges(report, reportPath) } : {}),
    ...(notes.length ? { notes } : {}),
    suite: `agent-bench/ in this repository — reproduce with: python3 agent-bench/agent_token_bench.py --setup --agents auto --modes atlas,graphify,baseline --qa-set ${qaFile}`,
    calibration,
    runs,
  };
}

/* --------------- public artifact -> cells and ratios -------------------- */

export function cellsOf(artifact) {
  const keys = [...new Set(artifact.runs.map((r) => `${r.agent}|${r.mode}`))];
  return keys.map((k) => {
    const [agent, mode] = k.split("|");
    const rs = artifact.runs.filter((r) => r.agent === agent && r.mode === mode);
    const ok = rs.filter((r) => r.status === "ok");
    const raw = {
      totalTokens: mean(ok.map((r) => r.total_tokens)),
      billedProxy: mean(ok.map((r) => r.billed_proxy_tokens)),
      outputTokens: mean(ok.map((r) => r.output_tokens)),
      turns: mean(ok.map((r) => r.turns)),
      f1: mean(ok.map((r) => r.f1)),
      wallS: mean(ok.map((r) => r.wall_s)),
    };
    return {
      agent, mode,
      totalTokens: Math.round(raw.totalTokens),
      billedProxy: Math.round(raw.billedProxy),
      outputTokens: Math.round(raw.outputTokens),
      turns: round(raw.turns, 1),
      f1: round(raw.f1, 3),
      wallS: round(raw.wallS, 1),
      ok: ok.length, n: rs.length,
      emptyAnswers: ok.filter((r) => r.empty_answer).length,
      raw,
    };
  });
}

// Ratios are taken between UNROUNDED per-run means, so they can differ in the
// last digit from a quotient of the rounded cells shown beside them.
export function ratiosOf(cells, agent, modes) {
  const base = cells.find((c) => c.agent === agent && c.mode === "atlas");
  return Object.fromEntries(modes.filter((m) => m !== "atlas").map((m) => {
    const other = cells.find((c) => c.agent === agent && c.mode === m);
    const ratio = (key) => (base && other && base.raw[key] && other.raw[key] ? round(other.raw[key] / base.raw[key], 2) : null);
    return [m, { totalTokens: ratio("totalTokens"), billedProxy: ratio("billedProxy"), turns: ratio("turns") }];
  }));
}

// "Atlas beats both" — the owner's bar for the multi-language run: higher mean
// F1 than BOTH comparators and lower mean total tokens than BOTH.
export function verdictOf(cells, agent) {
  const c = (m) => cells.find((x) => x.agent === agent && x.mode === m);
  const a = c("atlas"), b = c("baseline"), g = c("graphify");
  if (!a || !b || !g) return null;
  const accuracy = a.raw.f1 > b.raw.f1 && a.raw.f1 > g.raw.f1;
  const tokens = a.raw.totalTokens < b.raw.totalTokens && a.raw.totalTokens < g.raw.totalTokens;
  return { pass: accuracy && tokens, accuracy, tokens };
}

const stripRaw = (cells) => cells.map(({ raw, ...c }) => c);
const harnessLabel = (agent, tv) =>
  agent === "claude" ? (tv.claude ? `Claude Code ${tv.claude.replace(/\s*\(Claude Code\)\s*$/, "")}` : null) : (tv.codex || null);

/* -------- public artifact -> the section the page renders --------------- */

export function deriveAgentBench(artifact, { artifactPath, supersedes = null } = {}) {
  const cells = cellsOf(artifact);
  const tv = artifact.tool_versions || {};
  const agents = (artifact.agents || []).map((a) => ({
    id: a,
    model: [artifact.models?.[a], artifact.calibration?.[a]?.model, (artifact.runs.find((r) => r.agent === a && r.model && r.model !== "default") || {}).model]
      .find((m) => m && m !== "codex default" && m !== "default") || null,
    harness: harnessLabel(a, tv),
    calibrationTotal: artifact.calibration?.[a]?.total_tokens ?? null,
    vsAtlas: ratiosOf(cells, a, artifact.modes || []),
  }));
  const atlasF1 = Object.fromEntries(agents.map((a) => [a.id, cells.find((c) => c.agent === a.id && c.mode === "atlas")?.f1 ?? null]));
  const out = {
    label: `Agent-harness token benchmark — ${artifact.date}${tv.atlas ? ` · Atlas ${(tv.atlas.match(/^atlas v?(\S+)/) || [])[1] || tv.atlas}` : ""}`,
    date: artifact.date,
    atlasBuild: tv.atlas || null,
    graphifyVersion: tv.graphify || null,
    repo: artifact.repo_slug,
    commit7: String(artifact.repo_commit || "").slice(0, 7),
    nQuestions: artifact.n_questions,
    truth: "gopls call_hierarchy (LSP-truth), frozen at the pinned commit",
    qaSet: artifact.qa_set || "agent-bench/QA_SET_logrus.json",
    modes: artifact.modes,
    agents,
    cells: stripRaw(cells),
    atlasF1,
    caveat: "Cross-agent absolute totals are not comparable — the two harnesses use different tokenizers and system-prompt floors (see each agent's calibration). Compare modes within an agent.",
    billedProxyNote: "billed-proxy = fresh input + cache writes + output (codex: fresh input + output); cache reads bill at ~10% and are excluded.",
    ratioNote: "Ratios are the other mode's mean over Atlas's mean, computed from the unrounded per-run means.",
    artifact: artifactPath,
    suiteCmd: "python3 agent-bench/agent_token_bench.py --setup --agents auto \\\n    --modes atlas,graphify,baseline \\\n    --qa-set agent-bench/QA_SET_logrus.json --workdir agentbench-work",
    suiteNeeds: "python3, git, atlas on PATH, graphify (uv tool install graphifyy), and claude and/or codex logged in",
  };
  const rescored = (artifact.rescores || []).flatMap((p) => p.changes || []);
  if (rescored.length) {
    out.rescoreNote = `Re-scored after the run when the scorer learned to strip "::" qualifiers: ${rescored.map((c) => `${c.agent} · ${MODE_LABELS[c.mode] || c.mode} · ${c.qid.replace(/^callers::/, "")} ${c.f1_before.toFixed(2)} → ${c.f1_after.toFixed(2)}`).join("; ")}. The stored answers did not change; every pass is recorded in the artifact.`;
  }
  if (supersedes) out.supersedes = supersedes;
  return out;
}

/* ---- the run this one replaces, summarised from ITS public artifact ---- */

export function summarizeSuperseded(oldArtifact, oldPath, current) {
  const old = deriveAgentBench(oldArtifact, { artifactPath: oldPath });
  const tv = oldArtifact.tool_versions || {};
  const pick = (a) => old.agents.find((x) => x.id === a);
  const cell = (cells, a, m) => cells.find((c) => c.agent === a && c.mode === m);
  const floorDelta = (a) => (current.agents.find((x) => x.id === a)?.calibrationTotal ?? 0) - (pick(a)?.calibrationTotal ?? 0);
  const codexOld = cell(old.cells, "codex", "baseline"), codexNew = cell(current.cells, "codex", "baseline");
  return {
    label: old.label,
    date: oldArtifact.date,
    atlasBuild: tv.atlas || null,
    graphifyVersion: tv.graphify || null,
    harnesses: Object.fromEntries(old.agents.map((a) => [a.id, a.harness])),
    models: Object.fromEntries(old.agents.map((a) => [a.id, a.model])),
    calibration: Object.fromEntries(old.agents.map((a) => [a.id, a.calibrationTotal])),
    vsAtlasTotalTokens: Object.fromEntries(old.agents.map((a) => [a.id, { baseline: a.vsAtlas.baseline?.totalTokens ?? null, graphify: a.vsAtlas.graphify?.totalTokens ?? null }])),
    cells: old.cells.map(({ agent, mode, totalTokens, turns, f1 }) => ({ agent, mode, totalTokens, turns, f1 })),
    artifact: oldPath,
    why:
      `The gap narrowed. Atlas's F1 did not move (${["claude", "codex"].map((a) => `${a} ${cell(old.cells, a, "atlas").f1.toFixed(3)} → ${cell(current.cells, a, "atlas").f1.toFixed(3)}`).join(", ")}). ` +
      `Two measured changes account for part of it: each harness's fixed floor rose (claude +${floorDelta("claude").toLocaleString("en-US")}, codex +${floorDelta("codex").toLocaleString("en-US")} tokens), and a larger floor added to both sides pulls every ratio toward 1; ` +
      `and the newer codex is stronger without help (no-tool F1 ${codexOld.f1.toFixed(3)} → ${codexNew.f1.toFixed(3)}, ${codexOld.turns} → ${codexNew.turns} turns). ` +
      `Atlas's own per-question totals rose too (claude ${cell(old.cells, "claude", "atlas").totalTokens.toLocaleString("en-US")} → ${cell(current.cells, "claude", "atlas").totalTokens.toLocaleString("en-US")}, codex ${cell(old.cells, "codex", "atlas").totalTokens.toLocaleString("en-US")} → ${cell(current.cells, "codex", "atlas").totalTokens.toLocaleString("en-US")}); this run does not isolate why.`,
  };
}

// §06 "Go flagship" panel and the §01 card are a VIEW of the agent-harness
// section (same repository, same ground truth, same run) — derived from it so
// the three places can never disagree.
export function goFlagshipFrom(agentBench) {
  const cell = (agent, mode) => agentBench.cells.find((c) => c.agent === agent && c.mode === mode) || {};
  const turnsX = agentBench.agents.map((a) => a.vsAtlas.graphify?.turns).filter((x) => x != null);
  const gF1 = agentBench.agents.map((a) => cell(a.id, "graphify").f1).filter((x) => x != null);
  const aF1 = [...new Set(agentBench.agents.map((a) => cell(a.id, "atlas").f1))];
  const aTurns = agentBench.agents.map((a) => cell(a.id, "atlas").turns);
  return {
    label: agentBench.label,
    date: agentBench.date,
    atlasBuild: agentBench.atlasBuild,
    repo: agentBench.repo,
    commit7: agentBench.commit7,
    truth: agentBench.truth,
    lane: "end-to-end agent harness, one code-intel tool per run",
    questions: agentBench.nQuestions,
    rows: agentBench.agents.flatMap((a) => ["atlas", "baseline", "graphify"].map((mode) => {
      const c = cell(a.id, mode);
      return { agent: a.id, tool: MODE_LABELS[mode], f1: c.f1 ?? null, tokens: c.totalTokens ?? null, turns: c.turns ?? null };
    })),
    why: `A production function has many more callers than a fixture does, spread across files. Given only the graph tool, the two agents spent ${Math.min(...turnsX).toFixed(1)}× and ${Math.max(...turnsX).toFixed(1)}× Atlas's turns and still scored F1 ${Math.min(...gF1).toFixed(3)}–${Math.max(...gF1).toFixed(3)}; given Atlas, both answered in ${Math.min(...aTurns)}–${Math.max(...aTurns)} turns at F1 ${aF1.map((f) => f.toFixed(3)).join(" / ")}.`,
    caveat: agentBench.caveat,
  };
}

export const agentBenchArtifactEntry = (artifactPath, note) => ({
  name: path.basename(artifactPath),
  path: artifactPath,
  tier: "fresh",
  note,
});

/* ------------------------------ CLI ------------------------------------- */

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const args = process.argv.slice(2);
  const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : null; };
  const outArg = flag("--out");
  const supersedesArg = flag("--supersedes");
  const src = args[0];
  if (!src) throw new Error("Usage: node scripts/build-agent-bench-data.mjs /path/to/AGENT_TOKEN_REPORT.json [--out data/raw/NAME.json] [--supersedes data/raw/OLD.json]");

  const report = JSON.parse(fs.readFileSync(src, "utf8"));
  const publicArtifact = toPublicArtifact(report, { reportPath: src });
  const outRel = outArg || `data/raw/AGENT_TOKEN_BENCH_PUBLIC_${String(publicArtifact.date).replace(/-/g, "")}.json`;
  const artifactText = JSON.stringify(publicArtifact, null, 2) + "\n";
  leakCheck(path.basename(outRel), artifactText);
  fs.writeFileSync(path.join(repoRoot, outRel), artifactText);

  let agentBench = deriveAgentBench(publicArtifact, { artifactPath: outRel });
  if (supersedesArg) {
    const old = JSON.parse(fs.readFileSync(path.join(repoRoot, supersedesArg), "utf8"));
    agentBench = deriveAgentBench(publicArtifact, { artifactPath: outRel, supersedes: summarizeSuperseded(old, supersedesArg, agentBench) });
  }
  const sitePath = path.join(repoRoot, "data", "site-data.json");
  const site = JSON.parse(fs.readFileSync(sitePath, "utf8"));
  site.agentBench = agentBench;
  const entry = agentBenchArtifactEntry(outRel, `agent-harness end-to-end token usage, ${publicArtifact.date} (claude + codex, ${publicArtifact.runs.length} per-run records)`);
  site.artifacts = (site.artifacts || []).filter((a) => a.name !== entry.name);
  if (supersedesArg) {
    site.artifacts = site.artifacts.map((a) => (a.path === supersedesArg
      ? { ...a, tier: "carried", note: `SUPERSEDED by ${entry.name} — the ${agentBench.supersedes.date} agent-harness run, kept so the previously published table stays auditable` }
      : a));
  }
  const siteIdx = site.artifacts.findIndex((a) => a.name === "site-data.json");
  site.artifacts.splice(siteIdx >= 0 ? siteIdx : site.artifacts.length, 0, entry);
  site.generatedAt = new Date().toISOString();

  const siteText = JSON.stringify(site, null, 2) + "\n";
  leakCheck("site-data.json", siteText);
  fs.writeFileSync(sitePath, siteText);

  console.log(
    `wrote ${outRel} (${publicArtifact.runs.length} runs) and patched site-data.json — ` +
    agentBench.agents.map((a) => `${a.id}: baseline ${a.vsAtlas.baseline?.totalTokens ?? "—"}× / graph tool ${a.vsAtlas.graphify?.totalTokens ?? "—"}× Atlas total tokens`).join(", ")
  );
}
