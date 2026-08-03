# Indexing and Reindexing

Atlas answers are only as current as the selected index. This guide covers
creating and updating an index, forcing a rebuild, keeping the graph fresh
automatically, controlling what gets indexed, and maintaining the database
that stores it. For what the graph contains, see [Core Concepts](concepts).

## Create or Update an Index

Run this once to build the graph, and again whenever you want to refresh it —
the same command handles both cases. From a repository root:

```sh
atlas index .
```

To pin an explicit database instead of the default `sqlite://./.atlas/atlas.db`:

```sh
atlas --db "sqlite:///absolute/path/.atlas/atlas.db" index .
```

`atlas index` parses symbols, edges, and routes, then persists the graph and
the lexical search index. By default it indexes the working tree; use
`--ref COMMIT_OR_BRANCH` to index a specific commit or branch instead.

## What Index Output Reports

Read the index output to confirm what actually happened rather than assuming.
With `--progress` (on by default for human output), Atlas prints start,
periodic progress, and completion statistics to stderr. A run reports a delta
update when files changed, or a no-op when the stored snapshot already
matches the workspace. For profiling an index run, `--cpuprofile PATH` and
`--memprofile PATH` write runtime/pprof profiles.

**Since 0.1.48, `atlas index --format json` also reports what the run did
internally**, so you can verify the fast paths engaged instead of inferring it
from a stopwatch:

```json
{
  "mode": "delta",
  "persist_mode": "delta",
  "persist_path": "sql",
  "delta_base": "dc4dc4ba86e307b8875a4c0b0623b628445d6274",
  "files_reparsed": 1,
  "lexical_bytes": 290368,
  "lexical_settle": "merged"
}
```

| Field | Values | What it tells you |
| --- | --- | --- |
| `persist_mode` | `full`, `delta`, `noop` | which mode the run resolved to. `noop` means the working tree already matched the stored snapshot |
| `persist_path` | `sql`, `sql_new_commit`, `whole_graph`, `full_walk`, `full_stream`, `noop` | the decisive one. `sql` and `sql_new_commit` are the O(change) paths — the base graph is never loaded into memory. `whole_graph` is the correctness fallback: a delta by mode, a full index by memory |
| `delta_base`, `delta_base_snapshot` | commit SHA, snapshot id | which snapshot the run built on, so a ladder of runs is pinnable |
| `files_reparsed` | integer | defined for every mode: changed plus added on a delta, every indexed file on a full run, `0` on a no-op |
| `lexical_bytes` | integer | the on-disk size of `.atlas/lexical` after the run settled it. This should match a `du` taken the instant `index` returns; a mismatch is a bug report, not a measurement |
| `lexical_settle` | see below | how the sidecar reached the size reported in `lexical_bytes` |

### Lexical Settle States

The lexical (BM25) sidecar writes new segments and supersedes old ones
asynchronously, so a footprint measured the moment an index returns used to
read far above the steady state. Since 0.1.48 `atlas index` settles the
sidecar before it returns — a bounded segment merge, then a reclaiming reopen
— and reports how that went. The settle never changes the document set and
never fails a run; every failure mode degrades to a disclosed state.

| State | Meaning |
| --- | --- |
| `merged` | the merge completed and superseded segments were reclaimed. **Only this state asserts a steady-state footprint** |
| `reclaimed` | the merge was skipped or declined, but the reclaim ran. Superseded segments are gone; unmerged ones may remain |
| `partial` | every step ran and reported success, and then the check found the sidecar still holding obsolete document bytes a compaction would reclaim — a contended machine can leave a whole superseded generation inside one segment, which the engine declines to re-merge. The reported footprint is **above** steady state. Re-run on a quiet machine, or run `atlas compact --rebuild-lexical`, before quoting a size |
| `timeout` | the merge did not finish inside its budget, so the reclaim was deliberately not attempted and the footprint may hold both unmerged and superseded segments. Raise `ATLAS_LEXICAL_SETTLE_TIMEOUT` (default 30s) and re-run |
| `skipped` | there was nothing to settle: no sidecar, or this run wrote no documents |
| `failed` | the settle itself errored; the reason is on stderr and the footprint is still reported |
| `off` | disabled with `ATLAS_LEXICAL_SETTLE=off` |

Set `ATLAS_LEXICAL_SETTLE=reclaim` to skip the merge and only reclaim — the
cheaper mode for very large sidecars where a single-segment merge is not worth
its write amplification.

## Incremental Behavior

Incremental updates are the default because they are much faster than full
rebuilds: Atlas computes a delta against the previous snapshot and reindexes
only what changed. To diff against a specific commit rather than the stored
base, pass `--base COMMIT`.

## Forced Rebuild

Use `--reindex` only when the incremental path cannot repair the index:

```sh
atlas index . --reindex
```

The legitimate reasons for a full rebuild are:

1. An upgrade reports an incompatible or stale index format, or
   `atlas doctor` recommends a rebuild.
2. Parser or language support changed and old files must be reparsed.
3. The workspace identity or indexed root was incorrect, or focused
   troubleshooting confirms the current index is incomplete.

Do not make forced reindexing the default workflow. It is slower and discards
the benefit of incremental updates.

## Watch Mode

Use watch mode when you want the graph to stay fresh during active editing
with no manual `atlas index` runs. `atlas watch` indexes the repo once, then
watches the working tree and runs an incremental, working-tree-aware update on
every file change. A burst of edits is coalesced into one update
(`--debounce-ms`, default 250). It runs in the foreground until interrupted.

```sh
atlas watch .
```

The MCP and HTTP surfaces maintain freshness the same way — `atlas mcp` and
`atlas serve` watch the repo by default. Disable watching when another process
owns indexing:

```sh
atlas mcp --supervise --watch=false   # or set ATLAS_NO_WATCH=1
```

## Semantic Vectors (Optional)

Enable vectors only if you want embedding-based retrieval; the deterministic
lexical and graph core never depends on them. Run the optional embedding pass
at index time:

```sh
atlas index . --enable-vectors
atlas watch . --enable-vectors   # keep embeddings fresh on each update
```

With vectors enabled (`ATLAS_ENABLE_VECTORS=1` and a repo indexed with
`--enable-vectors`), `atlas semantic-search` returns nearest symbols by cosine
similarity. Otherwise it transparently degrades to lexical search and reports
`degraded=true` / `mode_used=lexical`. By default the embedder is offline
(deterministic token overlap); set `ATLAS_EMBED_URL` to use a real embedding
model. See [Configuration](configuration).

## Excluding Files

Exclude generated outputs, dependency caches, and nested repository snapshots
so they do not pollute search results. Atlas skips paths git ignores by
default (`--gitignore`, default true); pass `--gitignore=false` to index
everything. Add Atlas-specific patterns to:

```text
.atlasignore
```

## Registering Without Indexing

Use `atlas link` when a repo should participate in cross-repo queries and
appear in `atlas status` before (or without) being indexed on this machine:

```sh
atlas link org/name --branch main
```

`REPO` may be a filesystem path, a git remote URL, or a bare `org/name`.
Linking is idempotent — re-linking updates the registration and reports
`created=false`. Linking does not populate the graph; run `atlas index` for
that. To remove a repo from the registry, `atlas repo rm` forgets it entirely:
snapshots, symbols, edges, embeddings, and lexical documents.

## Performance Envelope

**Since 0.1.48, resource use is a profile decision first.** Atlas detects a
machine profile — `eco`, `balanced`, `performance`, or `turbo` — and sizes
indexing to it. The individual knobs below all still work and all still win
over the tier; they are overrides, not the primary control. Pin a tier with
`ATLAS_PROFILE` and read back what it installed with `atlas doctor`; the
tiers, their values, and the auto-detection rules are in
[Configuration](configuration).

The one rule that matters most while indexing: **`balanced` bounds background
work, not the index you are waiting on.** A watch-triggered refresh or an MCP
lazy index runs inside a warm daemon and takes 3/4 of the cores under a
`RAM/4` soft heap limit; an explicit `atlas index` you typed runs at full
width with no ceiling. `eco` is deliberately not scoped that way — on a
genuinely low-spec box it throttles foreground indexes too, because that is
the case it exists to protect.

Behaviors worth knowing on large or memory-constrained machines:

- **Streaming index (v0.1.42+).** Full indexes of repos over ~15,000 candidate
  files automatically stream in bounded batches instead of holding the whole
  graph in memory — the Linux kernel (81k files, 1.86M symbols, 6.8M edges)
  indexes at ~1.3 GiB peak RSS. Force it at any size with
  `ATLAS_STREAM_INDEX=1` (or off with `0`); tune with
  `ATLAS_STREAM_INDEX_THRESHOLD` and `ATLAS_STREAM_INDEX_BATCH`.
- **CPU ceiling (v0.1.43+; an override since 0.1.48).** With no profile bound
  in force the parse/hash pool uses all cores, so a large index can saturate
  the machine (a Chromium index drove one reporter's CPU past 300%). Cap it
  explicitly with `atlas index --workers N` or `ATLAS_INDEX_WORKERS` — e.g.
  `--workers 4` trades a little wall-time for headroom, and `1` pins the run
  to a single core. An explicit value always beats the tier's worker count.
  (Go repos also run `go/types`, which spawns its own compilers outside this
  pool; C/C++/other tree-sitter languages are fully bounded by it.)
- **Memory ceiling (an override since 0.1.48).** `ATLAS_MEMORY_LIMIT` and
  `ATLAS_GOGC` bound the Go runtime directly and override whatever the tier
  would have set — the right tool for a container with a hard cgroup limit,
  where you want a specific number rather than a fraction of host RAM.
- **Deletions cost more than edits.** Adding or modifying files takes the
  scoped delta path (sub-second, tens of MB). Deleting a Go file currently
  forces the whole-module type-check fallback — correctness requires
  re-deriving reverse-dependency edges — so a delete delta can approach
  cold-build time and RAM on Go-heavy repos. A scoped-deletion analyzer is
  planned; until then, batch deletions together when you can.

## Database Maintenance

Run maintenance when the database has grown or after an Atlas upgrade.

- `atlas compact` reports reclaimable pages and truncates the WAL. Modern
  Atlas databases use online incremental auto-vacuum; legacy databases are
  converted with a one-time full VACUUM that takes an exclusive lock — stop
  `atlas serve` and watch processes first, or you get a lock error rather
  than partial work.
- `atlas compact --full` additionally runs a full VACUUM and rebuilds the
  lexical (BM25) sidecar when it has outgrown its size bound — the only way
  dead segments are returned to the OS. Exclusive: quiesce other Atlas
  processes first.
- `atlas compact --rebuild-lexical` rebuilds the lexical sidecar regardless of
  size — the fix for an empty or wedged sidecar, which otherwise silently
  degrades every search to SQL-only. `atlas doctor` reports when you need it.
- `atlas migrate` applies storage migrations and reports the active contracts.
  Both `migrate` and `compact` accept `--all --root DIR` to process every
  local `.atlas/atlas.db` under a directory.

## Verify Freshness

Confirm which index is answering before trusting results:

```sh
atlas status
atlas stats
atlas doctor
```

When multiple repositories or databases exist, pin both `--db` and `--repo`.
If a running Atlas server is configured, CLI queries may use that server —
unset `ATLAS_SERVER_URL` or pin an explicit database while diagnosing.

## Safe Recovery Order

Follow this order so you never destroy data a cheaper step could have fixed:

1. Stop active `serve`, `watch`, and supervised MCP processes.
2. Run `atlas status` and `atlas doctor`.
3. Confirm the repository and database paths.
4. Run `atlas migrate` when a schema upgrade is required.
5. Rebuild lexical data only when recommended.
6. Run `atlas index . --reindex` as the final non-destructive repair.
7. Delete `.atlas` only when a complete data reset is intended.

See [Troubleshooting](troubleshooting) before removing data.
