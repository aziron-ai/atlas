import React from "react";
import { Command, ProseSection, Bullets, Callout, Figure, Clip, RELEASE, GITHUB, WIKI } from "./ui.jsx";

export default function Page() {
  return (
    <>
      <p className="docs-lead">Atlas builds a local index of a repository — its symbols, the calls and references between them, the HTTP routes it serves and the history of each indexing pass — and answers questions about it exactly, with a file and line for every claim. The same index feeds a browser dashboard, a command line, an HTTP API and AI assistants over MCP, so a person and an assistant read the same facts. This page shows each area in one frame and links to its guide. Every screenshot is from Atlas running on the public Go project inference-gateway.</p>

      <ProseSection title="Command Center">
        <p>The dashboard opens on the <strong>Command Center</strong>: a summary of everything one Atlas service holds. Tiles count recall savings, connected devices, skills, events per minute and the service's own latency; a row below shows each configured monitoring tool; a live feed on the right lists the newest events. Every number is read from the running service, and every tile opens the view that owns it. The navigation rail on the left reaches every other area.</p>
        <Figure src="assets/docs/tour/command-center.png" alt="The Command Center with KPI tiles, the Observe row and the Live activity feed" caption="The Command Center." />
        <p>Read more: <a className="text-link" href="#docs/dashboard">The dashboard</a>.</p>
      </ProseSection>

      <ProseSection title="Code Map">
        <p>The <strong>Code Map</strong> draws the stored graph five ways. <strong>Clusters</strong> packs the whole repository as its folder tree; <strong>Flow</strong> reads one symbol with its callers on the left and callees on the right; <strong>Explorer</strong> lists the same relations with call-site evidence; <strong>Workbench</strong> (beta) is a canvas you arrange and export; <strong>Repos</strong> draws which services call which. <strong>Path Finder</strong> traces how one function reaches another, and <strong>Resolve</strong> maps a pasted log line back to the code that emits it.</p>
        <Figure src="assets/docs/tour/code-map.png" alt="The Code Map in the Clusters lens for inference-gateway" caption="The Code Map, Clusters lens." />
        <p>Read more: <a className="text-link" href="#docs/code-map">Code Map and graph</a>.</p>
      </ProseSection>

      <ProseSection title="Search and Ask">
        <p>Press <code>/</code> anywhere in the dashboard to search every indexed symbol by name, path or a word from its signature. <strong>Ask Atlas</strong> takes a question in plain language and answers with the lines that answer it — the best passage first, quoted and cited, then the other files that matched. For symbol questions it adds an exact verdict, such as the number of callers. An optional AI answer, written only from those passages, can sit on top.</p>
        <Figure src="assets/docs/tour/search-and-ask.png" alt="Ask Atlas answering how are allowed models enforced with a passage from config/config.go" caption="Ask Atlas: the best passage for a question, quoted with its lines." />
        <p>Read more: <a className="text-link" href="#docs/search-and-ask">Search and Ask</a>.</p>
      </ProseSection>

      <ProseSection title="Ask Workbench">
        <p>The <strong>Ask Workbench</strong> is a conversation about the codebase. Atlas gathers the evidence — passages, definitions, routes, git history, and the tickets and pull requests of connected sources — and a model you choose writes the answer, citing each piece. The evidence panel lists every item the answer rests on, and the server keeps each thread, so you can come back to it or share its link.</p>
        <Figure src="assets/docs/tour/workbench.png" alt="Ask Workbench answering which HTTP routes the gateway serves, with a routes table and citation chips" caption="A Workbench thread: the routes table, every row cited, and the evidence on the right." />
        <p>Read more: <a className="text-link" href="#docs/workbench">Ask Workbench</a>.</p>
      </ProseSection>

      <ProseSection title="Impact and Routes">
        <p>Before you change a symbol, <strong>Impact</strong> shows what the change could reach over stored call and import edges: every affected symbol, file and test, the routes whose handlers fall inside that radius, and the call sites in other indexed repositories. <strong>Routes</strong> lists the HTTP surface the index proved, each route with its handler. The same answers come from <code>atlas impact</code> and <code>atlas context</code> when you review a change.</p>
        <Figure src="assets/docs/tour/impact.png" alt="Impact for modelDenied: seven impacted handlers" caption="The blast radius of modelDenied: seven symbols, each resolvable in the inspector." />
        <p>Read more: <a className="text-link" href="#docs/impact">Impact and review</a>.</p>
      </ProseSection>

      <ProseSection title="Change Lens">
        <p>Every indexing pass is kept as a snapshot. The <strong>Change Lens</strong> shows the timeline of snapshots for a repository and, for any pass, what it changed: symbols added, modified and removed, files touched, call edges gained and lost. With a single snapshot it says a diff needs two and gives the command that makes the second. <strong>Freshness</strong> shows how current each index is.</p>
        <Figure src="assets/docs/tour/change-lens.png" alt="Change Lens for inference-gateway with one snapshot recorded" caption="The Change Lens on a repository indexed once: one snapshot, and the command that records the next." />
        <p>Read more: <a className="text-link" href="#docs/history">Change lens and history</a>.</p>
      </ProseSection>

      <ProseSection title="Observe">
        <p>Connect a log store, Prometheus, Jenkins or Tempo and an <strong>OBSERVE</strong> group appears in the navigation: Log Streams, What Changed, Alerts &amp; Metrics, Builds, Incidents and Traces. Each answers a bounded question — the alerts firing now, the log templates growing since a deploy, the build that failed — and links what it finds back to the code that emits it. Atlas keeps templates and summaries, not raw lines.</p>
        <Figure src="assets/docs/tour/observe.png" alt="Alerts and Metrics reading the public Prometheus demo: firing alerts and a bounded query" caption="Alerts & Metrics against the public Prometheus demo." />
        <p>Read more: <a className="text-link" href="#docs/observe">Observe</a>.</p>
      </ProseSection>

      <ProseSection title="Connected Sources">
        <p>Code is one source among several. <code>atlas source</code> indexes GitHub pull requests and issues, Jira, Confluence, OneDrive, Jenkins, Prometheus, Grafana and Tempo as virtual repositories beside your code, so a search or a Workbench question can cite a ticket as readily as a function. The <strong>Connectors</strong> page configures the monitoring tools: each card says what it unlocks, saving checks that the tool is reachable, and credentials are stored as environment variable names, never values.</p>
        <Figure src="assets/docs/tour/sources.png" alt="The Connectors page with Grafana Loki and Prometheus configured" caption="Connectors: a Loki log pull and the Prometheus demo configured." />
        <p>Read more: <a className="text-link" href="#docs/sources">Connected sources</a>.</p>
      </ProseSection>

      <ProseSection title="Skills and Automations">
        <p>A skill is a reviewed runbook an assistant can follow: steps, the parameters it takes, its preconditions, how to verify it worked and how to roll it back. <strong>Skill Studio</strong> turns repeated sessions into a draft; <strong>Skills</strong> moves each one through candidate, validating and trusted, and only trusted skills are offered to connected assistants. <strong>Approvals</strong> holds the requests that wait for a person.</p>
        <Figure src="assets/docs/tour/skills.png" alt="The Skills view with one validating runbook: its steps, rendered SKILL.md and contract" caption="A skill under validation: runbook steps, the rendered SKILL.md and its contract." />
        <p>Read more: <a className="text-link" href="#docs/skills">Skills and automations</a>.</p>
      </ProseSection>

      <ProseSection title="AI Assistants over MCP">
        <p><code>atlas bootstrap</code> registers Atlas as an MCP server for the assistants it finds on the machine — Claude, Codex, Copilot, Cursor, Gemini — and installs an instruction to ask Atlas before searching files. The assistant then calls the same tools the dashboard uses — search, symbol, impact, routes, logs and more. When assistants reach Atlas through the service, the System page counts every call, with errors, latency and the size of the answer.</p>
        <Figure src="assets/docs/tour/assistants.png" alt="System per-tool breakdown: calls, errors, p50, p95 and estimated tokens for each tool" caption="System → Per-tool breakdown: every tool call the service answered." />
        <p>Read more: <a className="text-link" href="#docs/assistants">AI assistant setup</a>.</p>
      </ProseSection>

      <ProseSection title="The CLI">
        <p>Every answer the dashboard shows is also a command of the single <code>atlas</code> binary, with <code>--format plain</code> for people and JSON for scripts. Index, search, ask for callers, trace a path, size a change, read the graph report, export the graph, run the service:</p>
        <Command>{`atlas callers modelDenied --format plain
callers modelDenied  total 5
  ChatCompletionsHandler  method  api/routes.go:637  :: func (router *RouterImpl) ChatCompletionsHandler(c *gin.Context)
  ImagesHandler  method  api/routes.go:1194  :: func (router *RouterImpl) ImagesHandler(c *gin.Context)
  MessagesHandler  method  api/routes.go:842  :: func (router *RouterImpl) MessagesHandler(c *gin.Context)
  …`}</Command>
        <p>Read more: <a className="text-link" href="#docs/cli">CLI reference</a>.</p>
      </ProseSection>

      <ProseSection title="How the Pieces Fit">
        <ol className="docs-list">
          <li><strong>Index.</strong> <code>atlas index</code> parses a repository into symbols, edges and routes and stores them, with a lexical search index, in a local database. Each pass is a snapshot.</li>
          <li><strong>Graph.</strong> Every query — search, callers, path, impact, report — reads that stored graph. Nothing is guessed at query time.</li>
          <li><strong>Surfaces.</strong> The same graph is served four ways: the CLI, the dashboard and HTTP API of <code>atlas serve</code>, and MCP for assistants (<code>atlas mcp</code>, or <code>atlas serve --mcp</code>).</li>
        </ol>
        <p><a className="text-link" href="#docs/concepts">Core concepts</a> explains snapshots, scope and output control; <a className="text-link" href="#docs/getting-started">Getting started</a> takes you from install to the first answer.</p>
      </ProseSection>
    </>
  );
}
