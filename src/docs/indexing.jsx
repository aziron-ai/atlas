import React from "react";
import { Command, ProseSection, Bullets, Callout, Figure, Clip, RELEASE, GITHUB, WIKI } from "./ui.jsx";

export default function Page() {
  return (
        <>
          <p className="docs-lead">Atlas answers are only as current as the selected index. This guide covers creating and updating an index, forcing a rebuild, keeping the graph fresh automatically, controlling what gets indexed, and maintaining the database that stores it. For what the graph contains, see <a className="text-link" href="#docs/concepts">Core Concepts</a>.</p>
          <ProseSection title="Create or Update an Index">
            <p>Run this once to build the graph, and again whenever you want to refresh it — the same command handles both cases. From a repository root:</p>
            <Command>{`atlas index .`}</Command>
            <p>To pin an explicit database instead of the default <code>sqlite://./.atlas/atlas.db</code>:</p>
            <Command>{`atlas --db "sqlite:///absolute/path/.atlas/atlas.db" index .`}</Command>
            <p><code>atlas index</code> parses symbols, edges, and routes, then persists the graph and the lexical search index. By default it indexes the working tree; use <code>--ref COMMIT_OR_BRANCH</code> to index a specific commit or branch instead.</p>
            <p>A first index of inference-gateway, a Go service of 307 files, looks like this on stderr (the JSON summary goes to stdout):</p>
            <Command label="stderr">{`atlas index: starting path=. db=sqlite://…/.atlas/atlas.db
atlas index: analyzing types (307 files, 11092 symbols) elapsed=2s
…
atlas index: analyzing types (307 files, 11092 symbols) elapsed=24s
atlas index: persisting 11092 symbols elapsed=26s
atlas index: done repo=inference-gateway mode=full files=307 symbols=11092 edges=13900 routes=71 duration=27014ms
atlas index: timings build_symbols_edges=25539ms … go_types=25510ms lexical=795ms lexical_settle=132ms log_sites=9ms parse=115ms persist=438ms …`}</Command>
            <p>On a Go repository most of a cold index is Go type analysis (<code>go_types</code>); the parse itself took 115 ms here.</p>
          </ProseSection>
          <ProseSection title="What Index Output Reports">
            <p>Read the index output to confirm what actually happened rather than assuming. With <code>--progress</code> (on by default for human output), Atlas prints start, periodic progress, and completion statistics to stderr. A run reports a delta update when files changed, or a no-op when the stored snapshot already matches the workspace. For profiling an index run, <code>--cpuprofile PATH</code> and <code>--memprofile PATH</code> write runtime/pprof profiles.</p>
            <p><strong>Since 0.1.48, <code>atlas index --format json</code> also reports what the run did internally</strong>, so you can verify the fast paths engaged instead of inferring it from a stopwatch:</p>
            <Command label="JSON">{`{\n  "mode": "delta",\n  "persist_mode": "delta",\n  "persist_path": "sql",\n  "delta_base": "dc4dc4ba86e307b8875a4c0b0623b628445d6274",\n  "files_reparsed": 1,\n  "lexical_bytes": 290368,\n  "lexical_settle": "merged"\n}`}</Command>
            <div className="docs-table-wrap"><table><thead><tr><th>Field</th><th>Values</th><th>What it tells you</th></tr></thead><tbody>
              <tr><td><code>persist_mode</code></td><td><code>full</code>, <code>delta</code>, <code>noop</code></td><td>which mode the run resolved to. <code>noop</code> means the working tree already matched the stored snapshot</td></tr>
              <tr><td><code>persist_path</code></td><td><code>sql</code>, <code>sql_new_commit</code>, <code>whole_graph</code>, <code>full_walk</code>, <code>full_stream</code>, <code>noop</code></td><td>the decisive one. <code>sql</code> and <code>sql_new_commit</code> are the O(change) paths — the base graph is never loaded into memory. <code>whole_graph</code> is the correctness fallback: a delta by mode, a full index by memory</td></tr>
              <tr><td><code>delta_base</code>, <code>delta_base_snapshot</code></td><td>commit SHA, snapshot id</td><td>which snapshot the run built on, so a ladder of runs is pinnable</td></tr>
              <tr><td><code>files_reparsed</code></td><td>integer</td><td>defined for every mode: changed plus added on a delta, every indexed file on a full run, <code>0</code> on a no-op</td></tr>
              <tr><td><code>lexical_bytes</code></td><td>integer</td><td>the on-disk size of <code>.atlas/lexical</code> after the run settled it. This should match a <code>du</code> taken the instant <code>index</code> returns; a mismatch is a bug report, not a measurement</td></tr>
              <tr><td><code>lexical_settle</code></td><td>see below</td><td>how the sidecar reached the size reported in <code>lexical_bytes</code></td></tr>
            </tbody></table></div>
            <p><strong>Lexical settle states.</strong> The lexical (BM25) sidecar writes new segments and supersedes old ones asynchronously, so a footprint measured the moment an index returns used to read far above the steady state. Since 0.1.48 <code>atlas index</code> settles the sidecar before it returns — a bounded segment merge, then a reclaiming reopen — and reports how that went. The settle never changes the document set and never fails a run; every failure mode degrades to a disclosed state.</p>
            <div className="docs-table-wrap"><table><thead><tr><th>State</th><th>Meaning</th></tr></thead><tbody>
              <tr><td><code>merged</code></td><td>the merge completed and superseded segments were reclaimed. <strong>Only this state asserts a steady-state footprint</strong></td></tr>
              <tr><td><code>reclaimed</code></td><td>the merge was skipped or declined, but the reclaim ran. Superseded segments are gone; unmerged ones may remain</td></tr>
              <tr><td><code>partial</code></td><td><strong>Since 0.1.51.</strong> Every step ran and reported success, and then the check found the sidecar still holding obsolete document bytes a compaction would reclaim — a contended machine can leave a whole superseded generation inside one segment, which the engine declines to re-merge. The reported footprint is <strong>above</strong> steady state. Re-run on a quiet machine, or run <code>atlas compact --rebuild-lexical</code>, before quoting a size</td></tr>
              <tr><td><code>timeout</code></td><td>the merge did not finish inside its budget, so the reclaim was deliberately not attempted and the footprint may hold both unmerged and superseded segments. Raise <code>ATLAS_LEXICAL_SETTLE_TIMEOUT</code> (default 30s) and re-run</td></tr>
              <tr><td><code>skipped</code></td><td>there was nothing to settle: no sidecar, or this run wrote no documents</td></tr>
              <tr><td><code>failed</code></td><td>the settle itself errored; the reason is on stderr and the footprint is still reported</td></tr>
              <tr><td><code>off</code></td><td>disabled with <code>ATLAS_LEXICAL_SETTLE=off</code></td></tr>
            </tbody></table></div>
            <p>Set <code>ATLAS_LEXICAL_SETTLE=reclaim</code> to skip the merge and only reclaim — the cheaper mode for very large sidecars where a single-segment merge is not worth its write amplification.</p>
            <p>Running the same command again on an unchanged tree is a no-op — this is the real second run on inference-gateway, trimmed:</p>
            <Command>{`$ atlas index . --format json
{
  "repo_full_name": "inference-gateway",
  "commit_sha": "524967508e9d90185c4a1c3540cac0dcda7c580a",
  "indexed_files": 307,
  "symbols": 11092,
  "edges": 13900,
  "routes": 71,
  "mode": "noop",
  "duration_ms": 69,
  "persist_mode": "noop",
  "persist_path": "noop",
  "delta_base": "524967508e9d90185c4a1c3540cac0dcda7c580a",
  "files_reparsed": 0,
  "lexical_bytes": 6991343,
  "lexical_settle": "merged"
}`}</Command>
          </ProseSection>
          <ProseSection title="Incremental Behavior">
            <p>Incremental updates are the default because they are much faster than full rebuilds: Atlas computes a delta against the previous snapshot and reindexes only what changed. To diff against a specific commit rather than the stored base, pass <code>--base COMMIT</code>.</p>
          </ProseSection>
          <ProseSection title="Forced Rebuild">
            <p>Use <code>--reindex</code> only when the incremental path cannot repair the index:</p>
            <Command>{`atlas index . --reindex`}</Command>
            <p>The legitimate reasons for a full rebuild are:</p>
            <ol className="docs-list numbered">
              <li>An upgrade reports an incompatible or stale index format, or <code>atlas doctor</code> recommends a rebuild.</li>
              <li>Parser or language support changed and old files must be reparsed.</li>
              <li>The workspace identity or indexed root was incorrect, or focused troubleshooting confirms the current index is incomplete.</li>
            </ol>
            <p>Do not make forced reindexing the default workflow. It is slower and discards the benefit of incremental updates.</p>
          </ProseSection>
          <ProseSection title="Watch Mode">
            <p>Use watch mode when you want the graph to stay fresh during active editing with no manual <code>atlas index</code> runs. <code>atlas watch</code> indexes the repo once, then watches the working tree and runs an incremental, working-tree-aware update on every file change. A burst of edits is coalesced into one update (<code>--debounce-ms</code>, default 250). It runs in the foreground until interrupted.</p>
            <Command>{`atlas watch .`}</Command>
            <p>The MCP and HTTP surfaces maintain freshness the same way — <code>atlas mcp</code> and <code>atlas serve</code> watch the repo by default. Disable watching when another process owns indexing:</p>
            <Command>{`atlas mcp --supervise --watch=false   # or set ATLAS_NO_WATCH=1`}</Command>
          </ProseSection>
          <ProseSection title="Semantic Vectors (Optional)">
            <p>Enable vectors only if you want embedding-based retrieval; the deterministic lexical and graph core never depends on them. Run the optional embedding pass at index time:</p>
            <Command>{`atlas index . --enable-vectors\natlas watch . --enable-vectors   # keep embeddings fresh on each update`}</Command>
            <p>With vectors enabled (<code>ATLAS_ENABLE_VECTORS=1</code> and a repo indexed with <code>--enable-vectors</code>), <code>atlas semantic-search</code> returns nearest symbols by cosine similarity. Otherwise it transparently degrades to lexical search and reports <code>degraded=true</code> / <code>mode_used=lexical</code>. By default the embedder is offline (deterministic token overlap); set <code>ATLAS_EMBED_URL</code> to use a real embedding model. See <a className="text-link" href="#docs/configuration">Configuration</a>.</p>
          </ProseSection>
          <ProseSection title="Excluding Files">
            <p>Exclude generated outputs, dependency caches, and nested repository snapshots so they do not pollute search results. Atlas skips paths git ignores by default (<code>--gitignore</code>, default true); pass <code>--gitignore=false</code> to index everything. Add Atlas-specific patterns to <code>.atlasignore</code>.</p>
          </ProseSection>
          <ProseSection title="Registering Without Indexing">
            <p>Use <code>atlas link</code> when a repo should participate in cross-repo queries and appear in <code>atlas status</code> before (or without) being indexed on this machine:</p>
            <Command>{`atlas link org/name --branch main`}</Command>
            <p><code>REPO</code> may be a filesystem path, a git remote URL, or a bare <code>org/name</code>. Linking is idempotent — re-linking updates the registration and reports <code>created=false</code>. Linking does not populate the graph; run <code>atlas index</code> for that. To remove a repo from the registry, <code>atlas repo rm</code> forgets it entirely: snapshots, symbols, edges, embeddings, and lexical documents.</p>
          </ProseSection>
          <ProseSection title="Performance Envelope">
            <p><strong>Since 0.1.48, resource use is a profile decision first.</strong> Atlas detects a machine profile — <code>eco</code>, <code>balanced</code>, <code>performance</code>, or <code>turbo</code> — and sizes indexing to it. The individual knobs below all still work and all still win over the tier; they are overrides, not the primary control. Pin a tier with <code>ATLAS_PROFILE</code> and read back what it installed with <code>atlas doctor</code>; the tiers, their values, and the auto-detection rules are in <a className="text-link" href="#docs/configuration">Configuration</a>.</p>
            <Callout kind="tip" label="Foreground full throttle">
              <p><strong>Since 0.1.51.</strong> <code>balanced</code> bounds background work, not the index you are waiting on. A watch-triggered refresh or an MCP lazy index runs inside a warm daemon and takes 3/4 of the cores under a <code>RAM/4</code> soft heap limit; an explicit <code>atlas index</code> you typed runs at full width with no ceiling. <code>eco</code> is deliberately not scoped that way — on a genuinely low-spec box it throttles foreground indexes too, because that is the case it exists to protect.</p>
            </Callout>
            <p>Behaviors worth knowing on large or resource-constrained machines:</p>
            <Bullets>
              <li><strong>Streaming index.</strong> Full indexes of repos over ~15,000 candidate files automatically stream in bounded batches instead of holding the whole graph in memory — the Linux kernel (81k files, 1.86M symbols, 6.8M edges) indexes at ~1.3&nbsp;GiB peak RSS. Force it at any size with <code>ATLAS_STREAM_INDEX=1</code> (or off with <code>0</code>); tune with <code>ATLAS_STREAM_INDEX_THRESHOLD</code> and <code>ATLAS_STREAM_INDEX_BATCH</code>.</li>
              <li><strong>CPU ceiling (an override since 0.1.48).</strong> With no profile bound in force the parse/hash pool uses all cores. Cap it explicitly with <code>atlas index --workers N</code> or <code>ATLAS_INDEX_WORKERS</code> — e.g. <code>--workers 4</code> trades a little wall-time for headroom; <code>1</code> pins the run to a single core. An explicit value always beats the tier's worker count. (Go repos also run <code>go/types</code>, which spawns its own compilers outside this pool; other tree-sitter languages are fully bounded by it.)</li>
              <li><strong>Memory ceiling (an override since 0.1.48).</strong> <code>ATLAS_MEMORY_LIMIT</code> and <code>ATLAS_GOGC</code> bound the Go runtime directly and override whatever the tier would have set — the right tool for a container with a hard cgroup limit, where you want a specific number rather than a fraction of host RAM.</li>
              <li><strong>Deletions cost more than edits.</strong> Adding or modifying files takes the fast scoped delta; deleting a Go file forces the whole-module type-check fallback (reverse-dependency edges must be re-derived), so a delete delta can approach cold-build time on Go-heavy repos. Batch deletions when you can.</li>
            </Bullets>
          </ProseSection>
          <ProseSection title="Database Maintenance">
            <p>Run maintenance when the database has grown or after an Atlas upgrade.</p>
            <Bullets>
              <li><code>atlas compact</code> reports reclaimable pages and truncates the WAL. Modern Atlas databases use online incremental auto-vacuum; legacy databases are converted with a one-time full VACUUM that takes an exclusive lock — stop <code>atlas serve</code> and watch processes first, or you get a lock error rather than partial work.</li>
              <li><code>atlas compact --full</code> additionally runs a full VACUUM and rebuilds the lexical (BM25) sidecar when it has outgrown its size bound — the only way dead segments are returned to the OS. Exclusive: quiesce other Atlas processes first.</li>
              <li><code>atlas compact --rebuild-lexical</code> rebuilds the lexical sidecar regardless of size — the fix for an empty or wedged sidecar, which otherwise silently degrades every search to SQL-only. <code>atlas doctor</code> reports when you need it.</li>
              <li><code>atlas migrate</code> applies storage migrations and reports the active contracts. Both <code>migrate</code> and <code>compact</code> accept <code>--all --root DIR</code> to process every local <code>.atlas/atlas.db</code> under a directory.</li>
            </Bullets>
          </ProseSection>
          <ProseSection title="Verify Freshness">
            <p>Confirm which index is answering before trusting results:</p>
            <Command>{`atlas status\natlas stats\natlas doctor`}</Command>
            <p>When multiple repositories or databases exist, pin both <code>--db</code> and <code>--repo</code>. If a running Atlas server is configured, CLI queries may use that server — unset <code>ATLAS_SERVER_URL</code> or pin an explicit database while diagnosing.</p>
            <Command>{`$ atlas stats
stats inference-gateway  local/sqlite  history 1  coverage_facts 0
  latest 52496750  mode full  files 307  symbols 11092  edges 13900  routes 71  53534ms
  store_rows files 307  symbols 11092  edges 13900  routes 71
  graph files 89  symbols 3526  edges 1317  communities 3161  isolated 3121
  langs  go:3511 bash:9 typescript:6`}</Command>
            <p><code>store_rows</code> is what the index stored. <code>graph</code> is what the graph report reads — the same numbers the dashboard's <strong>Orientation</strong> view (<code>#/orient</code>) shows at the top, beside the repository's entry points and its most-connected symbols:</p>
            <Figure src="assets/docs/indexing/orientation-index-state.png" alt="Orientation for inference-gateway: 89 files, 3,526 symbols, 1,317 edges, 3,161 communities, 3,121 isolated, a language bar, entry points and load-bearing symbols" caption="Orientation reads the graph report of the selected repository." />
            <p>To walk what was indexed file by file, open <strong>Files</strong> (<code>#/files</code>). Type in the filter to narrow the tree by path or symbol name, then click a file: the details panel lists the routes it serves, its imports and the symbols in it, with caller and callee counts.</p>
            <Clip src="assets/docs/indexing/files-after-index.mp4" alt="The Files view: filtering the indexed tree for routes, then selecting api/routes.go to show its 9 routes, 882 relations and imports" caption="Files after an index: api/routes.go serves 9 routes." />
            <p>The counter beside the filter says how much of the index the view loaded. On a large repository the first load is a sample; expanding a folder fetches that folder in full.</p>
          </ProseSection>
          <ProseSection title="Safe Recovery Order">
            <p>Follow this order so you never destroy data a cheaper step could have fixed:</p>
            <ol className="docs-list numbered">
              <li>Stop active <code>serve</code>, <code>watch</code>, and supervised MCP processes.</li>
              <li>Run <code>atlas status</code> and <code>atlas doctor</code>.</li>
              <li>Confirm the repository and database paths.</li>
              <li>Run <code>atlas migrate</code> when a schema upgrade is required.</li>
              <li>Rebuild lexical data only when recommended.</li>
              <li>Run <code>atlas index . --reindex</code> as the final non-destructive repair.</li>
              <li>Delete <code>.atlas</code> only when a complete data reset is intended.</li>
            </ol>
            <Callout kind="warn" label="Before deleting local data">
              <p>See <a className="text-link" href="#docs/troubleshooting">Troubleshooting</a> before removing data.</p>
            </Callout>
          </ProseSection>
        </>
  );
}
