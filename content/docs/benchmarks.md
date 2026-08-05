# Benchmarks and Methodology

Atlas publishes benchmark results for accuracy, token use, latency, language
compatibility, and agent workflows. Use this page to interpret those numbers
correctly — every result is a dated measurement under stated conditions, not a
general guarantee.

[Open the Atlas benchmark explorer](https://atlas.aziro.com/#benchmarks)

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

| Result | Conditions and definition |
| --- | --- |
| 3.17× fewer answer tokens than the graph tool | Pooled: sum of answer tokens over the 26 queries both tools answered, across a 7-repository matrix run on one host in one pass (Darwin arm64, graphify 0.8.49). Per-language mean 5.06×, median 3.66×, worst language cpp at 1.41× |
| Caller-F1 0.865 vs 0.541 — 1.60× | A real model is handed one context source and asked which functions call `target`; scored deterministically against a constructed truth of 15 callers and 3 decoys. 37 languages, 222 cells, 666 model calls, temperature 0, majority of 3 |
| The default detail level equals the maximum one | `--detail high` and `--detail xhigh` both score F1 0.8649 — at 23.9 tokens against 230.1, so high is 9.6× cheaper for an identical answer. 32 of 37 languages score a perfect 1.000 |
| Queries run 4.12× faster than the graph tool | Mean of the seven per-repository latency ratios on the same matrix; each timing is the median of 5 CLI invocations with process spawn included. Warm-serve `explain` lands between 1.6 and 14.9 ms per repository |

**Retracted.** Earlier versions of this page claimed **36× fewer query tokens** and
**17× faster queries** from a 36-repository live run, and an earlier one claimed 20×.
Those runs compared against a build whose caller answers were a two-token placeholder:
across all 224 live answers it named **zero callers**. The ratios measured an empty
answer, not a cheap one, and are withdrawn rather than adjusted. The
`2.3× faster cold index`, `14× faster incremental`, `7.9× more call edges` and
`100.2% AST coverage` rows are withdrawn too — they were not re-measured at this
commit, and a number nobody re-ran is not evidence.

**Live repositories, honestly.** On 36 pinned public repositories the current CLI
answers in **4.25× fewer tokens** (median across languages) or **3.70×** (pooled),
and runs **4.78×** faster. Those figures cover the 25 repositories whose Atlas answers
actually named a caller. On the other 11 — astro, blade, byond, delphi, ejs, lua,
powershell, rust, scala, sql, terraform — the CLI still returns a bare name or a name
and a location, so its token ratio measures a non-answer and is excluded from the
headline rather than averaged into it. Several of those excluded ratios are large
(lua 35.8×, rust 46.1×, terraform 38.5×); that is precisely why they are excluded.

## Agent-Harness Token Benchmark (2026-08-05)

This measures what a real agent actually spends. Claude Code and OpenAI Codex
ran headless in sirupsen/logrus (@a23d315), restricted to one
code-intelligence CLI per run, answering 19 caller questions scored against
gopls call_hierarchy (LSP-truth) at the pinned commit. Token numbers are each
harness's own usage accounting.

| Agent | Context source | Mean total tokens | Mean tool calls | Mean F1 |
| --- | --- | --- | --- | --- |
| claude (claude-sonnet-5) | Atlas | 58,234 | 2.0 | 0.995 |
| claude (claude-sonnet-5) | No tool (raw exploration) | 134,886 | 4.7 | 0.589 |
| claude (claude-sonnet-5) | Graph tool | 239,026 | 7.7 | 0.203 |
| codex (gpt-5.6-sol) | Atlas | 33,471 | 1.0 | 0.995 |
| codex (gpt-5.6-sol) | No tool (raw exploration) | 74,229 | 3.3 | 0.831 |
| codex (gpt-5.6-sol) | Graph tool | 131,335 | 12.7 | 0.379 |

All 114 runs completed (19 questions × 2 agents × 3 modes). Against the baseline,
Atlas saves 2.32× the tokens on claude and 2.22× on codex; against the graph tool,
4.10× and 3.92×.

Cross-agent absolute totals are **not comparable** — the two harnesses use
different tokenizers and system-prompt floors (see each agent's calibration).
Compare modes within an agent only.

**Two changes from the previously published table.** Atlas's F1 is 0.995 on both
harnesses; the figure published before was 0.88. And this run used **graphify
0.8.49** where the published run used **0.9.12**, so part of the movement in the
competitor column is a version change on their side rather than a change on ours.
Both versions are recorded in the artifacts.

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
[AGENT_TOKEN_BENCH_PUBLIC.json](https://atlas.aziro.com/data/raw/AGENT_TOKEN_BENCH_PUBLIC.json).

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
