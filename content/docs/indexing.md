# Indexing and Reindexing

Atlas answers are only as current as the selected index. This guide explains
normal updates, forced rebuilds, exclusions, and freshness checks.

## Initial Index

From a repository root:

```sh
atlas index .
```

To use an explicit database:

```sh
atlas --db "sqlite://$PWD/.atlas/atlas.db" index .
```

## Incremental Update

Run the same command after source changes:

```sh
atlas index .
```

Atlas may report a delta update when files changed or a no-op when the stored
snapshot already matches the workspace.

## Forced Reindex

```sh
atlas index . --reindex
```

Use a full rebuild when:

- an upgrade reports an incompatible or stale index format
- parser or language support changed and old files must be reparsed
- `atlas doctor` recommends a rebuild
- the workspace identity or indexed root was incorrect
- focused troubleshooting confirms the current index is incomplete

Do not make forced reindexing the default workflow. It is slower and discards
the benefit of incremental updates.

## Watch Mode

Keep a foreground index current:

```sh
atlas watch .
```

Supervised MCP can also maintain freshness:

```sh
atlas mcp --supervise
```

Disable automatic watching when another process owns indexing:

```sh
atlas mcp --supervise --watch=false
```

## Semantic Retrieval

Semantic vectors are optional:

```sh
atlas index . --enable-vectors
```

If vectors are disabled or unavailable, Atlas can continue with lexical and
graph-backed retrieval. Confirm the active mode with `atlas status` or
`atlas doctor`.

## Excluding Files

Atlas respects `.gitignore` by default. Add Atlas-specific patterns to:

```text
.atlasignore
```

Avoid indexing generated outputs, dependency caches, benchmark working copies,
or nested repository snapshots unless they are intentionally part of the
review surface.

## Verify Freshness

```sh
atlas status
atlas stats
atlas doctor
```

When multiple repositories or databases exist, pin both:

```sh
atlas --db "sqlite:///absolute/path/.atlas/atlas.db" \
  --repo /absolute/path status
```

If a running Atlas server is configured, CLI queries may use that server.
Unset `ATLAS_SERVER_URL` or pin an explicit database while diagnosing which
index is answering.

## Safe Recovery Order

1. Stop active `serve`, `watch`, and supervised MCP processes.
2. Run `atlas status` and `atlas doctor`.
3. Confirm the repository and database paths.
4. Run `atlas migrate` when a schema upgrade is required.
5. Rebuild lexical data only when recommended.
6. Run `atlas index . --reindex` as the final non-destructive repair.
7. Delete `.atlas` only when a complete data reset is intended.

See [Troubleshooting](Troubleshooting) before removing data.
