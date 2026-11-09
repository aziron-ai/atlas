# Natural-language retrieval relevance benchmark

A frozen, labelled, reproducible benchmark for Atlas's natural-language retrieval,
with a regression gate. Built for
[aziron-ai/atlas#44](https://github.com/aziron-ai/atlas/issues/44), whose Expected
result reads:

> Atlas should publish and gate retrieval quality using labelled queries and
> measurable precision@k/MRR/recall, including entity-first routing and
> generic-term adversaries.

The latest measured numbers and the findings are in [RESULTS.md](RESULTS.md). The
frozen thresholds are in [GATE.json](GATE.json). The benchmark site renders the same
run under **Retrieval relevance** on [atlas.aziro.com/#benchmarks](https://atlas.aziro.com/#relevance).

This directory is the public copy of the harness that lives in the Atlas source tree
as `bench/relevance/`. It is plain Python 3 (standard library only) and drives an
`atlas` binary you already have. `CORPORA.json`, `GATE.json`, `queries/*.json`,
`RESULTS.json` and `RESULTS.md` are copied **byte for byte** from the measured run, so
their provenance strings still name `bench/…` paths; the query files' SHA-256 values
match `query_files_sha256` in `RESULTS.json`. Only the Python scripts were edited, and
only for paths: the LSP-truth QA sets they read are published here as
[`agent-bench/QA_SET_<lang>.json`](../agent-bench/).

## Layout

| File | What it is |
|---|---|
| `CORPORA.json` | The frozen corpora: upstream commits, mount prefixes and the git **tree SHA** each checkout must have |
| `queries/<corpus>.json` | The labelled query sets. Labels are frozen in these files and never recomputed by a run |
| `derive_labels.py` | One-time tool that derives the `definition` and `callers` labels from the LSP-truth QA sets (see below) |
| `relevance_bench.py` | The runner: materializes corpora, indexes fresh stores, queries three surfaces, scores, writes results, holds the gate |
| `relevance_metrics.py` | Pure scoring: matching, P@k, MRR, recall@10, entity-first, adversarial outcomes, aggregation, gate evaluation |
| `relevance_report.py` | Renders `RESULTS.md` and keeps its hand-written Findings section across re-runs |
| `relevance_metrics_test.py` | Hermetic unit tests (synthetic results, label-file shape). Run by the `python-harness` suite |
| `GATE.json` | Frozen thresholds: measured develop baseline minus a stated margin |
| `RESULTS.json` / `RESULTS.md` | The committed baseline run: per-query rows, aggregates, store identity, findings |

## Corpora

| Corpus | Languages | Source (pinned) | Why |
|---|---|---|---|
| `c-cjson` | C | DaveGamble/cJSON `6d9f244` | header/implementation pairs and a vendored test framework (`tests/unity/**`) |
| `mixed-cpp-python` | C++ + Python | google/leveldb `bb74ef7` under `leveldb/` and psf/requests `3c7baaa` under `requests/`, grafted into one synthetic commit | the ticket's mixed C++/Python corpus: generic names (`Open`, `Close`, `close`, `send`, `ToString`) and two vocabularies in one repository |
| `ts-vue` | TypeScript | vuejs/core `ca03482` | the ticket's React-like corpus: a component/reactivity framework monorepo with `__tests__`, d.ts tests, benchmarks and workflow YAML |

Each corpus is checked out from its pinned commit(s) and verified against the
`tree` SHA in `CORPORA.json`; a different tree fails the run. The mixed corpus's
synthetic commit has a fixed author, committer and date, so its SHA
(`fa87647…`) reproduces too.

**Chromium is out of scope** for this gate. A Chromium index takes hours and tens
of GB, which belongs to a manual large-repository release check, not a regression
gate. The harness takes any corpus defined in `CORPORA.json`, so a pinned Chromium
entry with its own labels can run as release validation (`--corpus chromium`).

## What is labelled

216 queries: 59 + 98 + 59 across the three corpora.

| Class | Question template | Labels | Source |
|---|---|---|---|
| `definition` | `where is <E> defined?` | relevant: `E` at any LSP definition path. acceptable: any symbol named exactly `E` | **mechanical**: `definitions` of the QA set |
| `callers` | `what calls <E>?` | relevant: one item per LSP caller name (matched by name). acceptable: any symbol named exactly `E` | **mechanical**: `truth` of the QA set |
| `error_handling` | `<E> error exception handling` | relevant: the symbols that implement `E`'s error path. acceptable: neighbours and same-named symbols | **hand-labelled** by reading the code at the pinned commit; every item cites `path:line` |
| `adversarial` | generic or stopword phrasing, no entity | none. For "error handling" phrasings, the corpus's dedicated error machinery is listed as acceptable | **hand-written** |

| Corpus | definition | callers | error_handling | adversarial | total |
|---|---:|---:|---:|---:|---:|
| c-cjson | 19 | 19 | 9 | 12 | 59 |
| mixed-cpp-python | 38 | 38 | 10 | 12 | 98 |
| ts-vue | 19 | 19 | 9 | 12 | 59 |

Every query records its provenance: the QA set and entry it came from (with the
language server named in that set's metadata), or `"source": "hand"` with the
reading method.

### How the mechanical labels are derived

`definition` and `callers` come from the LSP-truth QA sets that also back the
multi-language agent benchmark ([`agent-bench/QA_SET_c.json`](../agent-bench/QA_SET_c.json),
`QA_SET_cpp.json`, `QA_SET_python.json`, `QA_SET_typescript.json`, generated with
clangd / pyright / typescript-language-server). The QA commit must equal the
corpus commit, and `derive_labels.py` refuses to run otherwise.

- **definition:** one relevant item, named `E`, at any path in the QA entry's
  `definitions`. Header prototypes are included, so finding either the declaration
  or the body counts.
- **callers:** one relevant item per name in `truth`, matched by name. That is the
  granularity the QA sets record, and Atlas's callers-F1 scorer scores the same way.
  The `paths` on each caller item are there for people reading the labels, never
  for matching. They come from `atlas symbol <E>` callers, else `atlas symbol
  <caller>` definitions; `paths_source` says which.

Re-derive and diff against the frozen files (writes nothing; exits 1 on drift):

```sh
python3 relevance-bench/derive_labels.py --atlas "$(command -v atlas)" --work relevance-work --check \
  [--source google/leveldb=/path/to/leveldb-clone ...]
```

Without `--check` it rewrites the `lsp` queries and keeps every hand-labelled
query exactly as it is.

## Surfaces measured

Every query is run against a fresh store of its corpus (deleted first, re-indexed
with `atlas index --unlisted`). `ATLAS_*` variables are stripped from the
environment, `ATLAS_HOME` is isolated, and auto-update, bootstrap and watch are
turned off.

| Surface | Invocation | Ranked list scored |
|---|---|---|
| `search` | `atlas search QUERY --limit 10 --json` | `results` in order |
| `context` | `atlas context --query QUERY --json` (intent `auto`, as in the ticket) | `symbols` in emitted order, then unseen `search_hits` |
| `code_query` | MCP stdio `tools/call code_query {question, workspace, require_citations: true, detail: high}` | `citations` in order. `status: insufficient` is a refusal |
| `search_exact` (control) | `atlas search <E> --limit 10 --json`, definition queries only | `results`. This is the ticket's "exact search" comparison |

## Metrics

All metrics are computed on the top 10, after deduplicating on `(name, path, line)`.
A result matches a label item when its name equals one of the item's names (or is
a qualified name ending in it: `Session.send`, `DBImpl::Get`; case-sensitive), and,
for `match: name+path` items, when its path is one of the item's paths. A result
is credited to the first relevant item it matches, otherwise to the first
acceptable item.

| Metric | Definition |
|---|---|
| **P@k** (k = 1, 3, 5, 10) | relevant-or-acceptable results in the top k ÷ **min(k, results returned)**. An empty answer to a labelled query scores 0. It measures how much of what the surface actually returned was on target. For single-target `definition` queries it is bounded by targets ÷ k, so read MRR and entity-first first. |
| **MRR** | 1 ÷ rank of the first **relevant** result (0 if none in the top 10). Acceptable results never count. |
| **R@10** | distinct relevant items matched in the top 10 ÷ min(10, relevant items). The cap means a symbol with 105 callers is held to 10. |
| **entity-first** | the rank-1 result names the query's entity. This is the routing signal the ticket asks for. |
| **query-word top-1** | the rank-1 result is a miss (not a labelled hit, not the entity) and shares a word only with the question's phrasing (`where`, `is`, `calls`, `exception`, …). This is the stopword/template-word pollution control. |
| **test@10 / non-code@10** | share of the top 10 under test/fixture/benchmark/example paths, or that are config keys, documents or markdown (path rules in `relevance_metrics.py`). Report-only, because a test can be a real caller. |
| **adversarial** | each answer is **refused** (code_query `insufficient`, or no results), **grounded** (answered, the query lists acceptable error machinery, and at least 3 of the top 5 are in it) or **noise**. **safe** = refused or grounded. |
| report-only | p50/p95 latency, mean serialized bytes (~bytes ÷ 4 tokens), truncation rate, empty-answer rate |

## How to run

You need `python3` (3.10 or later, standard library only), `git`, and an `atlas`
binary on `PATH` (or pass its path). The published baseline was measured on
`atlas v0.1.52-700-g1a75deae` (develop `3790ba95` plus this benchmark); run it
with the release you have installed to see how that build compares.

```sh
python3 relevance-bench/relevance_bench.py --atlas "$(command -v atlas)" \
    --work relevance-work \
    --results-json my-relevance.json --results-md my-relevance.md
```

Without `--source`, each corpus component is fetched from its upstream URL at the
pinned commit (`git fetch --depth 1`), which needs network. To run offline, point a
component at a local clone that contains the pinned commit:

```sh
python3 relevance-bench/relevance_bench.py --atlas "$(command -v atlas)" --work relevance-work \
    --source DaveGamble/cJSON=/src/cJSON --source google/leveldb=/src/leveldb \
    --source psf/requests=/src/requests --source vuejs/core=/src/vue
```

Other flags: `--corpus NAME` and `--surface NAME` narrow the run (repeatable),
`--no-gate` reports without holding the thresholds, `--details-out FILE` writes
every per-query record, and `--keep-stores` keeps the indexes. Corpus checkouts are
cached in `--work` (default `~/.cache/atlas-relevance`).

Without the `--results-*` flags the run rewrites `relevance-bench/RESULTS.{json,md}`
in place (the hand-written Findings block in RESULTS.md is kept). A full run takes
about 80 s on an M-series laptop. The stores are about 80 MB and are deleted
afterwards.

The unit tests are hermetic (no binary, no corpus) and check the scorer and the
shape of every label file:

```sh
python3 relevance-bench/relevance_metrics_test.py
```

Exit status: `0` = every gated metric held, `1` = a threshold failed or a surface
returned no JSON, `2` = the benchmark could not run (missing binary, corpus fetch
or tree mismatch, no `GATE.json`).

## What the gate means

`GATE.json` holds 159 thresholds:

- every primary metric for each (surface × class), pooled over all corpora: P@1/3/5/10, MRR, R@10 and entity-first for the named classes, and refusal and safe rates for the adversarial set;
- per corpus: MRR, R@10 and entity-first for each named class, and the adversarial safe rate.

Each `min` is the measured develop baseline minus a margin, floored at 0. The
margins are 0.03 (pooled precision/MRR/recall/entity-first), 0.05 (pooled
refusal/safe), 0.06 (per corpus) and 0.09 (per-corpus safe). Each margin is
widened to at least one query's worth (1/n) for small sets.

Why one query of slack: before #135, equal-score ties were broken by store
insertion order, so two fresh indexes of the same tree could swap tied results.
The largest gated drift across back-to-back runs was then 0.026 (RESULTS.md,
finding F8). Since #135, two back-to-back runs give a gated drift of 0. Only
last-ULP score differences still reorder some `atlas search` lists below rank 1,
and they change no metric. The slack stays as headroom for float and platform
differences. A run-to-run drift above it now means tie order regressed.

The gate fails when a metric drops below its min, when a gated metric is missing
from the run (fail closed), or when any surface returns no JSON. A run limited
with `--corpus` or `--surface` is held only to the per-corpus thresholds it
produced.

The gate catches regressions. It does not certify that retrieval is good: the
baseline encodes today's defects (RESULTS.md Findings). When a fix lands and the
numbers move up, re-freeze from a reviewed run so the gate ratchets:

```sh
python3 relevance-bench/relevance_bench.py --atlas "$(command -v atlas)" --write-gate   # then review RESULTS.md + GATE.json diff
```

## How to extend

- **More queries for an existing corpus.** Add entries to `queries/<corpus>.json`
  with `"provenance": {"source": "hand", ...}`. Give every relevant item `names`,
  `paths`, `locations` (`path:line`) and `match`. Run
  `relevance_metrics_test.py`: it checks the shape, unique ids and that every
  hand-labelled relevant item cites `file:line`. Then re-run and re-freeze.
- **A new corpus.** Add it to `CORPORA.json` with pinned commits and `"tree":
  null`. Run once with `--no-gate` to learn the tree SHA, freeze it, then add an
  LSP-truth QA set in the shape of `agent-bench/QA_SET_<lang>.json` (the generator
  lives in the Atlas source tree), then `derive_labels.py --corpus NAME`.
  Hand-label its error-handling and adversarial queries.
- **A new surface.** Add a parser to `relevance_metrics.py` (unit-test it) and a
  branch to `run_surface`.
