# Benchmarks and Methodology

Atlas publishes benchmark results for accuracy, token use, latency, language
compatibility, and agent workflows. Use this page to interpret those numbers
correctly — every result is a dated measurement under stated conditions, not a
general guarantee.

[Open the Atlas benchmark explorer](https://aziron-ai.github.io/atlas/#benchmarks)

## How to Read a Result

Work through this checklist before comparing tools or quoting a number — a
result you cannot place in it is not evidence:

1. **Identify the setup.** Atlas and baseline tool versions, repository URL
   and pinned commit, language and query set.
2. **Identify the conditions.** Hardware and operating system, cold-cache or
   warm-cache state, repeat count and aggregation method.
3. **Identify the scoring.** The accuracy oracle or reviewer, and the token
   measurement method (provider-reported usage versus a documented estimate).
4. **Identify the failure handling.** How failed and timed-out cases were
   counted. A mean that silently drops failures is not comparable to one that
   scores them.

## Evidence Categories

Keep categories separate — do not combine them into one unsupported headline:

- **Compatibility:** whether a format indexes successfully
- **Correctness:** precision, recall, or F1 against an oracle
- **Latency:** elapsed index or query time under stated cache conditions
- **Token use:** measured model/tool usage or a documented estimate
- **Agent workflow:** end-to-end behavior for a pinned assistant and task set

## Published Headline Results (July 2026)

These are the current published numbers, each with its evidence conditions:

| Result | Conditions |
| --- | --- |
| F1 0.757 at 21.2 context tokens, mean across all 37 languages | Fixture-truth ground truth, real-LLM scored (222 cells, 666 model calls) |
| F1 1.000 at 27.1 tokens on the 28 fully-supported languages | Full-file-dump accuracy at 6.1× fewer tokens; same fixture suite |
| Graph-tool comparison: 0.539 F1 at 97 tokens | Atlas delivers 6.4× the accuracy per token and 36× fewer query tokens |
| Query latency ~7.4 ms vs 128 ms for the graph tool | Real repositories, 36 languages; flat from 15 to 39,161 symbols |

## Agent-Harness Token Benchmark (2026-07-10)

This measures what a real agent actually spends. Claude Code and OpenAI Codex
ran headless in sirupsen/logrus (@a23d315), restricted to one
code-intelligence CLI per run, answering 19 caller questions scored against
gopls call_hierarchy (LSP-truth) at the pinned commit. Token numbers are each
harness's own usage accounting.

| Agent | Context source | Mean total tokens | Mean tool calls | Mean F1 |
| --- | --- | --- | --- | --- |
| claude (claude-sonnet-5) | Atlas | 61,561 | 2 | 0.882 |
| claude (claude-sonnet-5) | No tool (raw exploration) | 144,385 | 4.9 | 0.569 |
| claude (claude-sonnet-5) | Graph tool | 370,898 | 10.3 | 0.305 |
| codex (gpt-5.6-sol) | Atlas | 27,981 | 1 | 0.881 |
| codex (gpt-5.6-sol) | No tool (raw exploration) | 48,106 | 2.1 | 0.876 |
| codex (gpt-5.6-sol) | Graph tool | 109,662 | 9.6 | 0.410 |

Cross-agent absolute totals are **not comparable** — the two harnesses use
different tokenizers and system-prompt floors (see each agent's calibration).
Compare modes within an agent only.

## Reproduce It Yourself

Every published number is reproducible from committed artifacts — verify
before you cite:

- [Processed site data (site-data.json)](https://github.com/aziron-ai/atlas/blob/main/data/site-data.json)
- [Raw benchmark artifacts (data/raw)](https://github.com/aziron-ai/atlas/tree/main/data/raw)
- [Evidence manifests](https://github.com/aziron-ai/atlas/tree/main/data)
- [Agent benchmark kit (agent-bench/)](https://github.com/aziron-ai/atlas/tree/main/agent-bench)

The agent suite ships with the pinned commit, frozen gopls question set, and
isolation flags baked in:

```sh
python3 agent-bench/agent_token_bench.py \
  --setup \
  --agents auto \
  --qa-set agent-bench/QA_SET_logrus.json \
  --workdir agentbench-work
```

Read
[agent-bench/README.md](https://github.com/aziron-ai/atlas/blob/main/agent-bench/README.md)
for prerequisites, expected external cost, pinned inputs, and interpretation.
Per-run records are in
[AGENT_TOKEN_BENCH_PUBLIC.json](https://aziron-ai.github.io/atlas/data/raw/AGENT_TOKEN_BENCH_PUBLIC.json).

## Important Limitations

- Fixture results do not prove production-repository accuracy.
- One repository does not establish performance across a language.
- Different assistants may consume the same MCP result differently.
- Estimated tokens are not equivalent to provider-reported token usage.
- Warm-cache query latency is not cold-start installation or indexing time.
- Language support and result quality can differ by syntax and framework.

Per-language support levels behind these results are summarized in
[Supported Languages and Formats](languages).

## Reporting a Comparison

If you publish your own comparison, include everything a reader needs to
reproduce it:

- exact commands
- raw machine-readable output
- all failed and timed-out cases
- environment metadata
- evidence limitations
- the Atlas release tag and checksum

Benchmark results are dated measurements under published conditions — not a
guarantee for every repository, machine, language, or assistant.
