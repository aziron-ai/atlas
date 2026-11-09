import React from "react";
import { Command, ProseSection, Bullets, Callout, Figure, Clip, RELEASE, GITHUB, WIKI } from "./ui.jsx";

export default function Page() {
  return (
        <>
          <p className="docs-lead">This guide takes a repository from unindexed to queryable: build the local index, verify it is healthy, run the core queries, and connect an AI assistant. Atlas is local-first — everything below runs on your machine against an embedded database, with no server or account required. For the mental model behind these commands, see <a className="text-link" href="#docs/concepts">Core Concepts</a>.</p>
          <ProseSection title="1. Check Prerequisites">
            <p>Confirm the binary is installed and on <code>PATH</code> before anything else, because assistants and scripts resolve <code>atlas</code> from <code>PATH</code> too.</p>
            <Command>{`command -v atlas\natlas version`}</Command>
            <p>If either command fails, follow <a className="text-link" href="#docs/installation">Installation</a> first. You also need a local checkout of the repository you want to index; a git repository is required for commit-pinned indexing (<code>--ref</code>) and the per-commit snapshot history.</p>
          </ProseSection>
          <ProseSection title="2. Index a Repository">
            <p>Indexing builds everything Atlas knows about a repository: it parses symbols, call edges, and routes, and persists the <strong>knowledge graph</strong> plus a lexical search index.</p>
            <Command>{`cd /path/to/repository\natlas index .`}</Command>
            <p>Progress is printed to stderr while the run reports discovery and completion stats. Results are stored in an embedded SQLite database in the repository: <code>.atlas/atlas.db</code></p>
            <p>By default the indexer skips paths git ignores (build output, caches, vendored runtimes); pass <code>--gitignore=false</code> to index everything. The first run parses the whole repository; later runs are incremental deltas. Use <code>--reindex</code> to force a full rebuild, and <code>--ref</code> to index a specific commit or branch instead of the working tree. See <a className="text-link" href="#docs/indexing">Indexing and Reindexing</a> for exclusions, watch mode, and the optional embedding pass (<code>--enable-vectors</code>).</p>
          </ProseSection>
          <ProseSection title="3. Confirm Readiness">
            <p>Verify the index before relying on query results, so an empty or drifted database does not silently return nothing.</p>
            <Command>{`atlas status\natlas stats`}</Command>
            <p><code>atlas status</code> reports storage and version health: the schema and index-format contracts and the per-repo snapshot format state. <code>atlas stats</code> reports graph and index telemetry for the indexed repository. Look for your repository identity, a current snapshot, and non-zero symbol and edge counts. Zero counts or a missing repository mean the index did not build — see <a className="text-link" href="#docs/troubleshooting">Troubleshooting</a>.</p>
            <p>The same index is visible in the dashboard. Run <code>atlas serve</code> and open <code>http://127.0.0.1:3099/dashboard</code>. <strong>Live Activity</strong> records the indexing pass with what it found — here inference-gateway, a public Go project:</p>
            <Figure src="assets/docs/getting-started/index-event.png" alt="A Live Activity row: indexed inference-gateway, 307 files, 11092 symbols, 13900 edges, 71 routes" caption="The first index of inference-gateway, as Live Activity records it: 307 files, 11,092 symbols, 13,900 edges and 71 routes in about 54 seconds." />
            <p><strong>Workspace</strong> (under CODEBASE) lists the repository with the same counts, its index mode, when it was indexed and its status, with <strong>Orient me</strong> and <strong>Map</strong> to start reading:</p>
            <Figure src="assets/docs/getting-started/workspace-repo.png" alt="The Workspace per-repository table with inference-gateway: 307 files, 11,092 symbols, 13,900 edges, 71 routes, full, indexed" caption="The repository in Workspace, ready to explore." />
            <p><strong>Orient me</strong> opens <strong>Orientation</strong>: the entry points the repository serves, its most-connected symbols and its modules — the quickest way into code you have not read before.</p>
            <Figure src="assets/docs/getting-started/orientation.png" alt="Orientation for inference-gateway: graph counts, language bars, entry points and load-bearing symbols" caption="Orientation for inference-gateway: entry points on the left, load-bearing symbols on the right." />
            <p><a className="text-link" href="#docs/dashboard">The dashboard</a> walks through every view.</p>
          </ProseSection>
          <ProseSection title="4. Run the First Queries">
            <p>Each query answers a different question; pick the one that matches what you already know.</p>
            <p>Use <code>search</code> when you know words or phrases but not exact names — it is code-aware lexical search (BM25 + trigram) over the symbol index:</p>
            <Command>{`atlas search "authentication middleware" --format plain`}</Command>
            <p>Use <code>symbol</code> when you know a name and want its definition(s) together with its callers and callees:</p>
            <Command>{`atlas symbol NewServer`}</Command>
            <p>Use <code>callers</code> before changing a function's behavior or signature, to see exactly which symbols call it directly:</p>
            <Command>{`atlas callers NewServer --limit 25`}</Command>
            <p>Use <code>refs</code> when a rename or type change is on the table — it lists call sites plus type-use references (params, fields, returns):</p>
            <Command>{`atlas refs NewServer`}</Command>
            <p>Use <code>context</code> when reviewing a change — it builds a bounded review-context bundle (16–32 KiB with the default <code>auto</code> intent) around the changed files:</p>
            <Command>{`atlas context \\\n  --paths path/to/changed-file.go \\\n  --query "review correctness and regression risk" \\\n  --format json`}</Command>
            <p>For the blast radius of a change — impacted symbols, files, and covering tests — use <code>impact</code>:</p>
            <Command>{`atlas impact --paths path/to/changed-file.go`}</Command>
            <p>Run <code>atlas &lt;command&gt; --help</code> for the full flag list of your installed version, or see the <a className="text-link" href="#docs/cli">CLI Reference</a>.</p>
          </ProseSection>
          <ProseSection title="5. Connect an AI Assistant">
            <p>Bootstrap registers Atlas as an MCP server and installs the atlas-first skill and CLAUDE.md directive for every detected assistant (Claude desktop and CLI, Codex, Copilot, Cursor, Gemini), so assistants query the graph instead of grepping. Preview what would be written first:</p>
            <Command>{`atlas bootstrap --dry-run`}</Command>
            <p>Then apply it:</p>
            <Command>{`atlas bootstrap`}</Command>
            <p>Bootstrap is idempotent — safe to run repeatedly. Use <code>--only</code> or <code>--skip</code> (comma-separated agent lists) to limit which assistants are provisioned. Restart the assistant after configuration changes, and run <code>atlas doctor --verify atlas</code> to confirm the <code>atlas</code> on <code>PATH</code> — what assistants launch — matches the binary you installed. See <a className="text-link" href="#docs/mcp">MCP Tools</a> for the tool surface assistants receive.</p>
          </ProseSection>
          <ProseSection title="6. Keep the Index Fresh">
            <p>Query results are only as current as the last index run. After meaningful changes, run an incremental update:</p>
            <Command>{`atlas index .`}</Command>
            <p>For a foreground process that re-indexes on every file change (edits within 250 ms are coalesced into one update):</p>
            <Command>{`atlas watch`}</Command>
            <p>Reserve <code>atlas index . --reindex</code> for format changes or recovery, per <a className="text-link" href="#docs/indexing">Indexing and Reindexing</a>.</p>
          </ProseSection>
          <ProseSection title="Where to Go Next">
            <Bullets>
              <li><a className="text-link" href="#docs/concepts">Core Concepts</a> — the graph, snapshots, workspaces, and output control that every command shares.</li>
              <li><a className="text-link" href="#docs/cli">CLI Reference</a> — every command and flag.</li>
              <li><a className="text-link" href="#docs/mcp">MCP Tools</a> — what assistants can call after bootstrap.</li>
              <li><a className="text-link" href="#docs/configuration">Configuration</a> — knob precedence and <code>atlas config</code>.</li>
              <li><a className="text-link" href="#docs/troubleshooting">Troubleshooting</a> — empty results, drift, and recovery.</li>
            </Bullets>
          </ProseSection>
        </>
  );
}
