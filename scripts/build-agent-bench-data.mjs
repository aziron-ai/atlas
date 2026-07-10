#!/usr/bin/env node
// Ingest the agent-harness token benchmark (bench/agent_token_bench.py in the
// private bench repo) into the public site payload.
//
// Reads the private AGENT_TOKEN_REPORT.json, reduces it to a public-safe
// artifact (no local paths, no machine identifiers), writes
// data/raw/AGENT_TOKEN_BENCH_PUBLIC.json, and patches data/site-data.json
// with the derived `agentBench` section + its artifact-drawer entry.
//
// Additive by design: the rest of site-data.json (report canon, fresh run,
// liveRepos) is left byte-identical, so this can run without the full
// build-site-data.mjs input set. build-site-data.mjs re-ingests the public
// artifact (via deriveAgentBench below) on full rebuilds.
//
// Usage: node scripts/build-agent-bench-data.mjs /path/to/AGENT_TOKEN_REPORT.json
"use strict";

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const round = (x, d = 1) => (x == null ? null : Math.round(x * 10 ** d) / 10 ** d);
const mean = (xs) => {
  const v = xs.filter((x) => typeof x === "number" && !Number.isNaN(x));
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
};

/* ------- private report -> public raw artifact (paths stripped) --------- */

export function toPublicArtifact(report) {
  const runs = report.runs.map((r) => ({
    qid: r.qid, symbol: r.symbol, agent: r.agent, mode: r.mode, rep: r.rep ?? 1,
    status: r.status,
    input_fresh: r.input_fresh ?? null,
    cache_write: r.cache_write ?? null,
    cache_read: r.cache_read ?? null,
    output_tokens: r.output_tokens ?? null,
    total_tokens: r.total_tokens ?? null,
    billed_proxy_tokens: r.billed_proxy_tokens ?? null,
    turns: r.turns ?? null,
    f1: r.f1 ?? null, precision: r.precision ?? null, recall: r.recall ?? null,
    wall_s: round(r.wall_s, 1),
    model: r.model ?? null,
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
  return {
    label: "Agent-harness token benchmark",
    what: "end-to-end token usage reported by real coding-agent harnesses (claude -p, codex exec) answering gopls-ground-truth caller questions, restricted per run to one code-intel tool",
    repo_slug: report.meta.repo_slug,
    repo_url: report.meta.repo_url,
    repo_commit: report.meta.repo_commit,
    n_questions: report.meta.n_questions,
    agents: report.meta.agents,
    modes: report.meta.modes,
    repeats: report.meta.repeats ?? 1,
    date: report.meta.date,
    models: { claude: report.meta.claude_model, codex: report.meta.codex_model },
    tool_versions: report.meta.tool_versions ?? {},
    suite: "agent-bench/ in this repository — reproduce with: python3 agent-bench/agent_token_bench.py --setup --agents auto --qa-set agent-bench/QA_SET_logrus.json",
    calibration,
    runs,
  };
}

/* -------- public artifact -> the section the page renders --------------- */

export function deriveAgentBench(artifact) {
  const cellKeys = [...new Set(artifact.runs.map((r) => `${r.agent}|${r.mode}`))];
  const cells = cellKeys.map((k) => {
    const [agent, mode] = k.split("|");
    const rs = artifact.runs.filter((r) => r.agent === agent && r.mode === mode);
    const ok = rs.filter((r) => r.status === "ok");
    return {
      agent, mode,
      totalTokens: Math.round(mean(ok.map((r) => r.total_tokens))),
      billedProxy: Math.round(mean(ok.map((r) => r.billed_proxy_tokens))),
      outputTokens: Math.round(mean(ok.map((r) => r.output_tokens))),
      turns: round(mean(ok.map((r) => r.turns)), 1),
      f1: round(mean(ok.map((r) => r.f1)), 3),
      wallS: round(mean(ok.map((r) => r.wall_s)), 1),
      ok: ok.length, n: rs.length,
    };
  });

  const ratioFor = (agent, mode, key) => {
    const base = cells.find((c) => c.agent === agent && c.mode === "atlas");
    const other = cells.find((c) => c.agent === agent && c.mode === mode);
    if (!base || !other || !base[key] || !other[key]) return null;
    return round(other[key] / base[key], 1);
  };

  const agents = (artifact.agents || []).map((a) => ({
    id: a,
    model: (artifact.runs.find((r) => r.agent === a && r.model) || {}).model
      || artifact.models?.[a] || null,
    calibrationTotal: artifact.calibration?.[a]?.total_tokens ?? null,
    vsAtlas: Object.fromEntries(
      (artifact.modes || []).filter((m) => m !== "atlas").map((m) => [m, {
        totalTokens: ratioFor(a, m, "totalTokens"),
        billedProxy: ratioFor(a, m, "billedProxy"),
        turns: ratioFor(a, m, "turns"),
      }])
    ),
  }));

  return {
    label: `Agent-harness token benchmark — ${artifact.date}`,
    repo: artifact.repo_slug,
    commit7: String(artifact.repo_commit || "").slice(0, 7),
    nQuestions: artifact.n_questions,
    truth: "gopls call_hierarchy (LSP-truth), frozen at the pinned commit",
    modes: artifact.modes,
    agents,
    cells,
    caveat: "Cross-agent absolute totals are not comparable — the two harnesses use different tokenizers and system-prompt floors (see each agent's calibration). Compare modes within an agent.",
    billedProxyNote: "billed-proxy = fresh input + cache writes + output; cache reads bill at ~10% and are excluded.",
    artifact: "data/raw/AGENT_TOKEN_BENCH_PUBLIC.json",
    suiteCmd: "python3 agent-bench/agent_token_bench.py --setup --agents auto \\\n    --qa-set agent-bench/QA_SET_logrus.json --workdir agentbench-work",
    suiteNeeds: "python3, git, atlas on PATH, graphify (uv tool install graphifyy), and claude and/or codex logged in",
  };
}

export const AGENT_BENCH_ARTIFACT_ENTRY = {
  name: "AGENT_TOKEN_BENCH_PUBLIC.json",
  path: "data/raw/AGENT_TOKEN_BENCH_PUBLIC.json",
  tier: "fresh",
  note: "agent-harness end-to-end token usage (claude + codex, per-run records)",
};

const BANNED = [/\/Users\//, /\/home\//, /\/tmp\//, /\/root\//, /damirdarasu/, /aziron-ui/i, /aziron-pulse/i, /recallemit/i, /Msys/i];
export function leakCheck(name, text) {
  for (const re of BANNED) if (re.test(text)) throw new Error(`public payload leak in ${name}: ${re}`);
}

/* ------------------------------ CLI ------------------------------------- */

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const src = process.argv[2];
  if (!src) throw new Error("Usage: node scripts/build-agent-bench-data.mjs /path/to/AGENT_TOKEN_REPORT.json");

  const report = JSON.parse(fs.readFileSync(src, "utf8"));
  const publicArtifact = toPublicArtifact(report);
  const artifactText = JSON.stringify(publicArtifact, null, 2) + "\n";
  leakCheck("AGENT_TOKEN_BENCH_PUBLIC.json", artifactText);
  fs.writeFileSync(path.join(repoRoot, "data", "raw", "AGENT_TOKEN_BENCH_PUBLIC.json"), artifactText);

  const agentBench = deriveAgentBench(publicArtifact);
  const sitePath = path.join(repoRoot, "data", "site-data.json");
  const site = JSON.parse(fs.readFileSync(sitePath, "utf8"));
  site.agentBench = agentBench;
  site.artifacts = (site.artifacts || []).filter((a) => a.name !== AGENT_BENCH_ARTIFACT_ENTRY.name);
  site.artifacts.push(AGENT_BENCH_ARTIFACT_ENTRY);
  site.generatedAt = new Date().toISOString();

  const siteText = JSON.stringify(site, null, 2) + "\n";
  leakCheck("site-data.json", siteText);
  fs.writeFileSync(sitePath, siteText);

  console.log(
    `wrote data/raw/AGENT_TOKEN_BENCH_PUBLIC.json (${publicArtifact.runs.length} runs) and patched site-data.json — ` +
    agentBench.agents.map((a) => {
      const g = a.vsAtlas.graphify;
      return `${a.id}: graphify ${g?.totalTokens ?? "—"}× atlas total tokens`;
    }).join(", ")
  );
}
