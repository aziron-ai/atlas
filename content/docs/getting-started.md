# Getting Started

This guide creates a local Atlas index, runs the first queries, and prepares an
AI assistant integration.

## 1. Open a Repository

```sh
cd /path/to/repository
git status --short
```

Atlas uses the current repository when no explicit repository is supplied.

## 2. Create the Index

```sh
atlas index .
```

The command reports discovery and indexing progress. The default local database
is stored under:

```text
.atlas/atlas.db
```

The first index parses the repository. Later runs can update only changed
files.

## 3. Confirm Status

```sh
atlas status
atlas stats
```

Check the repository identity, indexed snapshot, file and symbol counts, and
retrieval health before relying on results.

## 4. Run the First Queries

```sh
atlas search "authentication middleware" --format plain
atlas symbol NewServer
atlas callers NewServer --limit 25
atlas refs NewServer
```

For change-review context:

```sh
atlas context \
  --paths path/to/changed-file.go \
  --query "review correctness and regression risk" \
  --format json
```

For likely impact:

```sh
atlas impact --paths path/to/changed-file.go
```

Use `atlas <command> --help` for version-specific flags.

## 5. Configure an AI Assistant

Preview detected integrations:

```sh
atlas bootstrap --dry-run
```

Apply the configuration:

```sh
atlas bootstrap
```

Restart the assistant after configuration changes. See
[AI Assistant Setup](AI-Assistant-Setup) for client-specific paths and modes.

## 6. Keep Results Fresh

Run an incremental update after important changes:

```sh
atlas index .
```

Use a forced rebuild only when the index format changed or troubleshooting
recommends it:

```sh
atlas index . --reindex
```

See [Indexing and Reindexing](Indexing-and-Reindexing) for exclusions, watch
mode, semantic retrieval, and recovery guidance.
