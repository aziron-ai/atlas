# Atlas — deterministic code intelligence for developers and agents

**The most accurate code answer, for the fewest tokens.** Atlas is a
deterministic, LLM-free code-intelligence CLI: one local binary that indexes a
repository into a SQLite symbol/call graph in under a second and answers
context queries — a symbol's definition, callers, callees, imports, routes —
in ~7 ms and ~21 tokens, instead of dumping whole files into a model's
context window.

**Benchmark & field comparison:** https://aziron-ai.github.io/atlas/

## Why it matters (July 2026 benchmark, real-LLM scored)

| Result | Number | Evidence |
| --- | --- | --- |
| Answer accuracy, all 37 languages | **F1 0.757 @ 21.2 tokens** | fixture-truth, 222 cells / 666 model calls |
| Accuracy on the 28 fully-supported languages | **F1 1.000 @ 27.1 tokens** | matches a full-file dump at 6.1× fewer tokens |
| vs. graph tool (Graphify) | **6.4× accuracy per token · 36× fewer tokens** | graph tool: F1 0.539 @ 96.5 tokens |
| Real repository (sirupsen/logrus vs gopls truth) | **F1 0.975 vs 0.084** | LSP-truth, production fan-in |
| Real agent harnesses, end-to-end (Claude Code + OpenAI Codex) | **3.9–6.0× fewer total tokens than the graph tool at F1 0.88 vs 0.31–0.41** — and cheaper than raw grep exploration | harness-reported usage, 114 runs, [reproduce it yourself](agent-bench/) |
| Query latency | **~7.4 ms, flat to 39k symbols** | 36 real repositories |
| Independent Linux re-run | **37/37 fixture-perfect · gopls 0.933** | deterministic corroboration |

Accuracy is tunable with a single `--detail low|medium|high|xhigh` knob;
`high` is the default sweet spot (all the accuracy at 1/13th of xhigh's
tokens), and retrieval operations floor at `high` so an agent is never handed
a truncated caller list. 40 code languages sit on a five-level, evidence-graded
maturity ladder (plus ~24 content formats indexed for search) — see the
[maturity ladder](https://aziron-ai.github.io/atlas/#languages) for the honest
per-language status, including the 9 languages pending real-repo proof.

Every number is reproducible from the artifacts committed under
[`data/`](data/) — start with
[`data/site-data.json`](https://aziron-ai.github.io/atlas/data/site-data.json).

## Install

This repository publishes prebuilt `atlas` CLI release assets and the public
benchmark/product site.

- GitHub Releases: macOS and Linux archives plus Linux `.deb`, `.rpm`, and `.apk` packages
- Homebrew tap: `dominic097/homebrew-atlas`
- npm wrapper package: `@dominic097/atlas`

Homebrew:

```sh
brew install --cask dominic097/atlas/atlas
atlas version
```

npm:

```sh
npm install -g @dominic097/atlas
atlas version
```

Linux archive (see [releases/latest](https://github.com/aziron-ai/atlas/releases/latest) for the current version):

```sh
curl -LO https://github.com/aziron-ai/atlas/releases/download/v0.1.28/atlas_0.1.28_linux_amd64.tar.gz
tar -xzf atlas_0.1.28_linux_amd64.tar.gz
sudo install -m 0755 atlas /usr/local/bin/atlas
atlas version
```

Basic local workflow:

```sh
atlas index . --reindex
atlas context --paths path/to/changed-file.go --query "review risk" --format json
atlas search "symbol or concept" --limit 10
atlas mcp --transport http --http 127.0.0.1:8765
```

Atlas uses embedded SQLite by default at `sqlite://./.atlas/atlas.db`; no server
is required for local indexing, context retrieval, or MCP usage. Agents connect
over MCP (`atlas install skill --agent claude`, or `codex`).

No Atlas CLI source tree is maintained in this repository.

## Benchmark site

The Atlas benchmark site is published with GitHub Pages from this repository:

https://aziron-ai.github.io/atlas/

The site is generated from benchmark JSON artifacts committed under `data/raw/`
and renders `data/site-data.json` at runtime, keeping raw artifact links
visible for auditability. All published data passes a sanitizer
(`scripts/sanitize-public-data.mjs`) that strips local machine paths and
private identifiers, enforced again by the test suite.

The site itself is a static React/Tailwind build. Source lives under `src/`,
the generated GitHub Pages assets are committed under `assets/`, and a static
crawler-readable digest of the benchmark is injected into `index.html` by
`scripts/build-seo.mjs`.

```sh
npm install
node scripts/build-site-data.mjs /path/to/aziron-atlas/bench   # refresh data
node scripts/build-agent-bench-data.mjs /path/to/AGENT_TOKEN_REPORT.json  # agent-harness section
node scripts/build-seo.mjs                                     # refresh static digest + robots/sitemap/llms.txt
npm run build                                                  # bundle
npm run test:site                                              # Playwright checks (serve first)
```

## Reproduce the agent benchmark yourself

The agent-harness token benchmark on the site — what Claude Code and OpenAI
Codex actually spend end-to-end with Atlas vs the graphify graph tool — ships
as a self-contained suite in [`agent-bench/`](agent-bench/): pinned repo
commit, frozen gopls ground truth, isolation flags baked in. One command,
your own agent logins:

```sh
python3 agent-bench/agent_token_bench.py --setup --agents auto \
    --qa-set agent-bench/QA_SET_logrus.json --workdir agentbench-work
```

See [`agent-bench/README.md`](agent-bench/README.md) for prerequisites, cost
expectations, and how to read the numbers.
