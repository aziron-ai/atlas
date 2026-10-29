# Agent-harness token benchmark — run it from your machine

Most code-intelligence benchmarks measure the tool's *output text*. This one
measures what actually hits your bill: the **end-to-end token usage a real
coding-agent harness reports** when it answers code questions with one
code-intel tool or another.

Two real agents, three modes, one pinned repository per language:

- **Agents:** [Claude Code](https://claude.com/claude-code) (`claude -p`,
  JSON usage accounting) and [OpenAI Codex](https://github.com/openai/codex)
  (`codex exec --json`, JSONL usage events)
- **Modes per run:** `atlas` (this repo's CLI) · `graphify` (the
  [graphifyy](https://pypi.org/project/graphifyy/) graph CLI) · optional
  `baseline` (no tool — raw grep/read exploration)
- **Targets:** each question set pins a public repository and commit, and the
  suite clones exactly that commit, so the graph both tools see is identical
  everywhere
- **Ground truth:** 19 caller-set questions per language, answered by the
  language's own server (an authority neither tool can influence) and frozen
  in a `QA_SET_<lang>.json` file:

| Language | Question set | Repository @ commit | Truth |
| --- | --- | --- | --- |
| Go | [`QA_SET_logrus.json`](QA_SET_logrus.json) | [sirupsen/logrus](https://github.com/sirupsen/logrus) @ `a23d315d` | gopls call_hierarchy |
| Python | [`QA_SET_python.json`](QA_SET_python.json) | [psf/requests](https://github.com/psf/requests) @ `3c7baaa0` | pyright-langserver LSP call_hierarchy |
| C | [`QA_SET_c.json`](QA_SET_c.json) | [DaveGamble/cJSON](https://github.com/DaveGamble/cJSON) @ `6d9f2443` | clangd LSP call_hierarchy |
| Java | [`QA_SET_java.json`](QA_SET_java.json) | [google/gson](https://github.com/google/gson) @ `57731049` | jdtls LSP references+documentSymbol |
| C++ | [`QA_SET_cpp.json`](QA_SET_cpp.json) | [google/leveldb](https://github.com/google/leveldb) @ `bb74ef73` | clangd LSP call_hierarchy |
| JavaScript | [`QA_SET_javascript.json`](QA_SET_javascript.json) | [axios/axios](https://github.com/axios/axios) @ `8f4ed569` | typescript-language-server LSP call_hierarchy |
| TypeScript | [`QA_SET_typescript.json`](QA_SET_typescript.json) | [vuejs/core](https://github.com/vuejs/core) @ `ca034820` | typescript-language-server LSP call_hierarchy |
| Rust | [`QA_SET_rust.json`](QA_SET_rust.json) | [BurntSushi/ripgrep](https://github.com/BurntSushi/ripgrep) @ `91f5d22e` | rust-analyzer LSP call_hierarchy |

## Prerequisites

| what | how |
| --- | --- |
| `atlas` | [install](https://github.com/aziron-ai/atlas#install) — brew, npm, or a release archive |
| `graphify` | `uv tool install graphifyy` (or `pip install graphifyy`) |
| `claude` and/or `codex` | each logged in as you normally use it; whichever is present is benchmarked (`--agents auto`) |
| `python3` (3.10+), `git` | stdlib only, no pip packages needed |

## Run

```sh
python3 agent-bench/agent_token_bench.py --setup --agents auto \
    --modes atlas,graphify,baseline \
    --qa-set agent-bench/QA_SET_logrus.json --workdir agentbench-work
```

Any other language: point `--qa-set` at its file and give it its own workdir —
the harness reads the repository, commit and language from the set:

```sh
python3 agent-bench/agent_token_bench.py --setup --agents auto --modes atlas,graphify,baseline \
    --qa-set agent-bench/QA_SET_python.json     --workdir agentbench-python
python3 agent-bench/agent_token_bench.py --setup --agents auto --modes atlas,graphify,baseline \
    --qa-set agent-bench/QA_SET_c.json          --workdir agentbench-c
python3 agent-bench/agent_token_bench.py --setup --agents auto --modes atlas,graphify,baseline \
    --qa-set agent-bench/QA_SET_java.json       --workdir agentbench-java
python3 agent-bench/agent_token_bench.py --setup --agents auto --modes atlas,graphify,baseline \
    --qa-set agent-bench/QA_SET_cpp.json        --workdir agentbench-cpp
python3 agent-bench/agent_token_bench.py --setup --agents auto --modes atlas,graphify,baseline \
    --qa-set agent-bench/QA_SET_javascript.json --workdir agentbench-javascript
python3 agent-bench/agent_token_bench.py --setup --agents auto --modes atlas,graphify,baseline \
    --qa-set agent-bench/QA_SET_typescript.json --workdir agentbench-typescript
python3 agent-bench/agent_token_bench.py --setup --agents auto --modes atlas,graphify,baseline \
    --qa-set agent-bench/QA_SET_rust.json       --workdir agentbench-rust
```

`--setup-only` clones, indexes and provisions without a single agent run (no
quota spent) — a cheap way to check a machine first.

`--setup` clones the pinned commit, builds the Atlas index and the graphify
graph, and provisions an isolated `CODEX_HOME` (your `~/.codex/auth.json` is
copied, your config is not). `--modes atlas,graphify` skips the no-tool
baseline, `--repeats 3` gives mean ± sd, `--jobs 3` runs cells concurrently.
A cell that times out or hits a provider error can be re-run on its own with
`--cells failed --merge-into <workdir>/AGENT_TOKEN_REPORT.json`: the re-run
replaces only that cell, never overwrites an answered one with a failure, and
is recorded under `reruns` in the report.

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
- codex also runs under an isolated `HOME`, because it loads skills from
  `~/.agents/skills` regardless of `CODEX_HOME` — an installed Atlas skill would
  otherwise leak into the no-tool baseline.
- every atlas invocation pins `--db` explicitly (a live `atlas serve` would
  otherwise hijack default-DB CLI calls), and the binary under test is copied
  into `<workdir>/toolbin` and put first on both agents' `PATH`, so the agent
  queries exactly the build that indexed (the report records the version the
  agent resolved, at the start and at the end).
- a timed-out run is killed as a whole process group, so a native `codex`
  child cannot outlive its wrapper and hold a provider session open.
- a per-agent **calibration run** (a no-tool "Reply with exactly: OK") records
  each harness's fixed token floor, so you can separate harness overhead from
  per-question marginal cost.
- scoring is deterministic: comma-separated names vs the frozen caller set,
  precision/recall/F1. Qualified names score as their last segment
  (`Class.method`, `mod::fn`, `path/fn`), a C++ destructor's `~` is dropped (the
  clangd truth set spells it without), and an empty answer scores F1 0.

## Reading the numbers

**Cross-agent absolute totals are not comparable** — the two harnesses use
different tokenizers and different system-prompt floors. The reproducible
result is the *mode-vs-mode gap within each agent*: how many tokens and tool
calls the same agent burns to reach an answer with each tool, and how often
the answer is right. Your absolute numbers will drift with agent versions and
models; the gap is what to compare.

## Published runs

| Run | Where | Per-run records |
| --- | --- | --- |
| logrus, 2026-10-28, released Atlas 0.1.54, Claude Code 2.1.304 (claude-sonnet-5), Codex CLI 0.162.1 (gpt-6.1-sol) | [#agents](https://atlas.aziro.com/#agents) | [`AGENT_TOKEN_BENCH_PUBLIC_20261028.json`](../data/raw/AGENT_TOKEN_BENCH_PUBLIC_20261028.json) |
| eight languages, 2026-10-28, develop builds that ship in 0.1.55, same agents | [#agent-languages](https://atlas.aziro.com/#agent-languages) | `AGENT_TOKEN_BENCH_<LANG>_20261028.json` in [`data/raw/`](../data/raw/) |
| logrus, 2026-08-05 (superseded), Claude Code 2.1.178, Codex CLI 0.146.0-alpha.9.2 (gpt-5.6-sol) | — | [`AGENT_TOKEN_BENCH_PUBLIC.json`](../data/raw/AGENT_TOKEN_BENCH_PUBLIC.json) |

The question sets for C, C++, Java, JavaScript, Python, Rust and TypeScript are
also the label source of the natural-language relevance benchmark in
[`../relevance-bench/`](../relevance-bench/).
