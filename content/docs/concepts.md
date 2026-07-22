# Core Concepts

Every Atlas command shares the same underlying model: a local knowledge graph
of your code, a snapshot timeline over its history, one workspace-resolution
scheme, and one set of output controls. Understanding these once makes the
whole [CLI Reference](cli) predictable.

## The Knowledge Graph

Atlas answers structural questions from a **knowledge graph** rather than
text search, so results are exact relationships, not pattern matches. The
graph is built by `atlas index`, which parses a repository into:

- **Symbols** — functions, methods, classes, and other definitions.
- **Call edges** — who calls whom, powering `callers`, `path`, `impact`, and
  the graph-shape commands (`hubs`, `communities`).
- **Routes** — the HTTP routes a repository serves and calls, powering
  cross-repo queries such as `consumers` and `dependencies`.
- **Coverage** — test-to-symbol links, from static call-graph reachability or
  an imported runtime profile (`atlas coverage import`).

Alongside the graph, indexing persists a lexical (BM25 + trigram) search
index. Everything lives in an embedded SQLite database, by default
`sqlite://./.atlas/atlas.db` inside the repository — no daemon or service is
required to query it.

```sh
atlas index .
```

## Snapshots and History

Each indexed commit becomes a **snapshot**, giving the graph a per-commit
timeline — you can ask not only what the code looks like, but how its
structure changed. `atlas history` lists the timeline; `atlas snapshot-diff`
computes a structural diff (symbols and edges added, removed, modified)
between two snapshots, defaulting to the latest snapshot and the one before
it. Both `--from` and `--to` accept a commit sha (prefix ok) or snapshot id.

```sh
atlas snapshot-diff --from a1b2c3d --to HEAD
```

## Workspace Resolution

Every command needs to know which repository and which database it is
operating on; three global flags resolve that, and the defaults make the
common case zero-config.

| Flag | Meaning | Default |
| --- | --- | --- |
| `--repo` | Repo workspace: a path, `org/name`, or `repo_id`; `'*'` = all repos on `search`/`semantic-search` | the current directory |
| `--db` | Storage DSN: `sqlite://PATH` or `postgres://...` | `sqlite://./.atlas/atlas.db` |
| `--tenant` | Tenant/org scope to isolate repos to (hosted multi-tenant) | empty = all repos |

Run from inside an indexed repository and no flags are needed. Point `--db`
at a shared database to query many repositories from one place:

```sh
atlas search "rate limiter" --repo '*' --db sqlite:///srv/atlas/atlas.db
```

## Output Control

Output has two independent axes — shape and depth — so you can tune results
for a terminal, a script, or an LLM context window.

| Flag | Values | Default |
| --- | --- | --- |
| `--format` | `plain` \| `json` \| `compact` \| `ndjson` — output shape | `json` |
| `--json` | shorthand for `--format json` | — |
| `--detail` | `low` \| `medium` \| `high` \| `xhigh` — graph context per item | `high` |

Retrieval operations (`callers`, `refs`, `impact`) floor at `high` detail so
they never silently drop the context they exist to provide; `xhigh` opts into
cross-repo context. For agents, prefer `--format plain`: it carries the same
answer in far fewer tokens than structured JSON, which matters when every
query result lands in a model's context window.

```sh
atlas search "session store" --format plain --detail low
```

## Three Surfaces

The same graph is exposed three ways, so humans, services, and AI agents each
get a native interface without separate infrastructure.

- **CLI** — the commands in this documentation; scriptable via `--format`.
- **REST HTTP API** — `atlas serve` runs the HTTP API on `127.0.0.1:3099` by
  default (use `--addr 0.0.0.0:3099` to expose it) and hosts the dashboard at that
  URL (pass `--open` to auto-open it in your browser); `--mcp` also mounts MCP over HTTP at `POST /mcp`.
- **MCP** — `atlas mcp` exposes graph, search, and impact as MCP tools to LLM
  agents over stdio by default, with `--http`/`--sse` transports available.
  Both `serve` and `mcp` keep the graph fresh with a background repo watch
  (`--watch`, on by default; disable with `--watch=false` or
  `ATLAS_NO_WATCH=1`). [Getting Started](getting-started) covers wiring
  assistants via `atlas bootstrap`; [MCP Tools](mcp) covers the tool surface.

```sh
atlas serve --mcp
```

## Read-Only Mode

Use `--read-only` when the database must not change — CI caches,
content-addressed artifacts, shared read replicas. It opens the database
immutably: no migration runs, no WAL/journal files are created, and no
`telemetry.db` appears next to it — artifact bytes hash identically after any
query. A missing database errors instead of being created. If you still want
telemetry in this mode, point `--telemetry-db` at an explicit writable path.

```sh
atlas symbol NewServer --read-only
```

## Local-First vs Hosted

Atlas is local by default: indexing, querying, serving, and MCP all run
against your local database, and nothing leaves the machine. Two commands opt
into a central Atlas server, and only for fleet telemetry and org skills:

- `atlas connect` registers the machine with a central server under a stable
  device identity and installs capture hooks. What leaves the machine is
  governed by the data level (`--level`): `off`, `telemetry` (metrics only),
  `interactions` (normalized prompts + redacted traces; the default), or
  `full` (raw prompts; org opt-in). Raw transcripts, tool outputs, answers,
  and secrets never leave the machine at any level. `atlas disconnect`
  reverses it.
- `atlas sync` is the fleet telemetry uplink — `sync status` shows the
  configuration, kill switches, and per-stream cursors; `sync now` pushes
  pending telemetry once.

Connected machines can also exchange org-trusted skills and automations
(`atlas skill push/pull`, `atlas recall push/pull`). Everything else —
`index`, `search`, `callers`, `impact`, `serve`, `mcp` — works with no server
and no account. On a hosted multi-tenant server, `--tenant` scopes queries to
one org. See [Configuration](configuration) for the related knobs.

```sh
atlas sync status
```
