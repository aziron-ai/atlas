# Troubleshooting

Start with:

```sh
atlas version
atlas status
atlas doctor
```

Record the repository path, database path, Atlas version, and exact command
before changing data.

## Installation

### `atlas: command not found`

```sh
command -v atlas
echo "$PATH"
```

For Homebrew:

```sh
brew list --cask atlas
brew reinstall --cask aziron-ai/atlas/atlas
```

For npm:

```sh
npm prefix -g
npm install -g @aziron/atlas
```

### npm binary download fails

Confirm the requested version exists on
[GitHub Releases](https://github.com/aziron-ai/atlas/releases), then check
proxy and GitHub access. Pin a published version instead of a version that is
still being released.

### macOS blocks a manual binary

Prefer the Homebrew cask. For a trusted, checksum-verified manual binary:

```sh
xattr -dr com.apple.quarantine /usr/local/bin/atlas
```

## Repository and Freshness

### Results come from the wrong repository

Pin scope:

```sh
atlas --repo /absolute/path status
```

For a shared database, use the repository ID shown by `atlas status`.

### Results are stale

```sh
atlas index .
atlas status
```

If the status remains stale:

```sh
atlas doctor
atlas index . --reindex
```

### `workspace_required` from MCP

Supply a workspace root, `workspace`, `repo_id`, or launch-time `--repo`.
Atlas does not silently select a repository for scoped requests.

## Database and Retrieval

### SQLite is busy or locked

Stop `atlas serve`, `atlas watch`, and supervised MCP processes. Inspect the
owner:

```sh
lsof "$PWD/.atlas/atlas.db"
```

Run maintenance serially after all writers exit.

### Retrieval reports `sql_fallback`

This usually means supporting lexical retrieval is unavailable while the graph
database is still readable:

```sh
atlas doctor
atlas compact --rebuild-lexical
atlas status
```

Stop competing Atlas processes before rebuilding retrieval data.

### Upgrade reports schema or index drift

```sh
atlas migrate
atlas status --schema
atlas index . --reindex
```

Back up `.atlas/` before migration or downgrade testing.

### Semantic search falls back to lexical

```sh
atlas index . --enable-vectors
atlas status
```

Also verify semantic retrieval configuration with `atlas config list`.

## MCP and Assistants

### Assistant does not list Atlas tools

```sh
atlas bootstrap --dry-run
atlas doctor --verify atlas
```

Apply bootstrap if needed, then fully restart the assistant.

### MCP list is fast but calls are slow

An index or exclusive maintenance task may be running:

```sh
atlas status
atlas doctor
```

Wait for indexing, disable duplicate watchers, or adjust
`ATLAS_MCP_CALL_TIMEOUT` only after confirming the root cause.

### HTTP 401 or 403

Supply the bearer token:

```sh
curl \
  -H "Authorization: Bearer $ATLAS_API_TOKEN" \
  http://127.0.0.1:3099/api/v1/status
```

For browser clients, also configure `ATLAS_MCP_ALLOWED_ORIGINS`.

## Server

### Port 3099 is already in use

```sh
lsof -nP -iTCP:3099 -sTCP:LISTEN
```

Stop the existing process or select another address with `atlas serve --help`.

### `healthz` passes but `readyz` fails

Atlas is running but cannot complete a lightweight engine request. Check for an
active index, database lock, or maintenance operation.

## Before Deleting Data

1. Stop every Atlas process.
2. Confirm the exact database and repository paths.
3. Back up the full `.atlas/` directory.
4. Run `atlas doctor`.
5. Attempt migration, lexical rebuild, or reindex first.

Delete local Atlas data only when a complete reset is intended.
