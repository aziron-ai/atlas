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
//       [--supersedes data/raw/<previous run>.json [--supersedes data/raw/<the one before>.json …]] \
//       [--atlas-release <x.y.z>]
//
// --supersedes may repeat, newest first: the first is the run this one
// replaces (`agentBench.supersedes`), and every one becomes a row of
// `agentBench.history` beside the current run. --atlas-release names the
// release a development-described build is the code of (recorded in the
// public artifact as `atlas_release`, with a note naming the build).
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

export function toPublicArtifact(report, { reportPath = null, label = "Agent-harness token benchmark", notes = [], atlasRelease = null } = {}) {
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
    ...(atlasRelease ? { atlas_release: atlasRelease } : {}),
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

/* -------- which Atlas a run measured, from its own version string ------- */
// "atlas 0.1.54 (e4b0dc22…, …)"               -> the released 0.1.54
// "atlas v0.1.52-699-g3790ba95 (3790ba95, …)" -> a described development
//     build; it is named as a release only when the artifact says which one
//     (`atlas_release`, written by --atlas-release at ingest).

export const atlasVersionOf = (s) => (String(s || "").match(/^atlas (v?\S+)/) || [])[1] || null;
export const atlasCommitOf = (s) => ((String(s || "").match(/\(([0-9a-f]{7,40})\b/) || [])[1] || "").slice(0, 8) || null;

export function atlasIdentity(artifact) {
  const tv = artifact.tool_versions || {};
  const version = atlasVersionOf(tv.atlas);
  const commit = atlasCommitOf(tv.atlas);
  const plain = version && /^v?\d+\.\d+\.\d+$/.test(version) ? version.replace(/^v/, "") : null;
  const release = artifact.atlas_release || plain;
  return {
    version,
    commit,
    release,
    // the one phrase every surface uses for "which binary answered"
    binary: !version ? null
      : release && release === plain ? `the released Atlas ${release}${commit ? ` (${commit})` : ""}`
      : release ? `the Atlas ${release} release code, built from ${commit} (version string ${version})`
      : `an Atlas development build, ${version}`,
    // compact form for tables and change lists
    tag: release ? `${release}${commit ? ` (${commit})` : ""}` : version,
  };
}

/* ------- marginal cost: what a question costs above the harness floor --- */
// Every run first pays its harness's floor: the calibration run, a no-tool
// "Reply with exactly: OK". Floors move with harness versions, and a constant
// added to both sides of a ratio pulls it toward 1 — so beside the ratio of
// mean totals the page shows the ratio of (mean total − floor), computed from
// the unrounded per-run means like every other ratio here.

export const MARGINAL_NOTE =
  "Marginal = mean total tokens − the harness floor, where the floor is what the same harness spends on a no-tool “Reply with exactly: OK” before any question (its calibration run); the marginal ratio leaves out that one fixed cost, which otherwise sits on both sides of every total ratio and pulls it toward 1.";

export function marginalOf(cells, agent, floor, modes) {
  const above = (m) => {
    const c = cells.find((x) => x.agent === agent && x.mode === m);
    return c && floor != null && c.raw.totalTokens != null ? c.raw.totalTokens - floor : null;
  };
  const base = above("atlas");
  return {
    tokens: Object.fromEntries(modes.map((m) => [m, above(m) == null ? null : Math.round(above(m))])),
    ratios: Object.fromEntries(modes.filter((m) => m !== "atlas").map((m) => [m, base > 0 && above(m) != null ? round(above(m) / base, 2) : null])),
  };
}

/* -------- public artifact -> the section the page renders --------------- */

export function deriveAgentBench(artifact, { artifactPath, supersedes = null, history = null } = {}) {
  const cells = cellsOf(artifact);
  const tv = artifact.tool_versions || {};
  const id = atlasIdentity(artifact);
  const modes = artifact.modes || [];
  const agents = (artifact.agents || []).map((a) => {
    const calibrationTotal = artifact.calibration?.[a]?.total_tokens ?? null;
    const vsAtlas = ratiosOf(cells, a, modes);
    const marginal = marginalOf(cells, a, calibrationTotal, modes);
    for (const [m, r] of Object.entries(marginal.ratios)) if (vsAtlas[m]) vsAtlas[m].marginal = r;
    return {
      id: a,
      model: [artifact.models?.[a], artifact.calibration?.[a]?.model, (artifact.runs.find((r) => r.agent === a && r.model && r.model !== "default") || {}).model]
        .find((m) => m && m !== "codex default" && m !== "default") || null,
      harness: harnessLabel(a, tv),
      calibrationTotal,
      marginalTokens: marginal.tokens,
      vsAtlas,
    };
  });
  const atlasF1 = Object.fromEntries(agents.map((a) => [a.id, cells.find((c) => c.agent === a.id && c.mode === "atlas")?.f1 ?? null]));
  const out = {
    label: `Agent-harness token benchmark — ${artifact.date}${id.version ? ` · Atlas ${id.release || id.version.replace(/^v/, "")}` : ""}`,
    date: artifact.date,
    atlasBuild: tv.atlas || null,
    atlasRelease: id.release,
    atlasVersion: id.version,
    atlasCommit: id.commit,
    atlasBinary: id.binary,
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
    marginalNote: MARGINAL_NOTE,
    artifact: artifactPath,
    suiteCmd: "python3 agent-bench/agent_token_bench.py --setup --agents auto \\\n    --modes atlas,graphify,baseline \\\n    --qa-set agent-bench/QA_SET_logrus.json --workdir agentbench-work",
    suiteNeeds: "python3, git, atlas on PATH, graphify (uv tool install graphifyy), and claude and/or codex logged in",
  };
  const rescored = (artifact.rescores || []).flatMap((p) => p.changes || []);
  if (rescored.length) {
    out.rescoreNote = `Re-scored after the run when the scorer learned to strip "::" qualifiers: ${rescored.map((c) => `${c.agent} · ${MODE_LABELS[c.mode] || c.mode} · ${c.qid.replace(/^callers::/, "")} ${c.f1_before.toFixed(2)} → ${c.f1_after.toFixed(2)}`).join("; ")}. The stored answers did not change; every pass is recorded in the artifact.`;
  }
  const empty = cells.filter((c) => c.emptyAnswers > 0);
  if (empty.length) {
    out.emptyNote = `${empty.map((c) => `${c.emptyAnswers} of ${c.agent}'s ${c.ok} ${(MODE_LABELS[c.mode] || c.mode).toLowerCase()} runs`).join(" and ")} finished without naming any function; each is scored F1 0, not dropped, and its tokens count.`;
  }
  if (supersedes) out.supersedes = supersedes;
  if (history) out.history = history;
  return out;
}

/* ---------- what moved between two runs — measured, never explained ----- */
// Built from the two derived sections only. Direction words come from the
// numbers ("flat" = within 2%); no cause is offered, because neither run
// isolates one.

const AGENT_NAME = { claude: "Claude", codex: "Codex" };
const fmtN = (n) => (n == null ? "—" : Number(n).toLocaleString("en-US"));
const fmtF1 = (x) => (x == null ? "—" : Number(x).toFixed(3));
const trendWord = (a, b) => (a == null || b == null ? "" : Math.abs(b - a) <= 0.02 * a ? "flat" : b > a ? "up" : "down");
// "Claude Code 2.1.178" → "Claude Code 2.1.304" reads as "Claude Code 2.1.178 → 2.1.304"
const versionChange = (a, b) => {
  const [pa, pb] = [String(a).split(" "), String(b).split(" ")];
  const head = pa.slice(0, -1).join(" ");
  return pa.length > 1 && head === pb.slice(0, -1).join(" ") ? `${head} ${pa.at(-1)} → ${pb.at(-1)}` : `${a} → ${b}`;
};

export function whatMoved(older, newer) {
  const cell = (d, a, m) => d.cells.find((c) => c.agent === a && c.mode === m) || {};
  const ids = newer.agents.map((a) => a.id).filter((x) => older.agents.some((o) => o.id === x));
  const o = (x) => older.agents.find((a) => a.id === x);
  const n = (x) => newer.agents.find((a) => a.id === x);
  const tagOf = (d) => (d.atlasRelease ? `${d.atlasRelease}${d.atlasCommit ? ` (${d.atlasCommit})` : ""}` : d.atlasVersion);

  const changed = [], same = [];
  if (tagOf(older) !== tagOf(newer)) changed.push(`Atlas ${tagOf(older)} → ${tagOf(newer)}`);
  for (const x of ids) {
    const ho = o(x).harness, hn = n(x).harness, mo = o(x).model, mn = n(x).model;
    if (ho === hn && mo === mn) same.push(`${hn} with ${mn}`);
    else {
      if (ho !== hn) changed.push(versionChange(ho, hn));
      if (mo !== mn) changed.push(`${AGENT_NAME[x] || x} model ${mo} → ${mn}`);
    }
  }
  if (older.graphifyVersion === newer.graphifyVersion) same.push(newer.graphifyVersion);
  else changed.push(versionChange(older.graphifyVersion, newer.graphifyVersion));
  const setup = `${changed.length ? `Changed between the runs: ${changed.join("; ")}.` : "Nothing in the setup changed."}${same.length ? ` Unchanged: ${same.join(", ")}.` : ""}`;

  const pairs = ids.map((x) => [fmtF1(older.atlasF1[x]), fmtF1(newer.atlasF1[x])]);
  const uniform = pairs.every(([a, b]) => a === pairs[0][0] && b === pairs[0][1]);
  const scope = ids.length === 2 ? "on both harnesses" : "on every harness";
  const f1 = uniform
    ? (pairs[0][0] === pairs[0][1] ? `Atlas's F1 held at ${pairs[0][1]} ${scope}.` : `Atlas's F1 ${pairs[0][0]} → ${pairs[0][1]} ${scope}.`)
    : `Atlas's F1: ${ids.map((x, i) => `${AGENT_NAME[x] || x} ${pairs[i][0]} → ${pairs[i][1]}`).join(", ")}.`;

  const perAgent = ids.map((x) => {
    const tot = (d, m) => cell(d, x, m).totalTokens;
    const moved = (m) => `${trendWord(tot(older, m), tot(newer, m))} (${fmtN(tot(older, m))} → ${fmtN(tot(newer, m))})`;
    return `${AGENT_NAME[x] || x}: Atlas totals ${moved("atlas")}, harness floor ${fmtN(o(x).calibrationTotal)} → ${fmtN(n(x).calibrationTotal)}, ` +
      `no-tool F1 ${fmtF1(cell(older, x, "baseline").f1)} → ${fmtF1(cell(newer, x, "baseline").f1)}, graph-tool totals ${moved("graphify")}.`;
  });
  return `${setup} ${f1} ${perAgent.join(" ")} Neither run isolates a cause for any of these moves.`;
}

/* ---- the run this one replaces, summarised from ITS public artifact ---- */

export function summarizeSuperseded(oldArtifact, oldPath, current) {
  const old = deriveAgentBench(oldArtifact, { artifactPath: oldPath });
  return {
    label: old.label,
    date: oldArtifact.date,
    atlasBuild: old.atlasBuild,
    atlasRelease: old.atlasRelease,
    atlasBinary: old.atlasBinary,
    graphifyVersion: old.graphifyVersion,
    harnesses: Object.fromEntries(old.agents.map((a) => [a.id, a.harness])),
    models: Object.fromEntries(old.agents.map((a) => [a.id, a.model])),
    calibration: Object.fromEntries(old.agents.map((a) => [a.id, a.calibrationTotal])),
    vsAtlasTotalTokens: Object.fromEntries(old.agents.map((a) => [a.id, { baseline: a.vsAtlas.baseline?.totalTokens ?? null, graphify: a.vsAtlas.graphify?.totalTokens ?? null }])),
    vsAtlasMarginal: Object.fromEntries(old.agents.map((a) => [a.id, { baseline: a.vsAtlas.baseline?.marginal ?? null, graphify: a.vsAtlas.graphify?.marginal ?? null }])),
    cells: old.cells.map(({ agent, mode, totalTokens, turns, f1 }) => ({ agent, mode, totalTokens, turns, f1 })),
    artifact: oldPath,
    moved: whatMoved(old, current),
  };
}

/* ------ run history: the current run and every run it superseded -------- */

export function historyRowOf(d, { current = false } = {}) {
  return {
    date: d.date,
    label: d.label,
    current,
    atlasBuild: d.atlasBuild,
    atlasRelease: d.atlasRelease,
    atlasVersion: d.atlasVersion,
    atlasCommit: d.atlasCommit,
    graphifyVersion: d.graphifyVersion,
    agents: d.agents.map((a) => ({
      id: a.id,
      harness: a.harness,
      model: a.model,
      calibrationTotal: a.calibrationTotal,
      atlasF1: d.atlasF1[a.id] ?? null,
      vsAtlasTotalTokens: { baseline: a.vsAtlas.baseline?.totalTokens ?? null, graphify: a.vsAtlas.graphify?.totalTokens ?? null },
      vsAtlasMarginal: { baseline: a.vsAtlas.baseline?.marginal ?? null, graphify: a.vsAtlas.graphify?.marginal ?? null },
      marginalTokens: a.marginalTokens,
    })),
    ...(d.rescoreNote ? { rescoreNote: d.rescoreNote } : {}),
    ...(d.emptyNote ? { emptyNote: d.emptyNote } : {}),
    artifact: d.artifact,
  };
}

// `superseded` is newest first: [the run this one replaces, the one before, …].
// Each history row carries `moved` — what changed from the run below it.
export function deriveAgentBenchWithHistory(current, superseded = []) {
  const now = deriveAgentBench(current.artifact, { artifactPath: current.path });
  if (!superseded.length) return now;
  const chain = [now, ...superseded.map((s) => deriveAgentBench(s.artifact, { artifactPath: s.path }))];
  for (let i = 1; i < chain.length; i++) {
    if (!(chain[i].date < chain[i - 1].date)) throw new Error(`--supersedes must be newest first and older than the run it precedes: ${chain[i].date} (${chain[i].artifact}) is not older than ${chain[i - 1].date}`);
  }
  const history = chain.map((d, i) => ({ ...historyRowOf(d, { current: i === 0 }), ...(chain[i + 1] ? { moved: whatMoved(chain[i + 1], d) } : {}) }));
  return deriveAgentBench(current.artifact, {
    artifactPath: current.path,
    supersedes: summarizeSuperseded(superseded[0].artifact, superseded[0].path, now),
    history,
  });
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
    atlasRelease: agentBench.atlasRelease ?? null,
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

// The artifact-drawer entries for the section: every superseded run (oldest
// first, carried) and then the current one (fresh).
export function agentBenchArtifactEntries(agentBench) {
  const current = path.basename(agentBench.artifact);
  const older = (agentBench.history || []).filter((h) => !h.current).reverse();
  const runs = agentBench.cells.reduce((s, c) => s + c.n, 0);
  return [
    ...older.map((h) => ({
      name: path.basename(h.artifact),
      path: h.artifact,
      tier: "carried",
      note: `SUPERSEDED by ${current} — the ${h.date} agent-harness run (Atlas ${h.atlasRelease || h.atlasVersion}), kept in the run history so its published table stays auditable`,
    })),
    agentBenchArtifactEntry(agentBench.artifact, `agent-harness end-to-end token usage, ${agentBench.date}, Atlas ${agentBench.atlasRelease || agentBench.atlasVersion} (claude + codex, ${runs} per-run records)`),
  ];
}

/* ------------------------------ CLI ------------------------------------- */

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const args = process.argv.slice(2);
  const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : null; };
  const flags = (name) => { const out = []; for (let v = flag(name); v != null; v = flag(name)) out.push(v); return out; };
  const outArg = flag("--out");
  const supersedesArgs = flags("--supersedes");
  const releaseArg = flag("--atlas-release");
  const src = args[0];
  if (!src) throw new Error("Usage: node scripts/build-agent-bench-data.mjs /path/to/AGENT_TOKEN_REPORT.json [--out data/raw/NAME.json] [--supersedes data/raw/PREVIOUS.json ...] [--atlas-release x.y.z]");

  const report = JSON.parse(fs.readFileSync(src, "utf8"));
  const builtAs = pathFree(report.meta?.tool_versions?.atlas);
  if (releaseArg && !/^\d+\.\d+\.\d+$/.test(releaseArg)) throw new Error(`--atlas-release takes x.y.z, got ${releaseArg}`);
  const notes = releaseArg && atlasVersionOf(builtAs) !== releaseArg
    ? [`The Atlas binary was built from ${atlasCommitOf(builtAs)}, the ${releaseArg} release code; its version string reads ${atlasVersionOf(builtAs)}.`]
    : [];
  const publicArtifact = toPublicArtifact(report, { reportPath: src, atlasRelease: releaseArg, notes });
  const outRel = outArg || `data/raw/AGENT_TOKEN_BENCH_PUBLIC_${String(publicArtifact.date).replace(/-/g, "")}.json`;
  const artifactText = JSON.stringify(publicArtifact, null, 2) + "\n";
  leakCheck(path.basename(outRel), artifactText);
  fs.writeFileSync(path.join(repoRoot, outRel), artifactText);

  const superseded = supersedesArgs.map((p) => ({ artifact: JSON.parse(fs.readFileSync(path.join(repoRoot, p), "utf8")), path: p }));
  const agentBench = deriveAgentBenchWithHistory({ artifact: publicArtifact, path: outRel }, superseded);
  const sitePath = path.join(repoRoot, "data", "site-data.json");
  const site = JSON.parse(fs.readFileSync(sitePath, "utf8"));
  site.agentBench = agentBench;
  // §06 flagship and the §01 card are a view of this same run.
  if (site.report) site.report.goFlagship = goFlagshipFrom(agentBench);
  const entries = agentBenchArtifactEntries(agentBench);
  const names = new Set(entries.map((e) => e.name));
  const artifacts = site.artifacts || [];
  const first = artifacts.findIndex((a) => names.has(a.name));
  site.artifacts = artifacts.filter((a) => !names.has(a.name));
  const siteIdx = site.artifacts.findIndex((a) => a.name === "site-data.json");
  site.artifacts.splice(first >= 0 ? first : siteIdx >= 0 ? siteIdx : site.artifacts.length, 0, ...entries);
  site.generatedAt = new Date().toISOString();

  const siteText = JSON.stringify(site, null, 2) + "\n";
  leakCheck("site-data.json", siteText);
  fs.writeFileSync(sitePath, siteText);

  const x = (v) => (v == null ? "—" : `${v.toFixed(2)}×`);
  console.log(
    `wrote ${outRel} (${publicArtifact.runs.length} runs) and patched site-data.json (${agentBench.label}; history ${(agentBench.history || []).length} runs) — ` +
    agentBench.agents.map((a) => `${a.id}: baseline ${x(a.vsAtlas.baseline?.totalTokens)} / graph tool ${x(a.vsAtlas.graphify?.totalTokens)} Atlas total tokens, marginal ${x(a.vsAtlas.baseline?.marginal)} / ${x(a.vsAtlas.graphify?.marginal)}`).join("; ")
  );
}
