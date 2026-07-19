# Configuration

Use the CLI to inspect version-specific settings:

```sh
atlas config list
atlas config get ATLAS_MAX_DB_BYTES
```

Persist a setting:

```sh
atlas config set ATLAS_MAX_DB_BYTES 10GiB
```

Clear a persisted override:

```sh
atlas config set ATLAS_MAX_DB_BYTES ""
```

## Precedence

Configuration precedence is:

1. environment variable
2. repository `.atlas/settings.json`
3. compiled default

Environment variables are appropriate for automation and containers.
Repository settings are appropriate for stable local policy.

## Common Controls

| Setting | Purpose |
| --- | --- |
| `ATLAS_ENABLE_VECTORS` | Enable optional semantic retrieval |
| `ATLAS_EMBED_URL` | Configure an embedding endpoint when used |
| `ATLAS_NO_WATCH` | Disable automatic file watching |
| `ATLAS_WATCH_MODE` | Select the watcher mode, including polling |
| `ATLAS_MEMORY_LIMIT` | Bound Atlas memory use |
| `ATLAS_GOGC` | Tune Go garbage collection |
| `ATLAS_MCP_CALL_TIMEOUT` | Bound an MCP tool call |
| `ATLAS_API_TOKEN` | Protect HTTP API and MCP access |
| `ATLAS_MCP_ALLOWED_ORIGINS` | Allow additional browser origins |
| `ATLAS_SERVER_URL` | Route compatible CLI operations through a server |

Run `atlas config list` for current names, defaults, descriptions, and accepted
values.

## Database Selection

Default repository-local database:

```text
sqlite://./.atlas/atlas.db
```

Explicit database:

```sh
atlas --db "sqlite:///absolute/path/.atlas/atlas.db" status
```

Use absolute database paths in assistant configuration to avoid resolving a
relative path from the assistant's process directory.

## Resource-Constrained Environments

Start with:

```sh
export ATLAS_MEMORY_LIMIT=2GiB
export ATLAS_NO_WATCH=1
atlas index .
```

For very large repositories, exclude generated files and dependency caches
before increasing limits. Confirm behavior with `atlas status`, `atlas stats`,
and `atlas doctor`.
