# AI Assistant Setup

Atlas registers its MCP server with Claude CLI, Claude Desktop, Codex, Cursor,
Gemini, and GitHub Copilot, so any of these assistants can query your local
code graph. This page covers automatic setup, repository-pinned setup, git
hooks, verification, and removal. For what the tools return once connected,
see [MCP Tools](mcp).

## Automatic Setup with Bootstrap

Use bootstrap when you want every detected assistant provisioned in one pass.
In managed environments, always preview first:

```sh
atlas bootstrap --dry-run
```

Apply the changes:

```sh
atlas bootstrap
```

Restrict provisioning to selected clients, or exclude some:

```sh
atlas bootstrap --only codex,claude,claude-desktop
atlas bootstrap --skip cursor
```

Restart each assistant after its MCP configuration changes; most clients read
MCP configuration only at startup.

### What Bootstrap Writes

Bootstrap registers Atlas as an MCP server and installs the atlas-first skill
plus a CLAUDE.md directive for all detected assistants. It bakes the absolute
binary path into each config and registers the supervised gateway with no
`--db`, so the workspace is resolved at query time rather than pinned at
install time. The command merges the existing atlas entry rather than replacing it, so a `--db` pin, extra args, or an `env` block you configured are preserved. It is idempotent: safe to run repeatedly and from
a package post-install hook. Use `--home` to override the home directory base
when provisioning a different account's configuration.

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
runtime. Repository-scoped MCP tools still require one of:

- a workspace root supplied by the client
- a `workspace` argument
- a repository ID
- a repository pinned when MCP starts

If none is available, Atlas returns `workspace_required` instead of selecting
a repository silently.

## Shared Local Server

Use one local service when multiple thin clients should share a single index
and watcher:

```sh
atlas serve --mcp

atlas install skill \
  --agent codex,claude,claude-desktop \
  --repo "$PWD" \
  --server-url http://127.0.0.1:3099
```

Use a token before exposing the service beyond loopback. See
[Dashboard and HTTP API](service).

## Keep the Graph Fresh with a Git Hook

Install a local git hook when you want the index updated as part of your
normal git workflow rather than by a running watcher:

```sh
atlas install hook
```

The hook keeps the Atlas graph fresh in the repository where it is installed.

## Client Configuration Locations

Check these paths when auditing what setup wrote or when a client does not
pick up the server:

| Client | Typical location |
| --- | --- |
| Codex | `~/.codex/config.toml` |
| Claude CLI | `~/.claude.json` |
| Claude Desktop on macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |

Atlas preserves unrelated client configuration. Always review a dry run before
applying changes in managed environments.

## Verify

Confirm the integration end to end before relying on it:

```sh
atlas doctor --verify atlas
atlas status
atlas bootstrap --dry-run
```

`doctor --verify atlas` also checks for binary drift: whether the `atlas` on
`PATH` — what assistants launch via `command:"atlas"` — matches the running
binary. Then ask the assistant a repository-specific question and confirm that
the answer includes source file and line references.

## Remove the Integration

Preview removal, then apply it:

```sh
atlas uninstall --dry-run
atlas uninstall
```

Uninstall reverses `atlas bootstrap` across every assistant it provisions: it
removes the atlas MCP server entry from each config, the atlas skill markdown,
and the atlas-managed block in the global CLAUDE.md. Nothing else is touched —
other MCP servers, unrelated config keys, and your own CLAUDE.md content
outside the atlas markers are preserved. Re-running reports `absent` and
writes nothing. By default repository indexes are not deleted; `atlas uninstall --purge` also removes the `.atlas` index directories (global `~/.atlas` + every registry repo root), printing the blast radius and total reclaimed first and requiring confirmation (`--yes` to skip, `--dry-run` to preview). See
[Privacy and Data Handling](privacy) for data removal.
