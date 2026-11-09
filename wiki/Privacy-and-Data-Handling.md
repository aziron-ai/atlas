# Privacy and Data Handling

Atlas indexing and querying run locally by default. The default repository
index is stored under:

```text
.atlas/
```

## What "Local by Default" Means

- Source files are read from the selected workspace.
- The default index is stored in that workspace.
- CLI queries and stdio MCP do not require a hosted Atlas service.
- A local dashboard and API bind to loopback by default.

This does not mean every tool connected to Atlas is offline. A coding assistant
may send the snippets returned by MCP to its configured model provider, subject
to that client's settings and data policy.

## Before Enabling Network Features

Review:

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

Do not commit tokens to repository settings or shell scripts.

## Local Data

The `.atlas/` directory can contain the graph database, supporting retrieval
data, settings, telemetry, and transient SQLite files. Treat the directory as
one data set when backing up or moving an index.

Stop active Atlas processes before copying, compacting, or deleting local data.

## Data Removal

Remove Atlas-managed assistant configuration first:

```sh
atlas uninstall --dry-run
atlas uninstall
```

Package removal does not automatically delete repository indexes. See
[Upgrade and Uninstall](Upgrade-and-Uninstall) for explicit data-removal steps.

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
