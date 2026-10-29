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
  overloaded. Since 0.1.55 an owner-qualified name — `Type.method`,
  `Widget.prototype.render`, a Go `pkg.Func` — resolves on every view,
  including the default `explain`
  ([#150](https://github.com/aziron-ai/atlas/issues/150)), and `mutations: true` on the refs view lists only the
  references that write a symbol ([#55](https://github.com/aziron-ai/atlas/issues/55)).
- `context` when reviewing a known set of changed files.
- `impact` before a change, to size its blast radius.
- `routes` for service contracts, consumers, and dependencies.
- `report` for whole-graph analytics. Since 0.1.55 its `hubs` and
  `communities` sections are the whole `atlas hubs` / `atlas communities`
  answers — objects carrying `eligible`, `excluded_isolated`, `warnings` and
  the community split, rows capped by `limit` — rather than bare arrays
  ([#45](https://github.com/aziron-ai/atlas/issues/45)).
- `status` when results look empty or stale — it reports index and readiness
  state, which distinguishes "no index" from "no matches". Since 0.1.55 it
  also carries a `telemetry` block, so a read-only server says
  `unavailable_read_only` instead of leaving fields out
  ([#154](https://github.com/aziron-ai/atlas/issues/154)).

## Workspace Scoping

Repository-scoped tools need to know which repository they operate on. Atlas
accepts scope from, in order of availability:

- a workspace root supplied by the client
- a `workspace` argument on the call
- a repository ID
- a repository pinned at launch time with `--repo`

If none is available, Atlas returns `workspace_required` instead of silently
choosing a repository.

**Since 0.1.55**, more of these signals resolve, and a refusal says which one
it judged:

- **Windows roots.** A root a Windows client declares — `file:///C:/…`, VS
  Code's `file:///c%3A/…`, `file://localhost/C:/…`, a UNC path or a plain
  `C:\` path — resolves to its directory and matches without regard to case or
  separators. This is verified by tests on macOS; a run on Windows is still
  pending ([#72](https://github.com/aziron-ai/atlas/issues/72)).
- **Checkouts Atlas did not index.** A `workspace` that is a linked worktree,
  another clone or a worktree of a bare clone of an indexed repository is
  served by that index when its HEAD and working-tree state equal the latest
  snapshot; the scope reason is `workspace_identity`. Several equal checkouts
  are refused as `ambiguous_repo` with `candidates[]` and a remedy to pass
  `repo_id` ([#42](https://github.com/aziron-ai/atlas/issues/42)).
- **Refusals name their source.** A scope refusal carries `scope_source`
  (`workspace`, `cwd`, `roots` or `launch_roots`). A miss on client roots
  alone lists each root it tried in `roots_tried[]` (`path`, `uri`, and what
  is at that path), and a `workspace_not_indexed` refusal names the
  `searched_stores` and a `checkout` diagnosis (`content_differs`,
  `not_a_git_checkout`) beside `repos[]` and `remedy`
  ([#72](https://github.com/aziron-ai/atlas/issues/72),
  [#42](https://github.com/aziron-ai/atlas/issues/42)).

## Result Statuses

Check the status field before trusting a result — it tells you whether the
answer is backed by an index at all.

| Status | Meaning |
| --- | --- |
| `ok` | Atlas returned cited context |
| `indexing` | An index was started or is still running |
| `no_index` | No usable index exists for the workspace |
| `insufficient` | The index could not support a cited answer — nothing citeable is indexed, or (since 0.1.55, with `require_citations`) the retrieved code does not carry what the question names: `reason: citations_below_relevance_floor` |
| `budget_exceeded` | Strict output budget was too small |
| `workspace_required` | Repository scope was not declared |
| `workspace_not_indexed` | The workspace has no index this server can use; retry `code_query` with `allow_lazy_index=true`, or re-call with one of `repos[]` |
| `ambiguous_repo` | Several repositories match; re-call with one of `candidates[]` as `repo_id` |

## Citations and the Relevance Floor

A non-empty citation list is not evidence on its own: keyword search always
matches something. **Since 0.1.55**, `code_query` with
`require_citations: true` also checks that the cited symbol names and paths
carry what the question names — an identifier it spells, or enough of its
specific terms ([#60](https://github.com/aziron-ai/atlas/issues/60)). Below
that floor it refuses:

| Field | When | Meaning |
| --- | --- | --- |
| `status` | refused | `insufficient`, with no `citations` and no `context` |
| `reason` | refused | `citations_below_relevance_floor` — stable; branch on it |
| `relevance` | refused, or `ok` with pruned citations | the verdict (`below_floor` or `grounded`), what grounded it, the terms it looked for and matched, and how many citations it pruned |
| `low_confidence_hits` | refused, or `ok` with pruned citations | up to 5 candidates with the words they matched — never citations, never evidence |

On a grounded answer, a keyword-only citation that matched only generic words
moves to `low_confidence_hits`; graph evidence is never pruned. An answer the
floor did not touch is unchanged. With `require_citations`, trimming to
`max_tokens` never removes the last citation: a budget that cannot hold one is refused with
`budget_exceeded`, and the message names the budget that would fit
([#160](https://github.com/aziron-ai/atlas/issues/160)).

**Evidence inside large functions.** The index keeps a bounded window of each
body. When a cited symbol is longer than that window, `code_query` and
`context` re-read the lines that match the question from the file — only when
the file still has the indexed hash — and serve the signature, up to 4
windows and the closing line, with each skipped run marked
`// ... elided N lines (La-Lb) ...`. `metadata.body_elision` records what was
shown and elided, or why the file was not used (`source_changed`,
`source_unavailable`, `source_too_large`, `budget_trimmed`, `focus_cap`); the
citation keeps the symbol's real line range
([#156](https://github.com/aziron-ai/atlas/issues/156)).

## Freshness Fields

**Since 0.1.55**, `code_query`, `symbol` (every view), `search` and `context`
answers say how their snapshot relates to the checkout, with the same fields
the CLI and HTTP API return ([#59](https://github.com/aziron-ai/atlas/issues/59),
[#62](https://github.com/aziron-ai/atlas/issues/62)):

| Field | Meaning |
| --- | --- |
| `indexed_sha` | the snapshot that answered; `<sha>+dirty` when it was built from uncommitted work |
| `head_sha` | the live HEAD, or `unknown` when git cannot answer |
| `dirty` | whether the working tree has indexable changes |
| `stale`, `stale_reason` | whether the answer lags the checkout: `head_moved`, `working_tree_dirty`, `working_tree_changed` or `working_tree_reverted`. Omitted, never `false`, when git cannot answer |
| `refresh` | `none` on a clean tree; `started` when this answer queued a refresh (with `refresh_target`); `completed` on answers from the refreshed snapshot in the next 10 minutes (with `refresh_snapshot` and `refreshed_at`) |

A stale answer is still an answer: it tells the assistant the line numbers may
have moved. A long-running MCP server queues the refresh itself and says so
with `refresh: "started"`.

## Controlling Token Spend

Tune detail and format so results fit the assistant's context window instead
of trimming after the fact:

- Use `detail=low` when you only need counts or minimal metadata; `medium` for
  names and signatures; `high` for repository-local evidence; `xhigh` only
  when broader cross-repo context is required. Since 0.1.55 the tool schema's
  `detail` enum lists every accepted spelling (`l`/`0`, `med`/`m`/`1`,
  `h`/`2`, `x`/`max`/`full`/`3`), and each means what it means on the CLI and
  the HTTP API ([#146](https://github.com/aziron-ai/atlas/issues/146)).
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
