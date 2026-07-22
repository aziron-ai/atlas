# Privacy and Data Handling

Atlas indexes and queries your code locally by default; nothing leaves the
machine unless you deliberately turn on a network feature. This page defines
that boundary, what is stored where, how to run Atlas in audit-grade
read-only mode, and which features are opt-in.

## What "Local by Default" Means

Use this section to establish the baseline before granting any access:

- Source files are read from the selected workspace.
- The default index is stored in that workspace under `.atlas/`.
- CLI queries and stdio MCP do not require a hosted Atlas service.
- The local dashboard and API bind to loopback by default.

This does not mean every tool connected to Atlas is offline. A coding
assistant may forward the snippets Atlas returns over MCP to its configured
model provider, subject to that client's settings and data policy.

## What Is Stored Where

Know the on-disk layout before backing up, moving, or deleting an index. The
`.atlas/` directory can contain the graph database (`atlas.db` by default),
supporting retrieval data, settings, telemetry, and transient SQLite files
(WAL/journal). Treat the directory as one data set: copy, back up, or delete
it as a unit.

Stop active Atlas processes (`atlas serve`, `atlas watch`, MCP with `--watch`)
before copying, compacting, or deleting local data.

## Read-Only Mode for Audit-Grade Use

Use `--read-only` when queries must provably not modify the artifact — for
example when examining a database captured as evidence or shared by another
team. The flag opens the database immutably:

- no migration runs
- no WAL or journal files are created
- no `telemetry.db` is created next to the graph database
- artifact bytes hash identically after any query
- a missing database errors instead of being created

```sh
atlas status --read-only --db "sqlite:///path/to/copy/atlas.db"
```

## Telemetry

Local observability data is kept separate from the graph. By default it lives
in `telemetry.db` beside the graph database; set an explicit location with
`--telemetry-db PATH`. With `--read-only`, no telemetry database is created —
if you want telemetry in that mode, you must pass `--telemetry-db` explicitly.

## Fleet Features Are Opt-In

Nothing is uplinked unless you run `atlas connect`. Connecting registers the
machine with a central Atlas server under a stable device identity, writes
`~/.atlas/config.json`, and installs the Claude/Codex capture hooks
(`--no-hooks` to skip). There is no default hub: the server URL comes from the
explicit argument, `ATLAS_SYNC_SERVER`, or the URL the machine is already
connected to.

What leaves the machine is governed by the data level:

| `--level` | Shares |
| --- | --- |
| `off` | Nothing |
| `telemetry` | Metrics only |
| `interactions` | Normalized prompts + redacted traces (the default) |
| `full` | Raw prompts (org opt-in) |

Raw transcripts, tool outputs, answers, and secrets never leave the machine at
any level. Inspect and drive the uplink explicitly:

```sh
atlas sync status
atlas sync now
```

`sync status` shows uplink configuration, kill switches, and per-stream
cursors; `sync now` pushes all pending telemetry once. To leave the fleet and
remove the capture hooks:

```sh
atlas disconnect
```

## Before Enabling Network Access

Review this checklist before binding the service beyond loopback:

- the bind address
- API authentication
- allowed browser origins
- reverse-proxy TLS
- the data policy of connected assistants and model providers
- any optional embedding or organization-connected service

Protect non-loopback service access:

```sh
export ATLAS_API_TOKEN='replace-with-a-strong-token'
export ATLAS_MCP_ALLOWED_ORIGINS='https://trusted.example'
atlas serve --mcp --addr 0.0.0.0:3099
```

Do not commit tokens to repository settings or shell scripts. See
[Dashboard and HTTP API](service) for token and TLS details.

## Data Removal

Remove Atlas-managed assistant configuration first:

```sh
atlas uninstall --dry-run
atlas uninstall
```

Package removal does not automatically delete repository indexes; delete the
`.atlas/` directory (with Atlas processes stopped) to remove an index, or use
`atlas uninstall --purge` to delete the index databases automatically (the global `~/.atlas` and every registry-known repo's `.atlas`, with a blast-radius report and confirmation), or `atlas repo rm` to forget one repository's snapshots, symbols, edges,
embeddings, and lexical documents from a shared database.

## Shared and Connected Environments

When multiple users or repositories share an Atlas service:

- declare repository scope explicitly
- authenticate every network client
- restrict browser origins
- define retention and backup policy
- avoid mounting sensitive repositories into an index intended for a broader
  audience

Atlas documentation describes product behavior, but the operator remains
responsible for the policies of connected assistants, networks, and storage.
