# MCP Tools

Atlas exposes its graph, search, and impact analysis as MCP tools, so a
connected assistant answers repository questions with bounded, cited context
instead of raw file dumps. This page covers the transports, the tool set, how
workspace scope is resolved, and how to keep responses small.

## Transports

Choose the transport based on how the client launches Atlas. Desktop agents
spawn a process and speak stdio; shared setups talk HTTP to one long-running
service.

Stdio (the default; local to the launching assistant):

```sh
atlas mcp --transport stdio
```

HTTP, mounted on the local service at `POST /mcp`:

```sh
atlas serve --mcp
```

`atlas mcp` can also serve HTTP directly with `--http 127.0.0.1:8765`
(Streamable HTTP) or `--sse 127.0.0.1:8766` (legacy HTTP+SSE); set
`ATLAS_API_TOKEN` to require `Authorization: Bearer` on either. With
`--supervise`, Atlas runs as the supervised warm MCP gateway: it uses the
workspace database, starts a background watch, and serves `code_query` first.
By default the MCP process also watches the repository to keep the graph
fresh (`--watch=false` or `ATLAS_NO_WATCH=1` to disable; `--watch-path` to
watch a different path).

## Tool Selection

| Tool | Use it for |
| --- | --- |
| `code_query` | Natural-language questions about a repository |
| `search` | Focused lexical or semantic discovery |
| `symbol` | Definitions, snippets, callers, callees, refs, and coverage |
| `graph` | Paths or neighborhoods between symbols |
| `impact` | Repository or cross-repository blast radius |
| `routes` | Served routes, consumers, and dependencies |
| `context` | Code-review context for changed paths |
| `report` | Repository-level code intelligence reports |
| `history` | Indexed history and graph changes |
| `status` | Index, readiness, and retrieval state |
| `link` | Register a repository for workspace or cross-repository analysis |
| `record_feedback` | Record result-quality feedback |
| `record_task` | Record the outcome of a procedural task |

## Choosing a Tool

Start with `code_query` for most repository questions: it checks index
readiness and returns cited context under a bounded response budget. Reach for
a narrower tool when you already know the shape of the answer:

- `symbol` when you have a name and want its definition, callers, callees,
  refs, or coverage. Add package, receiver, or arity filters when the name is
  overloaded.
- `context` when reviewing a known set of changed files.
- `impact` before a change, to size its blast radius.
- `routes` for service contracts, consumers, and dependencies.
- `status` when results look empty or stale — it reports index and readiness
  state, which distinguishes "no index" from "no matches".

## Workspace Scoping

Repository-scoped tools need to know which repository they operate on. Atlas
accepts scope from, in order of availability:

- a workspace root supplied by the client
- a `workspace` argument on the call
- a repository ID
- a repository pinned at launch time with `--repo`

If none is available, Atlas returns `workspace_required` instead of silently
choosing a repository.

## Result Statuses

Check the status field before trusting a result — it tells you whether the
answer is backed by an index at all.

| Status | Meaning |
| --- | --- |
| `ok` | Atlas returned cited context |
| `indexing` | An index was started or is still running |
| `no_index` | No usable index exists for the workspace |
| `insufficient` | The index could not support a cited answer |
| `budget_exceeded` | Strict output budget was too small |
| `workspace_required` | Repository scope was not declared |

## Controlling Token Spend

Tune detail and format so results fit the assistant's context window instead
of trimming after the fact:

- Use `detail=low` when you only need counts or minimal metadata; `medium` for
  names and signatures; `high` for repository-local evidence; `xhigh` only
  when broader cross-repo context is required.
- Use `format=plain` for compact line-oriented output when the client does not
  need structured JSON.
- Set `max_tokens` to bound a `code_query` answer; an answer trimmed to fit is
  marked `truncated:true`. Strict budget mode refuses an oversized answer and
  returns `budget_exceeded` instead.

## Transport Security

Stdio MCP is local to the launching assistant. HTTP MCP should stay on
loopback unless authentication and origin restrictions are configured:

```sh
export ATLAS_API_TOKEN='replace-with-a-strong-token'
export ATLAS_MCP_ALLOWED_ORIGINS='https://trusted.example'
atlas serve --mcp --addr 0.0.0.0:3099
```

See [Privacy and Data Handling](privacy) before enabling networked access, and
[Dashboard and HTTP API](service) for the full service surface.
