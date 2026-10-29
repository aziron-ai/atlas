import React from "react";
import { Command, ProseSection, Bullets, Callout, Figure, Clip, RELEASE, GITHUB, WIKI } from "./ui.jsx";

export default function Page() {
  return (
    <>
      <p className="docs-lead">The dashboard is the browser view of everything one Atlas service holds: the repositories it indexed, the graph inside them, the questions it answered and the tools it is connected to. Every view shares one frame — a navigation rail on the left, a search box in the header and a symbol inspector that opens over any page. Reach for it when you want to look around a codebase instead of asking the command line one question at a time.</p>

      <ProseSection title="Open It">
        <p>Start the service and open the dashboard in a browser:</p>
        <Command>{`atlas serve
# then open http://127.0.0.1:3099/dashboard`}</Command>
        <p>The first page is the <strong>Command Center</strong> (<code>#/overview</code>). Every view has its own hash route — <code>#/map</code>, <code>#/ask</code>, <code>#/orient</code> — so a link to a view, a symbol or a question can be pasted into chat and opens the same page for the next reader. <a className="text-link" href="#docs/service">Dashboard and API</a> covers the service flags, tokens and the address it binds to.</p>
        <Figure src="assets/docs/dashboard/command-center.png" alt="The Command Center: KPI tiles, the Observe row, Ready to automate, Connector pulse, Skills lifecycle and the Live activity rail" caption="The Command Center on a service that has indexed inference-gateway and has Prometheus and a log pull configured." />
      </ProseSection>

      <ProseSection title="Find Your Way Around">
        <p>The rail on the left groups the views by job. A badge beside an item is a live count: events in the stream, open incidents, firing alerts, skills, repositories.</p>
        <Figure src="assets/docs/dashboard/nav-rail-lower.png" alt="The lower half of the navigation rail: the OBSERVE, AUTOMATE, FLEET, CODEBASE and SYSTEM groups with their badges" caption="The lower half of the rail (COMMAND and EXPLORE are in the screenshot above). OBSERVE appears only once a monitoring tool is configured; Builds and Traces are greyed until Jenkins and Tempo are." width={240} />
        <div className="docs-table-wrap"><table>
          <thead><tr><th>Group</th><th>Views</th><th>Use it to</th></tr></thead>
          <tbody>
            <tr><td><strong>COMMAND</strong></td><td>Command Center, Live Activity</td><td>See what the service holds and what it is doing right now.</td></tr>
            <tr><td><strong>PINNED</strong></td><td>Symbols you starred</td><td>Jump back to the symbols you keep returning to. Hidden until you pin one.</td></tr>
            <tr><td><strong>EXPLORE</strong></td><td>Ask Atlas, Ask Workbench, Code Map, Orientation, Resolve, Files, Routes, Impact, Path Finder, Changes</td><td>Read and question the code: search, ask, map, trace a path, size a change.</td></tr>
            <tr><td><strong>OBSERVE</strong></td><td>Log Streams, What Changed, Alerts &amp; Metrics, Builds, Incidents, Traces</td><td>Read what a running system is doing. Each item is greyed until the tool it needs (Loki or Elasticsearch, Prometheus, Jenkins, Tempo) is configured.</td></tr>
            <tr><td><strong>AUTOMATE</strong></td><td>Skill Studio, Skills, Approvals</td><td>Turn repeated work into reviewed skills and decide pending requests.</td></tr>
            <tr><td><strong>FLEET</strong></td><td>Devices, Connectors</td><td>See connected machines and configure monitoring tools.</td></tr>
            <tr><td><strong>CODEBASE</strong></td><td>Workspace, Hot Symbols, Freshness</td><td>List every indexed repository, its most-connected symbols and how fresh each index is.</td></tr>
            <tr><td><strong>SYSTEM</strong></td><td>System</td><td>Check the service's own health, settings and AI providers.</td></tr>
          </tbody>
        </table></div>
        <p>The header carries four controls on the right:</p>
        <Figure src="assets/docs/dashboard/header-controls.png" alt="Header controls: the search box with its / shortcut, the Live toggle, the ? button and the theme button" caption="Search, Live, tour replay and theme." width={460} />
        <Bullets>
          <li><strong>Search symbols, routes…</strong> — the omnibox. Press <code>/</code> anywhere to focus it (see below).</li>
          <li><strong>Live</strong> — pauses and resumes the dashboard's live refresh. Pause it when you want the numbers on screen to stop moving.</li>
          <li><strong>?</strong> — replays the five-step product tour: Orientation, Ask Atlas, Code Map, Routes, and search with the command palette. Each step highlights the real control; <strong>Skip</strong> closes it, <strong>Back</strong> and <strong>Next</strong> step through.</li>
          <li>The <strong>theme</strong> button switches between dark and light. The choice is remembered in this browser.</li>
        </Bullets>
        <Figure src="assets/docs/dashboard/product-tour.png" alt="The first step of the product tour, highlighting Orientation in the rail" caption="The tour's first step, opened from the ? button." />
      </ProseSection>

      <ProseSection title="Read the Command Center">
        <p>The Command Center is a summary of the whole service, read from one endpoint (<code>/api/v1/dashboard</code>). Nothing on it is sample data: a tile with nothing to count says so. Click a tile to open the view that owns its number.</p>
        <Figure src="assets/docs/dashboard/kpi-strip.png" alt="The six KPI tiles of the Command Center" caption="The KPI strip." />
        <div className="docs-table-wrap"><table>
          <thead><tr><th>Tile</th><th>The number</th><th>Opens</th></tr></thead>
          <tbody>
            <tr><td><strong>Tokens saved (recall)</strong></td><td>Tokens the recall ledger recorded as saved by replaying a stored answer, with the number of replay runs beneath.</td><td>Skills</td></tr>
            <tr><td><strong>Hit rate</strong></td><td>Cache and shadow hits over recorded turns.</td><td>Skills</td></tr>
            <tr><td><strong>Fleet devices</strong></td><td>Machines connected with <code>atlas connect</code>; a device is flagged stale after seven days without a push.</td><td>Devices</td></tr>
            <tr><td><strong>Active skills</strong></td><td>Trusted skills, with the candidate and validating counts beneath.</td><td>Skills</td></tr>
            <tr><td><strong>Events/min</strong></td><td>Recorded events over the last ten minutes.</td><td>Live Activity</td></tr>
            <tr><td><strong>System</strong></td><td>The service's p95 serving latency and its uptime.</td><td>System</td></tr>
          </tbody>
        </table></div>
        <p>Below the tiles:</p>
        <Bullets>
          <li><strong>OBSERVE</strong> — one tile per configured monitoring tool, such as <strong>Log pulls</strong>, <strong>Open incidents</strong> and <strong>Firing alerts</strong>. With nothing configured the row reads <strong>Observe is off</strong> and lists each tool, the views it unlocks, and the CLI command and HTTP route that configure it.</li>
          <li><strong>Ready to automate</strong> — repeated procedures mined from real sessions, ranked by projected savings, each with <strong>Create skill</strong>. Empty until agents work through Atlas with episode capture on.</li>
          <li><strong>Connector pulse</strong> — events per connector in the live window.</li>
          <li><strong>Skills lifecycle</strong> — skills per stage: candidate, validating, trusted, quarantined, revoked.</li>
          <li><strong>Code graph index</strong> — <strong>Indexed symbols</strong>, <strong>Repos indexed</strong>, <strong>Indexed edges</strong> and <strong>Route records</strong>: the stored rows of each indexed repository's latest snapshot, summed over the repositories, the same totals the Workspace view shows. Since 0.1.55 both views share one calculation, each tile reads "—" until the first dashboard frame arrives (an empty index shows a measured 0), hovering a tile names that scope, and <strong>Graph edges</strong> is renamed <strong>Indexed edges</strong> because it counts stored edge rows, not the graph's resolved edges (<a className="text-link" href="https://github.com/aziron-ai/atlas/issues/158" target="_blank" rel="noreferrer">#158</a>). The card links to <strong>Orientation</strong> and <strong>Hot Symbols</strong>.</li>
          <li><strong>Live activity</strong> (right rail) — the seven newest events: what was asked, which connector, how many tokens, how long it took. <strong>All</strong> opens the full stream. Below it, an <strong>Approvals</strong> card appears when requests await a decision, and a <strong>Devices</strong> card lists connected machines.</li>
        </Bullets>
        <p><strong>Live Activity</strong> (<code>#/events</code>) is the full stream. Filter it by connector with the chips (each shows its count), by tier (<strong>automation</strong>, <strong>exact</strong>, <strong>semantic</strong>, <strong>live</strong>), or by any text in the <strong>Filter events…</strong> box.</p>
        <Figure src="assets/docs/dashboard/live-activity.png" alt="Live Activity filtered to the atlas connector, showing three indexing events" caption="Live Activity filtered to the atlas connector: each row is an indexing pass with its file, symbol, edge and route counts." />
      </ProseSection>

      <ProseSection title="Search and Inspect a Symbol">
        <p>The omnibox in the header finds any indexed symbol from any view.</p>
        <ol className="docs-list">
          <li>Press <code>/</code> (or click the box) and type at least two characters.</li>
          <li>Results arrive grouped by kind — <strong>METHOD</strong>, <strong>FUNCTION</strong>, <strong>TYPE</strong>, <strong>FIELD</strong>, <strong>KEY</strong> — each with its file and line.</li>
          <li>Use <code>↑</code> <code>↓</code> to select and <code>Enter</code> to open the symbol in the inspector. <code>Enter</code> with nothing selected sends the text to <strong>Ask Atlas</strong> as a question instead (or, when logs are configured, a query that looks like a log line to <strong>Log Streams</strong>).</li>
        </ol>
        <Clip src="assets/docs/dashboard/omnibox-search.mp4" alt="Typing modelDenied into the header search, selecting the method and opening the inspector" caption="Search for modelDenied and open it in the inspector." />
        <p>The inspector docks on the right, over whatever view you are on. For <code>modelDenied</code> it shows:</p>
        <Bullets>
          <li>the name, kind and location (<code>routes.go:622</code>), with a star to pin it, a copy-link button and close;</li>
          <li><strong>Code Map</strong> and <strong>Ask about this</strong>, which open the symbol in those views;</li>
          <li><strong>Explain</strong> — the signature; then <strong>Body excerpt</strong>, <strong>Callers</strong> (5), <strong>References</strong> (5) and <strong>Neighbors</strong>, each loaded on its own and each saying so when it is empty;</li>
          <li><strong>Blast radius</strong> and <strong>History</strong> at the foot, which run the impact and history queries for this symbol.</li>
        </Bullets>
        <Figure src="assets/docs/dashboard/inspector.png" alt="The symbol inspector open on modelDenied, listing five callers and five references" caption="The inspector on modelDenied: five callers, all in api/routes.go." width={400} />
        <p>The inspector's state rides the URL (<code>?sym=modelDenied&amp;symPath=api/routes.go</code>), so a copied link reopens it. Star a symbol and it appears under <strong>PINNED</strong> in the rail; click the pin to reopen the inspector. Pins are kept per store in this browser, up to 20.</p>
        <Figure src="assets/docs/dashboard/pinned-symbol.png" alt="The PINNED group in the rail holding modelDenied" caption="A pinned symbol in the rail." width={240} />
        <p>For actions as well as symbols, press <code>⌘K</code> (<code>Ctrl+K</code>) for the command palette. It jumps to any view by name, lists matching symbols, and offers actions built on your text: <strong>Ask Atlas</strong>, <strong>Search Routes</strong>, <strong>Impact</strong> for the top hit, <strong>Path Finder</strong> from the top hit.</p>
        <Figure src="assets/docs/dashboard/command-palette.png" alt="The command palette with modelDenied typed: symbol rows and four actions" caption="The command palette: symbol rows are live index hits; the actions start a view pre-filled." />
      </ProseSection>

      <ProseSection title="Get Oriented in a Repository">
        <p><strong>Orientation</strong> (<code>#/orient</code>) is the page to open first on an unfamiliar repository. Pick the repository at the top; <strong>Open Code Map</strong> and <strong>Ask Atlas</strong> carry it into those views.</p>
        <Figure src="assets/docs/dashboard/orientation.png" alt="Orientation for inference-gateway: graph counts, language bars, entry points and load-bearing symbols" caption="Orientation for inference-gateway." />
        <Bullets>
          <li>The counts strip — <strong>FILES</strong>, <strong>SYMBOLS</strong>, <strong>EDGES</strong>, <strong>COMMUNITIES</strong>, <strong>ISOLATED</strong> — and a bar per language come from the graph report, which reads non-test code symbols and call edges. That is why they are smaller than the repository's stored totals: 89 files and 3,526 symbols here, against 307 files and 11,092 symbols stored.</li>
          <li><strong>Entry points</strong> lists the routes the repository serves — method, path, handler — with the confidence of each match.</li>
          <li><strong>Load-bearing symbols</strong> ranks the hubs by degree; <strong>Inspect</strong> opens one in the inspector, <strong>Map</strong> in the Code Map.</li>
          <li><strong>Modules &amp; communities</strong>, further down, groups symbols that call each other densely.</li>
        </Bullets>
      </ProseSection>

      <ProseSection title="Browse Repositories and Files">
        <p><strong>Workspace</strong> (<code>#/workspace</code>, under CODEBASE) lists every repository the service holds. The tiles total repositories, files, symbols, dependency edges and route contracts; the <strong>Knowledge map</strong> draws one tile per repository, sized by symbols and coloured by how recently it was indexed. The <strong>Per-repository index</strong> table below gives each repository's counts, index mode, age and status, with <strong>Orient me</strong> and <strong>Map</strong> buttons.</p>
        <Figure src="assets/docs/dashboard/workspace.png" alt="Workspace: totals, the knowledge map and the per-repository table header" caption="Workspace on the demo service: inference-gateway plus two connected sources indexed as virtual repositories." />
        <p><strong>Files</strong> (<code>#/files</code>) walks a repository as a tree. Sort the tree by <strong>name</strong>, <strong>syms</strong> or <strong>rel</strong>, or filter it by path and symbol name. Select a file and the <strong>Details</strong> panel shows its relations, the routes it serves, a likely test file, the packages it imports and the files that import it, with <strong>Map this file's folder</strong>, <strong>Ask about this file</strong> and <strong>Compare…</strong>.</p>
        <Figure src="assets/docs/dashboard/files.png" alt="Files: api/routes.go selected, showing 882 relations and the nine routes it serves" caption="api/routes.go in Files: 882 relations and nine served routes, each with its handler." />
      </ProseSection>

      <ProseSection title="Check the Service">
        <p><strong>System</strong> (<code>#/system</code>) has two tabs. <strong>Overview</strong> is the service's own footprint, streamed live: uptime, memory, CPU, serving latency, the size of the graph database, the lexical index and the telemetry database, events recorded and an estimate of tokens served. Below the tiles are a live resource timeline, a <strong>Per-tool breakdown</strong> of every tool call served, and the operational settings with where each value comes from (environment, settings file or default). <strong>Run self-diagnostic</strong>, <strong>Clear stale snapshots</strong> and <strong>Compact storage</strong> are the maintenance actions.</p>
        <Figure src="assets/docs/dashboard/system-runtime.png" alt="System overview: runtime tiles for uptime, memory, CPU, latency and storage" caption="System → Overview." />
        <p><strong>App integrations</strong> is where the optional AI answer gets its provider. Atlas detects the Claude and Codex CLIs and API keys on the machine; each provider card shows its model, the credential it uses, what leaves the machine, and a <strong>Test</strong> button. The same tab shows the GitHub and Pulse integrations of the Ask Workbench and the Jira sign-in.</p>
        <Figure src="assets/docs/dashboard/system-ai-providers.png" alt="System → App integrations: the AI providers card with Claude as the default, detected and ready" caption="App integrations: Claude detected and ready as the default provider." />
      </ProseSection>

      <ProseSection title="From the CLI">
        <p>The same facts the frame shows are one command away. <code>atlas status</code> is the storage and contract check, one line per repository:</p>
        <Command>{`atlas status --format plain
status  schema 8  index_format 5  lexical 4  mcp 2  driver sqlite
  inference-gateway  52496750  format 5  symbols 11092  edges 13900`}</Command>
        <p><code>atlas stats</code> is one repository's index telemetry. <code>store_rows</code> are the stored totals the Workspace view shows; <code>graph</code> is the report's non-test call graph that Orientation shows:</p>
        <Command>{`atlas stats --format plain
stats inference-gateway  local/sqlite  history 1  coverage_facts 0
  latest 52496750  mode full  files 307  symbols 11092  edges 13900  routes 71  53534ms
  store_rows files 307  symbols 11092  edges 13900  routes 71
  graph files 89  symbols 3526  edges 1317  communities 3161  isolated 3121
  langs  go:3511 bash:9 typescript:6`}</Command>
        <p><code>atlas repo list</code> is the Workspace table; <code>atlas repo rm</code> forgets a repository and its data:</p>
        <Command>{`atlas repo list --format plain
NAME               PATH               COMMIT                                    INDEXED               STATUS
inference-gateway  inference-gateway  524967508e9d90185c4a1c3540cac0dcda7c580a  2026-10-28T05:16:55Z  ready`}</Command>
        <p>Every command and flag is in the <a className="text-link" href="#docs/cli">CLI reference</a>.</p>
      </ProseSection>

      <ProseSection title="From the API">
        <p>The Command Center reads one snapshot, <code>GET /api/v1/dashboard</code>, and keeps it fresh over <code>GET /api/v1/dashboard/stream</code> (server-sent events). The snapshot's top-level blocks are <code>meta</code>, <code>kpis</code>, <code>series</code>, <code>tierBreakdown</code>, <code>clusters</code>, <code>automations</code>, <code>approvals</code>, <code>events</code>, <code>repoObservability</code>, <code>devices</code>, <code>decisions</code>, <code>recall</code>, <code>system</code> and <code>observe</code>; Workspace reads <code>repoObservability</code>. <code>GET /api/v1/status</code> is the same check as <code>atlas status</code>:</p>
        <Command>{`curl -s http://127.0.0.1:3099/api/v1/status
{"data":{"tier":"local","storage_driver":"sqlite","vector_backend":"disabled","repos_indexed":1,
 "repos":[{"repo_full_name":"inference-gateway","commit_sha":"524967508e9d90185c4a1c3540cac0dcda7c580a",
  "files":307,"symbols":11092,"edges":13900,"routes":71,"producer_routes":39,"consumer_calls":32,
  "indexed_at":"2026-10-28T05:16:55Z","state":"ready", …}]}}`}</Command>
        <p>Tokens, the full route list and the HTTP MCP endpoint are on <a className="text-link" href="#docs/service">Dashboard and API</a>.</p>
      </ProseSection>

      <ProseSection title="Related">
        <Bullets>
          <li><a className="text-link" href="#docs/tour">What Atlas does</a> — one frame of every area.</li>
          <li><a className="text-link" href="#docs/code-map">Code Map and graph</a> — the five map lenses, Path Finder and Resolve.</li>
          <li><a className="text-link" href="#docs/search-and-ask">Search and Ask</a> — the omnibox, <code>atlas search</code> and the Ask page.</li>
          <li><a className="text-link" href="#docs/workbench">Ask Workbench</a> — a cited conversation about the code.</li>
          <li><a className="text-link" href="#docs/observe">Observe</a> and <a className="text-link" href="#docs/sources">Connected sources</a> — the OBSERVE group and the Connectors page.</li>
          <li><a className="text-link" href="#docs/service">Dashboard and API</a> — running the service.</li>
        </Bullets>
      </ProseSection>
    </>
  );
}
