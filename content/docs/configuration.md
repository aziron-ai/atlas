# Configuration

Atlas works with zero configuration on a fresh checkout; every knob has a
compiled default. This page explains where overrides live, which settings
matter most, and the global flags that select storage, scope, and output
shape. For the full command surface, see the [CLI Reference](cli).

## Precedence

Know where a value comes from before changing it. Effective configuration is
resolved in this order (highest wins):

1. Environment variable
2. Repository `.atlas/settings.json`
3. Compiled default

A deployment environment variable always wins over a persisted edit.
Environment variables suit automation and containers; repository settings
suit stable local policy.

## Inspecting and Persisting Settings

Use `atlas config` to see every knob's effective value and its provenance —
not just what is set, but which layer set it:

```sh
atlas config list                        # every knob, value, and provenance
atlas config get ATLAS_MAX_DB_BYTES      # one knob's value and origin
atlas config set ATLAS_MAX_DB_BYTES 10GiB  # persist into .atlas/settings.json
atlas config set ATLAS_MAX_DB_BYTES ""     # clear a persisted override
```

## Known Settings

| Setting | Purpose |
| --- | --- |
| `ATLAS_ENABLE_VECTORS` | Enable optional semantic retrieval (pairs with an index built with `--enable-vectors`) |
| `ATLAS_EMBED_URL` | Point semantic search at a real embedding model; the default embedder is offline (deterministic token overlap) |
| `ATLAS_NO_WATCH` | Disable background file watching in `mcp` and `serve` (equivalent to `--watch=false`) |
| `ATLAS_WATCH_MODE` | Select the watcher mode, including polling |
| `ATLAS_MEMORY_LIMIT` | Bound Atlas memory use |
| `ATLAS_GOGC` | Tune Go garbage collection |
| `ATLAS_MCP_CALL_TIMEOUT` | Bound an MCP tool call |
| `ATLAS_MCP_ALLOWED_ORIGINS` | Allow additional browser origins |
| `ATLAS_API_TOKEN` | Require `Authorization: Bearer` on the HTTP API and HTTP/SSE MCP transports |
| `ATLAS_SERVER_URL` | Route compatible CLI operations through a running server |
| `ATLAS_SKIP_BOOTSTRAP` | Skip automatic bootstrap provisioning (for example in package post-install automation) |
| `ATLAS_SYNC_SERVER` | Default central server URL for `atlas connect` |
| `ATLAS_SYNC_TOKEN` | Bearer token for `atlas connect` |
| `ATLAS_CONTEXT_LIMIT`, `ATLAS_CONTEXT_MAX_FILES`, `ATLAS_CONTEXT_MAX_EDGES`, `ATLAS_CONTEXT_MAX_DEPTH` | Default budgets for `atlas context`; per-request flags override, intent defaults apply otherwise |
| `ATLAS_LEXICAL_MAX_RATIO`, `ATLAS_MAX_LEXICAL_BYTES` | Size bound on the lexical (BM25) sidecar that triggers a rebuild during `compact --full` |
| `ATLAS_MAX_DB_BYTES` | Bound the graph database size |
| `ATLAS_INDEX_WORKERS` | Cap the parse/hash worker pool during indexing (0 = all cores); CLI equivalent `atlas index --workers N`. Lower it to bound CPU on a large index |
| `ATLAS_STREAM_INDEX`, `ATLAS_STREAM_INDEX_THRESHOLD`, `ATLAS_STREAM_INDEX_BATCH` | Force/tune the streaming index that bounds memory on large repos (auto-engages above ~15,000 candidate files) |

Run `atlas config list` for the complete catalog with current names, defaults,
descriptions, and accepted values for your installed release.

## Storage Selection

Every command reads and writes one database, selected by `--db`. The DSN
takes two forms:

```text
sqlite://PATH
postgres://...
```

The default is `sqlite://./.atlas/atlas.db` — repository-local, relative to
the working directory. Pin an explicit database when several exist:

```sh
atlas --db "sqlite:///absolute/path/.atlas/atlas.db" status
```

Use absolute database paths in assistant configurations: an assistant's
process directory is rarely your repository root, so a relative DSN resolves
to the wrong place.

## Scope Selection

When one database holds several repositories, select which repo answers with
`--repo`. It accepts a filesystem path, an `org/name`, or a repo_id, and
defaults to the current directory. On `search` and `semantic-search`,
`--repo '*'` queries all repos. In hosted multi-tenant deployments, `--tenant`
isolates repos to one tenant/org scope; empty means all repos.

## Output Defaults

Treat output shape and depth as configuration, not per-query ceremony, when
scripting against Atlas.

- `--format` selects the shape: `plain`, `json` (default), `compact`, or
  `ndjson`. `--json` is shorthand for `--format json`.
- `--detail` selects the depth: `low`, `medium`, `high` (default for every
  format), or `xhigh`, which opts into cross-repo context. Retrieval
  operations (callers/refs/impact) floor at `high`.

## Read-Only Mode and Telemetry

Use `--read-only` when the database must not change — for example when
hashing artifacts or querying a shared, immutable index. It opens the
database immutably: no migration runs, no WAL/journal files are created, and
no `telemetry.db` is created beside it, so the artifact bytes hash
identically after any query. A missing database errors instead of being
created.

Because read-only mode suppresses the default telemetry database, telemetry
with `--read-only` requires an explicit `--telemetry-db PATH`. Without
`--read-only`, telemetry defaults to `telemetry.db` beside the graph
database.

```sh
atlas --read-only --telemetry-db /srv/atlas/telemetry.db \
  --db "sqlite:///shared/index/.atlas/atlas.db" search "payment handler"
```

## Resource-Constrained Environments

Start conservative and confirm before raising limits:

```sh
export ATLAS_MEMORY_LIMIT=2GiB
export ATLAS_NO_WATCH=1
atlas index . --workers 4
```

For very large repositories, exclude generated files and dependency caches
(see [Indexing and Reindexing](indexing)) before increasing limits. Confirm
behavior with `atlas status`, `atlas stats`, and `atlas doctor`.
