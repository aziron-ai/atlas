import React from "react";
import { Command, ProseSection, Bullets, Callout, Figure, Clip, RELEASE, GITHUB, WIKI } from "./ui.jsx";

export default function Page() {
  return (
    <>
      <p className="docs-lead">The Code Map draws the stored call graph of a repository: which folders hold what, which symbols call which, and how one function reaches another. Everything on it is an edge the index recorded — calls, references, imports — never a guess. Reach for it when you need to see the shape around a symbol before you change it, or to find your way into a folder you have never opened.</p>

      <ProseSection title="Open It">
        <p>Choose <strong>Code Map</strong> under EXPLORE, or open <code>#/map</code>. With no symbol chosen the map opens in the <strong>Clusters</strong> lens: the whole repository packed as its real folder tree.</p>
        <Figure src="assets/docs/code-map/map-clusters.png" alt="The Code Map in the Clusters lens for inference-gateway: folders packed as circles with edges between them" caption="inference-gateway in Clusters: internal, providers, tests, api and the rest, sized by the symbols inside." />
        <p>The controls along the top are shared by every lens:</p>
        <Figure src="assets/docs/code-map/map-controls.png" alt="The repository picker, the five lens buttons, the edge-kind chips and the find / seed box" caption="Repository, lens, edge kinds with their counts, and the find / seed box." />
        <Bullets>
          <li>The <strong>repository</strong> picker.</li>
          <li>The lens buttons: <strong>Flow</strong>, <strong>Clusters</strong>, <strong>Explorer</strong>, <strong>Workbench</strong> (beta) and <strong>Repos</strong>.</li>
          <li>The edge-kind chips with their counts — <strong>calls 2,383</strong>, <strong>references 2,181</strong>, <strong>imports 929</strong> on inference-gateway. Click a chip to hide or show that kind. Imports start off in Flow and Explorer, which read call flow, and on in Clusters and Workbench, which read architecture.</li>
          <li><strong>find / seed a symbol…</strong> — type a name to light up matches on the canvas (<code>Enter</code> cycles through them) or pick a row to re-root the map on it.</li>
        </Bullets>
        <p>The line under the controls counts what is drawn against what exists — <code>0 of 3,430 symbols · 318 of 5,493 edges — 28 folders collapsed</code> — so a hidden part of the graph is always named. <strong>⧉ link</strong> copies a link that carries the lens, the focus, pins and edge kinds; <strong>ⓘ</strong> explains why the current lens looks the way it does.</p>
      </ProseSection>

      <ProseSection title="Pick a Lens">
        <p>The five lenses are five ways of reading the same stored graph. The focus symbol rides the URL, so switching lens keeps your place.</p>
        <div className="docs-table-wrap"><table>
          <thead><tr><th>Lens</th><th>What it shows</th><th>Reach for it when</th></tr></thead>
          <tbody>
            <tr><td><strong>Flow</strong></td><td>One symbol at a time: callers enter from the left, callees leave on the right, one to three layers deep.</td><td>You are about to change a function and want to see who feeds it and what it calls.</td></tr>
            <tr><td><strong>Clusters</strong></td><td>The whole repository as its folder tree, packed in circles, with the edges between folders aggregated and counted. Same input, same picture.</td><td>You are new to a repository, or want to see which folders lean on which.</td></tr>
            <tr><td><strong>Explorer</strong></td><td>An answer-first list of one symbol's callers and dependencies, with call-site evidence in each row and a small synced map (25 nodes at most).</td><td>You want the exact list, with line numbers, rather than a picture.</td></tr>
            <tr><td><strong>Workbench</strong> (beta)</td><td>An interactive canvas of modules, collapsed to badges on a large repository, with style, filter and layout panels, box select and PNG export.</td><td>You want to arrange and export a picture of part of the graph.</td></tr>
            <tr><td><strong>Repos</strong></td><td>The dependency graph between repositories, from HTTP calls one repository makes that match a route another serves.</td><td>Several services are indexed and you need to know which calls which.</td></tr>
          </tbody>
        </table></div>
        <Figure src="assets/docs/code-map/map-flow.png" alt="Flow lens focused on modelDenied: five callers on the left, seven callees on the right" caption="Flow on modelDenied at depth 2: five first-degree callers, seven first-degree callees, and the next layer on each side." />
        <Figure src="assets/docs/code-map/map-explorer.png" alt="Explorer lens on modelDenied: the focus card, callers grouped by file, dependencies grouped by module, and a small synced map" caption="Explorer on modelDenied: 5 callers, 7 dependencies, 5 call sites — each row expands to its evidence." />
        <Figure src="assets/docs/code-map/map-workbench.png" alt="Workbench beta lens: modules collapsed to badges, with style, module and symbol-kind panels on the left" caption="Workbench (beta): 117 modules collapsed to badges; tick a module to expand it on the canvas." />
        <p>Workbench is a beta: the first time you choose it, the map explains that it loads an extra analysis engine once and asks you to confirm with <strong>Enable Workbench</strong>. <strong>Repos</strong> needs at least two repositories where one calls the other over HTTP; with nothing to join it says so:</p>
        <Figure src="assets/docs/code-map/map-repos.png" alt="Repos lens: a repo-pair matrix of zeros and the note that no cross-repo route join is recorded" caption="Repos on the demo service: inference-gateway calls no route another indexed repository serves, so the matrix is empty." />
      </ProseSection>

      <ProseSection title="Read the Legend and Filter Edges">
        <p>Each lens has a <strong>Legend</strong> in the lower left of the canvas; click its title to fold it away. In Clusters it names the colour of each top folder, the line style of each edge kind, and how to read size: a folder's size is the number of symbols inside it, a symbol's size is its degree. Open top folders carry <code>↓</code> fan-in and <code>↑</code> fan-out badges.</p>
        <Figure src="assets/docs/code-map/map-legend.png" alt="The Clusters legend: folder colours, edge kinds and the size rules" caption="The Clusters legend." width={260} />
        <p>The Clusters toolbar controls how much is drawn:</p>
        <Figure src="assets/docs/code-map/map-modebar.png" alt="The Clusters toolbar: tint, EDGES all / focus-only / off, link, the lens note and the count strip" caption="tint, the EDGES switch, link and the count strip." />
        <Bullets>
          <li><strong>EDGES all</strong> draws every edge between folders; past the edge budget they bundle into weighted ribbons.</li>
          <li><strong>focus-only</strong> draws edges only for what you hover or select — the calm way to read a busy repository.</li>
          <li><strong>off</strong> draws no edges: folders only.</li>
          <li><strong>tint</strong> colours open folders in their hue.</li>
        </Bullets>
        <p>To zoom, use the <strong>+</strong> and <strong>−</strong> buttons in the lower right of the canvas or the mouse wheel; drag to pan; <strong>⤢</strong> (or <code>0</code>) fits the drawing to the frame. Click a node to select it.</p>
      </ProseSection>

      <ProseSection title="Seed a Symbol and Read Its Neighbourhood">
        <p>Flow and Explorer read one symbol at a time, so they start by asking for one.</p>
        <ol className="docs-list">
          <li>Click <strong>Flow</strong>. With no focus yet, the lens shows a search box and the repository's top hubs by degree.</li>
          <li>Type a name — <code>modelDenied</code> — and click the row for the definition you mean (<code>api/routes.go:622</code>).</li>
          <li>Read the layers: the five handlers that call <code>modelDenied</code> on the left, what it calls on the right (<code>ModelMatches</code>, <code>ParseModelSet</code>, the logger's <code>Error</code>), the second layer beyond each. Edge width grows with the number of call sites.</li>
        </ol>
        <Clip src="assets/docs/code-map/seed-symbol.mp4" alt="Switching to Flow, searching modelDenied, picking it, and the layered call flow drawing around it" caption="Seed Flow with modelDenied and read its callers and callees." />
        <p>The Flow toolbar works on the focus:</p>
        <Bullets>
          <li><strong>− 2 +</strong> steps the depth between 1 and 3; each step is a fresh query.</li>
          <li><strong>Hubs ▾</strong> lists the repository's hubs to re-seed from.</li>
          <li><strong>×N</strong> merges same-name definitions within a layer into one chip, such as <strong>Error ×4</strong>.</li>
          <li><strong>Path A→B</strong> draws the path between two symbols on the canvas; <strong>Impact</strong> overlays the blast radius of the selected symbol; <strong>Neighbors</strong> fetches and grafts the selected symbol's neighbours that are not drawn yet.</li>
          <li>When a layer holds many symbols that call the same thing, they fold into a <strong>co-callers</strong> bar; click it to expand.</li>
        </Bullets>
        <p>Anywhere on the map, double-click a symbol to re-root Flow on it. Explorer reads the same focus as a list: the focus card counts callers, dependencies, call sites and modules, and each row expands to the call-site lines.</p>
      </ProseSection>

      <ProseSection title="Isolate a Folder">
        <p>A large folder can be read on its own. In Clusters, double-click the folder: the map redraws with only that subtree, a breadcrumb (<code>inference-gateway › providers</code>) shows where you are, and the count strip says <code>isolated to providers</code>. <strong>⤴ leave isolate</strong> returns to the whole repository.</p>
        <Figure src="assets/docs/code-map/map-isolate.png" alt="Clusters isolated to the providers folder: types, registry, routing, transformers, constants, core and client" caption="providers isolated: 1,172 symbols, with common_types.go holding 873 of them." />
      </ProseSection>

      <ProseSection title="Find the Path Between Two Symbols">
        <p><strong>Path Finder</strong> (<code>#/path</code>) answers "how does A reach B?" with the shortest forward chain of stored call edges, or says that none exists.</p>
        <ol className="docs-list">
          <li>Pick the repository and a depth budget (6 by default).</li>
          <li>In <strong>From (the caller side)</strong> search and pick the start symbol; in <strong>To (the callee side)</strong> pick the target.</li>
          <li>Read the chain: one card per step with kind, signature and location, and the edge between steps. The map button on a card opens that symbol in the Code Map.</li>
        </ol>
        <Figure src="assets/docs/code-map/path-finder.png" alt="Path Finder: ChatCompletionsHandler reaches ModelMatches in two hops through modelDenied" caption="ChatCompletionsHandler reaches ModelMatches in 2 hops, through modelDenied." />
        <p>Call edges have a direction. If no path is found, <strong>swap</strong> asks the reverse question in one click. <strong>Copy link to this chain</strong> gives a link that reopens the same answer.</p>
      </ProseSection>

      <ProseSection title="Resolve a Log Line to Code">
        <p><strong>Resolve</strong> (<code>#/resolve</code>) starts from the other end: paste a log line, a stack frame or an error string, one per line, and Atlas finds the statement that emits it, then walks its blast radius and the recent change window. At index time Atlas records the message each log statement can emit, so a line with different ids, timestamps and values still matches.</p>
        <ol className="docs-list">
          <li>Pick the repository.</li>
          <li>Paste the line — here a JSON log line from the gateway: <code>{`{"level":"error",…,"msg":"model not in allowed list","model":"gpt-4o",…}`}</code>.</li>
          <li>Click <strong>Resolve</strong>. The answer is a chain of three cards.</li>
        </ol>
        <Figure src="assets/docs/code-map/resolve.png" alt="Resolve: the log line matched to modelDenied at routes.go:625, its impact, and the change window" caption="The line resolves to modelDenied (routes.go:625, 100% match, exact_skeleton); changing it would touch seven handlers." />
        <Bullets>
          <li><strong>Match</strong> — the emitting symbol and line, the match score and the reason the server gives (<code>exact_skeleton</code>), with <strong>Inspect</strong> and <strong>Map</strong>.</li>
          <li><strong>Impact</strong> — the symbols a change to it would reach.</li>
          <li><strong>Change window</strong> — the snapshot timeline and what changed between the last two snapshots. With a single snapshot indexed, it says a diff needs two.</li>
        </Bullets>
        <p>The commit and snapshot the evidence came from are pinned at the top of the answer.</p>
      </ProseSection>

      <ProseSection title="From the CLI">
        <p>Each map question has a command. Output below is from inference-gateway, in <code>--format plain</code>.</p>
        <p><code>atlas neighbors</code> — a symbol's direct callers and callees (what Flow draws at depth 1):</p>
        <Command>{`atlas neighbors modelDenied --format plain
neighbors modelDenied  callers 5  callees 6
  callers(5)  ChatCompletionsHandler, ImagesHandler, MessagesHandler, ResponsesHandler, handleImagesMultipart
  callees(6)  Error, Error, ModelMatches, ParseModelSet, Error, Error`}</Command>
        <p><code>atlas path</code> — the shortest forward call path (Path Finder); <code>--max-depth</code> sets the budget:</p>
        <Command>{`atlas path ChatCompletionsHandler ModelMatches --format plain
path ChatCompletionsHandler -> ModelMatches  len 2
  steps  ChatCompletionsHandler -> modelDenied -> ModelMatches

atlas path main ModelMatches --format plain
path main -> ModelMatches  NOT FOUND`}</Command>
        <p><code>atlas hubs</code> and <code>atlas communities</code> — the load-bearing symbols and the dense clusters (Orientation's lists):</p>
        <Command>{`atlas hubs --limit 5 --format plain
hubs  total 5
  main  function  in 0  out 71  total 71  cmd/gateway/main.go
  ProviderImpl.ListModels  method  in 2  out 53  total 55  providers/core/provider.go
  RouterImpl.handleImagesMultipart  method  in 2  out 53  total 55  api/routes.go
  RouterImpl.MessagesHandler  method  in 0  out 52  total 52  api/routes.go
  RouterImpl.ImagesHandler  method  in 0  out 51  total 51  api/routes.go

atlas communities --limit 3 --format plain
communities  total 3161  shown 3
  #0  size 137  ProviderImpl.ListModels, RouterImpl.handleImagesMultipart, RouterImpl.MessagesHandler
  #1  size 69  main, LoggerZapImpl.Debug, MockLogger.Debug
  #2  size 65  LoggerZapImpl.Error, MockLogger.Error, MockLoggerMockRecorder.Error`}</Command>
        <p><code>atlas report</code> — summary, hubs and communities in one Markdown report:</p>
        <Command>{`atlas report --format plain
# Graph report

## Summary

- Files: 89
- Symbols (nodes): 3526
- Call edges: 1317
- Communities (size > 1): 40
- Isolated nodes: 3121
- Languages: go:3511 bash:9 typescript:6
- Edge kinds: calls:4706 references:3158 imports:540
…`}</Command>
        <p><code>atlas export</code> — a symbol's neighbourhood or the whole graph as <code>json</code>, <code>mermaid</code>, <code>dot</code> or a self-contained <code>html</code> page; <code>--bundle DIR</code> writes the interactive page and the report together:</p>
        <Command>{`atlas export --symbol modelDenied --depth 1 --format mermaid
flowchart LR
  n0["RouterImpl (type)"]
  n1["modelDenied (method)"]
  n2["ChatCompletionsHandler (method)"]
  …
  n9["ParseModelSet (function)"]
  n10["ModelMatches (function)"]
  n2 --> n1
  n1 --> n10
  n1 --> n9
  …`}</Command>
        <p>Pasting a log line works from the terminal too: <code>atlas logsites resolve "&lt;line&gt;"</code> returns the same match (<code>api/routes.go:625</code>, <code>modelDenied</code>, <code>exact_skeleton</code>). Flags for each command are in the <a className="text-link" href="#docs/cli">CLI reference</a>; the map reads <code>GET /api/v1/export</code>, Path Finder <code>GET /api/v1/path</code> and Resolve <code>POST /api/v1/resolve</code> (see <a className="text-link" href="#docs/service">Dashboard and API</a>).</p>
      </ProseSection>

      <ProseSection title="Related">
        <Bullets>
          <li><a className="text-link" href="#docs/dashboard">The dashboard</a> — the frame, the omnibox and the inspector.</li>
          <li><a className="text-link" href="#docs/search-and-ask">Search and Ask</a> — find a symbol by name or ask in plain language.</li>
          <li><a className="text-link" href="#docs/impact">Impact and review</a> — the full blast radius of a change.</li>
          <li><a className="text-link" href="#docs/history">Change lens and history</a> — what each indexing pass changed.</li>
          <li><a className="text-link" href="#docs/observe">Observe</a> — log streams and incidents that Resolve links back to code.</li>
        </Bullets>
      </ProseSection>
    </>
  );
}
