# AI Assistant Setup

Atlas can register its MCP server with Claude CLI, Claude Desktop, Codex,
Cursor, Gemini, and GitHub Copilot. Client behavior and supported transport
modes vary.

## Automatic Setup

Preview all detected changes:

```sh
atlas bootstrap --dry-run
```

Apply them:

```sh
atlas bootstrap
```

Restrict setup to selected clients:

```sh
atlas bootstrap --only codex,claude,claude-desktop
```

Restart each assistant after changing its MCP configuration.

## Repository-Pinned Setup

Use a repository-pinned local MCP configuration when one assistant should
always query one index:

```sh
cd /path/to/repository
atlas index .

atlas install skill \
  --agent codex,claude,claude-desktop \
  --repo "$PWD" \
  --db "sqlite://$PWD/.atlas/atlas.db" \
  --server-url=none
```

## Dynamic Workspace Setup

Bootstrap is appropriate when the assistant supplies the active workspace at
runtime:

```sh
atlas bootstrap
```

Repository-scoped MCP tools still require one of:

- a workspace root supplied by the client
- a `workspace` argument
- a repository ID
- a repository pinned when MCP starts

If none is available, Atlas returns `workspace_required` instead of selecting a
repository silently.

## Shared Local Server

For multiple thin clients using one local service:

```sh
atlas serve --mcp --open=false

atlas install skill \
  --agent codex,claude,claude-desktop \
  --repo "$PWD" \
  --server-url http://127.0.0.1:3099
```

Use a token before exposing the service beyond loopback. See
[Dashboard and HTTP API](Dashboard-and-HTTP-API).

## Common Configuration Locations

| Client | Typical location |
| --- | --- |
| Codex | `~/.codex/config.toml` |
| Claude CLI | `~/.claude.json` |
| Claude Desktop on macOS | `~/Library/Application Support/Claude/` |

The Claude Desktop configuration filename is
`claude_desktop_config.json`.

Atlas preserves unrelated client configuration. Always review a dry run before
applying changes in managed environments.

## Verify

```sh
atlas doctor --verify atlas
atlas status
atlas bootstrap --dry-run
```

Then ask the assistant a repository-specific question and confirm that the
answer includes source file and line references.

## Remove Integration

Preview removal:

```sh
atlas uninstall --dry-run
```

Apply removal:

```sh
atlas uninstall
```

This removes Atlas-managed assistant entries and skills. It does not remove
unrelated assistant configuration or repository indexes.
