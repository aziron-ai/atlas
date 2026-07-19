# CLI Reference

Run `atlas --help` and `atlas <command> --help` for the authoritative command
contract installed on the machine.

## Global Scope and Output

Common global controls:

```sh
atlas --repo /absolute/path status
atlas --db "sqlite:///absolute/path/.atlas/atlas.db" status
atlas --format json status
atlas --detail high symbol NewServer
```

Output formats include `plain`, `json`, `compact`, and `ndjson` where supported.
Detail levels are `low`, `medium`, `high`, and `xhigh`.

Use an explicit `--repo` or repository ID when a shared database contains more
than one repository.

## Index and Health

```sh
atlas index .
atlas index . --reindex
atlas index . --enable-vectors
atlas watch .
atlas status
atlas stats
atlas doctor
atlas report --format plain
```

## Search and Context

```sh
atlas search "authentication middleware" --mode lexical --format plain
atlas context \
  --paths internal/api/handler.go \
  --query "review correctness and regression risk" \
  --intent review
```

Use search for discovery. Use context when reviewing one or more changed paths
and you need bounded related code.

## Symbols and Relationships

```sh
atlas symbol NewServer
atlas snippet NewServer
atlas callers NewServer --limit 50
atlas refs NewServer
atlas path Handler ServeHTTP --max-depth 6
```

When a symbol name is overloaded, add package, receiver, or arity filters shown
by the command help.

## Impact and Routes

```sh
atlas impact --paths internal/api/handler.go --max-depth 3
atlas cross-repo-impact --paths internal/api/handler.go
atlas route-contracts
atlas consumers --max-staleness-days 30
atlas dependencies
```

Repository impact follows local code relationships. Cross-repository impact
depends on linked repositories and indexed service contracts.

## History and Snapshots

```sh
atlas history --limit 20
atlas snapshot-diff --from HEAD~1 --to HEAD
```

Snapshot availability depends on local retention and indexing history.

## MCP and Assistant Setup

```sh
atlas bootstrap --dry-run
atlas bootstrap
atlas install skill --agent codex,claude,claude-desktop
atlas mcp --transport stdio
atlas serve --mcp
atlas uninstall --dry-run
```

See [AI Assistant Setup](AI-Assistant-Setup) and [MCP Tools](MCP-Tools).

## Local Service

```sh
atlas serve
atlas serve --open=false --watch=false
atlas serve --mcp
```

The default local dashboard and API address is `127.0.0.1:3099`.

## Maintenance

```sh
atlas migrate
atlas compact
atlas compact --full
atlas repo rm owner/repository --yes
```

Stop long-running Atlas processes before exclusive maintenance. Back up the
complete `.atlas/` directory before destructive data operations.
