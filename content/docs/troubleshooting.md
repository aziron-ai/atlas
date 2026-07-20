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
| `atlas: command not found` | Check `command -v atlas` and `$PATH`; reinstall via your channel — `brew reinstall --cask aziron-ai/atlas/atlas` or `npm install -g @aziron-ai/atlas` (verify `npm prefix -g` is on PATH) |
| Results are stale or from the wrong repository | `atlas index .` then `atlas status`; pin scope with `atlas --repo /absolute/path status`; if still stale, `atlas doctor` then `atlas index . --reindex` |
| `workspace_required` from MCP | Supply a workspace root, `workspace`, `repo_id`, or launch-time `--repo`. Atlas does not silently select a repository for scoped requests |
| SQLite is busy or locked | Stop `atlas serve`, `atlas watch`, and supervised MCP processes; inspect the owner with `lsof "$PWD/.atlas/atlas.db"`; run maintenance serially after all writers exit |
| Retrieval reports `sql_fallback` | The lexical (BM25) sidecar is empty or wedged while the graph stays readable. Run `atlas doctor` to confirm, stop other Atlas processes, then `atlas compact --rebuild-lexical` and re-check `atlas status` |
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

## Read the Diagnosis

Knowing what each diagnostic actually reports keeps you from applying the
wrong fix.

- **`atlas doctor`** reports Atlas upgrade health and the schema/index
  contract state. It also tells you when the lexical sidecar needs
  `atlas compact --rebuild-lexical` — the condition that otherwise degrades
  every search to SQL-only silently. Add `--verify atlas` to check binary
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
