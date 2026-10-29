# Benchmarks and Methodology

Atlas publishes benchmark results for accuracy, token use, latency, language
compatibility, and agent workflows. Use this page to interpret those numbers
correctly — every result is a dated measurement under stated conditions, not a
general guarantee.

[Open the Atlas benchmark explorer](https://atlas.aziro.com/#benchmarks)

What 0.1.55 adds to the evidence, a labelled relevance benchmark with a regression gate and the multi-language agent benchmark, is summarised in the [0.1.55 release notes](upgrade).

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

## Published Headline Results (refreshed 2026-08-05, shipped in v0.1.51)

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

## Agent-Harness Token Benchmark (2026-10-28, Atlas 0.1.54)

This measures what a real agent actually spends. Claude Code 2.1.304
(claude-sonnet-5) and Codex CLI 0.162.1 (gpt-6.1-sol) ran headless in
sirupsen/logrus (@a23d315), restricted to one code-intelligence CLI per run,
answering 19 caller questions scored against gopls call_hierarchy (LSP-truth)
at the pinned commit. The Atlas binary was the released 0.1.54 (e4b0dc22); the
graph tool was graphify 0.8.49. Token numbers are each harness's own usage
accounting. All 114 runs completed.

| Agent | Context source | Mean total tokens | Billed-proxy tokens | Mean turns | Mean F1 | Mean wall time |
| --- | --- | --- | --- | --- | --- | --- |
| claude (claude-sonnet-5) | Atlas | 76,205 | 7,948 | 2.0 | 0.995 | 10.2 s |
| claude (claude-sonnet-5) | No tool (raw exploration) | 163,187 | 11,336 | 4.5 | 0.504 | 17.8 s |
| claude (claude-sonnet-5) | Graph tool | 251,586 | 11,429 | 7.6 | 0.233 | 33.4 s |
| codex (gpt-6.1-sol) | Atlas | 52,776 | 13,440 | 1.0 | 0.995 | 8.7 s |
| codex (gpt-6.1-sol) | No tool (raw exploration) | 99,172 | 16,881 | 2.5 | 0.941 | 12.9 s |
| codex (gpt-6.1-sol) | Graph tool | 155,242 | 14,537 | 5.2 | 0.275 | 19.2 s |

Against the no-tool baseline, the other mode spends 2.14× Atlas's total
tokens on claude and 1.88× on codex; the graph tool spends 3.30× and 2.94×.
Turns: 2.26× and 2.53× (baseline), 3.79× and 5.21× (graph tool). Ratios are
taken between the unrounded per-run means. The harness floors (a no-tool
"Reply with exactly: OK") were 35,961 tokens for claude and 24,846 for codex.

Cross-agent absolute totals are **not comparable** — the two harnesses use
different tokenizers and system-prompt floors (see each agent's calibration).
Compare modes within an agent only. Billed-proxy = fresh input + cache writes
+ output (codex: fresh input + output); cache reads bill at about 10% and are
excluded.

**Replaces the 2026-08-05 run.** That run used an Atlas development build
(fc68e26, released as 0.1.51), Claude Code 2.1.178 with claude-sonnet-5 and
Codex CLI 0.146.0-alpha.9.2 with gpt-5.6-sol, and measured 2.32× / 4.10×
(claude) and 2.22× / 3.92× (codex) against the baseline / graph tool. Atlas's
F1 did not move (0.995 on both harnesses, then and now). Two measured changes
account for part of the narrower gap: each harness's fixed floor rose (claude
+5,173, codex +9,428 tokens), and a larger floor added to both sides pulls
every ratio toward 1; and the newer codex is stronger without help (no-tool
F1 0.831 → 0.941 in 2.5 turns instead of 3.3). Atlas's own per-question
totals rose too (claude 58,234 → 76,205, codex 33,471 → 52,776); the run
does not isolate why. The superseded per-run records stay in
[AGENT_TOKEN_BENCH_PUBLIC.json](https://atlas.aziro.com/data/raw/AGENT_TOKEN_BENCH_PUBLIC.json).

One stored answer was re-scored after the run, when the scorer learned to
strip `::` qualifiers: claude · graph tool · `Errorf` 0.40 → 0.50, which raises
the graph tool's claude mean from 0.228 to 0.233. Per-run records:
[AGENT_TOKEN_BENCH_PUBLIC_20261028.json](https://atlas.aziro.com/data/raw/AGENT_TOKEN_BENCH_PUBLIC_20261028.json).

## Multi-Language Agent Benchmark (2026-10-28)

The same harness, generalized to eight languages: one pinned public
repository per language, 19 caller questions each with the language's own
server as ground truth, both agents (same versions and models as above), all
three modes — 912 runs, all answered. A cell **passes** when Atlas's mean F1
is higher than both the no-tool baseline's and the graph tool's **and** its
mean total tokens are lower than both. **Atlas passes 16 of 16 cells.**

| Language | Repository @ commit | Truth | claude F1 (Atlas · no tool · graph) | claude tokens vs Atlas (no tool · graph) | codex F1 (Atlas · no tool · graph) | codex tokens vs Atlas (no tool · graph) | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Go | sirupsen/logrus @a23d315 | gopls | **0.996** · 0.539 · 0.249 | 2.02× · 3.42× | **0.996** · 0.985 · 0.275 | 1.55× · 3.32× | claude ✓ codex ✓ |
| Python | psf/requests @3c7baaa | pyright-langserver | **0.965** · 0.467 · 0.479 | 3.77× · 3.29× | **0.965** · 0.861 · 0.469 | 1.79× · 2.19× | claude ✓ codex ✓ |
| C | DaveGamble/cJSON @6d9f244 | clangd | **1.000** · 0.640 · 0.983 | 2.21× · 1.35× | **1.000** · 0.988 · 0.997 | 2.04× · 1.23× | claude ✓ codex ✓ |
| Java | google/gson @5773104 | jdtls | **0.806** · 0.175 · 0.269 | 2.08× · 2.46× | **0.860** · 0.622 · 0.307 | 1.86× · 2.70× | claude ✓ codex ✓ |
| C++ | google/leveldb @bb74ef7 | clangd | **0.978** · 0.683 · 0.179 | 7.66× · 9.83× | **0.978** · 0.844 · 0.153 | 3.53× · 3.26× | claude ✓ codex ✓ |
| JavaScript | axios/axios @8f4ed56 | typescript-language-server | **0.991** · 0.780 · 0.594 | 4.39× · 1.87× | **0.991** · 0.913 · 0.601 | 1.76× · 1.79× | claude ✓ codex ✓ |
| TypeScript | vuejs/core @ca03482 | typescript-language-server | **0.980** · 0.767 · 0.550 | 3.08× · 1.76× | **0.957** · 0.820 · 0.582 | 1.88× · 1.34× | claude ✓ codex ✓ |
| Rust | BurntSushi/ripgrep @91f5d22 | rust-analyzer | **0.892** · 0.394 · 0.315 | 1.97× · 1.31× | **0.991** · 0.860 · 0.327 | 1.57× · 1.56× | claude ✓ codex ✓ |

F1 is the mean over the 19 questions; **bold** is Atlas. “Tokens vs Atlas” is
the no-tool baseline's and the graph tool's mean total tokens over Atlas's.
Absolute totals are not comparable across agents or languages. The verdict
counts total tokens. On billed-proxy tokens (cache reads excluded) the graph
tool spends less than Atlas in 4 of 32 comparisons, all on codex: C 0.80×,
JavaScript 0.84×, TypeScript 0.82× and Rust 0.75×. Every billed-proxy ratio is
in the per-language data.

Provenance, stated plainly:

- The Atlas cells ran on develop working-tree builds made during the
  campaign (six builds, each named per language in the artifacts); the
  changes merged to develop the same night and ship in 0.1.55. Java's Atlas
  cells came from two of those builds (31 and 7 cells); the later build only
  answered cells re-run after a timeout or provider error.
- Cells that timed out or hit provider errors were re-run; every final cell
  is ok. A run that names no function is scored F1 0, not dropped (25 graph-tool
  runs on codex across the eight languages).
- The JavaScript and TypeScript question sets were regenerated on 2026-10-29
  after the truth generator stopped counting references passed as values (for
  example `bind(…)`) as calls; the stored answers of every mode were re-scored
  against them. Sixteen C++ no-tool answers were re-scored when the scorer
  learned to strip `::` qualifiers and a destructor's `~`. Every re-score is
  listed, cell by cell, in the per-language artifact.

Per-run records: `data/raw/AGENT_TOKEN_BENCH_<LANG>_20261028.json` for GO,
PYTHON, C, JAVA, CPP, JAVASCRIPT, TYPESCRIPT and RUST; question sets:
`agent-bench/QA_SET_<lang>.json` (`QA_SET_logrus.json` for Go).

## Tool-Level Callers F1 Against LSP Truth (2026-10-29)

No agent and no model: `atlas callers <symbol> --json` straight from the CLI,
each repository indexed into a brand-new store, scored by caller name against
the same frozen LSP-truth question sets. This is the ceiling the tool hands an
agent.

| Language | Repository @ commit | Truth | Questions | Mean callers F1 | Perfect |
| --- | --- | --- | --- | --- | --- |
| Go | sirupsen/logrus @a23d315 | gopls | 19 | 0.996 | 17/19 |
| Python | psf/requests @3c7baaa | pyright-langserver | 19 | 0.965 | 14/19 |
| C | DaveGamble/cJSON @6d9f244 | clangd | 19 | 1.000 | 19/19 |
| Java | google/gson @5773104 | jdtls | 19 | 0.858 | 5/19 |
| C++ | google/leveldb @bb74ef7 | clangd | 19 | 0.935 | 7/19 |
| JavaScript | axios/axios @8f4ed56 | typescript-language-server | 19 | 0.940 | 10/19 |
| TypeScript | vuejs/core @ca03482 | typescript-language-server | 19 | 0.950 | 2/19 |
| Rust | BurntSushi/ripgrep @91f5d22 | rust-analyzer | 19 | 0.991 | 11/19 |

Per question: P = hits / names returned, R = hits / truth names,
F1 = 2PR / (P + R); the table shows the mean over 19 questions. Measured on
`atlas v0.1.52-697-gadb57f43`, a commit of the fix branch that develop merged
at 3790ba95 (ships in 0.1.55); it was not re-run on the merge commit itself.
Every per-question row was identical on the three builds measured before it
that night (1290d8a8, a3e9065b, 87b5330a). Per-question counts and the
scorer's verbatim output:
[TOOL_CALLERS_F1_LSP_20261029.json](https://atlas.aziro.com/data/raw/TOOL_CALLERS_F1_LSP_20261029.json).

Older and smaller results stay on the benchmark page with their dates: the
2026-08-05 Linux leg's gopls-truth F1 0.900 over 10 symbols of a private Go
service, and that leg's per-language native fixture table.

## Natural-Language Relevance Benchmark (2026-10-29)

Built for [issue #44](https://github.com/aziron-ai/atlas/issues/44): 216
labelled questions over three frozen corpora, asked in natural language of
three Atlas retrieval surfaces — `atlas search`, `atlas context` and the MCP
`code_query` tool — on a fresh index of each corpus, scored offline against
frozen labels, with a regression gate. Chromium is out of scope for the gate:
it indexes for hours, which is a manual release check, not a regression test.

| Corpus | Sources (pinned) | Tree | Files | Symbols | definition · callers · error handling · adversarial |
| --- | --- | --- | --- | --- | --- |
| c-cjson | DaveGamble/cJSON @6d9f244 | 43196d72eeaf | 178 | 2,474 | 19 · 19 · 9 · 12 = 59 |
| mixed-cpp-python | google/leveldb @bb74ef7 under leveldb/; psf/requests @3c7baaa under requests/ | 0036e745e7f6 | 249 | 4,368 | 38 · 38 · 10 · 12 = 98 |
| ts-vue | vuejs/core @ca03482 | 8c37cc4ea9cf | 644 | 21,378 | 19 · 19 · 9 · 12 = 59 |

Definition and caller labels are mechanical, taken from the LSP-truth question
sets above; error-handling labels are hand-labelled from the code, each item
citing `file:line`; adversarial questions are generic or stopword phrasings
with no entity, where the safe outcome is a refusal.

Pooled results (top 10):

| Question | Surface | n | P@1 | MRR | R@10 | Entity first | Query-word top-1 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| where is E defined? | search | 76 | 0.618 | 0.752 | 0.961 | 0.618 | 0.329 |
| where is E defined? | search, bare entity name (control) | 76 | 0.934 | 0.924 | 0.987 | 0.934 | 0.000 |
| where is E defined? | context | 76 | 0.632 | 0.762 | 0.961 | 0.632 | 0.342 |
| where is E defined? | code_query (MCP) | 76 | 0.632 | 0.762 | 0.961 | 0.632 | 0.342 |
| what calls E? | search | 76 | 0.645 | 0.208 | 0.089 | 0.645 | 0.289 |
| what calls E? | context | 76 | 0.632 | 0.397 | 0.488 | 0.632 | 0.368 |
| what calls E? | code_query (MCP) | 76 | 0.921 | 0.477 | 0.498 | 0.921 | 0.013 |
| E error exception handling | search | 28 | 0.821 | 0.780 | 0.592 | 0.679 | 0.107 |
| E error exception handling | context | 28 | 0.857 | 0.774 | 0.527 | 0.750 | 0.107 |
| E error exception handling | code_query (MCP) | 28 | 0.857 | 0.774 | 0.527 | 0.750 | 0.107 |

MRR and R@10 count only relevant labels; P@k also credits acceptable ones.
Entity first means the rank-1 result names the entity. Query-word top-1 is a
miss that matches only the question's phrasing (“where”, “is”, “calls”)
ranked first.

| Adversarial (generic / stopword) | n | Refused | Grounded | Safe | Confident noise |
| --- | --- | --- | --- | --- | --- |
| search | 36 | 0.333 | 0.083 | 0.417 | 0.583 |
| context | 36 | 0.000 | 0.111 | 0.111 | 0.889 |
| code_query (MCP) | 36 | 0.444 | 0.083 | 0.528 | 0.472 |

Safe means refused, or grounded in the corpus's own error machinery.

**The gate.** 159 frozen thresholds, each the measured develop baseline minus
a margin (0.03 pooled precision/MRR/recall/entity-first, 0.05 pooled
refusal/safe, 0.06 per corpus, 0.09 per-corpus safe, each widened to one
query's worth for small sets); all 159 hold. Two back-to-back runs on fresh
stores: 16 of 724 ranked lists differ, none at rank 1, gated drift 0. The gate
catches regressions; it does not certify that retrieval is good — the
baseline encodes today's defects, published as follow-ups:

- F1 — Question-template words are ranked as search terms (stopword pollution)
- F2 — Entity-first routing exists for “what calls”, not for “where is … defined”
- F3 — A case-exact whole-name match does not outrank case-folded or partial matches
- F4 — Non-code facts outrank code for code-shaped questions
- F5 — search refuses real identifiers inside a question (false off-topic)
- F6 — code_query's relevance floor (#60) grounds on generic words that happen to be symbol names, and keeps citations retrieved only by stopwords
- F7 — context never refuses and always ships a ~30 KB bundle
- F8 — Tied results ordered by store insertion order — fixed on develop by #135, kept as a regression control
- F9 — Graph packing puts test callers ahead of the error types a question names
- F10 — A vendored test framework answers generic questions (fixture pollution)

Measured 2026-10-29 on `atlas v0.1.52-700-g1a75deae` (develop 3790ba95 plus
the benchmark; no ranking code changed), macOS arm64, 80.8 s. Repro, likely
cause and acceptance for every finding:
[relevance-bench/RESULTS.md](https://github.com/aziron-ai/atlas/blob/main/relevance-bench/RESULTS.md);
per-query rows and every gate verdict:
[RELEVANCE_BENCH_20261029.json](https://atlas.aziro.com/data/raw/RELEVANCE_BENCH_20261029.json).

## Reproduce It Yourself

Every published number is reproducible from committed artifacts — verify
before you cite:

- [Processed site data (site-data.json)](https://github.com/aziron-ai/atlas/blob/main/data/site-data.json)
- [Raw benchmark artifacts (data/raw)](https://github.com/aziron-ai/atlas/tree/main/data/raw)
- [Evidence manifests](https://github.com/aziron-ai/atlas/tree/main/data)
- [Agent benchmark kit (agent-bench/)](https://github.com/aziron-ai/atlas/tree/main/agent-bench)
- [Relevance benchmark kit (relevance-bench/)](https://github.com/aziron-ai/atlas/tree/main/relevance-bench)

The agent suite ships with the pinned commit, frozen gopls question set, and
isolation flags baked in:

```sh
python3 agent-bench/agent_token_bench.py \
  --setup \
  --agents auto \
  --modes atlas,graphify,baseline \
  --qa-set agent-bench/QA_SET_logrus.json \
  --workdir agentbench-work
```

Any other language: pass its question set, for example
`--qa-set agent-bench/QA_SET_rust.json --workdir agentbench-rust`. The
harness clones the commit pinned inside the set.

The relevance benchmark drives the `atlas` binary you have installed and
fetches the three pinned corpora:

```sh
python3 relevance-bench/relevance_bench.py --atlas "$(command -v atlas)" \
  --work relevance-work \
  --results-json my-relevance.json --results-md my-relevance.md
```

Read
[agent-bench/README.md](https://github.com/aziron-ai/atlas/blob/main/agent-bench/README.md)
for prerequisites, expected external cost, pinned inputs, and interpretation.
Per-run records are in
[AGENT_TOKEN_BENCH_PUBLIC_20261028.json](https://atlas.aziro.com/data/raw/AGENT_TOKEN_BENCH_PUBLIC_20261028.json)
and the per-language `AGENT_TOKEN_BENCH_<LANG>_20261028.json` files beside it;
[relevance-bench/README.md](https://github.com/aziron-ai/atlas/blob/main/relevance-bench/README.md)
covers the relevance harness.

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
