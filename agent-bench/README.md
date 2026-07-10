# Agent-harness token benchmark — run it from your machine

Most code-intelligence benchmarks measure the tool's *output text*. This one
measures what actually hits your bill: the **end-to-end token usage a real
coding-agent harness reports** when it answers code questions with one
code-intel tool or another.

Two real agents, three modes, one pinned repository:

- **Agents:** [Claude Code](https://claude.com/claude-code) (`claude -p`,
  JSON usage accounting) and [OpenAI Codex](https://github.com/openai/codex)
  (`codex exec --json`, JSONL usage events)
- **Modes per run:** `atlas` (this repo's CLI) · `graphify` (the
  [graphifyy](https://pypi.org/project/graphifyy/) graph CLI) · optional
  `baseline` (no tool — raw grep/read exploration)
- **Target:** `sirupsen/logrus` frozen at commit `a23d315d` — the suite clones
  exactly that commit, so the graph both tools see is identical everywhere
- **Ground truth:** 19 caller-set questions answered by `gopls call_hierarchy`
  (an authority neither tool can influence), frozen in
  [`QA_SET_logrus.json`](QA_SET_logrus.json)

## Prerequisites

| what | how |
| --- | --- |
| `atlas` | [install](https://github.com/aziron-ai/atlas#install) — brew, npm, or a release archive |
| `graphify` | `uv tool install graphifyy` (or `pip install graphifyy`) |
| `claude` and/or `codex` | each logged in as you normally use it; whichever is present is benchmarked (`--agents auto`) |
| `python3`, `git` | stdlib only, no pip packages needed |

## Run

```sh
python3 agent-bench/agent_token_bench.py --setup --agents auto \
    --qa-set agent-bench/QA_SET_logrus.json --workdir agentbench-work
```

`--setup` clones the pinned commit, builds the Atlas index and the graphify
graph, and provisions an isolated `CODEX_HOME` (your `~/.codex/auth.json` is
copied, your config is not). Add `--modes atlas,graphify,baseline` for the
three-way comparison, `--repeats 3` for mean ± sd, `--jobs 3` to run cells
concurrently.

Outputs: `AGENT_TOKEN_REPORT.md` (calibration floor + per-mode means +
per-question detail), `AGENT_TOKEN_REPORT.json` (raw usage records), and one
log file per run under `<workdir>/logs/` — every number in the report is
re-derivable from those logs.

## What it costs to run

The agents make real model calls with **your** credentials. A full
19-question × 2-agent × 3-mode sweep is on the order of 100+ agent runs —
expect a few dollars of Claude API spend (the harness prints its own USD
total) and comparable Codex usage, plus 60–90 minutes of wall time at
`--jobs 3`. Start with `--modes atlas,graphify` and a subset if you just want
the shape of the result.

## Fairness & isolation (baked into the script)

- claude runs with `--setting-sources ""` (no user CLAUDE.md can bias tool
  choice) and `--strict-mcp-config` with an empty MCP set; Bash is
  allow-listed to **only** the mode's CLI prefix, so a run cannot silently
  fall back to grep or the other tool.
- codex runs under an isolated `CODEX_HOME`, so locally configured MCP
  servers can't leak context into a run.
- every atlas invocation pins `--db` explicitly (a live `atlas serve` would
  otherwise hijack default-DB CLI calls).
- a per-agent **calibration run** (a no-tool "Reply with exactly: OK") records
  each harness's fixed token floor, so you can separate harness overhead from
  per-question marginal cost.
- scoring is deterministic: comma-separated names vs the frozen gopls caller
  set, precision/recall/F1.

## Reading the numbers

**Cross-agent absolute totals are not comparable** — the two harnesses use
different tokenizers and different system-prompt floors. The reproducible
result is the *mode-vs-mode gap within each agent*: how many tokens and tool
calls the same agent burns to reach an answer with each tool, and how often
the answer is right. Your absolute numbers will drift with agent versions and
models; the gap is what to compare.

The published run this suite backs is on the
[benchmark site](https://aziron-ai.github.io/atlas/#agents), with per-run
records in
[`data/raw/AGENT_TOKEN_BENCH_PUBLIC.json`](../data/raw/AGENT_TOKEN_BENCH_PUBLIC.json).
