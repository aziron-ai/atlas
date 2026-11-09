#!/usr/bin/env python3
"""Agent-level token-consumption benchmark: Atlas vs graphify under real agents.

The offline benches (graphify_vs_atlas.py, llm_qa.py) measure the token cost of
each tool's *output text*. This bench measures what actually hits the bill: the
END-TO-END token usage a real coding-agent harness reports when it answers a
code question using one tool or the other.

For every question in the QA set (ground truth = the language's own server —
gopls for the frozen Go set; pyright, clangd, jdtls, typescript-language-server
or rust-analyzer for the per-language QA_SET_<lang>.json sets —
frozen at a pinned commit of the target repo):

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
  - codex runs under an isolated CODEX_HOME (auth copied in, no MCP servers)
    AND an isolated HOME, because codex also loads skills from ~/.agents/skills
    — an installed Atlas skill otherwise leaks into the baseline.
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
      --qa-set QA_SET_logrus.json --workdir agentbench-work \
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

LANGUAGE_LABELS = {"go": "Go", "python": "Python", "javascript": "JavaScript",
                   "typescript": "TypeScript", "java": "Java", "c": "C", "cpp": "C++",
                   "rust": "Rust", "kotlin": "Kotlin", "swift": "Swift", "php": "PHP",
                   "ruby": "Ruby", "csharp": "C#", "scala": "Scala"}

DISALLOWED_CLAUDE = ("Read,Grep,Glob,Task,WebSearch,WebFetch,Edit,Write,"
                     "NotebookEdit,TodoWrite")


# Output shape the atlas-mode prompt recommends. "json" is the published recipe.
# "plain" (`--format plain`) carries the same caller names, kinds and paths in
# 4–9× fewer bytes (vue `warn`: 14 KB vs 58 KB; `ref`: 14.5 KB vs 130 KB, measured
# 2026-10-28): the JSON of a 100+-caller answer exceeds Claude Code's inline
# tool-result limit, is spilled to a file with a 2 KB preview, and the agent then
# spends 190k–444k tokens trying to read it back. Opt-in via --atlas-format.
ATLAS_FORMAT = "json"


def atlas_invocation(db: str) -> str:
    """The exact program the prompt tells the agent to run. The pinned copy lives in
    <workdir>/toolbin next to the db; naming it by ABSOLUTE path makes the recipe
    immune to the agent's shell PATH (a login zsh sourcing ~/.zprofile puts
    /opt/homebrew/bin — the released atlas — ahead of the harness PATH; a Claude
    cell did exactly that once on 2026-10-28 and was scored against 0.1.54)."""
    if ATLAS_INVOCATION != "absolute":
        return "atlas"
    db_path = db[len("sqlite:///"):] if db.startswith("sqlite:///") else db.replace("sqlite://", "", 1)
    return str(Path(db_path).resolve().parent / "toolbin" / "atlas")


# "atlas" (default): the bare command — Claude Code is launched with `--allowedTools
# "Bash(atlas:*)"`, and that allow-list matches the COMMAND TEXT, so an absolute
# path is DENIED and every Claude atlas cell scores 0 (ripgrep leg, 2026-10-28
# 18:42–18:52). Provenance of which binary answered comes from the
# `atlas_version` field the binary stamps into every answer instead.
ATLAS_INVOCATION = "atlas"


def tool_examples(mode: str, db: str) -> str:
    if mode == "atlas":
        fmt = "--json" if ATLAS_FORMAT == "json" else f"--format {ATLAS_FORMAT}"
        a = atlas_invocation(db)
        return (
            "Tool: the `atlas` CLI (code knowledge graph, already indexed).\n"
            f"  {a} --db \"{db}\" {fmt} callers <SymbolName>   # who calls it\n"
            f"  {a} --db \"{db}\" {fmt} explain <SymbolName>   # full context bundle\n"
            f"  {a} --db \"{db}\" {fmt} refs <SymbolName>      # all references\n"
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


def build_prompt(mode: str, db: str, question: str,
                 language: str = "Go", slug: str = PINNED_REPO_SLUG) -> str:
    if mode == "baseline":
        constraint = "- Gather evidence by exploring the repository directly."
    else:
        constraint = (
            f"- Gather evidence ONLY by running the CLI shown below. Do NOT read source\n"
            f"  files, do NOT use grep/find/cat/sed/ls or any other command, and do NOT\n"
            f"  answer from memory or training data."
        )
    return (
        f"You are in a checkout of the {language} repository {slug} (current "
        "directory). Answer one code question about it.\n"
        "HARD CONSTRAINTS:\n"
        f"{constraint}\n"
        "- Reply with the answer in exactly the format the question requests — "
        "no preamble, no markdown.\n\n"
        f"{tool_examples(mode, db)}\n\n"
        f"Question: {question}"
    )


def sh(cmd, cwd=None, env=None, timeout=300):
    # stdin is closed on purpose: `codex exec` reads "additional input from
    # stdin" until EOF when stdin is not a TTY, so an inherited open pipe (a
    # CI step, a supervising tool) makes every Codex run hang to the timeout.
    # The child gets its own process group so a timeout kills the WHOLE tree:
    # `node codex` wraps a native codex binary that outlived its killed wrapper
    # (re-parented to pid 1) and kept its Codex session alive, so every
    # timed-out cell silently raised the provider concurrency and bred the next
    # 429 and the next timeout (2026-10-28 six-way batch: nine orphans at once).
    proc = subprocess.Popen(cmd, cwd=cwd, env=env, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, text=True,
                            stdin=subprocess.DEVNULL, start_new_session=True)
    try:
        out, err = proc.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        _kill_process_group(proc)
        out, err = proc.communicate()
        raise subprocess.TimeoutExpired(cmd, timeout, output=out, stderr=err)
    return subprocess.CompletedProcess(cmd, proc.returncode, out, err)


def _kill_process_group(proc):
    """SIGKILL the child's whole process group (it is the group leader thanks
    to start_new_session), then the child itself in case it changed groups."""
    import signal
    try:
        os.killpg(proc.pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    try:
        proc.kill()
    except ProcessLookupError:
        pass


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
    # A detached checkout of FETCH_HEAD leaves the bare sha in .git/HEAD: read it
    # without spawning git. On 2026-10-28 every `git` on the host hung behind
    # ~2,500 stuck VS Code `git fetch` processes and this one rev-parse killed
    # four legs' setups at the 300 s subprocess timeout.
    head = ""
    try:
        txt = (repo / ".git" / "HEAD").read_text().strip()
        if re.fullmatch(r"[0-9a-f]{40}", txt):
            head = txt
    except OSError:
        pass
    if head != commit:
        try:
            head = sh(["git", "rev-parse", "HEAD"], cwd=repo, timeout=120).stdout.strip()
        except subprocess.TimeoutExpired:
            raise SystemExit(f"[setup] git rev-parse HEAD hung for 120 s (host-wide git stall) and .git/HEAD is not the pinned sha")
    if head != commit:
        raise SystemExit(f"[setup] repo at {head}, expected pinned {commit}")
    return repo


def ensure_indexes(repo: Path, workdir: Path, atlas_bin: str,
                   graphify_bin: str | None = None) -> str:
    """Index the target repo with the requested tools, re-indexing whenever the
    tool that built a graph has changed.

    Reusing an existing atlas.db unconditionally (the old behavior) silently
    benchmarked a STALE GRAPH: a parser/extractor improvement would land, the
    harness would skip the re-index, and the run would report the OLD graph's
    quality as if it were the new binary's. That is exactly what happened to the
    a callers-overload fix — measured F1 0.20 against a pre-fix graph while a
    fresh index of the same tree scored 1.00. A benchmark that cannot see an
    improvement is worse than no benchmark.

    The stamp is the tool's own version string, so a rebuilt binary re-indexes
    and an unchanged one reuses the graph (the fast path stays fast).
    """
    db_path = workdir / "atlas.db"
    db = f"sqlite://{db_path}"
    atlas_stamp = workdir / ".atlas-index-stamp"
    atlas_ver = cli_version(atlas_bin, "version")
    stale = (not db_path.exists()
             or not atlas_stamp.exists()
             or atlas_stamp.read_text().strip() != atlas_ver)
    if stale:
        for leftover in (db_path, workdir / "telemetry.db", workdir / "lexical"):
            if leftover.is_dir():
                shutil.rmtree(leftover, ignore_errors=True)
            elif leftover.exists():
                leftover.unlink()
        r = sh([atlas_bin, "--db", db, "index", str(repo)], timeout=600)
        if r.returncode != 0:
            raise SystemExit(f"[setup] atlas index failed: {r.stderr.strip()[-500:]}")
        atlas_stamp.write_text(atlas_ver + "\n")
        print(f"[setup] atlas index ({atlas_ver}) -> {db_path}")
    else:
        print(f"[setup] atlas graph reused (same binary: {atlas_ver})")

    if not graphify_bin:
        return db

    gfy_out = repo / "graphify-out" / "graph.json"
    gfy_stamp = workdir / ".graphify-index-stamp"
    gfy_ver = cli_version(graphify_bin)
    gfy_stale = (not gfy_out.exists()
                 or not gfy_stamp.exists()
                 or gfy_stamp.read_text().strip() != gfy_ver)
    if gfy_stale:
        r = sh([graphify_bin, "update", "."], cwd=repo, timeout=600)
        if r.returncode != 0:
            raise SystemExit(f"[setup] graphify update failed: {r.stderr.strip()[-500:]}")
        gfy_stamp.write_text(gfy_ver + "\n")
        print(f"[setup] graphify update ({gfy_ver}) -> graphify-out/graph.json")
    return db


def ensure_tool_path(workdir: Path, atlas_bin: str,
                     graphify_bin: str | None = None) -> dict:
    """Make the AGENT invoke the pinned binaries, not whatever is on PATH.

    The agents are allowed `Bash(atlas:*)` / `Bash(graphify:*)` and the prompt
    tells them to run bare `atlas ...`, so the shell resolved the tool through
    PATH — which meant `--atlas-bin` pinned the binary used for INDEXING while
    every query the agent actually made ran some other build. On this machine
    that was a binary 100 commits old, and it turned a shipped fix (a
    callers-overload disambiguation) into a permanently "known-open" benchmark
    number: the old client returned 9 callers for `Errorf` where the pinned one
    returns the 2 correct ones.

    Fix: symlink the pinned tools into workdir/toolbin and PREPEND that to the
    agent's PATH. Bare `atlas` now IS the binary under test.
    """
    toolbin = workdir / "toolbin"
    toolbin.mkdir(parents=True, exist_ok=True)
    for name, target in (("atlas", atlas_bin), ("graphify", graphify_bin)):
        if not target:
            continue
        link = toolbin / name
        if link.is_symlink() or link.exists():
            link.unlink()
        if name == "atlas":
            # COPY the binary under test, do not link it: a dev build rebuilt at
            # its source path mid-run silently changed the tool 7 of 38 atlas
            # cells ran against (2026-10-28 Python iteration 2). A copy pins the
            # exact bytes for the whole run; the start/end version check below
            # turns any remaining drift into a flagged fact in the report.
            shutil.copy2(Path(target).resolve(), link)
        else:
            link.symlink_to(Path(target).resolve())
    env = dict(os.environ)
    env["PATH"] = f"{toolbin}{os.pathsep}{env.get('PATH', '')}"
    env["ATLAS_BENCH_TOOLBIN"] = str(toolbin)
    return env


def ensure_codex_home(workdir: Path, repo: Path):
    """Isolated CODEX_HOME: real auth, no MCP servers, repo pre-trusted.
    Returns the path, or None (with a reason) when codex can't run."""
    home = workdir / "codex-home"
    home.mkdir(parents=True, exist_ok=True)
    if not (home / "auth.json").exists():
        src = Path.home() / ".codex" / "auth.json"
        if src.exists():
            shutil.copy(src, home / "auth.json")
        elif not os.environ.get("OPENAI_API_KEY"):
            return None, "no ~/.codex/auth.json (run `codex login` first)"
        # In CI, OPENAI_API_KEY is injected only around the benchmark stage.
        # Codex can authenticate directly from it, so no persistent auth file
        # is created or copied onto the shared worker.
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

def run_claude(prompt, repo, mode, model, budget_usd, timeout, log_path, env=None):
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
        r = sh(cmd, cwd=repo, env=env, timeout=timeout)
    except subprocess.TimeoutExpired as e:
        _write_partial_log(log_path, e, f"claude timed out after {timeout}s")
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


def run_codex(prompt, repo, codex_home, mode, model, timeout, log_path, base_env=None):
    env = dict(base_env or os.environ, CODEX_HOME=str(codex_home))
    # Codex discovers skills from the SHARED ~/.agents/skills directory no
    # matter what CODEX_HOME says. On a machine where Atlas's own skill is
    # installed, a "baseline" Codex run read that skill in 10/19 questions and
    # once executed `atlas context` — a baseline that uses the tool under test
    # is not a baseline. Point HOME at an empty directory beside CODEX_HOME so
    # the only skills Codex can see are the (none) in the isolated home.
    iso_home = Path(codex_home).parent / "agent-home"
    iso_home.mkdir(parents=True, exist_ok=True)
    env["HOME"] = str(iso_home)
    cmd = ["codex", "exec", "--json", "--skip-git-repo-check",
           "-s", "workspace-write"]
    # Codex's shell tool REBUILDS PATH — an inherited PATH is not enough: it
    # resolved a 100-commit-old ~/.local/bin/atlas while our toolbin sat first
    # in the environment we handed it. Force the pinned tools through codex's
    # own shell_environment_policy so `atlas` IS the binary under test.
    toolbin = env.get("ATLAS_BENCH_TOOLBIN")
    if toolbin:
        forced = os.pathsep.join([toolbin, "/usr/local/bin", "/usr/bin", "/bin"])
        cmd += ["-c", f'shell_environment_policy.set.PATH="{forced}"']
        # The pinned SQLite index is a sibling of the target checkout. Keep the
        # agent sandboxed, but explicitly admit only this benchmark workdir so
        # Atlas can open its DB. Without this, Codex received SQLite error 14,
        # guessed an answer, and the old harness incorrectly called the row ok.
        cmd += ["--add-dir", str(Path(toolbin).parent)]
    if model:
        cmd += ["-m", model]
    cmd.append(prompt)
    t0 = time.time()
    try:
        r = sh(cmd, cwd=repo, env=env, timeout=timeout)
    except subprocess.TimeoutExpired as e:
        _write_partial_log(log_path, e, f"codex timed out after {timeout}s")
        return {"status": "timeout", "wall_s": time.time() - t0}
    wall = time.time() - t0
    Path(log_path).write_text(r.stdout + ("\n--- stderr ---\n" + r.stderr if r.stderr else ""))
    usage_in = usage_cached = usage_out = usage_reason = 0
    answer, cmds, command_successes, command_failures = "", 0, 0, 0
    seen_model, status = model or "default", "ok"
    turn_completed, transient_errors = False, 0
    for line in r.stdout.splitlines():
        try:
            ev = json.loads(line)
        except Exception:
            continue
        t = ev.get("type", "")
        if t == "thread.started" or t == "session.created":
            seen_model = ev.get("model") or seen_model
        if t == "turn.completed":
            turn_completed = True
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
                if item.get("status") == "completed" and item.get("exit_code") == 0:
                    command_successes += 1
                else:
                    command_failures += 1
        if t == "error":
            # `{"type":"error","message":"Reconnecting... 2/5 (... 429 Too Many Requests)"}`
            # is a TRANSIENT transport event; the turn often still completes with
            # usage and a final answer. Only a turn that did NOT complete is an error
            # (vue `codex_atlas_warn`/`ref` under 5 concurrent legs, 2026-10-28:
            # completed answers were voided and the retry then starved).
            transient_errors += 1
        if t == "turn.failed":
            status = "error"
    if transient_errors and not (turn_completed and answer):
        status = "error"
    if not r.stdout.strip():
        status = f"empty rc={r.returncode}"
    if mode != "baseline" and command_successes == 0:
        status = "error"
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
        "transient_errors": transient_errors,
        "answer": answer,
        "input_fresh": fresh, "cache_write": 0, "cache_read": usage_cached,
        "output_tokens": usage_out,
        "reasoning_tokens": usage_reason,
        "total_tokens": usage_in + usage_out,
        "billed_proxy_tokens": fresh + usage_out,  # cached input is ~10% price
        "cost_usd": None,
        "turns": cmds,
        "command_successes": command_successes,
        "command_failures": command_failures,
        "model": seen_model,
        "wall_s": wall,
    }


def _write_partial_log(log_path, exc: subprocess.TimeoutExpired, note: str) -> None:
    """A timed-out agent run used to leave NO log, so the stall could not be
    diagnosed. Persist whatever the harness had captured before the kill."""
    def _s(b):
        return b.decode(errors="ignore") if isinstance(b, bytes) else (b or "")
    Path(log_path).write_text(f"--- {note}; partial transcript ---\n" + _s(exc.stdout)
                              + ("\n--- stderr ---\n" + _s(exc.stderr) if exc.stderr else ""))


def calibration_errors(calibrations):
    """Return fail-closed provider calibration errors before the paid matrix."""
    errors = []
    for agent, record in calibrations.items():
        status = record.get("status")
        total = record.get("total_tokens")
        if status != "ok" or not isinstance(total, (int, float)) or total <= 0:
            errors.append(f"{agent}: status={status} total_tokens={total}")
    return errors


# ── scoring (same normalization idea as llm_qa_score.py) ────────────────────

def parse_names(answer: str):
    answer = re.sub(r"^.*?:", "", answer, count=1) if ":" in answer.split("\n")[0] and "," not in answer.split(":")[0] else answer
    toks = re.split(r"[,\n]+", answer)
    names = set()
    for t in toks:
        t = t.strip().strip("`*.\"'()").strip()
        t = re.sub(r"\(.*\)$", "", t)
        # `mod::fn` / `Class::method` (Rust, C++) get the same treatment as
        # `Class.method` / `path/fn`: score the trailing segment.
        t = t.split("::")[-1].split(".")[-1].split("/")[-1].strip()
        # The truth generator (lsp_truth.py simple_name) spells a C++ destructor
        # `~Builder` as `Builder`; score the agent's `~Builder` the same way.
        t = t.lstrip("~")
        if t.lower() in ("none", "n/a", "null", "nothing"):
            continue   # "(none)" means "no callers", it is not a caller named none
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
             f"{meta['n_questions']} caller-set questions, ground truth = {meta.get('truth', 'the language server')}"
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
              "- Scoring: comma-separated names vs the language server's caller set (precision/recall/F1).",
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
    ap.add_argument("--atlas-invocation", default="atlas", choices=("atlas", "absolute"),
                    help="how the prompt names the tool: `atlas` (bare; required for Claude's Bash(atlas:*) allow-list) "
                         "or `absolute` (<workdir>/toolbin/atlas; only for agents without a command allow-list)")
    ap.add_argument("--atlas-format", default="json", choices=("json", "plain", "compact"),
                    help="output shape the atlas-mode prompt recommends (json = published recipe; "
                         "plain = same names in 4-9x fewer bytes, avoids tool-result spills)")
    ap.add_argument("--codex-model", default=None, help="default: codex's own default")
    ap.add_argument("--repeats", type=int, default=1, help="runs per (agent,mode,question) cell")
    ap.add_argument("--jobs", type=int, default=1, help="concurrent agent runs (agents/tools only read the indexes)")
    ap.add_argument("--retries", type=int, default=1, help="retries per run on non-ok status")
    ap.add_argument("--budget-usd", type=float, default=1.0, help="per-claude-run cap")
    ap.add_argument("--timeout", type=int, default=300)
    ap.add_argument("--calibration-timeout", type=int, default=60,
                    help="per-attempt timeout for the provider preflight")
    ap.add_argument("--out", default="AGENT_TOKEN_REPORT.md")
    ap.add_argument("--json-out", default="AGENT_TOKEN_REPORT.json")
    ap.add_argument("--logs", default=None)
    ap.add_argument("--skip-calibration", action="store_true")
    ap.add_argument("--cells", default=None,
                    help="run ONLY these cells: comma list of agent:mode:symbol, or `failed` = every "
                         "non-ok cell of the report given by --merge-into (stalled cells re-run one at a time)")
    ap.add_argument("--merge-into", default=None,
                    help="existing AGENT_TOKEN_REPORT.json whose runs the new results replace cell-by-cell; "
                         "its meta/calibration are kept, a `reruns` note is appended, the previous JSON is "
                         "saved as *.before-rerun-N.json (implies --skip-calibration)")
    ap.add_argument("--setup-only", action="store_true",
                    help="clone + index + provision the codex home, then exit without any agent run (no quota spent)")
    args = ap.parse_args()
    global ATLAS_FORMAT, ATLAS_INVOCATION
    ATLAS_FORMAT = args.atlas_format
    ATLAS_INVOCATION = args.atlas_invocation

    workdir = Path(args.workdir).resolve()
    qa_meta, qs = load_qa(Path(args.qa_set))
    commit = qa_meta.get("commit", args.commit)
    repo_url = qa_meta.get("repo_url", args.repo_url)
    modes = [m.strip() for m in args.modes.split(",") if m.strip()]
    # Per-language QA sets (QA_SET_<lang>.json) carry the language; the
    # frozen Go set predates the field.
    repo_slug = qa_meta.get("repo_slug", PINNED_REPO_SLUG)
    lang_label = LANGUAGE_LABELS.get(qa_meta.get("language", "go"), qa_meta.get("language", "Go"))
    invalid_modes = sorted(set(modes) - {"atlas", "graphify", "baseline"})
    if invalid_modes:
        raise SystemExit(f"unsupported modes: {', '.join(invalid_modes)}")
    if not modes:
        raise SystemExit("at least one benchmark mode is required")

    if args.setup:
        required_tools = [
            (args.atlas_bin, "download from the atlas releases page"),
            ("git", "install git"),
        ]
        if "graphify" in modes:
            required_tools.append((args.graphify_bin, "uv tool install graphifyy"))
        for b, hint in required_tools:
            if shutil.which(b) is None:
                raise SystemExit(f"[setup] `{b}` not found on PATH ({hint})")
        repo = Path(args.repo).resolve() if args.repo else ensure_repo(workdir, repo_url, commit)
        graphify_bin = args.graphify_bin if "graphify" in modes else None
        db = args.db or ensure_indexes(repo, workdir, args.atlas_bin, graphify_bin)
    else:
        if not args.repo or not args.db:
            raise SystemExit("--repo and --db are required without --setup")
        repo = Path(args.repo).resolve()
        db = args.db

    codex_home, codex_reason = (Path(args.codex_home), None) if args.codex_home \
        else ensure_codex_home(workdir, repo)
    if args.setup_only:
        print(f"[setup] done: repo={repo} db={db} codex_home={codex_home or codex_reason}")
        return

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

    logs = Path(args.logs) if args.logs else workdir / "logs"
    logs.mkdir(parents=True, exist_ok=True)

    # The agent's PATH resolves `atlas`/`graphify` to the PINNED binaries — see
    # ensure_tool_path. Without this the agents queried whatever build happened
    # to be installed, and --atlas-bin only ever pinned the indexer.
    graphify_bin = args.graphify_bin if "graphify" in modes else None
    agent_env = ensure_tool_path(workdir, args.atlas_bin, graphify_bin)
    atlas_version_start = cli_version(str(workdir / "toolbin" / "atlas"), "version")
    print(f"[setup] atlas under test (pinned copy): {atlas_version_start}", flush=True)

    def run_one(agent, mode, prompt, log_path, timeout=None):
        call_timeout = args.timeout if timeout is None else timeout
        for attempt in range(args.retries + 1):
            # the first attempt owns the plain log name; retries get a suffix so a
            # failed transcript survives for diagnosis instead of being overwritten
            path = Path(log_path)
            attempt_log = path if attempt == 0 else path.with_name(f"{path.stem}.attempt{attempt + 1}{path.suffix}")
            if agent == "claude":
                rec = run_claude(prompt, repo, mode, args.claude_model,
                                 args.budget_usd, call_timeout, attempt_log, env=agent_env)
            else:
                rec = run_codex(prompt, repo, codex_home, mode, args.codex_model,
                                call_timeout, attempt_log, base_env=agent_env)
            rec["attempts"] = attempt + 1
            if rec.get("status") == "ok":
                return rec
        return rec

    cals = {}
    if not args.skip_calibration and not args.merge_into:
        for agent in agents:
            print(f"[cal] {agent} ...", flush=True)
            # Calibration intentionally uses no code-intelligence tool. Mark it
            # baseline so Codex's fail-closed tool-command check does not reject
            # a correct one-message "OK" response for making zero Atlas calls.
            cals[agent] = run_one(
                agent, "baseline", CAL_PROMPT, logs / f"cal_{agent}.log",
                timeout=args.calibration_timeout,
            )
            print(f"[cal] {agent}: total={cals[agent].get('total_tokens')} "
                  f"status={cals[agent].get('status')}", flush=True)
        invalid_calibrations = calibration_errors(cals)
        if invalid_calibrations:
            raise SystemExit(
                "provider calibration failed; refusing paid benchmark matrix: "
                + "; ".join(invalid_calibrations)
                + f"; see {logs}"
            )

    tasks = [(q, agent, mode, rep)
             for q in qs for agent in agents for mode in modes
             for rep in range(1, args.repeats + 1)]
    if args.cells:
        if args.cells == "failed":
            if not args.merge_into:
                raise SystemExit("--cells failed needs --merge-into <report.json>")
            prev_runs = json.load(open(args.merge_into))["runs"]
            wanted = {(r["agent"], r["mode"], r["symbol"], r.get("rep", 1))
                      for r in prev_runs if r.get("status") != "ok"}
        else:
            wanted = set()
            for cell in args.cells.split(","):
                a, m, sym = cell.strip().split(":", 2)
                wanted.add((a, m, sym, 1))
        tasks = [t for t in tasks if (t[1], t[2], t[0]["symbol"], t[3]) in wanted]
        print(f"[cells] running {len(tasks)} cell(s): "
              + ", ".join(f"{a}:{m}:{s}" for a, m, s, _ in sorted(wanted)), flush=True)

    def run_task(task):
        q, agent, mode, rep = task
        tag = f"{agent}_{mode}_{q['symbol']}" + (f"_r{rep}" if args.repeats > 1 else "")
        rec = run_one(agent, mode, build_prompt(mode, db, q["question"],
                                                language=lang_label, slug=repo_slug),
                      logs / f"{tag}.log")
        rec.update({"qid": q["id"], "symbol": q["symbol"],
                    "agent": agent, "mode": mode, "rep": rep})
        if rec.get("status") == "ok" and not (rec.get("answer") or "").strip():
            rec["empty_answer"] = True   # scored as F1 0 below; reported, not hidden
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
    if args.merge_into:
        # cell-by-cell merge into the existing report: a re-run cell replaces the
        # old record (whatever its new status — a second stall is reported, not
        # hidden), untouched cells stay, meta and calibration are the original's
        prev = json.load(open(args.merge_into))
        key = lambda r: (r["agent"], r["mode"], r["symbol"], r.get("rep", 1))
        fresh = {key(r): r for r in records}
        # A re-run cell replaces the old record, EXCEPT that a failed re-run never
        # overwrites an ok result (2026-10-28 18:53: a re-run during a provider
        # outage replaced 38 valid C++ atlas cells with errors). Kept cells are
        # listed in the reruns note so the loss of the fresh attempt is visible.
        kept_previous = []
        def pick(old):
            new = fresh.pop(key(old), None)
            if new is None:
                return old
            if old.get("status") == "ok" and new.get("status") != "ok":
                kept_previous.append(f"{old['agent']}:{old['mode']}:{old['symbol']}")
                return old
            return new
        merged = [pick(r) for r in prev["runs"]] + list(fresh.values())
        n_prev = sum(1 for p in Path(args.merge_into).parent.glob(Path(args.merge_into).stem + ".before-rerun-*.json"))
        backup = Path(args.merge_into).with_name(f"{Path(args.merge_into).stem}.before-rerun-{n_prev + 1}.json")
        backup.write_text(Path(args.merge_into).read_text())
        meta = prev["meta"]
        meta.setdefault("reruns", []).append({
            "date": time.strftime("%Y-%m-%d %H:%M"), "jobs": args.jobs,
            "cells": [f"{r['agent']}:{r['mode']}:{r['symbol']}" for r in records],
            "statuses": {f"{r['agent']}:{r['mode']}:{r['symbol']}": r.get("status") for r in records},
            "kept_previous_ok": kept_previous,
            "atlas_on_agent_path": cli_version(str(Path(args.workdir) / "toolbin" / "atlas"), "version"),
            "previous_json": str(backup),
        })
        merged.sort(key=lambda r: (order.get(r["qid"], 10**6), r["agent"], r["mode"], r.get("rep", 1)))
        print(f"[merge] {len(records)} cell(s) merged into {args.merge_into} (previous copy: {backup})", flush=True)
        Path(args.json_out).write_text(json.dumps(
            {"meta": meta, "calibration": prev.get("calibration", {}), "runs": merged}, indent=2))
        write_report(args.out, merged, prev.get("calibration", {}), meta)
        return
    records.sort(key=lambda r: (order[r["qid"]], r["agent"], r["mode"], r["rep"]))

    meta = {
        "repo_slug": qa_meta.get("repo_slug", PINNED_REPO_SLUG),
        "language": qa_meta.get("language", "go"),
        "truth": qa_meta.get("truth", "gopls call_hierarchy"),
        "repo_url": repo_url, "repo_commit": commit,
        "n_questions": len(qs), "agents": agents, "modes": modes,
        "atlas_format": ATLAS_FORMAT,
        "atlas_invocation": atlas_invocation(db),
        "skipped_agents": skipped, "repeats": args.repeats,
        "claude_model": args.claude_model,
        "codex_model": args.codex_model or "codex default",
        "date": time.strftime("%Y-%m-%d"),
        "db": db,
        "tool_versions": {
            "claude": cli_version("claude") if "claude" in agents else "skipped",
            "codex": cli_version("codex") if "codex" in agents else "skipped",
            # the PINNED copy, not --atlas-bin re-read at the end: bin/atlas was
            # rebuilt during the Java leg and this field then misreported it
            "atlas": atlas_version_start,
            "atlas_bin_at_end": cli_version(args.atlas_bin, "version"),
            "graphify": cli_version(args.graphify_bin) if "graphify" in modes else "not requested",
            # What the AGENT actually resolves — must equal the pinned versions
            # above. They diverged for months (a 100-commit-old PATH binary).
            "atlas_on_agent_path": cli_version(str(Path(args.workdir) / "toolbin" / "atlas"), "version"),
            "atlas_at_start": atlas_version_start,
        },
    }
    # the pinned copy cannot change under us, but say so explicitly — and if it
    # ever does, the report must not pretend otherwise
    meta["binary_changed_during_run"] = meta["tool_versions"]["atlas_on_agent_path"] != atlas_version_start
    Path(args.json_out).write_text(json.dumps(
        {"meta": meta, "calibration": cals, "runs": records}, indent=2))
    write_report(args.out, records, cals, meta)
    print(f"\n[wrote] {args.out}\n[wrote] {args.json_out}\n[logs]  {logs}/")


if __name__ == "__main__":
    main()
