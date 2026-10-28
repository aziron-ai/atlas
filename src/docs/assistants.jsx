import React from "react";
import { Command, ProseSection, Bullets, Callout, Figure, Clip, RELEASE, GITHUB, WIKI } from "./ui.jsx";

export default function Page() {
  return (
        <>
          <p className="docs-lead">Atlas registers its MCP server with Claude CLI, Claude Desktop, Codex, Cursor, Gemini, and GitHub Copilot, so any of these assistants can query your local code graph. This page covers automatic setup, repository-pinned setup, git hooks, verification, and removal. For what the tools return once connected, see <a className="text-link" href="#docs/mcp">MCP Tools</a>.</p>
          <ProseSection title="Automatic Setup with Bootstrap">
            <p>Use bootstrap when you want every detected assistant provisioned in one pass. In managed environments, always preview first:</p>
            <Command>{`atlas bootstrap --dry-run`}</Command>
            <p>The preview names every file bootstrap would write and the entry it would put there. On a machine with no assistant configured yet it reads (binary path shortened):</p>
            <Command>{`would write ~/.claude.json
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
  skill atlas-sre-triage (copilot)`}</Command>
            <p>Besides the <code>atlas</code> skill, bootstrap installs <code>atlas-sre-triage</code>, the runbook Atlas ships for answering production questions from the <a className="text-link" href="#docs/observe">Observe</a> tools. When a client already has an atlas entry, the preview shows the merged entry, keeping any <code>--db</code> or <code>--repo</code> you pinned.</p>
            <p>Apply the changes:</p>
            <Command>{`atlas bootstrap`}</Command>
            <p>Restrict provisioning to selected clients, or exclude some:</p>
            <Command>{`atlas bootstrap --only codex,claude,claude-desktop\natlas bootstrap --skip cursor`}</Command>
            <p>Restart each assistant after its MCP configuration changes; most clients read MCP configuration only at startup.</p>
            <p><strong>What bootstrap writes.</strong> Bootstrap registers Atlas as an MCP server and installs the atlas-first skill plus a CLAUDE.md directive for all detected assistants. It bakes the absolute binary path into each config and registers the supervised gateway with no <code>--db</code>, so the workspace is resolved at query time rather than pinned at install time. The command is idempotent: it is safe to run repeatedly and from a package post-install hook. Re-running <em>merges</em> the existing atlas entry rather than replacing it, so a <code>--db</code> pin, extra args, or an <code>env</code> block you configured (for example via a repository-pinned <code>install skill --db</code>) are preserved. Use <code>--home</code> to override the home directory base when provisioning a different account's configuration.</p>
          </ProseSection>
          <ProseSection title="Repository-Pinned Setup">
            <p>Use a repository-pinned local MCP configuration when one assistant should always query one index:</p>
            <Command>{`cd /path/to/repository\natlas index .\n\natlas install skill \\\n  --agent codex,claude,claude-desktop \\\n  --repo "$PWD" \\\n  --db "sqlite://$PWD/.atlas/atlas.db" \\\n  --server-url=none`}</Command>
          </ProseSection>
          <ProseSection title="Dynamic Workspace Setup">
            <p>Bootstrap is appropriate when the assistant supplies the active workspace at runtime. Repository-scoped MCP tools still require one of:</p>
            <Bullets>
              <li>a workspace root supplied by the client</li>
              <li>a <code>workspace</code> argument</li>
              <li>a repository ID</li>
              <li>a repository pinned when MCP starts</li>
            </Bullets>
            <p>If none is available, Atlas returns <code>workspace_required</code> instead of selecting a repository silently.</p>
          </ProseSection>
          <ProseSection title="Shared Local Server">
            <p>Use one local service when multiple thin clients should share a single index and watcher:</p>
            <Command>{`atlas serve --mcp\n\natlas install skill \\\n  --agent codex,claude,claude-desktop \\\n  --repo "$PWD" \\\n  --server-url http://127.0.0.1:3099`}</Command>
            <p>Use a token before exposing the service beyond loopback. See <a className="text-link" href="#docs/service">Dashboard and HTTP API</a>.</p>
          </ProseSection>
          <ProseSection title="Keep the Graph Fresh with a Git Hook">
            <p>Install a local git hook when you want the index updated as part of your normal git workflow rather than by a running watcher:</p>
            <Command>{`atlas install hook`}</Command>
            <p>The hook keeps the Atlas graph fresh in the repository where it is installed.</p>
          </ProseSection>
          <ProseSection title="Client Configuration Locations">
            <p>Check these paths when auditing what setup wrote or when a client does not pick up the server:</p>
            <div className="docs-table-wrap"><table><thead><tr><th>Client</th><th>Typical location</th></tr></thead><tbody>
              <tr><td>Codex</td><td><code>~/.codex/config.toml</code></td></tr>
              <tr><td>Claude CLI</td><td><code>~/.claude.json</code></td></tr>
              <tr><td>Claude Desktop on macOS</td><td><code>~/Library/Application Support/Claude/claude_desktop_config.json</code></td></tr>
            </tbody></table></div>
            <p>Atlas preserves unrelated client configuration. Always review a dry run before applying changes in managed environments.</p>
          </ProseSection>
          <ProseSection title="Ask in the Dashboard">
            <p>The same providers answer in the dashboard's <strong>Ask Workbench</strong>: a conversation about the codebase where Atlas gathers the evidence and the model writes the cited answer. A <code>claude</code> or <code>codex</code> CLI that is installed and logged in is detected automatically; an API key can be stored with <code>atlas llm set</code>. Check what is configured with:</p>
            <Command>{`atlas llm status\natlas llm detect --apply`}</Command>
            <p>In the dashboard the same configuration is under <strong>System › App integrations › AI providers</strong> (<code>#/system?tab=integrations</code>): each provider's state (<strong>default</strong>, <strong>detected</strong>, <strong>ready</strong>), its model and credential, a <strong>Test</strong> button, and <strong>Detect</strong> to look for installed CLIs again.</p>
            <Figure src="assets/docs/assistants/ai-providers.png" alt="System › App integrations › AI providers: two providers detected and ready, Claude as the default via the anthropic-cli provider, model claude-sonnet-5, credential cli_login" caption="AI providers, detected automatically from the logged-in claude and codex CLIs." />
            <p>See <a className="text-link" href="#docs/workbench">Ask Workbench</a> for how a turn works, the threads the server keeps, and what leaves the machine.</p>
          </ProseSection>
          <ProseSection title="Verify">
            <p>Confirm the integration end to end before relying on it:</p>
            <Command>{`atlas doctor --verify atlas\natlas status\natlas bootstrap --dry-run`}</Command>
            <p><code>doctor --verify atlas</code> also checks for binary drift: whether the <code>atlas</code> on <code>PATH</code> — what assistants launch via <code>command:"atlas"</code> — matches the running binary. Then ask the assistant a repository-specific question and confirm that the answer includes source file and line references.</p>
          </ProseSection>
          <ProseSection title="Remove the Integration">
            <p>Preview removal, then apply it:</p>
            <Command>{`atlas uninstall --dry-run\natlas uninstall`}</Command>
            <p>Uninstall reverses <code>atlas bootstrap</code> across every assistant it provisions: it removes the atlas MCP server entry from each config, the atlas skill markdown, and the atlas-managed block in the global CLAUDE.md. Nothing else is touched — other MCP servers, unrelated config keys, and your own CLAUDE.md content outside the atlas markers are preserved. Re-running reports <code>absent</code> and writes nothing. By default repository indexes are not deleted; <code>atlas uninstall --purge</code> also removes the <code>.atlas</code> index directories (the global <code>~/.atlas</code> and every registry-known repo’s <code>.atlas</code>), printing the blast radius and total reclaimed space first and requiring confirmation (<code>--yes</code> to skip it, <code>--dry-run</code> to preview). See <a className="text-link" href="#docs/privacy">Privacy and Data Handling</a> for data removal.</p>
          </ProseSection>
        </>
  );
}
