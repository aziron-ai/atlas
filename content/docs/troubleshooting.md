# Troubleshooting

Most Atlas failures are diagnosable from three read-only commands. Capture the
evidence first, then act.

## First Response

Before changing any local data, record the facts you will need to diagnose or
report the problem: the repository path, the database path, the Atlas version,
and the exact failing command. Then run:

```sh
atlas version
atlas status
atlas doctor
```

All three are read-only. If you skip this step and start deleting or
rebuilding, you destroy the evidence that distinguishes a schema problem from
a stale index from a wedged retrieval sidecar.

## Symptom to Action

Match your symptom, apply the action, and re-run the failing command. Details
for the harder cases follow the table.

| Symptom | Action |
| --- | --- |
| `atlas: command not found` | Check `command -v atlas` and `$PATH`; reinstall via your channel — `brew reinstall --cask aziron-ai/atlas/atlas` or `npm install -g @aziron/atlas` (verify `npm prefix -g` is on PATH) |
| Results are stale or from the wrong repository | `atlas index .` then `atlas status`; pin scope with `atlas --repo /absolute/path status`; if still stale, `atlas doctor` then `atlas index . --reindex` |
| `workspace_required` from MCP | Supply a workspace root, `workspace`, `repo_id`, or launch-time `--repo`. Atlas does not silently select a repository for scoped requests |
| SQLite is busy or locked | Stop `atlas serve`, `atlas watch`, and supervised MCP processes; inspect the owner with `lsof "$PWD/.atlas/atlas.db"`; run maintenance serially after all writers exit |
| Retrieval reports `sql_fallback` | The lexical (BM25) sidecar is empty or wedged while the graph stays readable. Run `atlas doctor` to confirm, stop other Atlas processes, then `atlas compact --rebuild-lexical` and re-check with `atlas doctor` |
| `index` warns `lexical sidecar unavailable, indexing without it` | A warning, not a failure — the graph indexed fine. Another Atlas process held the sidecar lock (~2s timeout). It self-heals via lazy backfill; or stop other Atlas processes and run `atlas compact --rebuild-lexical`. See **The lexical sidecar** below |
| Assistant does not list Atlas tools | `atlas bootstrap --dry-run` to preview, `atlas doctor --verify atlas` to check binary drift; apply `atlas bootstrap`, then fully restart the assistant |
| Doctor or status reports schema/index drift | `atlas migrate` applies storage migrations and reports the active contracts; confirm with `atlas status --schema`, then `atlas index . --reindex` if snapshot formats have drifted |
| Database keeps growing after deletions or reindexes | `atlas compact` reports reclaimable pages and truncates the WAL; `atlas compact --full` also runs a full VACUUM and rebuilds an oversized lexical sidecar. Both `--full` and `--rebuild-lexical` are exclusive — quiesce other Atlas processes first |
| Semantic search falls back to lexical | Expected when vectors are absent: reindex with `atlas index . --enable-vectors` and verify configuration with `atlas config list` |

Other known cases, kept brief:

- **npm binary download fails:** confirm the version exists on
  [GitHub Releases](https://github.com/aziron-ai/atlas/releases), check proxy
  and GitHub access, and pin a published version.
- **macOS blocks a manual binary:** prefer the Homebrew cask; for a trusted,
  checksum-verified binary run
  `xattr -dr com.apple.quarantine /usr/local/bin/atlas`.
- **MCP list is fast but calls are slow:** an index or exclusive maintenance
  task may be running — check `atlas status` and `atlas doctor`; disable
  duplicate watchers; adjust `ATLAS_MCP_CALL_TIMEOUT` only after confirming
  the root cause.
- **HTTP 401 or 403:** send `Authorization: Bearer $ATLAS_API_TOKEN`; for
  browser clients also configure `ATLAS_MCP_ALLOWED_ORIGINS`.
- **Port 3099 in use:** find the owner with
  `lsof -nP -iTCP:3099 -sTCP:LISTEN`; stop it or choose another address (see
  `atlas serve --help`).
- **`healthz` passes but `readyz` fails:** Atlas is running but cannot
  complete a lightweight engine request — look for an active index, database
  lock, or maintenance operation.

## The Lexical Sidecar (and the SQL Fallback)

Atlas keeps two things under `.atlas/`. The **graph database** (`atlas.db`,
SQLite) holds symbols, callers, references, routes, and change impact. A
separate **lexical sidecar** (`.atlas/lexical/`, a Bleve BM25 index) powers
fast text search. Graph queries never need the sidecar — only text and keyword
search does.

During `atlas index` you may see this line on stderr. It is a **warning, not a
failure** — the graph index still built:

```text
atlas: index <repo>: lexical sidecar unavailable, indexing without it (lazy backfill will heal): <reason>
```

- **Why it happens:** another Atlas process — a running `atlas serve`,
  `atlas watch`, or a supervised/stale MCP session — holds the sidecar's
  exclusive lock. Atlas waits about two seconds for it (a bounded lock timeout),
  then indexes *without* the sidecar rather than failing the whole run. The
  usual trigger is running `atlas index` by hand while a server is already
  watching the same repo.
- **What it means:** until the sidecar is populated, text search answers from a
  SQL scan instead of BM25. Those results are honestly labelled — `degraded:
  true` and `retrieval_mode: sql_fallback` — and are correct but slower and
  lower quality. Symbol, caller, ref, route, and impact queries are unaffected.
- **It heals on its own:** in serve/watch mode a lazy backfill rebuilds the
  sidecar once the lock frees. To fix it now, stop the other Atlas processes and
  run `atlas compact --rebuild-lexical`, then confirm with `atlas doctor`.
- **To avoid it:** do not run a manual `atlas index` while `serve`/`watch`/an
  MCP session holds the same `.atlas` — stop them first, or let the running
  server's watch pick up the change.

**Since 0.1.50, a sidecar that is merely un-compacted is reported separately.**
`atlas index --format json` ends with `lexical_settle`, and a value of
`partial` means the settle ran every step and then verified it had *not*
reached the steady state — the sidecar still holds obsolete document bytes a
compaction would reclaim. Search is correct and undegraded; only the
`lexical_bytes` figure is above steady state. Re-run the index on a quiet
machine, or run `atlas compact --rebuild-lexical`, before quoting a size.
`timeout` is the other non-steady state: raise
`ATLAS_LEXICAL_SETTLE_TIMEOUT` (default 30s) and re-run. Only `merged`
asserts a steady-state footprint.

**Why `atlas status` looked clean but `atlas doctor` caught it:** `atlas status`
reports **version and contract health only** — schema, index-format, lexical,
and MCP contract versions plus per-repo snapshot format. It never opens the
sidecar, so a wedged or empty sidecar leaves `status` green. `atlas doctor`
checks **runtime health**, opens the sidecar, and reports `lexical_degraded`
when it is empty or wedged. That split is by design: if search behaves oddly but
`status` is clean, run `atlas doctor`.

## Read the Diagnosis

Knowing what each diagnostic actually reports keeps you from applying the
wrong fix.

- **`atlas doctor`** reports Atlas upgrade health and the schema/index
  contract state. It also tells you when the lexical sidecar needs
  `atlas compact --rebuild-lexical` — the condition that otherwise degrades
  every search to SQL-only silently. It also reports `mcp_registrations` health — flagging assistant MCP configs that launch a nonexistent binary (broken now) or a version-pinned path that breaks on the next upgrade, with `atlas bootstrap` as the fix. Add `--deep` for a page-level integrity scan (`PRAGMA quick_check`) that catches on-disk corruption. Add `--verify atlas` to check binary
  drift: whether the `atlas` on PATH (what assistants launch) matches the
  running binary. Add `--all --root DIR` to scan every `.atlas/atlas.db`
  under a directory.
- **`atlas status`** reports storage/version health: the schema and
  index-format contracts plus per-repo snapshot format state. Add `--schema`
  to see the schema/index-format/lexical/MCP contract versions and per-repo
  snapshot format drift.
- **`atlas migrate`** is the corresponding fix for schema findings: it applies
  storage migrations and reports the active contracts. `--all --root DIR`
  migrates every local SQLite database under a directory.

## Logs and Telemetry

When you need runtime evidence rather than a health verdict, look here:

- **`atlas stats`** shows graph and index telemetry statistics for an indexed
  repository; `--limit` controls how many recent snapshot telemetry rows are
  returned (default 20).
- **Observability database:** telemetry is stored in `telemetry.db` beside the
  graph database by default; relocate it with `--telemetry-db PATH`. With
  `--read-only`, no `telemetry.db` is created unless you pass
  `--telemetry-db` explicitly.
- **`atlas sync status`** (connected fleets only) shows uplink configuration,
  kill switches, and per-stream cursors.

## Two Atlas Writers at Once

A different sidecar line means two Atlas processes raced to WRITE it:

```text
atlas: lexical segment-version probe failed (…: timeout) — opening anyway
```

This is writer-vs-writer contention — typically a manual `atlas index` while a
`serve` or `watch` daemon owns the same sidecar. It is a one-off warning and
self-heals exactly like the sidecar-unavailable case above: the run continues,
and the next uncontended index or `atlas compact --rebuild-lexical` restores
BM25. If it recurs constantly, quiesce the extra writer (stop the manual
reindex loop, or let the daemon own freshness).

## Silent Disk Corruption (and `doctor --deep`)

SQLite reads pages lazily, so a store with corrupted interior pages can keep
answering reads — `doctor`, `status`, and queries all look healthy — until the
next write fails with `database disk image is malformed (11)`. From v0.1.43,
`atlas doctor --deep` runs the page-level integrity scan (`PRAGMA
quick_check`) and escalates to `status: "db_corrupt"` with the damaged pages
named. It is a full-file scan (seconds on GB-scale stores), so it is opt-in —
run it when hardware, filesystem, or sync tooling is suspect. Recovery: restore
`.atlas` from a backup, or delete `.atlas` and run `atlas index --reindex`.

## Before Deleting Data

> **Warning:** Deleting `.atlas/` is irreversible and is almost never the
> right first move. Complete every step below before removing anything.

1. Stop every Atlas process.
2. Confirm the exact database and repository paths.
3. Back up the full `.atlas/` directory.
4. Run `atlas doctor`.
5. Attempt migration, lexical rebuild, or reindex first.

Delete local Atlas data only when a complete reset is intended. For the
removal procedure itself, see [Upgrade and Uninstall](upgrade). For index
behavior and reindex options, see [Indexing and Reindexing](indexing); for
assistant wiring, see [AI Assistant Setup](assistants); for knob provenance,
see [Configuration](configuration).
