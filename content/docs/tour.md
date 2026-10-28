# What Atlas does

Atlas builds a local index of a repository — its symbols, the calls and
references between them, the HTTP routes it serves and the history of each
indexing pass — and answers questions about it exactly, with a file and line
for every claim. The same index feeds a browser dashboard, a command line, an
HTTP API and AI assistants over MCP, so a person and an assistant read the
same facts. This page shows each area in one frame and links to its guide.
Every screenshot is from Atlas running on the public Go project
inference-gateway.

## Command Center

The dashboard opens on the **Command Center**: a summary of everything one
Atlas service holds. Tiles count recall savings, connected devices, skills,
events per minute and the service's own latency; a row below shows each
configured monitoring tool; a live feed on the right lists the newest events.
Every number is read from the running service, and every tile opens the view
that owns it. The navigation rail on the left reaches every other area.

![The Command Center with KPI tiles, the Observe row and the Live activity feed](assets/docs/tour/command-center.png "The Command Center.")

Read more: [The dashboard](dashboard).

## Code Map

The **Code Map** draws the stored graph five ways. **Clusters** packs the
whole repository as its folder tree; **Flow** reads one symbol with its
callers on the left and callees on the right; **Explorer** lists the same
relations with call-site evidence; **Workbench** (beta) is a canvas you
arrange and export; **Repos** draws which services call which. **Path
Finder** traces how one function reaches another, and **Resolve** maps a
pasted log line back to the code that emits it.

![The Code Map in the Clusters lens for inference-gateway](assets/docs/tour/code-map.png "The Code Map, Clusters lens.")

Read more: [Code Map and graph](code-map).

## Search and Ask

Press `/` anywhere in the dashboard to search every indexed symbol by name,
path or a word from its signature. **Ask Atlas** takes a question in plain
language and answers with the lines that answer it — the best passage first,
quoted and cited, then the other files that matched. For symbol questions it
adds an exact verdict, such as the number of callers. An optional AI answer,
written only from those passages, can sit on top.

![Ask Atlas answering how are allowed models enforced with a passage from config/config.go](assets/docs/tour/search-and-ask.png "Ask Atlas: the best passage for a question, quoted with its lines.")

Read more: [Search and Ask](search-and-ask).

## Ask Workbench

The **Ask Workbench** is a conversation about the codebase. Atlas gathers the
evidence — passages, definitions, routes, git history, and the tickets and
pull requests of connected sources — and a model you choose writes the
answer, citing each piece. The evidence panel lists every item the answer
rests on, and the server keeps each thread, so you can come back to it or
share its link.

![Ask Workbench answering which HTTP routes the gateway serves, with a routes table and citation chips](assets/docs/tour/workbench.png "A Workbench thread: the routes table, every row cited, and the evidence on the right.")

Read more: [Ask Workbench](workbench).

## Impact and Routes

Before you change a symbol, **Impact** shows what the change could reach over
stored call and import edges: every affected symbol, file and test, the
routes whose handlers fall inside that radius, and the call sites in other
indexed repositories. **Routes** lists the HTTP surface the index proved,
each route with its handler. The same answers come from `atlas impact` and
`atlas context` when you review a change.

![Impact for modelDenied: seven impacted handlers](assets/docs/tour/impact.png "The blast radius of modelDenied: seven symbols, each resolvable in the inspector.")

Read more: [Impact and review](impact).

## Change Lens

Every indexing pass is kept as a snapshot. The **Change Lens** shows the
timeline of snapshots for a repository and, for any pass, what it changed:
symbols added, modified and removed, files touched, call edges gained and
lost. With a single snapshot it says a diff needs two and gives the command
that makes the second. **Freshness** shows how current each index is.

![Change Lens for inference-gateway with one snapshot recorded](assets/docs/tour/change-lens.png "The Change Lens on a repository indexed once: one snapshot, and the command that records the next.")

Read more: [Change lens and history](history).

## Observe

Connect a log store, Prometheus, Jenkins or Tempo and an **OBSERVE** group
appears in the navigation: Log Streams, What Changed, Alerts & Metrics,
Builds, Incidents and Traces. Each answers a bounded question — the alerts
firing now, the log templates growing since a deploy, the build that failed —
and links what it finds back to the code that emits it. Atlas keeps templates
and summaries, not raw lines.

![Alerts and Metrics reading the public Prometheus demo: firing alerts and a bounded query](assets/docs/tour/observe.png "Alerts & Metrics against the public Prometheus demo.")

Read more: [Observe](observe).

## Connected Sources

Code is one source among several. `atlas source` indexes GitHub pull requests
and issues, Jira, Confluence, OneDrive, Jenkins, Prometheus, Grafana and Tempo
as virtual repositories beside your code, so a search or a Workbench question
can cite a ticket as readily as a function. The **Connectors** page configures
the monitoring tools: each card says what it unlocks, saving checks that the
tool is reachable, and credentials are stored as environment variable names,
never values.

![The Connectors page with Grafana Loki and Prometheus configured](assets/docs/tour/sources.png "Connectors: a Loki log pull and the Prometheus demo configured.")

Read more: [Connected sources](sources).

## Skills and Automations

A skill is a reviewed runbook an assistant can follow: steps, the parameters
it takes, its preconditions, how to verify it worked and how to roll it back.
**Skill Studio** turns repeated sessions into a draft; **Skills** moves each
one through candidate, validating and trusted, and only trusted skills are
offered to connected assistants. **Approvals** holds the requests that wait
for a person.

![The Skills view with one validating runbook: its steps, rendered SKILL.md and contract](assets/docs/tour/skills.png "A skill under validation: runbook steps, the rendered SKILL.md and its contract.")

Read more: [Skills and automations](skills).

## AI Assistants over MCP

`atlas bootstrap` registers Atlas as an MCP server for the assistants it
finds on the machine — Claude, Codex, Copilot, Cursor, Gemini — and installs
an instruction to ask Atlas before searching files. The assistant then calls
the same tools the dashboard uses — search, symbol, impact, routes, logs and
more. When assistants reach Atlas through the service, the System page counts
every call, with errors, latency and the size of the answer.

![System per-tool breakdown: calls, errors, p50, p95 and estimated tokens for each tool](assets/docs/tour/assistants.png "System → Per-tool breakdown: every tool call the service answered.")

Read more: [AI assistant setup](assistants).

## The CLI

Every answer the dashboard shows is also a command of the single `atlas`
binary, with `--format plain` for people and JSON for scripts. Index, search,
ask for callers, trace a path, size a change, read the graph report, export
the graph, run the service:

```sh
atlas callers modelDenied --format plain
callers modelDenied  total 5
  ChatCompletionsHandler  method  api/routes.go:637  :: func (router *RouterImpl) ChatCompletionsHandler(c *gin.Context)
  ImagesHandler  method  api/routes.go:1194  :: func (router *RouterImpl) ImagesHandler(c *gin.Context)
  MessagesHandler  method  api/routes.go:842  :: func (router *RouterImpl) MessagesHandler(c *gin.Context)
  …
```

Read more: [CLI reference](cli).

## How the Pieces Fit

1. **Index.** `atlas index` parses a repository into symbols, edges and
   routes and stores them, with a lexical search index, in a local database.
   Each pass is a snapshot.
2. **Graph.** Every query — search, callers, path, impact, report — reads that
   stored graph. Nothing is guessed at query time.
3. **Surfaces.** The same graph is served four ways: the CLI, the dashboard
   and HTTP API of `atlas serve`, and MCP for assistants (`atlas mcp`, or
   `atlas serve --mcp`).

[Core concepts](concepts) explains snapshots, scope and output control;
[Getting started](getting-started) takes you from install to the first
answer.
