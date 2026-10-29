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

The settings most people change, including environment-only variables such as
`ATLAS_API_TOKEN` and `ATLAS_SERVER_URL` that `atlas config` does not list:

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
| `ATLAS_LLM_DETECT`, `ATLAS_LLM_ANTHROPIC_CLI_BIN`, `ATLAS_LLM_OPENAI_CLI_BIN` | **Since 0.1.54.** The AI providers behind the Ask page and the Ask Workbench: zero-configuration detection of a logged-in `claude` or `codex` CLI (`off` disables it) and the binaries it runs; `atlas llm status` / `atlas llm set` manage them. See [Ask Workbench](workbench) |
| `ATLAS_WORKBENCH_MODEL_ROUNDS`, `ATLAS_WORKBENCH_MODEL_REVISIONS`, `ATLAS_WORKBENCH_MAX_EVIDENCE_TOKENS`, `ATLAS_WORKBENCH_ASK_EFFORT`, `ATLAS_WORKBENCH_ANSWER_EFFORT`, `ATLAS_WORKBENCH_HISTORY_TURNS`, `ATLAS_WORKBENCH_MODEL_TURNS_PER_HOUR`, `ATLAS_WORKBENCH_TURNS_PER_HOUR` | **Since 0.1.54.** How many model calls and rewrites one Workbench answer may make, how much evidence and thread history a prompt carries, the reasoning effort per call on the Claude CLI, and the per-token hourly budgets. Defaults and meanings in [Ask Workbench](workbench) |
| `ATLAS_LEXICAL_SETTLE`, `ATLAS_LEXICAL_SETTLE_TIMEOUT` | **Since 0.1.48.** How `atlas index` brings the lexical sidecar to its on-disk steady state before returning: `auto` (default — merge, reclaim, measure), `reclaim` (skip the merge), `off` (measure only). The timeout budgets the merge (default 30s) |

The complete catalogue of the 122 settings `atlas config` manages in 0.1.55 is
at the end of this page, under The Knob Catalogue. `atlas config list` prints
it for the release you have installed, with each knob's effective value and
where that value came from.

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

### SQLite Residency

**Since 0.1.55.** The soft heap limit bounds the Go heap only. SQLite's
memory-mapped window and its page caches live outside it, so `eco` and
`balanced` now bound them too
([#127](https://github.com/aziron-ai/atlas/issues/127)):

| Tier | Read window (`ATLAS_MMAP_SIZE`) | Write window | Write cache (`ATLAS_SQLITE_CACHE_SIZE`) | Per read connection (`ATLAS_SQLITE_READ_CACHE_SIZE`) |
| --- | --- | --- | --- | --- |
| `performance`, `turbo` | 512MiB | whole database if at most 512MiB, else none | 64MiB | 16MiB |
| `balanced` | 256MiB | whole database if at most 256MiB, else none | 64MiB | 16MiB |
| `eco` | 64MiB | whole database if at most 64MiB, else none | 16MiB | 16MiB |

An explicit `ATLAS_MMAP_SIZE` sets both windows; an explicit cache knob
replaces the tier's cache. Under `eco` with the 1 GiB limit an 8 GB machine
gets, a one-line TensorFlow delta now peaks at 393 MB instead of 1,510 MB.
`atlas doctor` reports the values the handles open with as
`sqlite_read_mmap_bytes`, `sqlite_write_mmap_bytes`,
`sqlite_write_cache_bytes` and `sqlite_read_cache_bytes_per_conn`.

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
| `reason` | `ram`, `rotational_disk`, `env`, `settings` (a tier set in `.atlas/settings.json`, since 0.1.55), `flag`, or empty when the hardware simply qualified |
| `cpu_width_scope` | **where** the tier's CPU width and soft heap limit apply: `process` under `eco`, `daemon` under `balanced`, empty under `performance`/`turbo` |
| `total_ram_bytes`, `num_cpu`, `rotational_db` | the probe facts behind the verdict; `rotational_db` may be `unknown` |
| `gomaxprocs`, `workers`, `memory_limit_bytes`, `gogc` | the bounds actually installed. Since 0.1.55 a one-shot `doctor` under `balanced` reports the daemon-only heap limit as `daemon_memory_limit_bytes`, with a note, rather than as its own |
| `sqlite_read_mmap_bytes`, `sqlite_write_mmap_bytes`, `sqlite_write_cache_bytes`, `sqlite_read_cache_bytes_per_conn` | **Since 0.1.55.** The SQLite windows and caches the handles open with (see SQLite Residency above) |
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
- **Since 0.1.55, one alias table serves every surface:** `l`/`0`,
  `med`/`m`/`1`, `h`/`2` and `x`/`max`/`full`/`3` mean the same on
  `--detail`, the HTTP `?detail=` parameter and the MCP `detail` argument, and
  `ATLAS_DETAIL_DEFAULT` reads through the same table. An unrecognised value
  falls back to `high` ([#146](https://github.com/aziron-ai/atlas/issues/146)).

## Read-Only Mode and Telemetry

Use `--read-only` when the database must not change — for example when
hashing artifacts or querying a shared index. No migration runs, nothing is
written or checkpointed, and no `telemetry.db` is created beside the store.
Beside a quiescent store it creates no `-wal` or `-shm` file either, so the
artifact bytes hash identically after any query. A missing database errors
instead of being created.

**Since 0.1.55, a read-only reader follows a live writer.** Once a running
Atlas has a WAL beside the store, the reader reads that WAL, so it sees
snapshots the writer has committed; it refuses a store another Atlas moved to
a different schema generation (`store_superseded`), and it drops its warm
search, context and report caches when the store changes underneath it
([#130](https://github.com/aziron-ai/atlas/issues/130)).

Because read-only mode attaches no telemetry sink, telemetry with
`--read-only` requires an explicit `--telemetry-db PATH`. Without
`--read-only`, telemetry defaults to `telemetry.db` beside the graph
database. Since 0.1.55 `stats` and `status` say so instead of leaving fields
out: their `telemetry` block reads `unavailable_read_only` with the remedy
([#154](https://github.com/aziron-ai/atlas/issues/154)).

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

## The Knob Catalogue

Every setting `atlas config` manages in 0.1.55, 122 in all, grouped by area.
**Live** says whether a running daemon picks up a change without a restart:
`yes` means the knob is re-read per call or tick, `no` means restart to apply
it. A value is written in the syntax its environment variable accepts, in the
environment, in `.atlas/settings.json` or with `atlas config set`. The
settings new in 0.1.55 are listed in the [release notes](upgrade).

| Type | Syntax |
| --- | --- |
| `bytes` | `5GiB`, `500MB`, or a plain integer |
| `int` | a plain integer |
| `float` | a decimal ratio |
| `duration` | a Go duration (`6h`, `90s`) or bare seconds |
| `bool` | `1`/`true` is on; empty or absent is off |
| `enum` | one of the listed values |
| `string` | free-form (URLs, origin lists) |

### Storage and Retention

| Setting | Type | Default | Live | Description |
| --- | --- | --- | --- | --- |
| `ATLAS_MAX_DB_BYTES` | bytes | `5GiB` | yes | Retention budget for the graph DB's live footprint; oldest snapshots are pruned past it (0 disables). |
| `ATLAS_MAX_SNAPSHOTS_PER_REPO` | int | `5` | yes | How many newest snapshots each repo keeps; older ones are pruned after every index (<=0 disables). |
| `ATLAS_MAX_SNAPSHOT_AGE` | duration | `0 (disabled)` | yes | Prune snapshots older than this Go duration ("720h") after every index. A repo's newest snapshot is never pruned, nor is one with a read in flight. OFF by default so an upgrade never silently drops history; `atlas snapshots prune --keep-since 90d` applies it on demand. |
| `ATLAS_MAINTENANCE_INTERVAL` | duration | `6h` | yes | How often warm daemons run retention + lexical purge + online compact (0 disables the ticker). |
| `ATLAS_MMAP_SIZE` | bytes | `512MiB read (256MiB balanced, 64MiB eco); write: whole db if it fits, else 0` | no | SQLite memory-mapped window, set for EVERY handle when given ('0' disables mmap). Unset, the read pool maps the tier's window (512MiB; 256MiB balanced, 64MiB eco) and the WRITE handle maps the database whole when it fits that window and not at all when it is larger — a partial window only pins the persist's scanned pages on top of the page cache (TensorFlow's 2.2 GB store: ~500 MB of a one-line delta's peak). Mapped pages are file-backed but DO count toward RSS. |
| `ATLAS_SQLITE_CACHE_SIZE` | bytes | `64MiB (16MiB eco)` | no | Page cache of the SQLite WRITE handle (the index persist's working set). Outside the Go heap, so outside ATLAS_MEMORY_LIMIT. Explicit value beats the tier. |
| `ATLAS_SQLITE_READ_CACHE_SIZE` | bytes | `16MiB` | no | Page cache of EACH SQLite read-pool connection (multiply by ATLAS_READ_POOL). The tiers never move it — it is the measured warm-serve latency setting — so only an explicit value changes it. |
| `ATLAS_SQLITE_WAL_AUTOCHECKPOINT` | int | `1000 (4096 balanced, 16384 eco)` | no | WAL pages that accumulate on the WRITE handle before SQLite checkpoints (0 disables autocheckpointing). Larger means fewer, bigger, seek-friendlier checkpoints. The read pool always keeps SQLite's stock value. |
| `ATLAS_READ_POOL` | int | `4 (8 under turbo)` | no | SQLite READ-pool connection count, clamped to [1,32]. Read connections run concurrently with the single writer under WAL, so this is the concurrency ceiling for serve/MCP query traffic; the WRITE handle always stays at 1 regardless. Turbo raises it to 8 (measured at 16-way concurrency: p50 -35%, p95 -30-45%, QPS +26-54%; free at low concurrency). SQLite-only — it is not consulted for hosted Postgres stores. |

### Lexical (BM25) Sidecar

| Setting | Type | Default | Live | Description |
| --- | --- | --- | --- | --- |
| `ATLAS_LEXICAL_MAX_RATIO` | float | `2.0` | yes | Rebuild the BM25 lexical sidecar when it exceeds this multiple of the graph DB's logical size (<=0 disables the ratio check). |
| `ATLAS_MAX_LEXICAL_BYTES` | bytes | `0` | yes | Absolute lexical sidecar bound; replaces the ratio check when set (0 = ratio-only). |
| `ATLAS_LEXICAL_OPEN_TIMEOUT` | duration | `2s` | yes | Flock-acquisition deadline when opening the BM25 sidecar. Raise it when indexing a large repo alongside a warm daemon so the open waits out the writer instead of degrading to SQL search (default 2s keeps small repos fast). |

### Indexing and Watching

| Setting | Type | Default | Live | Description |
| --- | --- | --- | --- | --- |
| `ATLAS_INDEX_MAX_FILES` | int | `25000` | yes | Parseable-file ceiling for auto/lazy index runs (0 = unlimited; manual atlas index is always unlimited). |
| `ATLAS_INDEX_WORKERS` | int | `0 (profile cap, else all cores)` | yes | Cap the index parse/hash worker pool (the default for --workers). 0/unset follows the machine profile the way the indexer does: eco caps every process, one-shot commands included; balanced's cap applies only in warm daemons (serve, mcp, watch), so a one-shot command such as an explicit `atlas index` uses all cores; performance and turbo carry no cap (all cores). An explicit value outranks the machine profile and is reported live in `atlas doctor` machine_profile.workers. |
| `ATLAS_IMAGE_OCR_CMD` | string | unset | no | Opt-in OCR for image pixels at index time ([#26](https://github.com/aziron-ai/atlas/issues/26)): a command, split on whitespace and run without a shell, that reads one image on stdin (ATLAS_IMAGE_PATH, the repo-relative path, in its env) and prints the image's text; when set, its stdout is indexed as the image's OCR text, e.g. "tesseract - stdout" (30s per image). Unset = pixel text is not indexed and the image entry shows ocr: off; text the file itself carries (PNG text chunks, EXIF, XMP, IPTC, comments) is indexed either way. Read when an image is parsed, so images already indexed keep their text until `atlas index --reindex`. |
| `ATLAS_INDEX_NESTED_REPOS` | bool | `false` | no | Absorb files inside NESTED git repositories/worktrees into the parent index. Default false treats a nested repo (a subdir with its own .git) as an index boundary and skips it; the segmented workspace path still indexes such repos separately. |
| `ATLAS_NO_WATCH` | bool | unset | no | Disable the default-on background file watcher in serve/mcp (any non-empty value). |
| `ATLAS_WATCH_MODE` | enum | `auto` | no | File-watch backend: auto (fsnotify, falling back to polling) or poll (force polling — required for some bind-mount deployments). |
| `ATLAS_WATCH_POLL_INTERVAL` | duration | `45s (90s balanced, 180s eco)` | no | Polling interval when the watcher runs in poll mode. Each tick is a full working-tree re-walk, and any drift it finds triggers a re-index. |
| `ATLAS_STALENESS_INTERVAL` | duration | `120s` | yes | How often a non-watching daemon re-checks the working tree for drift on query (0 disables). |
| `ATLAS_FRESHNESS_TTL` | duration | `2s` | yes | How long one working-tree probe (HEAD + git status of the indexable files) answers for a repo when stamping indexed_sha/head_sha/dirty/stale on an answer (0 probes on every answer). |
| `ATLAS_FRESHNESS_PROBE` | bool | `on` | yes | Set 0/off to stop probing the working tree on answers; every answer then reports head_sha "unknown" (stale omitted), never a fabricated fresh. |
| `ATLAS_ONESHOT_REFRESH` | enum (`off`, `sync`) | `off` | yes | What a one-shot command (any CLI command except serve/mcp/watch) does about a stale repo. Accepted values: `off` (default) \| `sync`, case-insensitive; any other value warns once on stderr and behaves as `off`. `off`: nothing — the process exits before background index work could land, so none is enqueued; a stale answer says `refresh: "none"` with `refresh_skipped: "one_shot"` (run `atlas index`). `sync`: when git reports the repo stale, re-index it synchronously before answering, bounded by `ATLAS_ONESHOT_REFRESH_TIMEOUT`; the answer is then fresh (`refresh: "completed"`), or says `refresh_skipped: "budget_exceeded"` / `"failed"`. Long-lived processes keep their background backstop either way. |
| `ATLAS_ONESHOT_REFRESH_TIMEOUT` | duration | `10s` | yes | Wall-clock bound on one synchronous refresh under `ATLAS_ONESHOT_REFRESH=sync`. A run that does not finish in time is cancelled, persists nothing, and the answer reports `refresh_skipped: "budget_exceeded"`. |
| `ATLAS_INDEX_DIRTY_IDENTITY` | bool | `on` | yes | Index a dirty working tree into its own snapshot labeled `<sha>+dirty` instead of overwriting the clean snapshot of HEAD. 0/off restores the pre-[#65](https://github.com/aziron-ai/atlas/issues/65) in-place labeling. |

### Machine Profile and Runtime

| Setting | Type | Default | Live | Description |
| --- | --- | --- | --- | --- |
| `ATLAS_PROFILE` | enum | `auto (eco on <=12GiB RAM or rotational db disk; balanced on 12-16GiB; performance otherwise; turbo is explicit-only)` | no | Machine profile tier. eco bounds Atlas for a small box (half the cores for indexing, soft heap limit max(512MiB, RAM/8), GOGC=50, slower background cadences, larger WAL checkpoints, and it defers watch refreshes while foreground commands run); balanced is the 12-16GiB middle rung and bounds BACKGROUND work only: in a warm daemon (serve/mcp/watch) it takes 3/4 of the cores with a soft heap limit of max(1GiB, RAM/4), while an explicit `atlas index` you are waiting on runs at FULL speed (measured: the daemon-sized bounds cost a one-shot up to +15.69% wall on a 10-CPU box, so they are not applied to it); GOGC=75, 10s/90s cadences and 4096-page WAL checkpoints apply process-wide on both paths, and no scheduling behavior changes; performance is stock behavior on any hardware; turbo is above stock for big workstations/CI and moves exactly one knob, the sqlite read pool 4 -> 8. The [#127](https://github.com/aziron-ai/atlas/issues/127) names still work as input aliases: low = eco, default = performance. Unset = AUTO: eco on <=12GiB RAM or a rotational db disk, balanced on 12-16GiB, performance otherwise; turbo is NEVER auto-selected (it takes more of the machine than stock, so it must be asked for). `atlas doctor` reports the detected tier and every active bound. |
| `ATLAS_MEMORY_LIMIT` | bytes | unset | yes | Soft Go heap limit for the atlas process (debug.SetMemoryLimit). |
| `ATLAS_GOGC` | int | `75 (warm daemons)` | yes | GC target percent; warm daemons default to 75 when nothing is set. |
| `ATLAS_FEDERATED_CONCURRENCY` | int | `eco 2, balanced 4, performance 6, turbo min(cores,8); clamped to the read pool` | yes | How many repository legs the federated (repo="*") passages answer runs at once — the Ask page's all-repos scope and GET /api/v1/passages/federated. Each leg holds a SQLite read connection while it runs, so the width is ALWAYS clamped to the store's read pool (ATLAS_READ_POOL) and to [1,32]. Per-tier default: eco 2, balanced 4, performance 6, turbo min(cores, 8) — with the stock read pool of 4 that means eco 2 and 4 everywhere else (turbo's pool is 8). Results are byte-identical at every width. Read per request. |

### Context and Query Budgets

| Setting | Type | Default | Live | Description |
| --- | --- | --- | --- | --- |
| `ATLAS_CODE_QUERY_MAX_TOKENS` | int | `16000` | yes | Default token budget for a code_query with no explicit max_tokens (0 = unlimited; context is trimmed to fit). |
| `ATLAS_CONTEXT_LIMIT` | int | unset | no | Default max symbols packed into a context/code_query bundle when the request sets no --limit (unset = the selected intent budget). |
| `ATLAS_CONTEXT_MAX_FILES` | int | unset | no | Default max files referenced in a context/code_query bundle when the request sets no --max-files (unset = the selected intent budget). |
| `ATLAS_CONTEXT_MAX_EDGES` | int | unset | no | Default max scoped edges in a context/code_query bundle when the request sets no --max-edges (unset = the selected intent budget). |
| `ATLAS_CONTEXT_MAX_DEPTH` | int | unset | no | Default impact-traversal depth for a context/code_query bundle when the request sets no --max-depth (unset = the selected intent budget). |
| `ATLAS_CROSS_REPO_V2` | bool | `auto (on at >=2 repos)` | yes | Cross-repo intelligence in code_query/impact (route consumers, cross-repo blast radius). Unset = AUTO: on when >=2 repos are indexed; 1/0 forces on/off. |
| `ATLAS_FEEDBACK_RANKING` | bool | `true` | yes | Let stored record_feedback verdicts re-rank retrieval hits. |

### MCP Surface

| Setting | Type | Default | Live | Description |
| --- | --- | --- | --- | --- |
| `ATLAS_MCP_CALL_TIMEOUT` | duration | `30s` | yes | Per-tool-call deadline on the MCP surface — the guard that keeps a blocked engine from hanging an agent forever. |
| `ATLAS_MCP_MAX_RESULT_BYTES` | bytes | `96KiB` | yes | Ceiling on a single MCP tool result before it degrades to the compact rendering (0 disables). |
| `ATLAS_MCP_MAX_RECALL_TOOLS` | int | `15` | yes | How many trusted recall__<slug> tools the MCP catalog advertises. |
| `ATLAS_MCP_ALLOWED_ORIGINS` | string | unset | yes | Comma-separated Origin allowlist for the MCP HTTP transports (DNS-rebinding guard). |
| `ATLAS_MCP_REQUIRE_SESSION` | bool | `1` | yes | Enforce the MCP initialize lifecycle on the Streamable HTTP transport: requests other than initialize/ping must carry the Mcp-Session-Id minted at initialize. 0 restores the legacy stateless behavior, where any caller could execute tools/call without ever initializing. |
| `ATLAS_MCP_SESSION_TTL` | duration | `30m` | yes | Idle lifetime of an initialized MCP Streamable-HTTP session before its Mcp-Session-Id is rejected as expired. |
| `ATLAS_MCP_PUBLIC_READONLY` | bool | `false` | no | Open the PUBLIC READ-ONLY MCP door on `atlas serve --mcp` (the --mcp-public-readonly flag, which wins when given): POST /mcp then answers a caller that sends NO bearer, with the read-only catalog only — every tool annotated readOnlyHint:true except record_feedback, record_task and link, and within them no incidents op=refresh or op=rca, no code_query allow_lazy_index, no report allow_large; anything else is refused with a JSON-RPC error naming the mode. The read-write token keeps the full catalog on the same mount and every /api/v1 route keeps its gate. For hosts that reach Atlas only over public HTTPS with no static bearer, such as the ChatGPT desktop app's custom connectors. Needs a read-write API token (atlas token init); refused with --mcp absent or under central --jira-oauth. Read when the serve starts. PUT /api/v1/system/config refuses it with 403 setting_not_writable_via_api (it would open POST /mcp to callers with no bearer at the next restart), so set it on the serve's machine: the --mcp-public-readonly flag, the serve's environment, or `atlas config set`. |
| `ATLAS_MCP_PUBLIC_RATE` | int | `60` | no | Requests per minute one remote address may make on the public read-only MCP door: a token bucket holding a minute's worth, so a quiet caller may burst that many; a request over it is answered 429 with Retry-After. The key is the TCP peer, never a forwarding header, so behind a tunnel or proxy it is the one budget every caller through it shares. A non-positive or unparsable value falls back to 60 — there is no unlimited spelling. Read when the serve starts. |

### Embeddings and Semantic Search

| Setting | Type | Default | Live | Description |
| --- | --- | --- | --- | --- |
| `ATLAS_ENABLE_VECTORS` | bool | `false` | no | Compute and store embeddings at index time (semantic search + the semantic cache need them). |
| `ATLAS_EMBED_URL` | string | unset | no | Embedding provider endpoint. Unset = the offline hashing provider, whose matches are honestly flagged degraded. Atlas holds NO model key and never calls an LLM. |

### Recall: Service Posture

| Setting | Type | Default | Live | Description |
| --- | --- | --- | --- | --- |
| `ATLAS_RECALL_CACHE` | enum | `off` | yes | Opt-in snapshot-pinned answer cache stored in the selected observability store (telemetry.db for SQLite; the observability schema for PostgreSQL): off writes no CodeQuery results; shadow stores recursively redacted results but serves live; serve may return redacted cached answers. Questions containing maskable secrets or private coordinates always bypass lookup/storage. Delete query/cache data with `atlas privacy purge-recall --apply --yes`. |
| `ATLAS_RECALL_SHADOW` | bool | `true` | no | Semantic/exact recall service posture: true = observe-only (never serve a cached answer). A token-less hub is forced into shadow regardless. |
| `ATLAS_RECALL_SEMANTIC` | bool | `true` | no | Tier-1 semantic (embedding) cache on top of the exact cache. |
| `ATLAS_RECALL_SIM_THRESHOLD` | float | `0.92` | no | Cosine floor a semantic candidate must clear before it may be served (0,1]. |
| `ATLAS_RECALL_MIN_USERS` | int | `2` | no | Cross-user corroboration floor: how many DISTINCT users must have asked a cluster before its cached answer may be served. |
| `ATLAS_RECALL_MAX_AGE_SECONDS` | int | `0` | no | Wall-clock staleness ceiling on a served cached answer (0 = no ceiling; the snapshot gate still applies). |
| `ATLAS_RECALL_SERVE_DEGRADED` | bool | `false` | no | May an OFFLINE-hashing (token-overlap, not learned) semantic match be served? Off by default — a degraded match is honest, not trustworthy. |
| `ATLAS_MINER_INTERVAL_SEC` | int | `600` | no | How often a serve daemon mines clusters + runs the fleet sweep (0 disables the miner). |
| `ATLAS_RECALL_USD_PER_MTOKEN` | float | `3.0` | yes | Price used for the dashboard's ESTIMATED savings figure (explicitly labeled an estimate; never a fabricated constant). |

### Recall: Privacy and Retention

| Setting | Type | Default | Live | Description |
| --- | --- | --- | --- | --- |
| `ATLAS_RECALL_STORE_PROMPT_TEXT` | bool | `false` | yes | Opt in to storing redacted prompt text for recall query events in the selected observability store (telemetry.db for SQLite; the observability schema for PostgreSQL). Default stores only the redacted normalized/hash signal plus metrics; raw secrets are never retained. Delete with `atlas privacy purge-recall --apply --yes`. |
| `ATLAS_RECALL_RETENTION_DAYS` | int | `30` | yes | Bounded retention window for recall query events and captured transcript episodes in the selected observability store; non-positive or invalid values fall back to 30 days and values above one year clamp to 365 days. Delete immediately with `atlas privacy purge-recall --apply --yes`. |
| `ATLAS_RECALL_CACHE_RETENTION_DAYS` | int | `30` | yes | Bounded retention window for opt-in recursively redacted CodeQuery answer-cache rows in the selected observability store; non-positive or invalid values fall back to 30 days and values above one year clamp to 365 days. Delete immediately with `atlas privacy purge-recall --apply --yes`. |
| `ATLAS_SERVE_CAPTURE` | bool | `0` | no | Explicit opt-in for a serve daemon to scan ~/.claude/projects and ~/.codex/sessions into the selected observability store (telemetry.db for SQLite; the observability schema for PostgreSQL). A separately connected sync may uplink redacted/normalized events; startup discloses stored fields, scope, prompt redaction, retention, and `atlas privacy purge-recall --apply --yes` before the first scan. |
| `ATLAS_SERVE_CAPTURE_SEC` | int | `20` | no | How often an explicitly opted-in serve daemon scans ~/.claude/projects and ~/.codex/sessions. |
| `ATLAS_SERVE_CAPTURE_PROMPT_MODE` | enum | `norm` | no | Prompt posture for explicitly opted-in transcript capture: off stores hash only; norm stores redacted normalized text; raw stores redacted prompt text. Tool traces are always redacted. |

### Fleet Uplink and Telemetry

| Setting | Type | Default | Live | Description |
| --- | --- | --- | --- | --- |
| `ATLAS_SYNC_ACCEPT_LEVEL` | enum | `interactions` | yes | HUB accept policy for pushed fleet data: off \| telemetry (metrics only) \| interactions (normalized prompts) \| full (raw). |
| `ATLAS_TELEMETRY_PUSH` | bool | `1` | yes | Spoke-side uplink kill switch: 0 pauses every push without disconnecting. |
| `ATLAS_TELEMETRY_LEVEL` | enum | unset | yes | Spoke-side data-sharing ceiling: off \| telemetry \| interactions \| full. Overrides the connected level. |
| `ATLAS_GA_TELEMETRY` | bool | `0 (opt-in consent required)` | yes | Anonymous aggregated usage export to Google Analytics (label=atlas + version): tool name, source, status, and bucketed latency/token magnitudes only — never code, paths, repo names, query text, arguments, device ids, or user ids; client_id is random per batch. CONSENT-GATED and off by default: it runs only after an explicit recorded opt-in (the installer prompt or `atlas telemetry grant`), or when this knob is set explicitly truthy with no decision recorded. Set 0/false/off to hard-disable even over recorded consent; DO_NOT_TRACK is equally absolute. A recorded denial holds against a truthy value — re-grant with `atlas telemetry grant`. |
| `ATLAS_TELEMETRY_LOCAL` | bool | `1` | yes | LOCAL observability collection into telemetry.db (tool_events rows from the Recorder, resource_samples rows from the Sampler). Local-only — these rows never leave the machine, so this is not an egress knob. Default on; set 0/false/off to stop writing new rows entirely. In-memory session stats (latency rings, dashboard Latest()) stay live regardless: they are process RAM, not collection. |
| `ATLAS_TELEMETRY_SAMPLE_INTERVAL` | duration | `5s (10s balanced, 30s eco)` | no | How often the resource sampler writes a resource_samples row and stats the db/lexical files. The 5s default never lets a rotational disk idle. |
| `ATLAS_TELEMETRY_SAMPLE_RETENTION` | int | `20000` | yes | Row cap (retention) on the shared resource_samples ring buffer: each write prunes to the newest N rows, so telemetry.db cannot grow without limit no matter how long a daemon runs or how many Atlas processes (mcp, serve, watch, cli, index) share it. Downsample by RAISING ATLAS_TELEMETRY_SAMPLE_INTERVAL — the two together set the retained window: 20000 rows is ~28h at the 5s default and ~7 days at the eco 30s cadence. The cap is global, not per process role, because it bounds one shared file; every row records the process_id/process_role that wrote it, so a shared series stays attributable. Invalid values (0, negative, non-numeric) warn on stderr and keep the default — 0 is NOT 'unlimited', and there is deliberately no way to spell unbounded growth. Note cpu_pct: it is measured per process from getrusage(2) on Linux/macOS and from GetProcessTimes (kernel+user) on Windows, as CPU time over wall time since the previous sample (so it can exceed 100 on several cores); -1 is the honest 'unmeasured' sentinel — the first sample of every process (there is no previous reading to diff against yet), or a failed syscall — and must never be averaged in as 0. |

### Auto-update

| Setting | Type | Default | Live | Description |
| --- | --- | --- | --- | --- |
| `ATLAS_AUTO_UPDATE` | bool | `1 (recorded at install; on\|off here overrides the record)` | yes | Background auto-update: a jittered daily check against the public GitHub releases API (one unauthenticated GET, no identifiers) plus checksum-verified staged upgrades (atomic swap on the binary channel, which keeps the previous binary as atlas.bak for revert and refuses downgrades — only a strictly newer version is applied; npm/brew get a notice with their package manager's command). Default on via the decision recorded at install (`atlas update on\|off` manages it); this knob OVERRIDES THE RECORDED decision in both directions. Off means ZERO update-related network — no check, no download. |
| `ATLAS_UPDATE_CHECK_INTERVAL` | duration | `24h` | yes | Ceiling on how often ANY atlas process on this machine checks for a new release (the cursor is shared via ~/.atlas/update-config.json). Go duration or bare seconds. |
| `ATLAS_UPDATE_URL` | string | unset | yes | Mirror override for the release-check endpoint (default: the public GitHub releases API for aziron-ai/atlas). Must serve the same latest-release JSON shape (tag_name + assets[].browser_download_url); artifact and checksum downloads follow the asset URLs in that response, so an air-gapped mirror controls both. |

### Skills

| Setting | Type | Default | Live | Description |
| --- | --- | --- | --- | --- |
| `ATLAS_SKILL_EXEC` | bool | `1` | yes | Kill switch for the fenced skill test-run executor: unset/1 = enabled, 0 = every test-run refuses. |

### Observe: Log Streams, Pulls, Sources, Metrics, Traces, Incidents

See [Observe](observe).

| Setting | Type | Default | Live | Description |
| --- | --- | --- | --- | --- |
| `ATLAS_LOGSTREAM_MAX_TEMPLATES` | int | `5000` | yes | How many distinct log templates one stream may hold. Once it is reached, lines whose template is UNSEEN are counted under the reserved "__overflow__" template instead of being admitted — the counts survive, the table stops growing, and every ingest reports how many deltas it folded. Raise it for a stream that keeps folding; a stream that folds constantly is usually emitting values the skeletonizer is not masking. Non-positive or invalid values fall back to 5000. |
| `ATLAS_LOGSTREAM_MAX_EXEMPLARS` | int | `3` | yes | How many secret-masked example lines each log template keeps as proof it is real, first-arrived wins. Exemplars are the only line text Atlas persists (masked with the same lexicon as every other stored free-text field); raise it to see more of the variance behind one skeleton, at proportional storage. Non-positive or invalid values fall back to 3. |
| `ATLAS_LOGSTREAM_FOLD_CONTINUATIONS` | bool | `true` | yes | Fold continuation lines into the log record they continue before templating, within one ingest batch: a line that starts with a space or tab, or an unindented line with no timestamp, level token, bracketed tag or JSON shape that follows a record which had one (a SQL statement's body, a stack trace's frames, a panic's goroutine dump). One multi-line event then counts as ONE template instead of one per line. A JSON line never absorbs anything (it is complete by construction), and a record is capped at 64 lines and 8 KiB. Only 0/false/no/off disables it; anything else, including unset, leaves it on. |
| `ATLAS_LOGPULL_TOKEN_ENVS` | string | `ATLAS_LOKI_TOKEN,ATLAS_ELASTIC_TOKEN,ATLAS_JENKINS_TOKEN,ATLAS_JENKINS_USER` | yes | Comma-separated NAMES of the environment variables a scheduled log pull (atlas logs pull add, POST /api/v1/logs/pulls) may read its credential from — names, never credentials. A pull sends its credential to the url it names, so a pull whose token_env (or, for a jenkins pull, user_env: the Jenkins user ID rides in the same Authorization header) is not listed is refused when it is added, never probed, and skipped by the serve (log_pull_token_env_not_allowed, logged once an hour). none = no variable, anonymous pulls only. The config API cannot change this knob — it constrains that API's own write token — so set it in the serve's environment, or in settings.json from the serve's machine (atlas config set). |
| `ATLAS_SOURCE_TOKEN_ENVS` | string | `GITHUB_TOKEN,GRAFANA_SA_TOKEN,ATLAS_JENKINS_TOKEN,ATLAS_ONEDRIVE_TOKEN,PROMETHEUS_TOKEN,TEMPO_TOKEN` | yes | Comma-separated NAMES of the environment variables a source configured through POST /api/v1/sources (the Command Center's Fleet › Connectors form) may name as its token_env IN ADDITION to the connectors' own conventional variables, which are always allowed (the default list) — names, never credentials. A source sends its credential to the base_url it names, and the caller of that route chooses the url, so a token_env that neither list names (nor the variable the same-named source already uses) is refused before any variable is read (source_token_env_not_allowed). `atlas source add` is not bound by it: the shell that runs it already holds its own environment. An entry that is not a variable name is refused when set and dropped when read. The config API cannot change this knob — it constrains that API's own write token — so set it in the serve's environment, or in settings.json from the serve's machine (atlas config set). |
| `ATLAS_JENKINS_CONSOLE_MAX_BYTES` | int | `8388608` | yes | How many bytes of ONE build's console a scheduled jenkins log pull reads (atlas logs pull add --source jenkins). A console past it is cut at the last whole line inside the bound, the cut is counted in the poll's console_truncated, and the build is still marked ingested — the bound is what keeps a build that looped for an hour from becoming one gigantic ingest. Non-positive or invalid values fall back to 8388608 (8 MiB); there is no spelling for unbounded. |
| `ATLAS_METRICS_MAX_POINTS` | int | `60` | yes | Default point budget per series for `metrics op=query` over a range (MCP, `atlas metrics query`, POST /api/v1/metrics/query): the step is ceil(window / budget) rounded up to a multiple of 15s, so no series ever carries more points than this; a call's own max_points overrides it. Values above 1000 clamp to 1000; non-positive or invalid values fall back to 60. |
| `ATLAS_METRICS_TIMEOUT` | duration | `10s` | yes | Deadline for one metrics question to a Prometheus source (alerts, targets, rules or a query), also sent to Prometheus as its own query timeout so a heavy expression is abandoned server-side too. Go duration or bare seconds, clamped to [1s, 5m]; invalid values fall back to 10s. |
| `ATLAS_TRACES_TIMEOUT` | duration | `10s` | yes | Deadline for one traces question to a Tempo source (`traces op=services\|search\|trace\|metrics` over MCP, `atlas traces`, GET /api/v1/traces) — the whole question, including op=services' one presence search per service. Past it the answer is an error naming this knob, never a partial list. Go duration or bare seconds, clamped to [1s, 5m]; invalid values fall back to 10s. |
| `ATLAS_INCIDENTS_EVERY` | duration | `2m` | no | How often `atlas serve` recomputes incidents — the clusters of error/warn log templates that share a cause, joined with the firing alerts that watch them — from the log streams it pulls (and, when a Prometheus source is configured, its firing alerts). Go duration or bare seconds, never under 30s; 0/off disables the loop (POST /api/v1/incidents/refresh and `atlas incidents refresh` still work). Invalid values fall back to 2m. |
| `ATLAS_INCIDENTS_WINDOW` | duration | `24h` | yes | How far back an incident refresh reads the hourly template buckets: a template counts toward an incident when it was seen inside this window, an incident's rate is its lines per hour within it, and an incident no member of which has been seen for TWICE this window is resolved automatically. Go duration or 30m/6h/2d/1w, clamped to [1h, 7d]; invalid values fall back to 24h. |
| `ATLAS_SOURCE_DIR` | string | `~/.atlas/sources` | yes | Root of the materialized knowledge-source corpora. Each source gets <root>/<name>, which becomes the virtual repo's root and is walked and indexed like any checkout — so it must be on a filesystem the indexer can read and must stay put across syncs (a root that moves mints a second repo carrying a duplicate index of the same documents). Unset = ~/.atlas/sources. |
| `ATLAS_SOURCE_MAX_DOCS` | int | `20000` | yes | How many documents one `atlas source sync` may pull. Reaching it ABORTS the sync: the cursor does not move, the pages already materialized stay on disk behind their checkpoint (the next sync resumes there), and the error names the filter to narrow. It is a bound on a filter mistake — a JQL that selects a whole instance by accident would otherwise fill a disk before anyone noticed — not a page size; a source that genuinely holds a million tickets sets it above that. Non-positive or invalid values fall back to 20000; there is deliberately no spelling for unbounded. |

### AI Answers (Optional)

The model providers behind the Ask page and the Ask Workbench; see [Search and Ask](search-and-ask) and [Ask Workbench](workbench).

| Setting | Type | Default | Live | Description |
| --- | --- | --- | --- | --- |
| `ATLAS_LLM_ANTHROPIC_BIN` | string | `unused` | yes | Unused: the anthropic entry calls the vendor HTTPS API and runs no binary (kept so every entry has the same three fields). |
| `ATLAS_LLM_ANTHROPIC_CLI_BIN` | string | `PATH, else detected` | yes | Path to the claude binary the anthropic-cli AI-answer entry runs. Written by `atlas llm set --provider anthropic-cli --bin`. Empty = found on PATH, else the binary the detector finds (~/.nvm, ~/.volta, ~/.local/bin, Homebrew, npm's global prefix, app bundles — the newest; ATLAS_LLM_DETECT=off disables that fallback) — a serve started by launchd or a container often has a narrower PATH than your shell. |
| `ATLAS_LLM_ANTHROPIC_CLI_KEY_ENV` | string | `CLAUDE_CODE_OAUTH_TOKEN, else a stored setup-token, else the claude login` | yes | NAME of the environment variable holding the anthropic-cli entry's credential — never the credential itself; a value shaped like a key is refused. Written by `atlas llm set --provider anthropic-cli --key-env`. Empty = CLAUDE_CODE_OAUTH_TOKEN, else a stored setup-token, else the claude login. |
| `ATLAS_LLM_ANTHROPIC_CLI_MODEL` | string | `claude-sonnet-5` | yes | Model id the anthropic-cli AI-answer entry asks Anthropic for, passed through unchecked (any id the vendor accepts). Written by `atlas llm set --provider anthropic-cli --model`. Empty = claude-sonnet-5. |
| `ATLAS_LLM_ANTHROPIC_CLI_SOURCE` | enum | `user` | yes | "detected" when Atlas registered the anthropic-cli entry itself from what the detector found (zero configuration); unset = the user's entry. A detected entry may be updated by the detector (its binary path); a user entry never is. `atlas llm set --provider anthropic-cli` makes it the user's. |
| `ATLAS_LLM_ANTHROPIC_KEY_ENV` | string | `ANTHROPIC_API_KEY, else a stored key` | yes | NAME of the environment variable holding the anthropic entry's credential — never the credential itself; a value shaped like a key is refused. Written by `atlas llm set --provider anthropic --key-env`. Empty = ANTHROPIC_API_KEY, else a stored key. |
| `ATLAS_LLM_ANTHROPIC_MODEL` | string | `claude-sonnet-5` | yes | Model id the anthropic AI-answer entry asks Anthropic for, passed through unchecked (any id the vendor accepts). Written by `atlas llm set --provider anthropic --model`. Empty = claude-sonnet-5. |
| `ATLAS_LLM_ANTHROPIC_SOURCE` | enum | `user` | yes | "detected" when Atlas registered the anthropic entry itself from what the detector found (zero configuration); unset = the user's entry. A detected entry may be updated by the detector (its binary path); a user entry never is. `atlas llm set --provider anthropic` makes it the user's. |
| `ATLAS_LLM_CLI_BIN` | string | `PATH, else detected` | yes | First-release single-provider knob: path to the claude / codex binary for the DEFAULT provider when its own ATLAS_LLM_<ID>_BIN is unset. `atlas llm set` migrates a settings.json value into the default's scoped key. Empty = found on PATH, else the binary the detector finds (a serve started by launchd or a container often has a narrower PATH than your shell). |
| `ATLAS_LLM_DETECT` | enum | `on` | yes | Zero-configuration AI answers: on (default) registers the claude / codex CLIs (and API keys) the detector finds ready as DETECTED providers whenever no provider is configured by hand, and lets a -cli provider with no --bin fall back to the binary the detector found when PATH has none (a serve under launchd). off turns both off; `atlas llm detect` still runs on demand. `atlas llm off` writes off; `atlas llm detect --apply` clears it. |
| `ATLAS_LLM_DETECT_DIRS` | string | `built-in list` | yes | Directories the AI-provider detector searches for claude / codex after PATH, colon-separated (~ expanded). Set, it REPLACES the built-in list (~/.nvm/versions/node/*/bin, ~/.volta/bin, ~/.local/bin, /opt/homebrew/bin, /usr/local/bin, npm's global prefix, ~/.claude/local, /Applications/*.app/Contents/Resources) — for an unusual install, or to pin the search in CI. |
| `ATLAS_LLM_DETECT_IGNORE` | string | `none` | yes | Providers the user removed (`atlas llm off --provider`), comma-separated: neither the automatic detection nor a blanket `atlas llm detect --apply` registers them again. `atlas llm set --provider P` or `atlas llm detect --apply --provider P` (the System page's Use) takes one off the list. |
| `ATLAS_LLM_KEY_ENV` | string | `vendor default` | yes | First-release single-provider knob: NAME of the environment variable holding the DEFAULT provider's credential when its own ATLAS_LLM_<ID>_KEY_ENV is unset — never the credential itself. `atlas llm set` migrates a settings.json value into the default's scoped key. Empty = ANTHROPIC_API_KEY / OPENAI_API_KEY for the API providers, CLAUDE_CODE_OAUTH_TOKEN (a `claude setup-token` value) else the claude login for anthropic-cli, and the codex login for openai-cli. |
| `ATLAS_LLM_MODEL` | string | `provider default` | yes | First-release single-provider knob: the DEFAULT provider's model when its own ATLAS_LLM_<ID>_MODEL is unset — never another provider's. `atlas llm set` migrates a settings.json value into the default's scoped key. Passed through unchecked (any id the vendor accepts); empty = claude-sonnet-5 for anthropic/anthropic-cli, gpt-5.4 for openai, codex's own default for openai-cli. |
| `ATLAS_LLM_OPENAI_BIN` | string | `unused` | yes | Unused: the openai entry calls the vendor HTTPS API and runs no binary (kept so every entry has the same three fields). |
| `ATLAS_LLM_OPENAI_CLI_BIN` | string | `PATH, else detected` | yes | Path to the codex binary the openai-cli AI-answer entry runs. Written by `atlas llm set --provider openai-cli --bin`. Empty = found on PATH, else the binary the detector finds (~/.nvm, ~/.volta, ~/.local/bin, Homebrew, npm's global prefix, app bundles — the newest; ATLAS_LLM_DETECT=off disables that fallback) — a serve started by launchd or a container often has a narrower PATH than your shell. |
| `ATLAS_LLM_OPENAI_CLI_KEY_ENV` | string | `a stored key, else the codex login` | yes | NAME of the environment variable holding the openai-cli entry's credential — never the credential itself; a value shaped like a key is refused. Written by `atlas llm set --provider openai-cli --key-env`. Empty = a stored key, else the codex login. |
| `ATLAS_LLM_OPENAI_CLI_MODEL` | string | `codex's own default` | yes | Model id the openai-cli AI-answer entry asks OpenAI for, passed through unchecked (any id the vendor accepts). Written by `atlas llm set --provider openai-cli --model`. Empty = codex's own default. |
| `ATLAS_LLM_OPENAI_CLI_SOURCE` | enum | `user` | yes | "detected" when Atlas registered the openai-cli entry itself from what the detector found (zero configuration); unset = the user's entry. A detected entry may be updated by the detector (its binary path); a user entry never is. `atlas llm set --provider openai-cli` makes it the user's. |
| `ATLAS_LLM_OPENAI_KEY_ENV` | string | `OPENAI_API_KEY, else a stored key` | yes | NAME of the environment variable holding the openai entry's credential — never the credential itself; a value shaped like a key is refused. Written by `atlas llm set --provider openai --key-env`. Empty = OPENAI_API_KEY, else a stored key. |
| `ATLAS_LLM_OPENAI_MODEL` | string | `gpt-5.4` | yes | Model id the openai AI-answer entry asks OpenAI for, passed through unchecked (any id the vendor accepts). Written by `atlas llm set --provider openai --model`. Empty = gpt-5.4. |
| `ATLAS_LLM_OPENAI_SOURCE` | enum | `user` | yes | "detected" when Atlas registered the openai entry itself from what the detector found (zero configuration); unset = the user's entry. A detected entry may be updated by the detector (its binary path); a user entry never is. `atlas llm set --provider openai` makes it the user's. |
| `ATLAS_LLM_PROVIDER` | enum | `off` | yes | The DEFAULT provider for the Ask page's optional AI answer — the one that answers when a request names none: anthropic \| openai call the vendor HTTPS API with a key; anthropic-cli \| openai-cli drive the claude / codex binary on the user's own subscription login. Several providers can be configured at once (ATLAS_LLM_PROVIDERS, `atlas llm set`); this picks the default among them. Empty with no ATLAS_LLM_PROVIDERS = off: answers stay deterministic quoted passages. Only the retrieved passages and their paths are sent. |
| `ATLAS_LLM_PROVIDERS` | string | `none` | yes | Every configured AI-answer provider, comma-separated in the order added (anthropic, anthropic-cli, openai, openai-cli) — the registry a reader picks from on the Ask page. Each keeps its own model, key-variable NAME and binary in ATLAS_LLM_<ID>_MODEL / _KEY_ENV / _BIN. Written by `atlas llm set` / `off --provider`; ATLAS_LLM_PROVIDER names the default among them. |
| `ATLAS_LLM_SECRET_STORE` | enum | `auto` | yes | Where a provider key supplied explicitly (`atlas llm set --key-stdin`, PUT /api/v1/system/llm/secret, the System page form) is kept — never in settings.json: auto (default) = the macOS Keychain (service com.aziron.atlas.llm, account = the provider) on macOS, the Secret Service through secret-tool on Linux with a session bus, else the encrypted file store; keychain \| secret-tool \| file force one. The file store is $ATLAS_HOME/llm-secrets/<provider>, 0600, AES-256-GCM under a key derived from this machine's id and a salt kept beside it — it keeps keys out of backups, sync folders and a copied ATLAS_HOME, not away from processes running as this OS user. |

### Ask Workbench

See [Ask Workbench](workbench).

| Setting | Type | Default | Live | Description |
| --- | --- | --- | --- | --- |
| `ATLAS_WORKBENCH_ANSWER_EFFORT` | enum | unset | yes | The reasoning effort of every other Ask Workbench model call — an answer, the round after an asking one, the last round, a revision or a patch — on a transport that takes one: the claude CLI (anthropic-cli) as --effort, when the installed build advertises it; the API transports ignore it. meta.effort reports it when set. low \| medium \| high \| xhigh \| max; empty or default = the CLI's own default; invalid = empty. |
| `ATLAS_WORKBENCH_ANSWER_MAX_TOKENS` | int | `4000` | yes | The most tokens an Ask Workbench model reply may hold (the answer format: the model writes the whole answer, asked to stay under 900 words), sent as max_tokens on the API transports (anthropic, openai). The claude CLI (anthropic-cli) is not given it: it reads a cap per API request and continues past it (see Ask Workbench). 0 or invalid = 4000. |
| `ATLAS_WORKBENCH_ASK_EFFORT` | enum | `low` | yes | The reasoning effort of an Ask Workbench model call that only asks for context — the first call of a turn whose evidence holds nothing an answer could lead with (documents, nothing found), where the model decides what Atlas should fetch — on a transport that takes one: the claude CLI (anthropic-cli) as --effort, when the installed build advertises it; the API transports ignore it. meta.effort reports it. low \| medium \| high \| xhigh \| max, or default (none: the CLI's own); invalid = low. |
| `ATLAS_WORKBENCH_HISTORY_RUNES` | int | `4000` | yes | The ceiling, in characters (runes), on an Ask Workbench prompt's "Conversation so far" block: the oldest turns are dropped first, and a single turn longer than it is cut. done.history_runes reports the block's length. 0 = no block. Invalid values fall back to 4000. |
| `ATLAS_WORKBENCH_HISTORY_TURNS` | int | `6` | yes | How many earlier turns of a thread the server keeps an Ask Workbench model prompt reads, as its "Conversation so far" block (Q: the question / A: the verdict — up to 3 takeaways; for a turn the model answered in the answer format, A: the first 400 characters of its answer), oldest first. Context only, never evidence: every sentence still cites the turn's own evidence. done.history_turns reports what a turn carried. 0 = no block. Invalid values fall back to 6. |
| `ATLAS_WORKBENCH_MAX_EVIDENCE_TOKENS` | int | `24000` | yes | The evidence an Ask Workbench model prompt may carry, in tokens estimated at bytes/4. Past it the prompt is trimmed — what Atlas computed (the S items) first, then by lane priority (atlas, git/github, jira, pulse, confluence) — and every trimmed item is listed in merge.excluded with reason evidence_budget; the exact verdict still uses all evidence, and what the model asks for in a later round is added — a file it asks for gives up its last lines to keep the prompt within this budget, never below 150 lines, and says so. 0 or invalid = 24000. |
| `ATLAS_WORKBENCH_MODEL_FALLBACK` | enum | `auto` | yes | What an Ask Workbench turn does when the chosen model cannot run on this host (the provider's CLI is older than the model needs: GET /api/v1/system/llm marks it available:false). auto: known before the lanes run, the entry's configured model runs instead (plan.model.fallback_from); refused only at call time, the turn retries ONCE on the configured model (a second meta frame, done.model_fallback). off: no fallback — done.model_failed {code: llm_model_unsupported, installed_version, required_version, retry_with, fix} and the model turn is refunded. A request's model_fallback overrides it for one turn. |
| `ATLAS_WORKBENCH_MODEL_FORMAT` | enum | `answer` | yes | The reply an Ask Workbench model writes. answer (default): the model writes the answer in whatever shape the question calls for, citing the labelled evidence and what Atlas computed (S items), and may ask for more context (MORE: lines) and suggest follow-ups (NEXT: lines) — meta.format answer, plan.answer_mode model\|exact. chat: the earlier one-call format (EVIDENCE USED, then ANSWER; meta.format chat, delta.part), kept as a switch back. |
| `ATLAS_WORKBENCH_MODEL_REVISIONS` | int | `1` | yes | How many times one Ask Workbench answer may be written again. A model that answers AND asks for more (an answer-and-ask) gets what it asked for and writes the complete answer again — a full model call; the last allowed rewrite is told its MORE: lines are no longer read, and one that asks again is not fetched (done.more: "not fetched: one rewrite per turn"): the answer stands and what it asked for is offered as a suggestion. Request rounds (only MORE: lines) write no answer and are not counted. plan.revisions_max reports it. Clamped to [0, ATLAS_WORKBENCH_MODEL_ROUNDS − 1]; 0 = the first answer always stands; invalid = 1. |
| `ATLAS_WORKBENCH_MODEL_ROUNDS` | int | `3` | yes | How many model calls one Ask Workbench answer may make: the model answers in one, or — when it replies with MORE: lines (a symbol, a file, read whole up to 400 lines, a search, callers, a git blame, a ticket) — Atlas fetches what it asked for (at most 3 requests a round, each bounded to 2 s) and asks again with the new items, up to this many calls (the rewrites among them bounded by ATLAS_WORKBENCH_MODEL_REVISIONS). All of them are ONE model turn for the hourly budget; a request round past the last round or past ATLAS_WORKBENCH_HARD_BUDGET (Atlas's own time in the turn) is not fetched and the answer so far stands. plan.rounds_max reports it. 1 = the model is never asked again; clamped to [1, 6]; invalid = 3. |
| `ATLAS_WORKBENCH_MODEL_TURNS_PER_HOUR` | int | `30` | yes | How many Ask Workbench turns per bearer token per hour may call the AI model. Past it a turn still runs and returns the exact verdict, WITHOUT the model (plan.model.skipped = rate_limited); plan.budget shows the count. 0 = no model turns. Invalid values fall back to 30. |
| `ATLAS_WORKBENCH_TURNS_PER_HOUR` | int | `240` | yes | How many Ask Workbench turns per bearer token per hour the serve answers at all. Past it POST /api/v1/ask/workbench answers 429 workbench_rate_limited with retry_after (seconds until the window resets) before the stream. Invalid values fall back to 240. |
