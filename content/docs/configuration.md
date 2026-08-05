# Configuration

Atlas works with zero configuration on a fresh checkout; every knob has a
compiled default. This page explains where overrides live, which settings
matter most, and the global flags that select storage, scope, and output
shape. For the full command surface, see the [CLI Reference](cli).

## Precedence

Know where a value comes from before changing it. Effective configuration is
resolved in this order (highest wins):

- **Environment variable** — a deployment variable always wins.
- **Repository `.atlas/settings.json`** — stable local policy.
- **Machine profile default** (since 0.1.48) — what the tier in force
  implies for a knob nobody set (see *Machine Profiles* below).
- **Compiled default** — the value Atlas ships with.

Environment variables suit automation and containers; repository settings
suit stable local policy. The profile rung sits below both on purpose: a
profile never overrides a value you set explicitly.

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
| `ATLAS_PROFILE` | **Since 0.1.48.** Pin the machine profile tier: `eco`, `balanced`, `performance`, or `turbo`. Unset means auto-detect. See *Machine Profiles* below |
| `ATLAS_MEMORY_LIMIT` | Soft Go heap limit for the Atlas process. Accepts a byte count or a suffixed size (`512MiB`, `2GiB`, `2GB`). Overrides whatever the profile would set |
| `ATLAS_GOGC` | GC target percent. Overrides both the profile default and the warm-daemon nudge |
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
| `ATLAS_INDEX_WORKERS` | Cap the parse/hash worker pool during indexing (0 = all cores); CLI equivalent `atlas index --workers N`. Overrides the profile's worker count |
| `ATLAS_STREAM_INDEX`, `ATLAS_STREAM_INDEX_THRESHOLD`, `ATLAS_STREAM_INDEX_BATCH` | Force/tune the streaming index that bounds memory on large repos (auto-engages above ~15,000 candidate files) |
| `ATLAS_LEXICAL_SETTLE`, `ATLAS_LEXICAL_SETTLE_TIMEOUT` | **Since 0.1.48.** How `atlas index` brings the lexical sidecar to its on-disk steady state before returning: `auto` (default — merge, reclaim, measure), `reclaim` (skip the merge), `off` (measure only). The timeout budgets the merge (default 30s) |

Run `atlas config list` for the complete catalog with current names, defaults,
descriptions, and accepted values for your installed release.

## Machine Profiles

**Since 0.1.48.** Atlas sizes itself to the machine it is running on. A
profile decides how much of the box Atlas takes while it works; it never
changes what Atlas produces. Symbol, edge, and route counts are identical on
every tier.

Leave `ATLAS_PROFILE` unset to auto-detect, or pin a tier:

```sh
export ATLAS_PROFILE=balanced   # eco | balanced | performance | turbo
atlas doctor                    # read back the tier and every active bound
```

### The Ladder

`C` is the machine's CPU count; `RAM` is physical memory.

| Tier | Intended for | Index workers | Soft heap limit | GOGC | Sampler | Watch poll | WAL checkpoint | SQLite read pool |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `eco` | ≤12 GiB RAM, or a database on a spinning disk | `max(2, C/2)` | `max(512MiB, RAM/8)` | 50 | 30s | 180s | 16384 pages (~64 MB) | 4 |
| `balanced` | the 12–16 GiB middle: a laptop shared with an IDE and a browser | `max(2, 3C/4)` | `max(1GiB, RAM/4)` | 75 | 10s | 90s | 4096 pages (~16 MB) | 4 |
| `performance` | stock Atlas, on any hardware | all cores | none | 100 (75 in warm daemons) | 5s | 45s | 1000 pages (~4 MB) | 4 |
| `turbo` | ≥32 GiB workstations and CI | all cores | none | 100 (75 in warm daemons) | 5s | 45s | 1000 pages (~4 MB) | 8 |

`performance` is stock Atlas by construction rather than by gating: it carries
no bounds at all, so every read site falls through to its compiled default.
`turbo` moves exactly one knob — the SQLite read-pool connection count, 4 to 8
— because that is the only candidate that survived measurement.

### Auto-Detection

With `ATLAS_PROFILE` unset, Atlas picks a tier from what it can actually
measure, highest trigger first:

- **≤12 GiB RAM** selects `eco` (reported reason `ram`).
- **A rotational database disk** selects `eco` (reason `rotational_disk`).
  Rotation is answered only where the kernel says so — Linux `/sys`.
  Everywhere else it is reported `unknown` rather than guessed, and an
  unknown disk never blocks a RAM trigger.
- **12–16 GiB RAM** selects `balanced` (reason `ram`).
- **Anything else** falls through to `performance` with an empty reason, so
  you can tell "performance because the hardware is fine" from "performance
  because you asked for it".

Unmeasured RAM never triggers a tier on its own, and **`turbo` is never
auto-selected** — it takes more of the machine than stock, so it has to be
asked for.

The pre-0.1.48 spellings still work as inputs: `low` means `eco` and
`default` means `performance`. Atlas always reports the canonical name.

### Foreground Full Throttle

**Since 0.1.51.** `balanced` bounds **background** work, not the command you are waiting on.

- In a warm daemon — `atlas serve`, `atlas mcp`, `atlas watch` — `balanced`
  installs its CPU width (`3C/4`) and its soft heap ceiling (`RAM/4`). This
  is where a watch-triggered reindex and an MCP lazy index run, and it is
  what keeps the machine responsive while Atlas works in the background.
- In a one-shot CLI run — an explicit `atlas index` — those two bounds are
  **not** installed. The command gets the whole machine. Measured on a
  10-CPU box, the daemon-sized bounds cost a foreground index up to +15.69%
  wall time for no benefit a human waiting on the command can use, so
  `balanced` no longer pays that tax.
- The two knobs move together or not at all; the rest of the tier — GOGC 75,
  the 10s/90s cadences, the 4096-page WAL checkpoint — applies process-wide
  on both paths.
- **`eco` is not scoped.** It throttles one-shot commands too, process-wide.
  That is the point of the tier: on genuinely low-spec hardware an explicit
  index is exactly what makes the machine unusable.
- `performance` and `turbo` carry no runtime bounds at all, so the
  distinction does not apply to them.

Pinning `balanced` in `.atlas/settings.json` behaves identically to pinning it
in the environment — a one-shot that discovers the tier when it opens the
store still defers the daemon bounds.

### Explicit Knobs Always Win

A profile is a default for knobs nobody set. Every control below still works
and still outranks the tier, in both directions — Atlas will not apply a bound
over your value, and it will not take yours away either:

| Override | Beats |
| --- | --- |
| `atlas index --workers N`, `ATLAS_INDEX_WORKERS` | the tier's index worker count |
| `ATLAS_MEMORY_LIMIT`, `GOMEMLIMIT` | the tier's soft heap limit |
| `GOMAXPROCS` | the tier's CPU width |
| `ATLAS_GOGC`, `GOGC` | the tier's GC target |

When a tier does install something, it says so on stderr, names what a
one-shot deferred, and tells you how to opt out:

```text
atlas: balanced profile active (ram): GOGC=75 (cpu width + memory limit apply
in warm daemons) (set ATLAS_PROFILE=performance to opt out; explicit knobs
always win)
```

### Reading It Back

`atlas doctor` reports a `machine_profile` block. It is informational — a
low-spec machine is not a fault, so it never sets doctor's status — and its
numbers are **live read-backs** from the running process, not what detection
intended. If something overrode a bound, this block shows the override.

| Field | Meaning |
| --- | --- |
| `profile` | the tier in force: `eco`, `balanced`, `performance`, `turbo` |
| `reason` | `ram`, `rotational_disk`, `env`, `flag`, or empty when the hardware simply qualified |
| `cpu_width_scope` | **where** the tier's CPU width and soft heap limit apply: `process` under `eco`, `daemon` under `balanced`, empty under `performance`/`turbo` |
| `total_ram_bytes`, `num_cpu`, `rotational_db` | the probe facts behind the verdict; `rotational_db` may be `unknown` |
| `gomaxprocs`, `workers`, `memory_limit_bytes`, `gogc` | the bounds actually installed |
| `sampler_interval`, `watch_poll_interval`, `wal_autocheckpoint_pages`, `read_pool` | the cadences and pool this tier resolved to |
| `go_types_note` | under `eco` only: `atlas index --go-types=off` skips Go type analysis for −78% cold first-index wall and −194 MB RSS, at the cost of type-derived edges |

`cpu_width_scope` is the field that explains an otherwise confusing reading:
run `atlas doctor` as a one-shot under `balanced` and `gomaxprocs` correctly
shows the stock, full-width value, because a one-shot is not where that bound
applies. `cpu_width_scope: daemon` says so.

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

**Since 0.1.48, start with a tier, not with individual knobs.** On a small or
shared machine Atlas already selects one for you; pinning it is the one-line
version of everything below:

```sh
export ATLAS_PROFILE=eco
atlas doctor            # confirm the tier and the bounds it installed
```

Reach for individual knobs when you need a specific bound the tier does not
give you — a hard memory ceiling for a container, a fixed worker count for a
CI runner sharing an executor. They override the tier:

```sh
export ATLAS_MEMORY_LIMIT=2GiB
export ATLAS_NO_WATCH=1
atlas index . --workers 4
```

For very large repositories, exclude generated files and dependency caches
(see [Indexing and Reindexing](indexing)) before tightening limits — a
smaller candidate set beats a tighter bound. Confirm behavior with
`atlas status`, `atlas stats`, and `atlas doctor`.
