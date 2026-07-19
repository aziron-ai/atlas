# MCP Tools

Atlas MCP tools provide bounded code context to coding assistants. Start MCP
over stdio for desktop agents:

```sh
atlas mcp --transport stdio
```

Or expose MCP through the local service:

```sh
atlas serve --mcp
```

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

## Recommended Starting Point

Use `code_query` for most repository questions. It checks index readiness and
returns cited context under a bounded response budget.

Example intent:

```text
How is checkout authorization enforced, and which tests cover it?
```

Use `context` instead when reviewing a known set of changed files:

```text
changed_paths:
  - internal/api/handler.go
intent: review
query: correctness, regressions, and missing tests
```

## Symbol Views

The `symbol` tool supports views such as:

- `explain`
- `definition`
- `snippet`
- `callers`
- `callees`
- `neighbors`
- `refs`
- `coverage`

Add package, receiver, or arity filters when a name is overloaded.

## Detail and Budgets

Use:

- `low` for counts and minimal metadata
- `medium` for names and signatures
- `high` for repository-local evidence
- `xhigh` only when broader context is required

Normal budget overflow may trim results and mark them as truncated. Strict
budget mode refuses an oversized answer instead.

## Common Status Values

| Status | Meaning |
| --- | --- |
| `ok` | Atlas returned cited context |
| `indexing` | An index was started or is still running |
| `no_index` | No usable index exists for the workspace |
| `insufficient` | The index could not support a cited answer |
| `budget_exceeded` | Strict output budget was too small |
| `workspace_required` | Repository scope was not declared |

## Transport Security

Stdio MCP is local to the launching assistant. HTTP MCP should stay on loopback
unless authentication and origin restrictions are configured:

```sh
export ATLAS_API_TOKEN='replace-with-a-strong-token'
export ATLAS_MCP_ALLOWED_ORIGINS='https://trusted.example'
atlas serve --mcp --addr 0.0.0.0:3099
```

See [Privacy and Data Handling](Privacy-and-Data-Handling) before enabling
networked access.
