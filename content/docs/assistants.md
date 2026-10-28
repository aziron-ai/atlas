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

The preview names every file bootstrap would write and the entry it would put
there. On a machine with no assistant configured yet it reads (binary path
shortened):

```text
would write ~/.claude.json
  mcpServers.atlas = {command: "/path/to/atlas", args: ["mcp", "--supervise", "--watch=false"]}
would write ~/.claude/skills/atlas/SKILL.md
  skill atlas (claude)
would write ~/.claude/skills/atlas-sre-triage/SKILL.md
  skill atlas-sre-triage (claude)
would write ~/Library/Application Support/Claude/claude_desktop_config.json
  mcpServers.atlas = {command: "/path/to/atlas", args: ["mcp", "--supervise", "--watch=false"]}
would write ~/.cursor/mcp.json
  mcpServers.atlas = {command: "/path/to/atlas", args: ["mcp", "--supervise", "--watch=false"]}
would write ~/.gemini/settings.json
  mcpServers.atlas = {command: "/path/to/atlas", args: ["mcp", "--supervise", "--watch=false"]}
would write ~/.codex/config.toml
  mcp_servers.atlas = {command: "/path/to/atlas", args: ["mcp", "--supervise", "--watch=false"]}
would write ~/.codex/skills/atlas/SKILL.md
  skill atlas (codex)
would write ~/.codex/skills/atlas-sre-triage/SKILL.md
  skill atlas-sre-triage (codex)
would write ~/Library/Application Support/Code/User/mcp.json
  servers.atlas = {command: "/path/to/atlas", args: ["mcp", "--supervise", "--watch=false"]}
would write ~/.copilot/skills/atlas-sre-triage/SKILL.md
  skill atlas-sre-triage (copilot)
```

Besides the `atlas` skill, bootstrap installs `atlas-sre-triage`, the runbook
Atlas ships for answering production questions from the [Observe](observe)
tools. When a client already has an atlas entry, the preview shows the merged
entry, keeping any `--db` or `--repo` you pinned.

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

## Ask in the Dashboard

The same providers answer in the dashboard's **Ask Workbench**: a conversation
about the codebase where Atlas gathers the evidence and the model writes the
cited answer. A `claude` or `codex` CLI that is installed and logged in is
detected automatically; an API key can be stored with `atlas llm set`. Check
what is configured with:

```sh
atlas llm status
atlas llm detect --apply
```

In the dashboard the same configuration is under **System › App integrations
› AI providers** (`#/system?tab=integrations`): each provider's state
(**default**, **detected**, **ready**), its model and credential, a **Test**
button, and **Detect** to look for installed CLIs again.

![System › App integrations › AI providers: two providers detected and ready, Claude as the default via the anthropic-cli provider, model claude-sonnet-5, credential cli_login](assets/docs/assistants/ai-providers.png "AI providers, detected automatically from the logged-in claude and codex CLIs.")

See [Ask Workbench](workbench) for how a turn works, the threads the server
keeps, and what leaves the machine.

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
