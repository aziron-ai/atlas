# Upgrade and Uninstall

Upgrade the binary through the channel you installed with, then run the
post-upgrade sequence — the binary and the on-disk data have separate version
contracts, and skipping the sequence is the most common source of
post-upgrade drift.

## What's New in 0.1.55

Atlas 0.1.55 is a correctness and trust release. A dirty working tree gets a
snapshot of its own, every repo-scoped answer says how fresh it is,
`code_query` refuses rather than cite code that does not carry the question,
and qualified, case-exact and cross-file names resolve the same way on every
surface. There is no schema change. Each item links to its public issue, where
the before-and-after evidence is posted.

### How to Upgrade

Homebrew:

```sh
brew update
brew upgrade --cask aziron-ai/atlas/atlas
atlas version
```

npm:

```sh
npm install -g @aziron/atlas@0.1.55
atlas version
```

To install a binary you already have (offline, behind a proxy, or one you
verified yourself), point `ATLAS_BINARY` at it. Postinstall now honours it: it
checks that the file exists, is executable and that `atlas version` prints an
Atlas version line within 30 s, then copies it into the package. It makes no
request to the release host and never falls back to a download; an invalid
path fails the install. `ATLAS_SKIP_DOWNLOAD=1` still makes postinstall do
nothing and takes precedence
([#151](https://github.com/aziron-ai/atlas/issues/151)).

```sh
ATLAS_BINARY=/absolute/path/to/atlas npm install -g @aziron/atlas
```

Archives and Linux packages are on the
[release page](https://github.com/aziron-ai/atlas/releases/latest). Then run the
post-upgrade sequence further down this page.

**Store compatibility.** No schema change. A dirty snapshot is stored as
`<sha>+dirty:<tree_hash>` in the existing `commit_sha` column, so an older
binary can still open a store 0.1.55 wrote
([#65](https://github.com/aziron-ai/atlas/issues/65)). Some improvements are
written when a file is indexed: import bindings and Go import resolution
([#126](https://github.com/aziron-ai/atlas/issues/126)), cross-file type
provenance for Scala, PHP and Java
([#21](https://github.com/aziron-ai/atlas/issues/21),
[#24](https://github.com/aziron-ai/atlas/issues/24),
[#34](https://github.com/aziron-ai/atlas/issues/34),
[#137](https://github.com/aziron-ai/atlas/issues/137),
[#139](https://github.com/aziron-ai/atlas/issues/139)) and image text
([#26](https://github.com/aziron-ai/atlas/issues/26)). An existing snapshot
shows them after one `atlas index --reindex`.

### Resolution and Provenance

- **Owner-qualified names.** `explain Module._findPath` and the MCP `symbol`
  default view now find the method that `callers` finds;
  `Widget.prototype.render` keeps its prototype owner; a Go `util.Helper` is
  checked against the package clause and fails closed when two directories
  answer to it. Each explain definition names its `owner`, and an unknown
  owner never widens to the bare name
  ([#150](https://github.com/aziron-ai/atlas/issues/150)).
- **Case twins stay apart.** In case-sensitive languages a name binds only to
  its exact spelling, so Go's `newEntry()` calling `NewEntry()` no longer binds
  to itself, and an answer no longer depends on which spelling was asked first.
  PowerShell, SQL, Fortran, PHP, Pascal/Delphi, Apex and VB keep folding case
  ([#125](https://github.com/aziron-ai/atlas/issues/125)).
- **Impact parity.** The in-memory impact walk follows heritage and proven
  references like the store walk
  ([#136](https://github.com/aziron-ai/atlas/issues/136)). Go package variables
  in a flat-layout module (the package at the module root) bind on `impact`,
  focused `export` and `export --all`
  ([#142](https://github.com/aziron-ai/atlas/issues/142)).
- **Scala, PHP and Java type scope.** An index-time resolver stamps the
  declaring file of a type use from the file's package and imports, failing
  closed when ambiguous, so `export` and `impact` keep cross-file type uses.
  Scala universal `apply` binds to its class; Java return, field and annotation
  element types become references; PHP class constants, static properties,
  container and event rows prove their class
  ([#21](https://github.com/aziron-ai/atlas/issues/21),
  [#24](https://github.com/aziron-ai/atlas/issues/24),
  [#34](https://github.com/aziron-ai/atlas/issues/34)). Scala import selectors
  resolve by Scala's lookup order and gain `resolved_path` only when exactly
  one file declares the target under a verified package clause; `import a.B,
  c.{D, E}` no longer runs together
  ([#137](https://github.com/aziron-ai/atlas/issues/137)).
- **Go and Python import bindings.** `from X import A, B` keeps one edge per
  statement: binding rows are marked `import_binding` / `import_module` and
  fold onto the module edge in `export`. Parenthesized imports are read from
  the syntax tree, and `from . import foo` stores `.foo`. Go imports resolve
  through `go.mod` (nested modules and in-repo `replace` directives included)
  to the package directory, and a delta refreshes that when a package
  directory or `go.mod` changes
  ([#126](https://github.com/aziron-ai/atlas/issues/126)).
- **PHP use-imports and anonymous classes.** `use` clauses are read from the
  syntax tree per namespace region, one row per clause, so grouped and aliased
  imports (`use App\Events\Shipped as ShippedEvent`) prove their class and
  `use function` / `use const` never resolve to a class
  ([#139](https://github.com/aziron-ai/atlas/issues/139)). Anonymous-class
  heritage belongs to the method or function that constructs the class; at
  file top level it keeps the module-scope identity
  ([#138](https://github.com/aziron-ai/atlas/issues/138)).
- **More languages.** Ruby `class Child < Base` follows Ruby constant lookup
  to a base in another directory
  ([#120](https://github.com/aziron-ai/atlas/issues/120)); a call inside a
  `.rake` task binds to a same-file `def`
  ([#32](https://github.com/aziron-ai/atlas/issues/32)); a call from an
  anonymous `test()` / `it()` callback counts as coverage and lists the test
  in `impacted_tests` ([#6](https://github.com/aziron-ai/atlas/issues/6)).
  A Go package-level initializer (`var std = New()`) is a call edge, writes
  are `mutation: true` rows that `refs --mutations` (alias `--writes`) and the
  MCP `symbol` tool's `mutations` parameter list, and `declared_type` is
  inferred ([#55](https://github.com/aziron-ai/atlas/issues/55)).
- **Call extraction.** Rust gets a syntax-tree call extractor with
  scope-aware receiver typing; C++ types receivers from locals, parameters,
  fields and factories, and JavaScript/TypeScript from casts, `new`, field
  chains and class property types; a Python constructor call is
  typed as its class; Kotlin constructors are indexed, and Java, Kotlin and C#
  share the inline-constructor tie-break. `callers` answers lead with
  `caller_names`, mark a `--limit` page `truncated`, and take `--brief`.
- **Routes.** `mock.patch` targets and mock receivers never become HTTP
  routes or consumers ([#131](https://github.com/aziron-ai/atlas/issues/131));
  Go, Python, Java and JavaScript consumers read the URL from the call's own
  argument, not an earlier string on the same line
  ([#161](https://github.com/aziron-ai/atlas/issues/161)).

### Freshness

- **Dirty working trees are their own snapshots.** Uncommitted edits or
  untracked indexable files index as `<sha>+dirty` (with a `tree_hash`)
  instead of overwriting the clean snapshot of that commit. `status`,
  `history`, `snapshots list`, `snapshot-diff` and the index JSON show the
  label. A superseded dirty snapshot of the same commit is retired by
  retention, so edit churn cannot evict commit history
  ([#65](https://github.com/aziron-ai/atlas/issues/65)).
- **Every answer says how fresh it is.** Repo-scoped answers on the CLI, MCP
  and HTTP carry `indexed_sha`, `head_sha`, `dirty`, `stale` and
  `stale_reason` (`head_moved`, `working_tree_dirty`, `working_tree_changed`,
  `working_tree_reverted`), stamped before the output budget is applied. When
  git cannot answer, `stale` is omitted, never reported as fresh. Plain output
  opens with a `stale:` line
  ([#59](https://github.com/aziron-ai/atlas/issues/59)).
- **Refreshes are announced.** A stale answer from a daemon says
  `refresh: "started"` with `refresh_target`; answers from the refreshed
  snapshot in the next 10 minutes say `refresh: "completed"` with
  `refresh_snapshot` and `refreshed_at`. A clean tree says `refresh: "none"`.
  An in-place rebuild moves `indexed_at` and stops older cached answers from
  replaying ([#62](https://github.com/aziron-ai/atlas/issues/62)).
- **One-shot commands do not queue work they cannot finish.** A stale
  one-shot CLI answer says `refresh: "none"` and
  `refresh_skipped: "one_shot"`. `ATLAS_ONESHOT_REFRESH=sync` re-indexes a
  git-stale repo before answering, bounded by `ATLAS_ONESHOT_REFRESH_TIMEOUT`
  (10 s) ([#141](https://github.com/aziron-ai/atlas/issues/141)).

### code_query and Context

- **Relevance gate.** With `require_citations: true`, an answer whose
  citations do not carry what the question names is refused:
  `status: "insufficient"`, `reason: "citations_below_relevance_floor"`, a
  `relevance` block naming the missing terms, and up to 5 candidates as
  `low_confidence_hits`, never as citations. On a grounded answer, keyword-only
  citations that matched only generic words move to `low_confidence_hits`
  ([#60](https://github.com/aziron-ai/atlas/issues/60)). Under the same flag,
  trimming to `max_tokens` keeps at least one citation or refuses with
  `budget_exceeded`, naming the budget that would fit ([#160](https://github.com/aziron-ai/atlas/issues/160)).
- **Evidence inside large functions.** When a body is longer than its stored
  excerpt, `code_query` and `context` re-read the lines that match the
  question from the file (only when its hash matches the index): signature,
  up to 4 windows and the closing line, with explicit
  `// ... elided N lines (La-Lb) ...` markers and a `metadata.body_elision`
  record. Citations keep their real range
  ([#156](https://github.com/aziron-ai/atlas/issues/156)).
- **One `detail` table.** `--detail x`, `?detail=x` and MCP `detail: "x"` all
  mean `xhigh`; the MCP schema's `detail` enum lists every accepted spelling.
  The OpenAPI document now declares every query parameter the `/api/v1`
  handlers read: 245 on 73 operations, up from 58
  ([#146](https://github.com/aziron-ai/atlas/issues/146)).
- **Context companions are resolved.** Callers and callees come from resolved
  call edges and import provenance, so a Python builtin `type()` is no longer
  labelled the callee of a same-named method
  ([#162](https://github.com/aziron-ai/atlas/issues/162)), and a review context
  ranks the seed's own edges first with quotas for callers, callees,
  references, imports and tests
  ([#75](https://github.com/aziron-ai/atlas/issues/75)).

### Observability

- `stats` names its four count projections and checks seven invariants
  between them; `graph.edge_binding` accounts for every edge row and counts
  `multi_bound_rows` instead of assuming one target per row
  ([#14](https://github.com/aziron-ai/atlas/issues/14)).
- `stats`, `atlas status` (local and server mode), MCP `status` and
  `/api/v1/status` carry a `telemetry` block, so `--read-only` says
  `unavailable_read_only` with a remedy instead of leaving fields out
  ([#154](https://github.com/aziron-ai/atlas/issues/154)).
- `status --repo <path|org/name|repo_id>` scopes the whole report to that
  repo and refuses an unknown one exactly as `stats` does
  ([#155](https://github.com/aziron-ai/atlas/issues/155)).
- The Command Center's **Indexed symbols** tile shows the same totals as
  Workspace and a dash until the first frame; **Graph edges** is now
  **Indexed edges** ([#158](https://github.com/aziron-ai/atlas/issues/158)).
- Stack frames resolve by their coordinate on `atlas logsites resolve` and the
  Resolve page (Go, Node, Python, Java/Kotlin, C#, Ruby), and a miss says which
  miss: `unsupported_frame_format`, `frame_file_not_indexed`,
  `frame_symbol_not_found` and the ambiguous cases
  ([#163](https://github.com/aziron-ai/atlas/issues/163)).

### Store and CLI

- **`--read-only` follows a live writer.** It reads the WAL once a writer
  appears, refuses a store another Atlas moved to a different schema
  (`store_superseded`), and leaves a quiescent store byte-identical. The WAL
  is bounded and truncated after an index even with a reader attached,
  `index --reindex` heals crash residue, and readiness checks the graph tables
  ([#130](https://github.com/aziron-ai/atlas/issues/130)).
- Telemetry retention is atomic, so one-shot commands keep `resource_samples`
  at its cap ([#67](https://github.com/aziron-ai/atlas/issues/67)), and
  `snapshots prune --dry-run` opens no telemetry sink
  ([#133](https://github.com/aziron-ai/atlas/issues/133)).
- The `eco` and `balanced` profiles also bound SQLite residency (mmap window,
  write cache, read-pool cache) with two new knobs; `status --repo` probes that
  repo's watch lock; `ATLAS_INDEX_WORKERS` set in `settings.json` is honoured
  ([#127](https://github.com/aziron-ai/atlas/issues/127)). A tier set in
  `settings.json` reports `reason: settings`
  ([#129](https://github.com/aziron-ai/atlas/issues/129)).
- **A new commit costs what it changed.** The lexical sidecar carries forward
  per snapshot, and the shapes that used to rebuild the whole graph (JS/TS or
  Python adds and deletes, Go file deletion, C/C++/Rust edits) run on the SQL
  delta path: a one-line TensorFlow edit went from 1,528 MB / 36 s to
  529 MB / 13 s ([#128](https://github.com/aziron-ai/atlas/issues/128),
  [#118](https://github.com/aziron-ai/atlas/issues/118)).

### Search and Analytics Determinism

- **Equal scores have one order:** score, then path, name, kind, signature,
  line and end line. Fresh indexes, any `--workers` count and a delta return
  the same page, and a large low-scoring tie can no longer push a
  higher-scored row off it ([#135](https://github.com/aziron-ai/atlas/issues/135)).
- **Communities are a function of content:** canonical node order, ties to
  the canonically first node, ids by size then first member, isolated
  singletons flagged ([#149](https://github.com/aziron-ai/atlas/issues/149)).
- **Graph health:** `hubs` never ranks degree-zero symbols and reports
  `eligible`, `excluded_isolated`, `ranking` and `warnings`; `stats` and
  `report` add `isolated_ratio`, `connected_components`, `largest_component`,
  the community split, relation coverage by language and kind, and the
  `isolated_majority` / `fragmented_communities` warnings
  ([#45](https://github.com/aziron-ai/atlas/issues/45)).
- A search whose only hits are hidden locals returns a clean empty result
  with no false `degraded` flag
  ([#64](https://github.com/aziron-ai/atlas/issues/64)).

### Images

- The text an image file carries is indexed and searchable: PNG text chunks
  (including XMP) and EXIF, JPEG EXIF/XMP/IPTC/comments, TIFF text tags, WebP
  EXIF/XMP and GIF comments, plus format and size. Reading pixels needs OCR,
  which is now opt-in through `ATLAS_IMAGE_OCR_CMD`, and every image entry
  states its `ocr_status` ([#26](https://github.com/aziron-ai/atlas/issues/26)).

### Workspaces

- **Unowned checkouts reuse an index.** A linked worktree, another clone or a
  worktree of a bare clone is served by an existing index when its git
  identity matches and its HEAD and working-tree state equal that repo's
  latest snapshot. Same identity with different content is refused
  (`content_differs`); several equal checkouts are `ambiguous_repo` with
  `candidates[]` ([#42](https://github.com/aziron-ai/atlas/issues/42)).
- **Windows roots.** MCP roots such as `file:///C:/…`, VS Code's
  `file:///c%3A/…`, UNC paths and plain `C:\` paths resolve, and match
  without regard to case or separators. Verified by tests on macOS; a run on
  Windows is still pending ([#72](https://github.com/aziron-ai/atlas/issues/72)).
- **Refusals name their source:** `scope_source` (`workspace`, `cwd`, `roots`,
  `launch_roots`), `roots_tried[]` for a roots-only miss, and `searched_stores`
  with a `checkout` diagnosis
  ([#72](https://github.com/aziron-ai/atlas/issues/72),
  [#42](https://github.com/aziron-ai/atlas/issues/42)).

### Benchmarks

- **Relevance benchmark and gate.** 216 frozen, labelled natural-language
  queries over three pinned corpora (cJSON, leveldb with requests, vuejs/core)
  score precision@k, MRR, recall@10, entity-first routing and 36 generic-term
  adversaries, and 159 thresholds gate regressions. No ranking code changed;
  the baseline findings are filed as follow-ups
  ([#44](https://github.com/aziron-ai/atlas/issues/44)).
- **Multi-language agent benchmark.** Across Go, Python, C, JavaScript,
  TypeScript, Java, C++ and Rust, with Claude and with Codex, Atlas beats both
  the no-tool baseline and graphify on accuracy and on tokens in all 16
  agent-language cells. See [Benchmarks](benchmarks).

### Behaviour Changes to Know About

- **Uncommitted edits cost a new-commit delta.** An edit to a dirty tree now
  takes the O(change) new-commit path (copy forward, then retire the
  superseded dirty snapshot) instead of rewriting in place, so watch mode on a
  large repo pays roughly what a new commit costs.
  `ATLAS_INDEX_DIRTY_IDENTITY=0` restores the old labelling
  ([#65](https://github.com/aziron-ai/atlas/issues/65)).
- **OCR is no longer an implicit `tesseract`.** A `tesseract` on PATH used to
  run on every image. Now pixel text is not indexed unless you set
  `ATLAS_IMAGE_OCR_CMD="tesseract - stdout"`, and an image without OCR says
  `ocr: off` ([#26](https://github.com/aziron-ai/atlas/issues/26)).
- **Search tie order is by path.** Equal-score hits come back in path order,
  and the SQL fallback orders hits within one file by line, not by name
  ([#135](https://github.com/aziron-ai/atlas/issues/135)).
- **Shorter hub lists; isolates out of the report.** Hub lists are shorter on
  sparse graphs (the dashboard's hub card shows fewer rows), the report lists
  only clusters and counts isolated symbols in its summary, and community
  partitions differ from previously recorded output
  ([#45](https://github.com/aziron-ai/atlas/issues/45),
  [#149](https://github.com/aziron-ai/atlas/issues/149)).
- **One-shot CLI commands never refresh in the background.** Run
  `atlas index`, or set `ATLAS_ONESHOT_REFRESH=sync`
  ([#141](https://github.com/aziron-ai/atlas/issues/141)).
- **`code_query` may answer `insufficient`.** With `require_citations: true`,
  a question the index does not carry is refused where it used to get `ok`
  with name-overlap citations; branch on `reason`
  ([#60](https://github.com/aziron-ai/atlas/issues/60)).
- **MCP `report` sections are objects.** The `hubs` and `communities`
  sections are now the whole `atlas hubs` / `atlas communities` answers, not
  bare arrays ([#45](https://github.com/aziron-ai/atlas/issues/45)).
- **False case-twin edges are gone.** On logrus, `export --all --max-nodes 0`
  loses 15 false `calls` edges (762 to 747) and gains 2 true `references`
  edges; caller accuracy is unchanged
  ([#125](https://github.com/aziron-ai/atlas/issues/125)).
- **Same identity, different content is refused.** A checkout that shares a
  repo's git identity but sits at another commit or has uncommitted edits is
  refused rather than served stale line numbers
  ([#42](https://github.com/aziron-ai/atlas/issues/42)).

### New and Changed Settings

| Setting | Default | Meaning |
| --- | --- | --- |
| `ATLAS_FRESHNESS_TTL` | `2s` | How long one working-tree probe answers for a repo when an answer is stamped with `indexed_sha`, `head_sha`, `dirty` and `stale` (stretched to 5× a slow probe, at most 30 s); `0` probes on every answer |
| `ATLAS_FRESHNESS_PROBE` | on | `0`/`off` stops probing; every answer then reports `head_sha: "unknown"` and omits `stale` |
| `ATLAS_INDEX_DIRTY_IDENTITY` | on | Index a dirty working tree into its own `<sha>+dirty` snapshot; `0`/`off` restores in-place labelling |
| `ATLAS_IMAGE_OCR_CMD` | unset | Opt-in OCR: a command (no shell) that reads one image on stdin and prints its text, e.g. `tesseract - stdout`; 30 s per image |
| `ATLAS_ONESHOT_REFRESH` | `off` | What a one-shot CLI command does about a stale repo: `off` reports it, `sync` re-indexes before answering |
| `ATLAS_ONESHOT_REFRESH_TIMEOUT` | `10s` | Bound on one synchronous refresh; past it the answer reports `refresh_skipped: "budget_exceeded"` and nothing is persisted |
| `ATLAS_SQLITE_CACHE_SIZE` | `64MiB` (`16MiB` eco) | Page cache of the SQLite write handle; outside the Go heap and `ATLAS_MEMORY_LIMIT` |
| `ATLAS_SQLITE_READ_CACHE_SIZE` | `16MiB` | Page cache of each read-pool connection; the tiers never move it |
| `ATLAS_MMAP_SIZE` (changed) | `512MiB` read (`256MiB` balanced, `64MiB` eco) | The read pool maps the tier's window, and the write handle maps the whole database when it fits that window and none of it otherwise |

The full catalogue, with types and liveness, is on
[Configuration](configuration).

## Upgrade per Channel

Use the same channel you installed from (see [Installation](installation)).

Homebrew:

```sh
brew update
brew upgrade --cask aziron-ai/atlas/atlas
atlas version
```

npm:

```sh
npm install -g @aziron/atlas
atlas version
```

Pin a version for reproducible automation:

```sh
npm install -g @aziron/atlas@0.1.43
```

For installations sourced from GitHub Packages, use the equivalent
`@aziron-ai/atlas@0.1.43` coordinate with the existing registry authentication.

Archives: download the new tar.gz, .deb, .rpm, or .apk from
[GitHub Releases](https://github.com/aziron-ai/atlas/releases/latest), replace
the installed binary, and confirm with `atlas version`.

## Post-Upgrade Sequence

Run these four commands after every upgrade. Each one closes a specific gap
that a binary swap leaves open:

```sh
atlas bootstrap
atlas migrate
atlas status --schema
atlas doctor --verify atlas
```

- **`atlas bootstrap`** refreshes the assistant glue: it re-registers Atlas as
  an MCP server and reinstalls the skill and CLAUDE.md directive for detected
  assistants, baking in the absolute binary path. It is idempotent — safe to
  run repeatedly.
- **`atlas migrate`** applies Atlas storage migrations to the database and
  reports the active contracts. Use `--all --root DIR` to migrate every
  `.atlas/atlas.db` under a directory.
- **`atlas status --schema`** reports the schema/index-format/lexical/MCP
  contract versions and per-repo snapshot format drift, so you can see
  whether existing snapshots match what the new binary expects.
- **`atlas doctor --verify atlas`** reports upgrade health and the
  schema/index contract state, and additionally checks binary drift — whether
  the `atlas` on PATH (what assistants launch via `command:"atlas"`) matches
  the binary you just upgraded.

## Reading Doctor Output After an Upgrade

Act on what doctor reports rather than rebuilding preemptively. A clean report
means the upgrade is complete. If doctor or status flags schema or index
contract drift, run `atlas migrate` and re-check. If doctor reports the
lexical sidecar needs rebuilding, use `atlas compact --rebuild-lexical` (see
[Troubleshooting](troubleshooting)). Run a full rebuild only when status,
doctor, or the release notes require it:

```sh
atlas index . --reindex
```

## Before Downgrading

Back up the full `.atlas/` directory first. Do not assume an older binary can
open a database already migrated by a newer release. Use a separate database
(`--db`) for downgrade testing when possible.

## Uninstall

Remove Atlas in this order: assistant integrations first, then the package,
then (only if intended) local data.

### 1. Remove Assistant Integrations

`atlas uninstall` reverses `atlas bootstrap` across every assistant it
provisions (Claude CLI and desktop, Cursor, Gemini, Codex, Copilot): it
removes the atlas MCP server entry from each config, the atlas skill
markdown, and the atlas-managed block in the global CLAUDE.md. Nothing else
is touched — other MCP servers, unrelated config keys, and your own CLAUDE.md
content outside the atlas markers are preserved. It is idempotent: re-running
reports `absent` and writes nothing.

```sh
atlas uninstall --dry-run
atlas uninstall
```

If this machine is connected to a central Atlas server, also disconnect —
`atlas disconnect` disconnects from the central Atlas and removes the capture
hooks:

```sh
atlas disconnect
```

### 2. Remove the Package

```sh
brew uninstall --cask aziron-ai/atlas/atlas   # Homebrew
npm uninstall -g @aziron/atlas                # public npm
npm uninstall -g @aziron-ai/atlas             # GitHub Packages
sudo rm /usr/local/bin/atlas                  # manual binary
```

### 3. Remove Local Data — Read First

> **Warning:** Package removal does not delete repository indexes. Every
> indexed repository keeps its `.atlas/` directory — index, settings,
> retrieval data, telemetry, and retained snapshots — until you remove it.
> Stop all Atlas processes and confirm the exact paths before deleting;
> removal is permanent.

`atlas uninstall --purge` removes the `.atlas` index directories for you — the global `~/.atlas` and every registry-known repo’s `.atlas` — printing the blast radius and total reclaimed space first, and requiring confirmation (`--yes` to skip, `--dry-run` to preview). To remove them by hand instead, per repository, after stopping all Atlas processes and verifying the path:

```sh
rm -rf /absolute/path/to/repository/.atlas
```

User-level data, only when all user-level Atlas data and installed Atlas
skills should go:

```sh
rm -rf "$HOME/.atlas"
```

## Verify Removal

```sh
command -v atlas || true
```

Also inspect the assistant configuration locations listed in
[AI Assistant Setup](assistants) if a client was configured manually.
