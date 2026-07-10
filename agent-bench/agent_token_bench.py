#!/usr/bin/env python3
"""Agent-level token-consumption benchmark: Atlas vs graphify under real agents.

The offline benches (graphify_vs_atlas.py, llm_qa.py) measure the token cost of
each tool's *output text*. This bench measures what actually hits the bill: the
END-TO-END token usage a real coding-agent harness reports when it answers a
code question using one tool or the other.

For every question in the QA set (ground truth = gopls, frozen at a pinned
commit of the target repo):

    agent in {claude, codex}  x  mode in {atlas, graphify, baseline}

the agent CLI is run headless in the target repo, restricted to ONE
code-intel CLI (baseline = no tool; plain shell/file exploration), and we
record the harness's own usage accounting:

  - claude:  `claude -p --output-format json` -> usage{input, cache_creation,
             cache_read, output}, total_cost_usd, num_turns
  - codex:   `codex exec --json` JSONL -> turn.completed usage{input_tokens,
             cached_input_tokens, output_tokens, reasoning_output_tokens}

Isolation (so no mode is contaminated):
  - claude runs with --setting-sources "" (drops user CLAUDE.md, which may
    instruct tool preferences) and --strict-mcp-config with an empty MCP set;
    Bash is allow-listed to ONLY the mode's CLI prefix.
  - codex runs under an isolated CODEX_HOME (auth copied in, no MCP servers).
  - every atlas call pins --db explicitly (a live `atlas serve` hijacks
    default-DB CLI calls).

A per-agent calibration run ("Reply with exactly: OK", same flags, no tool
use) measures each harness's fixed overhead floor so marginal cost per
question can be read from the report. Cross-agent absolute totals are NOT
comparable (different tokenizers + system prompts); the meaningful axis is
mode-vs-mode WITHIN each agent.

REPRODUCE FROM ANY MACHINE (needs: python3, git, an `atlas` binary, graphify
via `uv tool install graphifyy` or pip, and claude and/or codex logged in):

  python3 agent_token_bench.py --setup --agents auto \
      --qa-set QA_SET_logrus.json --workdir /tmp/agentbench \
      --out AGENT_TOKEN_REPORT.md --json-out AGENT_TOKEN_REPORT.json

--setup clones the pinned target repo commit, builds the Atlas index and the
graphify graph, and provisions an isolated codex home. Every run's raw
harness output is logged; every number in the report is re-derivable from
those logs. Use --repeats N for variance (mean ± sd in the report).
"""
import argparse
import concurrent.futures
import json
import os
import re
import shutil
import statistics
import subprocess
import time
from pathlib import Path

CAL_PROMPT = "Reply with exactly: OK"

PINNED_REPO_URL = "https://github.com/sirupsen/logrus"
PINNED_REPO_SLUG = "sirupsen/logrus"
PINNED_COMMIT = "a23d315dfebb6de47d18c92c8ae1430736a60b0c"

DISALLOWED_CLAUDE = ("Read,Grep,Glob,Task,WebSearch,WebFetch,Edit,Write,"
                     "NotebookEdit,TodoWrite")


def tool_examples(mode: str, db: str) -> str:
    if mode == "atlas":
        return (
            "Tool: the `atlas` CLI (code knowledge graph, already indexed).\n"
            f"  atlas --db \"{db}\" --json callers <SymbolName>   # who calls it\n"
            f"  atlas --db \"{db}\" --json explain <SymbolName>   # full context bundle\n"
            f"  atlas --db \"{db}\" --json refs <SymbolName>      # all references\n"
            f"  (more ops: search, neighbors, impact — always pass --db \"{db}\")"
        )
    if mode == "graphify":
        return (
            "Tool: the `graphify` CLI (code graph already built at "
            "graphify-out/graph.json in the repo root; run commands from the repo root).\n"
            "  graphify explain \"<SymbolName>\"        # node + neighbors\n"
            "  graphify query \"<question>\"            # BFS traversal for a question\n"
            "  graphify affected \"<SymbolName>\"       # reverse-impact traversal"
        )
    # baseline: no code-intel tool
    return ("Tool: none. You may explore the repository with ordinary shell "
            "commands (grep, cat, ls) or file reads.")


def build_prompt(mode: str, db: str, question: str) -> str:
    if mode == "baseline":
        constraint = "- Gather evidence by exploring the repository directly."
    else:
        constraint = (
            f"- Gather evidence ONLY by running the CLI shown below. Do NOT read source\n"
            f"  files, do NOT use grep/find/cat/sed/ls or any other command, and do NOT\n"
            f"  answer from memory or training data."
        )
    return (
        "You are in a checkout of the Go repository sirupsen/logrus (current "
        "directory). Answer one code question about it.\n"
        "HARD CONSTRAINTS:\n"
        f"{constraint}\n"
        "- Reply with the answer in exactly the format the question requests — "
        "no preamble, no markdown.\n\n"
        f"{tool_examples(mode, db)}\n\n"
        f"Question: {question}"
    )


def sh(cmd, cwd=None, env=None, timeout=300):
    return subprocess.run(cmd, cwd=cwd, env=env, capture_output=True,
                          text=True, timeout=timeout)


# ── setup (portable bootstrap) ──────────────────────────────────────────────

def ensure_repo(workdir: Path, repo_url: str, commit: str) -> Path:
    """Clone the target repo at EXACTLY the pinned commit (shallow)."""
    repo = workdir / "repo"
    if not (repo / ".git").exists():
        repo.mkdir(parents=True, exist_ok=True)
        for cmd in (["git", "init", "-q"],
                    ["git", "remote", "add", "origin", repo_url],
                    ["git", "fetch", "-q", "--depth", "1", "origin", commit],
                    ["git", "checkout", "-q", "FETCH_HEAD"]):
            r = sh(cmd, cwd=repo, timeout=600)
            if r.returncode != 0:
                raise SystemExit(f"[setup] {' '.join(cmd)} failed: {r.stderr.strip()}")
    head = sh(["git", "rev-parse", "HEAD"], cwd=repo).stdout.strip()
    if head != commit:
        raise SystemExit(f"[setup] repo at {head}, expected pinned {commit}")
    return repo


def ensure_indexes(repo: Path, workdir: Path, atlas_bin: str, graphify_bin: str) -> str:
    db_path = workdir / "atlas.db"
    db = f"sqlite://{db_path}"
    if not db_path.exists():
        r = sh([atlas_bin, "--db", db, "index", str(repo)], timeout=600)
        if r.returncode != 0:
            raise SystemExit(f"[setup] atlas index failed: {r.stderr.strip()[-500:]}")
        print(f"[setup] atlas index -> {db_path}")
    if not (repo / "graphify-out" / "graph.json").exists():
        r = sh([graphify_bin, "update", "."], cwd=repo, timeout=600)
        if r.returncode != 0:
            raise SystemExit(f"[setup] graphify update failed: {r.stderr.strip()[-500:]}")
        print("[setup] graphify update -> graphify-out/graph.json")
    return db


def ensure_codex_home(workdir: Path, repo: Path):
    """Isolated CODEX_HOME: real auth, no MCP servers, repo pre-trusted.
    Returns the path, or None (with a reason) when codex can't run."""
    home = workdir / "codex-home"
    home.mkdir(parents=True, exist_ok=True)
    if not (home / "auth.json").exists():
        src = Path.home() / ".codex" / "auth.json"
        if not src.exists():
            return None, "no ~/.codex/auth.json (run `codex login` first)"
        shutil.copy(src, home / "auth.json")
    (home / "config.toml").write_text(
        f'[projects."{repo}"]\ntrust_level = "trusted"\n')
    return home, None


def agent_unavailable_reason(agent: str, codex_home) -> str | None:
    if shutil.which(agent) is None:
        return f"`{agent}` CLI not on PATH"
    if agent == "codex" and codex_home is None:
        return "codex auth missing"
    return None


def cli_version(binary: str, flag: str = "--version") -> str:
    try:
        r = sh([binary, flag], timeout=30)
        return (r.stdout or r.stderr).strip().splitlines()[0][:80]
    except Exception:
        return "unknown"


# ── agent runners ───────────────────────────────────────────────────────────

def run_claude(prompt, repo, mode, model, budget_usd, timeout, log_path):
    if mode == "atlas":
        allowed = ["Bash(atlas:*)"]
    elif mode == "graphify":
        allowed = ["Bash(graphify:*)"]
    else:
        allowed = ["Bash", "Read", "Grep", "Glob"]
    cmd = [
        "claude", "-p", prompt,
        "--output-format", "json",
        "--model", model,
        "--setting-sources", "",
        "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}',
        "--allowedTools", ",".join(allowed),
        "--disallowedTools", DISALLOWED_CLAUDE if mode != "baseline" else "Task,WebSearch,WebFetch",
        "--max-budget-usd", str(budget_usd),
    ]
    t0 = time.time()
    try:
        r = sh(cmd, cwd=repo, timeout=timeout)
    except subprocess.TimeoutExpired:
        return {"status": "timeout", "wall_s": time.time() - t0}
    wall = time.time() - t0
    Path(log_path).write_text(r.stdout + ("\n--- stderr ---\n" + r.stderr if r.stderr else ""))
    try:
        d = json.loads(r.stdout)
    except Exception:
        return {"status": f"parse_error rc={r.returncode}", "wall_s": wall}
    u = d.get("usage", {})
    fresh = u.get("input_tokens", 0)
    cw = u.get("cache_creation_input_tokens", 0)
    cr = u.get("cache_read_input_tokens", 0)
    out = u.get("output_tokens", 0)
    return {
        "status": "error" if d.get("is_error") else "ok",
        "answer": (d.get("result") or "").strip(),
        "input_fresh": fresh, "cache_write": cw, "cache_read": cr,
        "output_tokens": out,
        "total_tokens": fresh + cw + cr + out,
        "billed_proxy_tokens": fresh + cw + out,   # cache reads are ~10% price
        "cost_usd": d.get("total_cost_usd"),
        "turns": d.get("num_turns"),
        # modelUsage can include tiny background-helper models (e.g. a haiku
        # topic-detection call); report the model that did the actual work.
        "model": max((d.get("modelUsage") or {model: {}}).items(),
                     key=lambda kv: (kv[1] or {}).get("costUSD") or 0)[0],
        "permission_denials": len(d.get("permission_denials") or []),
        "wall_s": wall,
    }


def run_codex(prompt, repo, codex_home, model, timeout, log_path):
    env = dict(os.environ, CODEX_HOME=str(codex_home))
    cmd = ["codex", "exec", "--json", "--skip-git-repo-check",
           "-s", "workspace-write"]
    if model:
        cmd += ["-m", model]
    cmd.append(prompt)
    t0 = time.time()
    try:
        r = sh(cmd, cwd=repo, env=env, timeout=timeout)
    except subprocess.TimeoutExpired:
        return {"status": "timeout", "wall_s": time.time() - t0}
    wall = time.time() - t0
    Path(log_path).write_text(r.stdout + ("\n--- stderr ---\n" + r.stderr if r.stderr else ""))
    usage_in = usage_cached = usage_out = usage_reason = 0
    answer, cmds, seen_model, status = "", 0, model or "default", "ok"
    for line in r.stdout.splitlines():
        try:
            ev = json.loads(line)
        except Exception:
            continue
        t = ev.get("type", "")
        if t == "thread.started" or t == "session.created":
            seen_model = ev.get("model") or seen_model
        if t == "turn.completed":
            u = ev.get("usage", {})
            usage_in += u.get("input_tokens", 0)
            usage_cached += u.get("cached_input_tokens", 0)
            usage_out += u.get("output_tokens", 0)
            usage_reason += u.get("reasoning_output_tokens", 0)
        if t == "item.completed":
            item = ev.get("item", {})
            if item.get("type") == "agent_message":
                answer = (item.get("text") or "").strip()
            if item.get("type") == "command_execution":
                cmds += 1
        if t == "error":
            status = "error"
        if t == "turn.failed":
            status = "error"
    if not r.stdout.strip():
        status = f"empty rc={r.returncode}"
    if seen_model in (None, "default"):
        # the --json event stream omits the model; the session rollout records it
        try:
            sess = max(Path(codex_home).glob("sessions/**/*.jsonl"),
                       key=lambda p: p.stat().st_mtime)
            m = re.search(r'"model":"([^"]+)"', sess.read_text(errors="ignore"))
            if m:
                seen_model = m.group(1)
        except (ValueError, OSError):
            pass
    # codex input_tokens INCLUDES cached_input_tokens
    fresh = usage_in - usage_cached
    return {
        "status": status,
        "answer": answer,
        "input_fresh": fresh, "cache_write": 0, "cache_read": usage_cached,
        "output_tokens": usage_out,
        "reasoning_tokens": usage_reason,
        "total_tokens": usage_in + usage_out,
        "billed_proxy_tokens": fresh + usage_out,  # cached input is ~10% price
        "cost_usd": None,
        "turns": cmds,
        "model": seen_model,
        "wall_s": wall,
    }


# ── scoring (same normalization idea as llm_qa_score.py) ────────────────────

def parse_names(answer: str):
    answer = re.sub(r"^.*?:", "", answer, count=1) if ":" in answer.split("\n")[0] and "," not in answer.split(":")[0] else answer
    toks = re.split(r"[,\n]+", answer)
    names = set()
    for t in toks:
        t = t.strip().strip("`*.\"'()").strip()
        t = re.sub(r"\(.*\)$", "", t)
        t = t.split(".")[-1].split("/")[-1].strip()
        if t and re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", t):
            names.add(t)
    return names


def f1(pred: set, truth: set):
    if not pred and not truth:
        return 1.0, 1.0, 1.0
    tp = len(pred & truth)
    p = tp / len(pred) if pred else 0.0
    r = tp / len(truth) if truth else 0.0
    f = 2 * p * r / (p + r) if p + r else 0.0
    return p, r, f


# ── report ──────────────────────────────────────────────────────────────────

def mean(vals):
    vals = [v for v in vals if isinstance(v, (int, float))]
    return statistics.mean(vals) if vals else None


def sd(vals):
    vals = [v for v in vals if isinstance(v, (int, float))]
    return statistics.stdev(vals) if len(vals) > 1 else None


def fmt(v, nd=0):
    if v is None:
        return "—"
    return f"{v:,.{nd}f}"


def fmt_pm(vals, nd=0):
    m, s = mean(vals), sd(vals)
    if m is None:
        return "—"
    return f"{m:,.{nd}f}" + (f" ±{s:,.{nd}f}" if s is not None else "")


def write_report(out_md, records, cals, meta):
    rep = meta.get("repeats", 1)
    lines = ["# Agent token-consumption benchmark: Atlas vs graphify",
             "",
             f"Repo: `{meta['repo_slug']}` @ `{meta['repo_commit']}` — "
             f"{meta['n_questions']} caller-set questions, ground truth = gopls"
             + (f", {rep} repeats per cell." if rep > 1 else "."),
             f"Agents: {', '.join(meta['agents'])}. Modes: {', '.join(meta['modes'])}. "
             f"Date: {meta['date']}.",
             "",
             "Each cell aggregates one headless agent run per question, restricted to the",
             "mode's CLI (baseline = no code-intel tool; free shell/file exploration).",
             "Token numbers are the agent harness's OWN usage accounting.",
             "**Cross-agent absolute totals are not comparable** (different tokenizers and",
             "system-prompt floors — see calibration); compare modes within an agent,",
             "and subtract the calibration floor for marginal cost.",
             ""]
    if meta.get("skipped_agents"):
        lines += ["> Skipped agents on this machine: "
                  + "; ".join(f"{a} ({r})" for a, r in meta["skipped_agents"].items()), ""]
    lines += ["## Calibration floor (no-tool `Reply with exactly: OK` run)",
              "",
              "| agent | model | fresh in | cache write | cache read | out | total |",
              "|---|---|---:|---:|---:|---:|---:|"]
    for a, c in cals.items():
        lines.append(f"| {a} | {c.get('model','?')} | {fmt(c.get('input_fresh'))} | "
                     f"{fmt(c.get('cache_write'))} | {fmt(c.get('cache_read'))} | "
                     f"{fmt(c.get('output_tokens'))} | {fmt(c.get('total_tokens'))} |")
    lines += ["", "## Summary (mean per question" + (" ± sd" if rep > 1 else "") + ")", "",
              "| agent | mode | fresh in | cache write | cache read | output | total | billed-proxy | turns | F1 | wall s | ok |",
              "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|"]
    combos = sorted({(r["agent"], r["mode"]) for r in records})
    for a, m in combos:
        rs = [r for r in records if r["agent"] == a and r["mode"] == m]
        ok = [r for r in rs if r.get("status") == "ok"]
        lines.append(
            f"| {a} | {m} | {fmt(mean([r.get('input_fresh') for r in ok]))} | "
            f"{fmt(mean([r.get('cache_write') for r in ok]))} | "
            f"{fmt(mean([r.get('cache_read') for r in ok]))} | "
            f"{fmt(mean([r.get('output_tokens') for r in ok]))} | "
            f"{fmt_pm([r.get('total_tokens') for r in ok])} | "
            f"{fmt_pm([r.get('billed_proxy_tokens') for r in ok])} | "
            f"{fmt(mean([r.get('turns') for r in ok]), 1)} | "
            f"{fmt_pm([r.get('f1') for r in ok], 2)} | "
            f"{fmt(mean([r.get('wall_s') for r in ok]), 1)} | "
            f"{len(ok)}/{len(rs)} |")
    lines += ["", "billed-proxy = fresh input + cache write + output (cache reads bill ~10%;",
              "codex: fresh input + output). Cost (claude only): harness-reported USD.", "",
              "## Per-question detail", "",
              "| question | agent | mode | rep | total tok | billed-proxy | turns | P | R | F1 | status |",
              "|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|"]
    for r in records:
        lines.append(
            f"| {r['qid']} | {r['agent']} | {r['mode']} | {r.get('rep', 1)} | "
            f"{fmt(r.get('total_tokens'))} | "
            f"{fmt(r.get('billed_proxy_tokens'))} | {fmt(r.get('turns'))} | "
            f"{fmt(r.get('precision'), 2)} | {fmt(r.get('recall'), 2)} | "
            f"{fmt(r.get('f1'), 2)} | {r.get('status')} |")
    claude_cost = [r.get("cost_usd") for r in records
                   if r["agent"] == "claude" and isinstance(r.get("cost_usd"), (int, float))]
    if claude_cost:
        lines += ["", f"Total claude spend for this run: ${sum(claude_cost):.2f} "
                  f"(codex spend is not reported by its harness)."]
    lines += ["", "## Method & isolation", "",
              "- claude: `-p --output-format json`, `--setting-sources \"\"` (drops any",
              "  user CLAUDE.md tool preferences), `--strict-mcp-config` with an empty",
              "  MCP set, Bash allow-listed to only the mode's CLI prefix.",
              "- codex: `exec --json -s workspace-write` with an isolated `CODEX_HOME`.",
              "- every atlas call pins `--db` (a live `atlas serve` hijacks default-DB CLI calls).",
              "- Scoring: comma-separated names vs the gopls caller set (precision/recall/F1).",
              "- Raw harness outputs: one log file per run (path printed at run time; `--logs`).",
              "",
              f"Tool versions: {meta.get('tool_versions', {})}", ""]
    Path(out_md).write_text("\n".join(lines))


# ── main ────────────────────────────────────────────────────────────────────

def load_qa(path: Path):
    d = json.loads(path.read_text())
    if isinstance(d, dict):  # frozen shape: {"meta": {...}, "questions": [...]}
        return d.get("meta", {}), d["questions"]
    return {}, d             # legacy shape: bare list


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--qa-set", required=True, help="question set JSON (frozen or llm_qa.py output)")
    ap.add_argument("--setup", action="store_true",
                    help="bootstrap --workdir: clone pinned repo commit, build atlas+graphify indexes, provision codex home")
    ap.add_argument("--workdir", default="./agentbench-work")
    ap.add_argument("--repo", default=None, help="existing target repo checkout (skips --setup clone)")
    ap.add_argument("--db", default=None, help="atlas sqlite DSN (defaults to <workdir>/atlas.db with --setup)")
    ap.add_argument("--repo-url", default=PINNED_REPO_URL)
    ap.add_argument("--commit", default=PINNED_COMMIT)
    ap.add_argument("--atlas-bin", default="atlas")
    ap.add_argument("--graphify-bin", default="graphify")
    ap.add_argument("--codex-home", default=None, help="isolated CODEX_HOME (auto-provisioned with --setup)")
    ap.add_argument("--agents", default="auto", help="comma list or 'auto' (use whichever of claude,codex is installed+authed)")
    ap.add_argument("--modes", default="atlas,graphify", help="atlas,graphify[,baseline]")
    ap.add_argument("--claude-model", default="claude-sonnet-5")
    ap.add_argument("--codex-model", default=None, help="default: codex's own default")
    ap.add_argument("--repeats", type=int, default=1, help="runs per (agent,mode,question) cell")
    ap.add_argument("--jobs", type=int, default=1, help="concurrent agent runs (agents/tools only read the indexes)")
    ap.add_argument("--retries", type=int, default=1, help="retries per run on non-ok status")
    ap.add_argument("--budget-usd", type=float, default=1.0, help="per-claude-run cap")
    ap.add_argument("--timeout", type=int, default=300)
    ap.add_argument("--out", default="AGENT_TOKEN_REPORT.md")
    ap.add_argument("--json-out", default="AGENT_TOKEN_REPORT.json")
    ap.add_argument("--logs", default=None)
    ap.add_argument("--skip-calibration", action="store_true")
    args = ap.parse_args()

    workdir = Path(args.workdir).resolve()
    qa_meta, qs = load_qa(Path(args.qa_set))
    commit = qa_meta.get("commit", args.commit)
    repo_url = qa_meta.get("repo_url", args.repo_url)

    if args.setup:
        for b, hint in ((args.atlas_bin, "download from the atlas releases page"),
                        (args.graphify_bin, "uv tool install graphifyy"),
                        ("git", "install git")):
            if shutil.which(b) is None:
                raise SystemExit(f"[setup] `{b}` not found on PATH ({hint})")
        repo = Path(args.repo).resolve() if args.repo else ensure_repo(workdir, repo_url, commit)
        db = args.db or ensure_indexes(repo, workdir, args.atlas_bin, args.graphify_bin)
    else:
        if not args.repo or not args.db:
            raise SystemExit("--repo and --db are required without --setup")
        repo = Path(args.repo).resolve()
        db = args.db

    codex_home, codex_reason = (Path(args.codex_home), None) if args.codex_home \
        else ensure_codex_home(workdir, repo)

    wanted = ["claude", "codex"] if args.agents == "auto" \
        else [a.strip() for a in args.agents.split(",") if a.strip()]
    agents, skipped = [], {}
    for a in wanted:
        reason = agent_unavailable_reason(a, codex_home)
        if a == "codex" and reason is None and codex_reason:
            reason = codex_reason
        if reason:
            skipped[a] = reason
            print(f"[skip] {a}: {reason}")
        else:
            agents.append(a)
    if not agents:
        raise SystemExit("no usable agents (claude/codex both unavailable)")

    modes = [m.strip() for m in args.modes.split(",") if m.strip()]
    logs = Path(args.logs) if args.logs else workdir / "logs"
    logs.mkdir(parents=True, exist_ok=True)

    def run_one(agent, mode, prompt, log_path):
        for attempt in range(args.retries + 1):
            if agent == "claude":
                rec = run_claude(prompt, repo, mode, args.claude_model,
                                 args.budget_usd, args.timeout, log_path)
            else:
                rec = run_codex(prompt, repo, codex_home, args.codex_model,
                                args.timeout, log_path)
            rec["attempts"] = attempt + 1
            if rec.get("status") == "ok":
                return rec
        return rec

    cals = {}
    if not args.skip_calibration:
        for agent in agents:
            print(f"[cal] {agent} ...", flush=True)
            cals[agent] = run_one(agent, modes[0], CAL_PROMPT, logs / f"cal_{agent}.log")
            print(f"[cal] {agent}: total={cals[agent].get('total_tokens')} "
                  f"status={cals[agent].get('status')}", flush=True)

    tasks = [(q, agent, mode, rep)
             for q in qs for agent in agents for mode in modes
             for rep in range(1, args.repeats + 1)]

    def run_task(task):
        q, agent, mode, rep = task
        tag = f"{agent}_{mode}_{q['symbol']}" + (f"_r{rep}" if args.repeats > 1 else "")
        rec = run_one(agent, mode, build_prompt(mode, db, q["question"]),
                      logs / f"{tag}.log")
        rec.update({"qid": q["id"], "symbol": q["symbol"],
                    "agent": agent, "mode": mode, "rep": rep})
        if rec.get("status") == "ok":
            p, r, f = f1(parse_names(rec.get("answer", "")), set(q["truth"]))
            rec.update({"precision": p, "recall": r, "f1": f})
        print(f"[run] {tag}: status={rec.get('status')} total={rec.get('total_tokens')} "
              f"turns={rec.get('turns')} f1={rec.get('f1', '—')}", flush=True)
        return rec

    if args.jobs > 1:
        with concurrent.futures.ThreadPoolExecutor(max_workers=args.jobs) as ex:
            records = list(ex.map(run_task, tasks))
    else:
        records = [run_task(t) for t in tasks]
    order = {q["id"]: i for i, q in enumerate(qs)}
    records.sort(key=lambda r: (order[r["qid"]], r["agent"], r["mode"], r["rep"]))

    meta = {
        "repo_slug": qa_meta.get("repo_slug", PINNED_REPO_SLUG),
        "repo_url": repo_url, "repo_commit": commit,
        "n_questions": len(qs), "agents": agents, "modes": modes,
        "skipped_agents": skipped, "repeats": args.repeats,
        "claude_model": args.claude_model,
        "codex_model": args.codex_model or "codex default",
        "date": time.strftime("%Y-%m-%d"),
        "db": db,
        "tool_versions": {
            "claude": cli_version("claude") if "claude" in agents else "skipped",
            "codex": cli_version("codex") if "codex" in agents else "skipped",
            "atlas": cli_version(args.atlas_bin),
            "graphify": cli_version(args.graphify_bin),
        },
    }
    Path(args.json_out).write_text(json.dumps(
        {"meta": meta, "calibration": cals, "runs": records}, indent=2))
    write_report(args.out, records, cals, meta)
    print(f"\n[wrote] {args.out}\n[wrote] {args.json_out}\n[logs]  {logs}/")


if __name__ == "__main__":
    main()
