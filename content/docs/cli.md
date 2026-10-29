# CLI Reference

Every Atlas capability is a subcommand of the single `atlas` binary. This page
is the complete map: global flags first, then each command grouped by task,
with worked examples. For narrative guides, start with
[Getting Started](getting-started) and [Indexing and Reindexing](indexing).

## Global Flags

These flags apply to every command and control which database answers, which
repo is in scope, and how output is shaped.

| Flag | Purpose |
| --- | --- |
| `--db` | Storage DSN: `sqlite://PATH` or `postgres://...` (default `sqlite://./.atlas/atlas.db`). |
| `--detail` | Output depth: `low`, `medium`, `high`, or `xhigh` — how much graph context to return per item. Default `high` for every format; `xhigh` opts into cross-repo context. Retrieval ops (callers/refs/impact) floor at `high`. |
| `--format` | Output shape: `plain`, `json`, `compact`, or `ndjson` (`json` by default). |
| `--json` | Shorthand for `--format json`. |
| `--read-only` | Open the database read-only: no migration, no writes or checkpoints, no `telemetry.db` created beside it, and no `-wal`/`-shm` beside a quiescent store — artifact bytes hash identically after any query. Since 0.1.55 it follows a live writer: once a running Atlas has a WAL beside the store it reads it, and it refuses a store moved to another schema generation (`store_superseded`) ([#130](https://github.com/aziron-ai/atlas/issues/130)). A missing database errors instead of being created. |
| `--repo` | Repo workspace: path, `org/name`, or repo_id. Defaults to the current directory; `'*'` means all repos on `search`/`semantic-search`. |
| `--telemetry-db` | Explicit path for the observability database — required if you want telemetry with `--read-only`. Default: `telemetry.db` beside the graph database. |
| `--tenant` | Tenant/org scope to isolate repos to (hosted multi-tenant; empty = all repos). |

Combine them freely with any command:

```sh
atlas --repo /absolute/path status
atlas --db "sqlite:///absolute/path/.atlas/atlas.db" --format plain stats
atlas --detail xhigh explain NewServer
atlas --repo '*' search "rate limiter"
```

### How a Workspace Finds Its Index

A workspace-scoped command answers in two steps: which store, then which
repository in it. The store is the `--db` you typed, else a running server
(`ATLAS_SERVER_URL`, or a local `atlas serve` on `127.0.0.1:3099`), else
`./.atlas/atlas.db`. Inside the store an explicit `--repo` wins, then the
registered root that contains the path.

**Since 0.1.55**, a git checkout that no registered root contains — a linked
worktree, another clone, a worktree of a bare clone — is served by an existing
index when it shares that repository's git common directory or normalized
`origin` URL, and its HEAD and working-tree state equal the repository's
latest snapshot ([#42](https://github.com/aziron-ai/atlas/issues/42)).
`atlas status --repo <path>` then reports `repo_scope.workspace_reuse` and the
line `workspace <path> served by the index of <root>`.

A checkout with the same identity but different content is refused with
`verdict: content_differs` rather than served stale line numbers, a copy that
is not a git checkout is never matched (`not_a_git_checkout`), and several
equal checkouts are `ambiguous_repo` with `candidates[]`. Every refusal names
the `searched_stores` and the `checkout` diagnosis. To read an index
explicitly, pin it with `atlas --db <dsn> --repo <repo_id>`; its line numbers
then describe the checkout that index was built from.

## Index and Health

Build the graph, keep it fresh, and verify that storage and schema are sound.

| Command | Purpose |
| --- | --- |
| `index` | Index a repo: parse symbols, edges, and routes; persist the graph and lexical index. Incremental by default; `--reindex` forces a full rebuild; `--workers N` (or `ATLAS_INDEX_WORKERS`; 0 = all cores) caps the parse/hash pool and overrides whatever the machine profile would set. Since 0.1.48, `--format json` also reports `persist_mode`, `persist_path`, `files_reparsed`, `lexical_bytes`, and `lexical_settle`. |
| `watch` | Index once, then watch the working tree and apply debounced incremental updates on every file change. Foreground until interrupted. |
| `status` | Storage and version health: schema/index-format contracts and per-repo snapshot format state (`--schema` for contract versions and drift). Since 0.1.55 `--repo` scopes the whole report to one repo, and the report carries a `telemetry` block. |
| `stats` | Graph and index telemetry statistics for an indexed repo. Since 0.1.55 it names its count projections, checks seven `invariants` between them, and carries graph-health fields and a `telemetry` block. |
| `doctor` | Report upgrade health and schema/index contract state; `--verify` also checks whether the `atlas` on PATH matches the running binary; `--deep` runs a page-level integrity scan (`PRAGMA quick_check`) to catch on-disk corruption reads silently tolerate. Since 0.1.48 it also reports a `machine_profile` block — the detected tier, the probe facts behind it, `cpu_width_scope`, and every bound actually installed. |
| `report` | Compose graph stats, top hubs, and top communities; `--format plain` prints the Markdown report directly. Since 0.1.55 it lists clusters only and prints graph-health warnings and coverage tables. |
| `migrate` | Apply storage migrations and report the active contracts. |
| `compact` | Reclaim space and truncate the WAL; `--full` also runs a full VACUUM and rebuilds an oversized lexical sidecar; `--rebuild-lexical` fixes an empty or wedged sidecar. |
| `link` | Register a repo into the graph without indexing it, so it joins cross-repo queries and appears in `status`. Idempotent. |
| `repo` | Repo registry maintenance — `repo rm` forgets a repo: snapshots, symbols, edges, embeddings, and lexical docs. |

```sh
atlas index . --enable-vectors
atlas watch .
atlas doctor --verbose
atlas report --format plain
```

### Status, Stats and Telemetry

**Since 0.1.55:**

- `atlas status --repo <path|org/name|repo_id>` scopes the whole report —
  served snapshot, counts, format drift and watch lock — to that repo and adds
  `repo_scope`. An unknown repo is refused exactly as `stats` refuses it, with
  exit code 1. Without `--repo`, or with `--repo '*'`, the global view is
  unchanged ([#155](https://github.com/aziron-ai/atlas/issues/155)).
- `atlas stats` names its four count projections (`latest`, `store_rows`,
  `graph.raw_*`, `graph`) and checks seven `invariants` between them: `ok`,
  `partial` when the graph was not computed at this scale, or `violated` with
  the failing checks named. `graph.edge_binding` accounts for every edge row
  on its way into `graph.edges`, including rows bound to several targets
  (`multi_bound_rows`) ([#14](https://github.com/aziron-ai/atlas/issues/14)).
- `stats`, `status` and `doctor` carry a `telemetry` block — `available`,
  `unavailable_read_only`, `unavailable`, `stale` or `missing`, with `reason`
  and `remedy` — and plain output prints a `telemetry` line whenever it is not
  `available` ([#154](https://github.com/aziron-ai/atlas/issues/154)).

```text
  edge_binding  raw 3 = graph-kind 2 + other 1;  graph-kind = bound 1 + unresolved 1;  multi-bound 0;  pairs 1 -> edges 1 (collapsed 0)
  invariants ok  (7 checked)
  telemetry unavailable_read_only  sink not_attached  index_run present
```

## Search and Retrieval

Find code and pull bounded, deterministic context about it.

| Command | Purpose |
| --- | --- |
| `search` | Code-aware lexical search (BM25 + trigram) over the symbol index; `--mode lexical\|semantic\|hybrid`, plus `--kind` and `--path` filters. Since 0.1.55 equal scores are ordered by path, name, kind, signature and line, so every fresh index returns the same page ([#135](https://github.com/aziron-ai/atlas/issues/135)). |
| `semantic-search` | Embedding-based nearest-symbol search; transparently degrades to lexical (`degraded=true`) when vectors are unavailable. |
| `context` | Bounded review-context bundle for changed/seed paths; budgets via `--intent` (`auto` is 16-32 KiB), per-request flags, or env vars. |
| `explain` | Deterministic context bundle for a symbol: defs, callers/callees, imports, served routes, cross-repo consumers. |
| `symbol` | Show a symbol's definition(s) with its callers and callees. |
| `snippet` | Show a symbol's bounded implementation body (path:line, signature, source excerpt). |
| `callers` | List symbols that directly call a symbol; scope overloaded names with `--package`, `--receiver`, or `--arity`. Since 0.1.55 the answer leads with `caller_names`, and `--brief` keeps the whole caller list with less detail per caller. |
| `refs` | List references to a symbol: call sites plus type-use references (params, fields, returns). Since 0.1.55 `--mutations` (alias `--writes`) lists only the references that write the symbol ([#55](https://github.com/aziron-ai/atlas/issues/55)). |
| `neighbors` | Depth-1 call neighborhood: a symbol's direct callers and callees. |
| `path` | Shortest forward call path from one symbol to another (`--max-depth`, default 6). |

```sh
atlas search "authentication middleware" --mode lexical --format plain
atlas context --paths internal/api/handler.go --intent review \
  --query "review correctness and regression risk"
atlas callers NewServer --limit 50 --receiver '*Server'
atlas path Handler ServeHTTP --max-depth 6
```

Use `search` for discovery; use `context` when reviewing changed paths and you
need bounded related code; use `explain`/`symbol` when you already know the
symbol.

## Graph Analysis

Measure blast radius, contracts, structure, and change over time.

| Command | Purpose |
| --- | --- |
| `impact` | Single-repo blast radius for a change: impacted symbols, files, and tests (`--tests` on by default). |
| `cross-repo-impact` | Cross-repo blast radius: which other repos call routes the changed handlers serve. |
| `consumers` | Other repos that call any route this repo serves. |
| `dependencies` | Producer repos/handlers that serve HTTP calls this repo makes. |
| `route-contracts` | The producer HTTP routes a repo serves — its public contract. |
| `coverage` | Real covered/total line ratio when a runtime profile was imported (`coverage import`); otherwise static call-graph reachability. |
| `hubs` | Rank the graph's hubs ("god nodes") by call-graph degree centrality. Since 0.1.55 degree-zero symbols are never hubs (see Graph Health below). |
| `communities` | Detect deterministic clusters of densely connected symbols; since 0.1.55 identical across fresh indexes of one commit, with isolated symbols flagged. |
| `history` | Per-commit snapshot timeline for a repo; since 0.1.55 a snapshot built from uncommitted work is its own row, labelled `<sha>+dirty`. |
| `snapshot-diff` | Structural diff between two snapshots: symbols/edges added, removed, modified (alias: `diff`). `--from`/`--to` take a commit sha, a snapshot id, or since 0.1.55 `<sha>+dirty`. |
| `export` | Export the call graph as `json`, `mermaid`, `dot`, or a self-contained interactive `html` page; `--bundle DIR` writes graph.html plus report.md. |

```sh
atlas impact --paths internal/api/handler.go --max-depth 3
atlas cross-repo-impact --paths internal/api/handler.go
atlas consumers --max-staleness-days 30
atlas export --symbol NewServer --depth 2 --format html -o graph.html
```

Cross-repository results depend on linked repositories and indexed service
contracts — see `atlas link` above.

## Freshness on Every Answer

**Since 0.1.55**, every repo-scoped answer — `search`, `symbol`, `callers`,
`refs`, `impact`, `context`, `explain`, `snippet` — says how its snapshot
relates to the checkout, with the same fields on MCP and the HTTP API
([#59](https://github.com/aziron-ai/atlas/issues/59)):

| Field | Meaning |
| --- | --- |
| `indexed_sha` | the snapshot that answered; `<sha>+dirty` when it was built from uncommitted work |
| `head_sha` | the live HEAD, or `unknown` when git cannot answer |
| `dirty` | whether the working tree has indexable changes |
| `stale`, `stale_reason` | whether the answer lags the checkout, and why: `head_moved`, `working_tree_dirty`, `working_tree_changed` or `working_tree_reverted`. Omitted, never `false`, when git cannot answer |
| `refresh`, `refresh_skipped` | what Atlas did about it: `none`, `started` or `completed`; a one-shot command reports `refresh_skipped: "one_shot"` |

Plain output opens with a notice when an answer is stale:

```text
stale: indexed 4fb9d0f74f1c vs head 4fb9d0f74f1c+dirty  (working_tree_dirty)  not refreshed (one-shot command; run `atlas index`)
```

A one-shot command (anything but `serve`, `mcp` and `watch`) never starts
background index work, because the process would exit before it landed
([#141](https://github.com/aziron-ai/atlas/issues/141)). Refresh with
`atlas index`, or set `ATLAS_ONESHOT_REFRESH=sync` to re-index a git-stale
repo before answering, bounded by `ATLAS_ONESHOT_REFRESH_TIMEOUT` (default
10s); an overrun reports `refresh_skipped: "budget_exceeded"` and persists
nothing. The check costs one HEAD read and one `git status` of the indexable
files per repo, reused for `ATLAS_FRESHNESS_TTL` (default 2s);
`ATLAS_FRESHNESS_PROBE=0` turns it off.

## Graph Health

**Since 0.1.55**, `hubs`, `communities`, `report` and `stats` describe how
connected the graph is, so a sparse graph is not mistaken for an
architecture ([#45](https://github.com/aziron-ai/atlas/issues/45),
[#149](https://github.com/aziron-ai/atlas/issues/149)):

- `hubs` ranks only symbols with at least one resolved call or inheritance
  relation and reports `eligible`, `excluded_isolated`, `ranking` and
  `warnings`; on a sparse graph the list is shorter than `--limit`.
- `communities` is deterministic: one commit gives the same partition, ids
  and order on every fresh index and at any `--workers` count. `total` splits
  into `multi_member` and `singletons`, and isolated one-symbol communities
  are flagged.
- `report` lists clusters only, counts isolated symbols in its summary, and
  prints `WARNING:` lines and relation-coverage tables by language and by
  symbol kind.
- `stats` (under `graph`) and `report` carry `isolated_ratio`,
  `connected_components`, `largest_component`, `multi_member_communities`,
  `singleton_communities`, relation coverage and `warnings`.

| Warning | Fires when |
| --- | --- |
| `isolated_majority` | at least half the symbols have no resolved relation |
| `fragmented_communities` | the connected symbols split into communities of two or fewer on average (evaluated with a computed partition and at least 20 connected symbols) |

On a three-function repository where one function calls nothing and nothing
calls it:

```text
$ atlas hubs --format plain
hubs  total 2  eligible 2  excluded_isolated 1
  helper  function  in 1  out 0  total 1  main.go
  main  function  in 0  out 1  total 1  main.go

$ atlas communities --format plain
communities  total 2  shown 2  multi_member 1  singletons 1  isolated 1
  #0  size 2  helper, main
  #1  size 1  extra  (isolated)
```

## Assistants and Surfaces

Wire Atlas into AI assistants and serve it over MCP or HTTP. See
[MCP Tools](mcp) and [Dashboard and HTTP API](service).

| Command | Purpose |
| --- | --- |
| `bootstrap` | Register Atlas as an MCP server and install the atlas-first skill and CLAUDE.md directive for all detected assistants (Claude desktop+CLI, Codex, Copilot, Cursor, Gemini). Idempotent. |
| `install` | Install integration glue piecemeal: `install skill` (assistant registration), `install hook` (git hook that keeps the graph fresh), `install aziron`. |
| `uninstall` | Reverse `bootstrap` across every assistant it provisions; touches only atlas-managed entries. `--purge` also deletes the `.atlas` index databases (global `~/.atlas` + registry repo roots), showing the blast radius and requiring `--yes` (or `--dry-run`). Idempotent. |
| `mcp` | Expose graph/search/impact as MCP tools over stdio (default), Streamable HTTP (`--http`), or legacy SSE (`--sse`); `--supervise` runs the warm gateway. |
| `serve` | Run the REST HTTP API and dashboard on `127.0.0.1:3099`; `--mcp` also mounts MCP over HTTP at `POST /mcp`. |
| `skill` | Author, test, render, and distribute runbook skills (`new`, `lint`, `test`, `register`, `render`, `push`, `pull`, and more). |

```sh
atlas bootstrap --dry-run
atlas install skill --agent codex,claude,claude-desktop
atlas mcp --supervise
atlas serve --mcp
```

Both `mcp` and `serve` watch the repo by default to keep the graph fresh;
disable with `--watch=false` or `ATLAS_NO_WATCH=1`.

## Fleet and Org

Connect a machine to a central Atlas server and share telemetry or trusted
automations. See [Privacy and Data Handling](privacy) for what leaves the
machine at each data level.

| Command | Purpose |
| --- | --- |
| `connect` | Register this machine with the central Atlas server under a stable device identity and install capture hooks; `--level off\|telemetry\|interactions\|full` governs what is shared (default `interactions`). |
| `disconnect` | Disconnect from the central Atlas and remove capture hooks. |
| `sync` | Fleet telemetry uplink: `sync status` shows configuration, kill switches, and cursors; `sync now` pushes all pending telemetry once. |
| `recall` | Frequent-prompt mining, replayable automations, and org sync (`clusters`, `promote`, `push`, `pull`, `state`, and more). |

```sh
atlas connect https://atlas.example.com --level interactions
atlas sync status
atlas recall clusters
```

## Utilities

| Command | Purpose |
| --- | --- |
| `config` | Inspect and persist configuration: `list` every knob with effective value and provenance, `get` one, `set` one into the workspace settings.json. See [Configuration](configuration). |
| `version` | Print the installed Atlas version. |
| `completion` | Generate shell completion scripts. |

```sh
atlas config list
atlas config get ATLAS_MAX_DB_BYTES
```

## Maintenance Safety

Stop long-running Atlas processes (`serve`, `watch`, supervised MCP) before
exclusive maintenance such as `compact --full`. Back up the complete `.atlas/`
directory before destructive operations like `repo rm`:

```sh
atlas migrate
atlas compact --full
atlas repo rm owner/repository --yes
```

## Authoritative Contract

Flags and defaults can change between releases. `atlas --help` and
`atlas <command> --help` are the authoritative contract for the release
installed on your machine; prefer them over this page when they disagree.
