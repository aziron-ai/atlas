# Getting Started

This guide takes a repository from unindexed to queryable: build the local
index, verify it is healthy, run the core queries, and connect an AI
assistant. Atlas is local-first — everything below runs on your machine
against an embedded database, with no server or account required. For the
mental model behind these commands, see [Core Concepts](concepts).

## 1. Check Prerequisites

Confirm the binary is installed and on `PATH` before anything else, because
assistants and scripts resolve `atlas` from `PATH` too.

```sh
command -v atlas
atlas version
```

If either command fails, follow [Installation](installation) first. You also
need a local checkout of the repository you want to index; a git repository is
required for commit-pinned indexing (`--ref`) and the per-commit snapshot
history.

## 2. Index a Repository

Indexing builds everything Atlas knows about a repository: it parses symbols,
call edges, and routes, and persists the **knowledge graph** plus a lexical
search index.

```sh
cd /path/to/repository
atlas index .
```

Progress is printed to stderr while the run reports discovery and completion
stats. Results are stored in an embedded SQLite database in the repository:

```text
.atlas/atlas.db
```

By default the indexer skips paths git ignores (build output, caches,
vendored runtimes); pass `--gitignore=false` to index everything. The first
run parses the whole repository; later runs are incremental deltas. Use
`--reindex` to force a full rebuild, and `--ref` to index a specific commit or
branch instead of the working tree. See [Indexing and Reindexing](indexing)
for exclusions, watch mode, and the optional embedding pass
(`--enable-vectors`).

## 3. Confirm Readiness

Verify the index before relying on query results, so an empty or drifted
database does not silently return nothing.

```sh
atlas status
atlas stats
```

`atlas status` reports storage and version health: the schema and index-format
contracts and the per-repo snapshot format state. `atlas stats` reports graph
and index telemetry for the indexed repository. Look for your repository
identity, a current snapshot, and non-zero symbol and edge counts. Zero counts
or a missing repository mean the index did not build — see
[Troubleshooting](troubleshooting).

## 4. Run the First Queries

Each query answers a different question; pick the one that matches what you
already know.

Use `search` when you know words or phrases but not exact names — it is
code-aware lexical search (BM25 + trigram) over the symbol index:

```sh
atlas search "authentication middleware" --format plain
```

Use `symbol` when you know a name and want its definition(s) together with
its callers and callees:

```sh
atlas symbol NewServer
```

Use `callers` before changing a function's behavior or signature, to see
exactly which symbols call it directly:

```sh
atlas callers NewServer --limit 25
```

Use `refs` when a rename or type change is on the table — it lists call sites
plus type-use references (params, fields, returns):

```sh
atlas refs NewServer
```

Use `context` when reviewing a change — it builds a bounded review-context
bundle (16–32 KiB with the default `auto` intent) around the changed files,
including changed symbols with body excerpts, retrieval hits, impacted files,
and scoped edges:

```sh
atlas context \
  --paths path/to/changed-file.go \
  --query "review correctness and regression risk" \
  --format json
```

For the blast radius of a change — impacted symbols, files, and covering
tests — use `impact`:

```sh
atlas impact --paths path/to/changed-file.go
```

Run `atlas <command> --help` for the full flag list of your installed version,
or see the [CLI Reference](cli).

## 5. Connect an AI Assistant

Bootstrap registers Atlas as an MCP server and installs the atlas-first skill
and CLAUDE.md directive for every detected assistant (Claude desktop and CLI,
Codex, Copilot, Cursor, Gemini), so assistants query the graph instead of
grepping. Preview what would be written first:

```sh
atlas bootstrap --dry-run
```

Then apply it:

```sh
atlas bootstrap
```

Bootstrap is idempotent — safe to run repeatedly. Use `--only` or `--skip`
(comma-separated agent lists) to limit which assistants are provisioned.
Restart the assistant after configuration changes, and run
`atlas doctor --verify atlas` to confirm the `atlas` on `PATH` — what
assistants launch — matches the binary you installed. See [MCP Tools](mcp)
for the tool surface assistants receive.

## 6. Keep the Index Fresh

Query results are only as current as the last index run. After meaningful
changes, run an incremental update:

```sh
atlas index .
```

For a foreground process that re-indexes on every file change (edits within
250 ms are coalesced into one update):

```sh
atlas watch
```

Reserve `atlas index . --reindex` for format changes or recovery, per
[Indexing and Reindexing](indexing).

## Where to Go Next

- [Core Concepts](concepts) — the graph, snapshots, workspaces, and output
  control that every command shares.
- [CLI Reference](cli) — every command and flag.
- [MCP Tools](mcp) — what assistants can call after bootstrap.
- [Configuration](configuration) — knob precedence and `atlas config`.
- [Troubleshooting](troubleshooting) — empty results, drift, and recovery.
