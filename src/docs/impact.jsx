import React from "react";
import { Command, ProseSection, Bullets, Callout, Figure, Clip, RELEASE, GITHUB, WIKI } from "./ui.jsx";

export default function Page() {
  return (
    <>
      <p className="docs-lead">Impact answers the question you ask before you change something: what else does this reach? You name the symbols or files you are about to change; Atlas walks the stored call and import edges backwards to every symbol, file and test that could notice, and joins the result with the routes the repository serves and the repositories that call them. Reach for it before a refactor, while reviewing a pull request, or when you need to know which tests to run.</p>

      <ProseSection title="Open It">
        <p>In the dashboard, choose <strong>Impact</strong> in the EXPLORE group (<code>#/impact</code>). The view opens on the first repository with nothing picked. Everything you pick is written into the address — <code>#/impact?repo=&lt;repo&gt;&amp;symbols=a,b&amp;depth=3</code> — so a radius can be linked and reopened.</p>
        <Figure src="assets/docs/impact/impact-empty.png" alt="The Impact view before anything is picked: Repository, Add a symbol to the change set, depth and Compute radius" caption="Impact with nothing picked yet. The radius appears under the picker." />
        <p>From a terminal, the same question is one command. Positional arguments are symbols; changed files go in <code>--paths</code>:</p>
        <Command>{`atlas impact StreamChatCompletions
atlas impact --paths api/context_window.go`}</Command>
      </ProseSection>

      <ProseSection title="Find What a Change Reaches">
        <Clip src="assets/docs/impact/pick-a-symbol.mp4" alt="Typing StreamChatCompletions into the Impact picker, choosing the provider method, and the blast radius appearing" caption="Picking StreamChatCompletions on inference-gateway. The radius computes as soon as a symbol is picked." />
        <ol className="docs-list">
          <li>Choose the <strong>Repository</strong>.</li>
          <li>Type a name into <strong>Add a symbol to the change set…</strong>. The list offers only symbols the index holds, with their kind and <code>path:line</code>; free text is never accepted as a symbol.</li>
          <li>Pick one. The radius computes at once. Add more symbols (up to 12) to widen the change set; <strong>×</strong> on a chip removes it.</li>
          <li><strong>depth</strong> (1 to 6, default 3) bounds how many reverse hops the walk takes. <strong>Compute radius</strong> runs it again.</li>
        </ol>
        <Callout kind="tip" label="One name, every definition">
          <p>A name stands for every definition that carries it. In inference-gateway, <code>StreamChatCompletions</code> is an interface method, the provider's method and two test mocks, so the verdict starts from 4 seeds and lists all four under <strong>traversal roots</strong>.</p>
        </Callout>
      </ProseSection>

      <ProseSection title="Read the Radius">
        <Figure src="assets/docs/impact/impact-radius.png" alt="The Impact verdict: Changing these 4 seeds would touch 10 symbols across 8 files, the traversal roots, the impacted symbols and the impacted files grouped by module" caption="The radius of StreamChatCompletions: 10 symbols across 8 files at depth 3, with 6 covering tests." />
        <Bullets>
          <li><strong>The verdict</strong> — "Changing these 4 seeds would touch 10 symbols across 8 files", with the depth reached and the number of covering tests. It is labelled <strong>structural verdict</strong>: counted from stored edges, not written by a model. <strong>Copy link to this radius</strong> copies the address.</li>
          <li><strong>Impacted symbols</strong> are chips; each opens the Symbol Inspector.</li>
          <li><strong>Impacted files</strong> are grouped by module (here <code>tests</code> 4, <code>api</code> 2, <code>internal/mcp</code> 2), each with the reason the server gave — <code>caller</code> for all eight.</li>
          <li><strong>Covering tests in the radius</strong> lists the tests that reach the change, with <code>path:line</code>: the list to run before you merge.</li>
          <li><strong>Affected routes</strong> are the contracts whose handler symbol and file are both in the radius — here <code>POST /chat/completions</code> through <code>ChatCompletionsHandler</code>. Contracts that only share a file are counted, not listed.</li>
          <li><strong>Cross-repo blast</strong> checks whether another indexed repository calls a route served from the impacted files. On this single-repository demo it reads "no call site in another repo hits a route served from these files (10 served routes in the closure, 42 changed paths checked)".</li>
        </Bullets>
        <Figure src="assets/docs/impact/impact-tests-routes.png" alt="Further down the radius: impacted files by module, covering tests with path and line, the affected route POST /chat/completions, and the cross-repo line" caption="Covering tests, the affected route and the cross-repo line for the same radius." />
        <p>An empty radius is a finding, not an error: no stored edge reaches the seeds.</p>
      </ProseSection>

      <ProseSection title="Read the Routes a Repository Serves">
        <p>Choose <strong>Routes</strong> in the EXPLORE group (<code>#/routes</code>). It lists the HTTP contracts the index proved, each with its method, path pattern, handler, file and the server's <strong>CONF</strong> (confidence) verbatim. The filter box narrows by path, handler or method; <strong>all</strong> / <strong>≥ medium</strong> / <strong>high only</strong> sets a confidence floor. Rows are grouped by the module of the handler's file.</p>
        <Figure src="assets/docs/impact/routes-table.png" alt="The Routes view for inference-gateway: 20 contracts, 7 GET, 11 POST, 1 ALL, 1 ANY, 10 medium and 10 low confidence, with the api group of 9 routes" caption="inference-gateway serves 20 contracts: 7 GET, 11 POST, 1 ALL and 1 ANY; 10 medium and 10 low confidence." />
        <p>Of the 20, eleven are registered by <code>cmd/gateway/main.go</code> (one of them, <code>POST /metrics</code>, is handled by a test mock) and nine by the example MCP servers under <code>examples/</code>. <code>atlas stats</code> reports 71 route rows for the snapshot: 32 are outbound HTTP calls the gateway makes, and the rest are the registrations this view folds into 20 contracts.</p>
        <p>On a row:</p>
        <Bullets>
          <li>The <strong>handler</strong> name opens the Symbol Inspector.</li>
          <li><strong>chain</strong> opens the Inspector with the handler's callers, references and neighbours loaded.</li>
          <li>The crosshair button opens <strong>Impact</strong> for that handler.</li>
          <li>A click anywhere else opens the <strong>Dependency panel</strong> under the row: <strong>IMPLEMENTS — SAME REPO</strong> (the handler's call chain from the stored graph) and <strong>CONSUMED BY — OTHER REPOS</strong> (call sites in other indexed repositories that match this route).</li>
        </Bullets>
        <Figure src="assets/docs/impact/routes-dependency.png" alt="The Dependency panel under POST /chat/completions: IMPLEMENTS shows ChatCompletionsHandler at api/routes.go:46, CONSUMED BY shows no recorded call site in another repo" caption="The Dependency panel of POST /chat/completions. The graph records no outgoing call edge from the handler; no other repository calls the route." />
      </ProseSection>

      <ProseSection title="Find Who Calls a Route from Another Repository">
        <p>Cross-repo answers join two repositories: the routes one serves and the HTTP calls another makes. Three commands ask it from either side:</p>
        <Bullets>
          <li><code>atlas consumers</code> — the other repositories that call a route this one serves.</li>
          <li><code>atlas dependencies</code> — the producers and handlers that serve the calls this one makes.</li>
          <li><code>atlas cross-repo-impact --paths &lt;files&gt;</code> — which other repositories call the routes served by the handlers in the changed files.</li>
        </Bullets>
        <p>The demo service holds one code repository, so every join is empty. This is the real output, and the shape a populated answer fills:</p>
        <Command>{`atlas consumers --format plain`}</Command>
        <Command label="Output">{`consumers inference-gateway  impacted 0/0  repos 0/0
  producer  52496750  indexed 2026-10-28T05:16:55Z`}</Command>
        <Command>{`atlas cross-repo-impact --paths api/routes.go`}</Command>
        <Command label="JSON">{`{
  "repo": "inference-gateway",
  "served_routes": [
    { "method": "GET", "path_pattern": "/health",
      "handler_file": "api/routes.go", "handler_symbol": "HealthcheckHandler",
      "confidence": "medium", "registered_in": "cmd/gateway/main.go", "registered_line": 310 },
    …
  ],
  "impacted": [],
  "consumer_repos": [],
  "producer_commit": "524967508e9d90185c4a1c3540cac0dcda7c580a",
  "closure_size": 13,
  "effective_changed_paths": 14,
  "total_served_routes": 10
}`}</Command>
        <p>With a second repository indexed — a front end or another service whose code calls these paths — <code>impacted</code> lists each matched route with the calling file and symbol, and <code>consumer_repos</code> names the callers. The same joins feed the <strong>CONSUMED BY</strong> half of the Dependency panel, the cross-repo line of Impact, and the <strong>Repos</strong> lens of the Code Map, which draws a repo-pair matrix: rows consume, columns produce.</p>
        <Figure src="assets/docs/impact/repos-lens.png" alt="The Code Map Repos lens: a repo-pair matrix of github://github, inference-gateway and prometheus://promlabs, all zero, and the note No cross-repo route join recorded" caption="The Repos lens on the demo. The other two rows are connected sources, which serve no routes, so every cell is 0." />
      </ProseSection>

      <ProseSection title="Gather Review Context for a Change">
        <p>Three read-only commands prepare a review. <code>atlas context</code> builds a bounded bundle around changed paths — the changed symbols with excerpts, retrieval hits for an optional question, the impacted files and the edges between them — sized for a model's context window:</p>
        <Command>{`atlas context --format plain --paths providers/core/provider.go "how are streaming chat completions forwarded"`}</Command>
        <Command label="Output">{`context  mode symbol_context  files 13  symbols 32  edges 17  hits 4  impacted 0
  files(13)  providers/core/provider.go, internal/guardrails/guardrails.go, logger/logger.go, …
  symbols(29)  HTTPError, StatusCode, Message, Error, ProviderImpl, ID, Name, URL, Token, …`}</Command>
        <p><code>atlas receipt</code> compares a git base with <code>HEAD</code> against the local snapshot and prints what the diff touches. It never indexes or writes anything:</p>
        <Command>{`atlas receipt --base HEAD~3`}</Command>
        <Command label="Output">{`Atlas pre-submit receipt
changed paths: 4
changed symbols:
  VERSION — callers ambiguous (config/meta.go:5)
  TracesEndpointURL — callers 2 (otel/otel.go:86)
  Init — callers ambiguous (otel/otel.go:104)
  TestTracingTracesEndpointURL — callers 0 (tests/tracing_test.go:312)
caller note: ambiguous means multiple same-named definitions; count withheld
served routes touched: 10
consumer repos: 0
local snapshot e842033e · commit 52496750 · NOT the server's snapshot`}</Command>
        <p><code>atlas coverage</code> lists the tests that reach a symbol. Without an imported coverage profile it answers from the call graph (<code>mode static</code>); <code>atlas coverage import</code> loads a Go coverprofile or LCOV file for real line coverage:</p>
        <Command>{`atlas coverage --format plain StreamChatCompletions`}</Command>
        <Command label="Output">{`coverage StreamChatCompletions  mode static  covered true  dir tests_for_symbol
  tests(20)  TestRunWithStreamReturnsWhenConsumerAbandons, TestChatCompletionsHandler_StreamingErrorHandling, TestChatCompletionsRouting_StreamingPassthrough, TestAgent_RunWithStream, …`}</Command>
      </ProseSection>

      <ProseSection title="From the CLI">
        <Command>{`atlas impact StreamChatCompletions --format plain`}</Command>
        <Command label="Output">{`impact  symbols 10  files 8  tests 6  depth 3
  symbols(10)  ChatCompletionsHandler, Middleware, RunWithStream, TestAgent_RunWithStream, …
  files(8)  api/middlewares/mcp.go, api/routes.go, internal/mcp/agent.go, internal/mcp/client_concurrency_test.go, …
  tests(6)  TestRunWithStreamReturnsWhenConsumerAbandons, TestChatCompletionsHandler_StreamingErrorHandling, …`}</Command>
        <Command>{`atlas route-contracts --format plain`}</Command>
        <Command label="Output">{`route_contracts inference-gateway  total 20
  ALL /mcp  confidence low  source route_table
  ANY /metrics  Handler  confidence low  source route_table
  GET /  confidence low  source route_table
  GET /capabilities  func  confidence low  source route_table
  GET /health  HealthcheckHandler  confidence medium  source route_table
  …`}</Command>
        <p><code>--max-depth</code> bounds the walk (default 3) and <code>--tests=false</code> leaves out covering tests. The <a className="text-link" href="#docs/cli">CLI reference</a> lists every flag.</p>
      </ProseSection>

      <ProseSection title="From the API and MCP">
        <p>The views read these routes on the running service (<a className="text-link" href="#docs/service">Dashboard and API</a>):</p>
        <div className="docs-table-wrap"><table>
          <thead><tr><th>Route</th><th>Answers</th></tr></thead>
          <tbody>
            <tr><td><code>POST /api/v1/impact</code></td><td>The radius: <code>{`{"symbols": […], "repo_id": "…", "max_depth": 3}`}</code></td></tr>
            <tr><td><code>GET /api/v1/repos/{"{repo}"}/route-contracts</code></td><td>The routes a repository serves, paged with <code>next_offset</code></td></tr>
            <tr><td><code>GET /api/v1/repos/{"{repo}"}/consumers</code> · <code>/dependencies</code></td><td>Cross-repo callers and producers</td></tr>
            <tr><td><code>GET /api/v1/repos/{"{repo}"}/consumer-contracts</code></td><td>Every outbound call the repository makes, matched or not</td></tr>
            <tr><td><code>POST /api/v1/repos/{"{repo}"}/cross-repo-impact</code></td><td>Cross-repo blast for <code>{`{"changed_paths": […]}`}</code></td></tr>
          </tbody>
        </table></div>
        <p>An assistant asks the same questions over MCP through the <code>impact</code> tool (with <code>scope=cross_repo</code> for the cross-repo radius), <code>routes</code> and <code>context</code>. See <a className="text-link" href="#docs/mcp">MCP tools</a>.</p>
      </ProseSection>

      <ProseSection title="Related">
        <Bullets>
          <li><a className="text-link" href="#docs/code-map">Code Map and graph</a> — walk the callers and callees a radius is made of.</li>
          <li><a className="text-link" href="#docs/history">Change lens and history</a> — what an indexing pass changed, and how history grows.</li>
          <li><a className="text-link" href="#docs/workbench">Ask Workbench</a> — ask about a change in plain language, with citations.</li>
          <li><a className="text-link" href="#docs/mcp">MCP tools</a> — the same answers for an AI assistant.</li>
        </Bullets>
      </ProseSection>
    </>
  );
}
