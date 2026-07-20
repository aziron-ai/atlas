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
| `--read-only` | Open the database immutably: no migration, no WAL/journal files, no `telemetry.db` created beside it — artifact bytes hash identically after any query. A missing database errors instead of being created. |
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

## Index and Health

Build the graph, keep it fresh, and verify that storage and schema are sound.

| Command | Purpose |
| --- | --- |
| `index` | Index a repo: parse symbols, edges, and routes; persist the graph and lexical index. Incremental by default; `--reindex` forces a full rebuild. |
| `watch` | Index once, then watch the working tree and apply debounced incremental updates on every file change. Foreground until interrupted. |
| `status` | Storage and version health: schema/index-format contracts and per-repo snapshot format state (`--schema` for contract versions and drift). |
| `stats` | Graph and index telemetry statistics for an indexed repo. |
| `doctor` | Report upgrade health and schema/index contract state; `--verify` also checks whether the `atlas` on PATH matches the running binary. |
| `report` | Compose graph stats, top hubs, and top communities; `--format plain` prints the Markdown report directly. |
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

## Search and Retrieval

Find code and pull bounded, deterministic context about it.

| Command | Purpose |
| --- | --- |
| `search` | Code-aware lexical search (BM25 + trigram) over the symbol index; `--mode lexical\|semantic\|hybrid`, plus `--kind` and `--path` filters. |
| `semantic-search` | Embedding-based nearest-symbol search; transparently degrades to lexical (`degraded=true`) when vectors are unavailable. |
| `context` | Bounded review-context bundle for changed/seed paths; budgets via `--intent` (`auto` is 16-32 KiB), per-request flags, or env vars. |
| `explain` | Deterministic context bundle for a symbol: defs, callers/callees, imports, served routes, cross-repo consumers. |
| `symbol` | Show a symbol's definition(s) with its callers and callees. |
| `callers` | List symbols that directly call a symbol; scope overloaded names with `--package`, `--receiver`, or `--arity`. |
| `refs` | List references to a symbol: call sites plus type-use references (params, fields, returns). |
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
| `hubs` | Rank the graph's hubs ("god nodes") by call-graph degree centrality. |
| `communities` | Detect deterministic clusters of densely connected symbols. |
| `history` | Per-commit snapshot timeline for a repo. |
| `snapshot-diff` | Structural diff between two snapshots: symbols/edges added, removed, modified (alias: `diff`). |
| `export` | Export the call graph as `json`, `mermaid`, `dot`, or a self-contained interactive `html` page; `--bundle DIR` writes graph.html plus report.md. |

```sh
atlas impact --paths internal/api/handler.go --max-depth 3
atlas cross-repo-impact --paths internal/api/handler.go
atlas consumers --max-staleness-days 30
atlas export --symbol NewServer --depth 2 --format html -o graph.html
```

Cross-repository results depend on linked repositories and indexed service
contracts — see `atlas link` above.

## Assistants and Surfaces

Wire Atlas into AI assistants and serve it over MCP or HTTP. See
[MCP Tools](mcp) and [Dashboard and HTTP API](service).

| Command | Purpose |
| --- | --- |
| `bootstrap` | Register Atlas as an MCP server and install the atlas-first skill and CLAUDE.md directive for all detected assistants (Claude desktop+CLI, Codex, Copilot, Cursor, Gemini). Idempotent. |
| `install` | Install integration glue piecemeal: `install skill` (assistant registration), `install hook` (git hook that keeps the graph fresh), `install aziron`. |
| `uninstall` | Reverse `bootstrap` across every assistant it provisions; touches only atlas-managed entries. Idempotent. |
| `mcp` | Expose graph/search/impact as MCP tools over stdio (default), Streamable HTTP (`--http`), or legacy SSE (`--sse`); `--supervise` runs the warm gateway. |
| `serve` | Run the REST HTTP API and dashboard on `127.0.0.1:3099`; `--mcp` also mounts MCP over HTTP at `POST /mcp`. |
| `skill` | Author, test, render, and distribute runbook skills (`new`, `lint`, `test`, `register`, `render`, `push`, `pull`, and more). |

```sh
atlas bootstrap --dry-run
atlas install skill --agent codex,claude,claude-desktop
atlas mcp --supervise
atlas serve --mcp --open=false
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
