import React from "react";
import { Command, ProseSection, Bullets, Callout, Figure, Clip, RELEASE, GITHUB, WIKI } from "./ui.jsx";

export default function Page() {
  return (
    <>
      <p className="docs-lead">Every indexing pass stores a snapshot: the files, symbols, call edges and routes of a repository at one commit. History is what you read from those snapshots — what a pass added, changed and removed, which symbols carry the most weight, and whether the index still matches the code. With logs connected, the same idea applies to a running service: what it started or stopped saying between two windows. Reach for it after a merge, before a release, or when an answer and the code seem to disagree.</p>

      <ProseSection title="Open It">
        <p>The views live in three places in the dashboard's navigation:</p>
        <Bullets>
          <li><strong>Changes</strong> in EXPLORE (<code>#/changes</code>) — the Change Lens: the snapshot timeline and what each pass changed.</li>
          <li><strong>Hot Symbols</strong> (<code>#/hot</code>) and <strong>Freshness</strong> (<code>#/staleness</code>) in CODEBASE — the graph's hubs and the freshness of what Atlas derives from the latest snapshot.</li>
          <li><strong>What Changed</strong> in OBSERVE (<code>#/diff</code>) — two windows of one log stream compared. OBSERVE appears once Loki or Elasticsearch is configured.</li>
        </Bullets>
        <Figure src="assets/docs/history/change-lens-one-snapshot.png" alt="The Change Lens: a repository picker, the snapshot timeline with one snapshot 5249675, and the notice One snapshot recorded — a diff needs two" caption="The Change Lens on the demo service, which holds one snapshot of inference-gateway." />
        <p>From a terminal, <code>atlas history</code> prints the same timeline:</p>
        <Command>{`atlas history --format plain`}</Command>
        <Command label="Output">{`history inference-gateway  snapshots 1
  52496750  e842033e-41d6-4e7a-9e27-7415bc5edcbc  files 307  symbols 11092  edges 13900  2026-10-28T05:16:55Z`}</Command>
      </ProseSection>

      <ProseSection title="See What an Indexing Pass Changed">
        <ol className="docs-list">
          <li>Open <strong>Changes</strong> and choose the <strong>Repository</strong>.</li>
          <li>The <strong>Snapshot timeline</strong> lists every stored snapshot, newest first: the short commit, its symbol, edge and file counts, and its age.</li>
          <li>Pick a snapshot. The lens compares it with the snapshot indexed just before it and answers "what did this pass change?": a count verdict first, then <strong>Added symbols</strong>, <strong>Modified symbols</strong>, <strong>Removed symbols</strong>, the changed files, and <strong>Added call edges</strong> and <strong>Removed call edges</strong>.</li>
        </ol>
        <p>Added and modified symbols open the Symbol Inspector; removed ones do not, because they no longer exist in the newer snapshot. Changed files open in Files. The server sends at most 100 rows per list, while the counts are always complete, so a long list says "first 100 of N". The address keeps the pick (<code>#/changes?repo=&lt;repo&gt;&amp;to=&lt;snapshot&gt;</code>).</p>
        <Figure src="assets/docs/history/change-lens-timeline.png" alt="The snapshot timeline with one entry, 5249675 with 11,092 symbols, 13,900 edges and 307 files, beside the instruction to index again and the command atlas index path" caption="With one snapshot there is nothing to compare, and the lens says how to get a second one." />
        <p>The demo store holds a single snapshot (commit <code>5249675</code>, 11,092 symbols), so the lens shows its empty state. History grows by indexing again once the code has moved — after a pull, a merge or a checkout of another commit:</p>
        <Command>{`git pull
atlas index .`}</Command>
        <p>Each pass at a new commit stores another snapshot, and the lens then diffs it against the one before. Retention keeps the newest 5 snapshots per repository by default (<code>ATLAS_MAX_SNAPSHOTS_PER_REPO</code>); the current one is never deleted. See <a className="text-link" href="#docs/indexing">Indexing and reindexing</a>.</p>
      </ProseSection>

      <ProseSection title="Compare Two Snapshots from the CLI">
        <p><code>atlas snapshot-diff</code> (alias <code>atlas diff</code>) gives the same structural delta in a terminal: symbols and edges added, removed and modified. <code>--to</code> defaults to the latest snapshot and <code>--from</code> to the one before it; both take a commit sha (a prefix is enough) or a snapshot id.</p>
        <Command>{`atlas snapshot-diff --format plain`}</Command>
        <Command label="Output">{`atlas: need two snapshots to diff — index the repo at two commits, or pass --from`}</Command>
        <p>That is the real answer on a store with one snapshot. <code>--from</code> names the base explicitly; pointed at the one stored snapshot it compares the snapshot with itself, which shows the shape of an answer with every count at zero:</p>
        <Command>{`atlas snapshot-diff --from 5249675`}</Command>
        <Command label="JSON">{`{
  "from_commit": "524967508e9d90185c4a1c3540cac0dcda7c580a",
  "to_commit": "524967508e9d90185c4a1c3540cac0dcda7c580a",
  "added_count": 0,
  "removed_count": 0,
  "modified_count": 0,
  "added_symbols": [],
  "removed_symbols": [],
  "modified_symbols": [],
  "changed_files": [],
  "added_edges": [],
  "removed_edges": []
}`}</Command>
        <p><code>atlas snapshots list</code> shows what history is costing on disk — one row per stored snapshot with its counts, and the retention policy:</p>
        <Command>{`atlas snapshots list`}</Command>
        <Command label="JSON">{`{
  "repositories": [
    {
      "repo_full_name": "inference-gateway",
      "snapshot_count": 1,
      "snapshots": [
        { "commit_sha": "524967508e9d90185c4a1c3540cac0dcda7c580a",
          "created_at": "2026-10-28T05:16:55Z",
          "file_count": 307, "symbol_count": 11092, "edge_count": 13900,
          "route_count": 71, "current": true }
      ]
    }
  ],
  "retention": { "max_snapshots_per_repo": 5, "max_total_bytes": 5368709120, "max_age": "disabled" }
}`}</Command>
        <p><code>atlas snapshots prune --dry-run</code> prints exactly what a prune would delete without touching anything; <code>--keep N</code> and <code>--keep-since 90d</code> override the policy for one run.</p>
      </ProseSection>

      <ProseSection title="Snapshots of Uncommitted Work">
        <p><strong>Since 0.1.55</strong>, indexing a working tree with uncommitted edits or untracked files stores a snapshot of its own, labelled <code>&lt;sha&gt;+dirty</code>, beside the clean snapshot of that commit (<a className="text-link" href="https://github.com/aziron-ai/atlas/issues/65" target="_blank" rel="noreferrer">#65</a>). The timeline lists both, and <code>snapshot-diff</code> compares them: <code>--from</code> and <code>--to</code> accept <code>&lt;sha&gt;+dirty</code> as well as a commit sha or a snapshot id. On a small repository after adding one function without committing it:</p>
        <Command label="Output">{`$ atlas history --format plain
history repo  snapshots 2
  4fb9d0f7+dirty  e0596478-…  files 2  symbols 4  edges 3  2026-10-29T05:18:49Z
  4fb9d0f7  777a3e52-…  files 2  symbols 3  edges 3  2026-10-29T05:18:35Z

$ atlas snapshot-diff --format plain
snapshot_diff 4fb9d0f7 -> 4fb9d0f7+dirty  +1 -0 ~0  files 1
  added(1)  extra
  files(1)  main.go`}</Command>
        <p>In <code>snapshots list</code> the dirty row carries <code>dirty: true</code> and its <code>tree_hash</code>. A newer dirty state of the same commit retires the one before it, so edit churn never pushes commit history out of the per-repository cap, and committing the work stores the new commit's snapshot.</p>
      </ProseSection>

      <ProseSection title="Find the Symbols That Carry the Most Weight">
        <p><strong>Hot Symbols</strong> ranks the graph's hubs by total degree — the calls in plus the calls out. A hub is where a change spreads: a symbol many others call, or one that calls many others.</p>
        <Figure src="assets/docs/history/hot-symbols.png" alt="Hot Symbols: the hub leaderboard with main at degree 71, ProviderImpl.ListModels and RouterImpl.handleImagesMultipart at 55, and the detail rail for main" caption="The hub leaderboard of inference-gateway. main in cmd/gateway/main.go leads with 71 outgoing edges and none incoming." />
        <Bullets>
          <li><strong>DEGREE</strong>, <strong>IN</strong> and <strong>OUT</strong> are counted from stored edges; <strong>RANK</strong> orders the board. Click a column head to sort.</li>
          <li>The filter box narrows by symbol name or repository; the chips filter by the <strong>SOURCE</strong> column (every hub on the demo reads <strong>yes</strong>: backed by the current graph).</li>
          <li>The rail on the right describes the selected hub — its graph signal ("Low inbound degree" for <code>main</code>), kind, degree and rank — with <strong>Inspect symbol</strong> and <strong>View in Code Map</strong>.</li>
        </Bullets>
        <Command>{`atlas hubs --format plain`}</Command>
        <Command label="Output">{`hubs  total 20
  main  function  in 0  out 71  total 71  cmd/gateway/main.go
  ProviderImpl.ListModels  method  in 2  out 53  total 55  providers/core/provider.go
  RouterImpl.handleImagesMultipart  method  in 2  out 53  total 55  api/routes.go
  RouterImpl.MessagesHandler  method  in 0  out 52  total 52  api/routes.go
  LoggerZapImpl.Error  method  in 41  out 6  total 47  logger/logger.go
  …`}</Command>
        <p>Since 0.1.55 a hub needs at least one resolved call or inheritance relation: the header adds <code>eligible</code> and <code>excluded_isolated</code>, and on a sparse graph the list is shorter than the limit rather than padded with symbols nothing calls (<a className="text-link" href="https://github.com/aziron-ai/atlas/issues/45" target="_blank" rel="noreferrer">#45</a>).</p>
      </ProseSection>

      <ProseSection title="Check How Fresh the Index Is">
        <p><strong>Freshness</strong> lists the operations Atlas derives from the latest snapshot — on the demo, one <strong>Observe repo</strong> card per indexed repository — and checks each against two signals: <strong>Code</strong> (the snapshot it was built from is still the one loaded) and <strong>Time</strong> (when that snapshot was indexed). Hover a signal for its detail. A card whose signals all hold reads <strong>fresh</strong>; the badge at the top counts the stale ones. <strong>Inspect</strong> opens the operation.</p>
        <Figure src="assets/docs/history/freshness.png" alt="The Freshness view: three cards, Observe repo github://github, inference-gateway and prometheus://promlabs, each fresh with 2/2 signals, and the badge 0 stale" caption="Three operations, each fresh on both signals; 0 stale." />
        <p>When the code moves on and the index does not, re-index: <code>atlas index .</code> brings the snapshot, and with it every derived operation, up to date. <a className="text-link" href="#docs/indexing">Indexing and reindexing</a> covers watching a repository so this happens on every change.</p>
        <p>The answers themselves say how fresh they are too. Since 0.1.55 every lookup carries <code>indexed_sha</code>, <code>head_sha</code>, <code>dirty</code> and <code>stale</code>, and a plain answer opens with a <code>stale:</code> line when the checkout has moved past the snapshot that answered — see <a className="text-link" href="#docs/search-and-ask">Search and Ask</a> (<a className="text-link" href="https://github.com/aziron-ai/atlas/issues/59" target="_blank" rel="noreferrer">#59</a>).</p>
      </ProseSection>

      <ProseSection title="See What a Service Started or Stopped Saying">
        <p><strong>What Changed</strong> compares two windows of one log stream from its hourly counts: templates <strong>New in B</strong>, <strong>Gone in B</strong>, and <strong>Rate changed</strong> per minute, biggest move first. Each row names the line of code that emits the template in <strong>CALLER</strong>. Choose the stream, then one shape: <strong>Recent window</strong> (the last 1–24 h against the same length before), <strong>Around an instant</strong> (either side of a deploy) or <strong>Explicit windows</strong>, and press <strong>Compare</strong>.</p>
        <Figure src="assets/docs/history/what-changed.png" alt="What Changed for prod / inference-gateway: Gone in B has route not found, Rate changed shows failed to generate tokens up 187 percent, with callers such as api/routes.go:805" caption="The last hour of the prod stream against the hour before. failed to generate tokens (api/routes.go:805) is up 187 % per minute; route not found stopped." />
        <p>Windows widen to whole UTC hours and are echoed back; a window still running is marked partial and its rates use the minutes elapsed, and a window that starts before the stream was first ingested is flagged as undercounted. The same comparison from a terminal:</p>
        <Command>{`atlas logs diff --stream inference-gateway --scope prod --window 1h --format plain`}</Command>
        <Command label="Output">{`stream inference-gateway  scope prod  limit 20  new 0 of 0  gone 1 of 1  changed 6 of 6
WINDOW  FROM                  TO                    MINUTES                 TEMPLATES  LINES
a       2026-10-28T04:00:00Z  2026-10-28T05:00:00Z  60                      7          120
b       2026-10-28T05:00:00Z  2026-10-28T07:00:00Z  75.88 of 120 (partial)  6          177

LIST     COUNT_A  COUNT_B  CHANGE  SEVERITY  CALLER                    SKELETON
gone     5        0        -100%   warn      api/routes.go:98          route not found
changed  12       44       +190%   error     api/routes.go:805         failed to generate tokens | err <*>:{<*>:<*>,<*>:<*>
…`}</Command>
        <p>Connecting a log source and the other Observe views are covered in <a className="text-link" href="#docs/observe">Observe</a>.</p>
      </ProseSection>

      <ProseSection title="From the API">
        <div className="docs-table-wrap"><table>
          <thead><tr><th>Route</th><th>Answers</th></tr></thead>
          <tbody>
            <tr><td><code>GET /api/v1/history?repo=&lt;repo&gt;</code></td><td>The snapshot timeline</td></tr>
            <tr><td><code>GET /api/v1/snapshot-diff?repo=&lt;repo&gt;&amp;from=&lt;sha&gt;</code></td><td>The structural delta; <code>422</code> with the "need two snapshots" detail when there is only one</td></tr>
            <tr><td><code>GET /api/v1/logs/diff</code></td><td>The two-window comparison What Changed draws</td></tr>
          </tbody>
        </table></div>
        <p>An assistant reads the timeline over MCP with the <code>history</code> tool (<a className="text-link" href="#docs/mcp">MCP tools</a>). Every command and flag is in the <a className="text-link" href="#docs/cli">CLI reference</a>; the service is described in <a className="text-link" href="#docs/service">Dashboard and API</a>.</p>
      </ProseSection>

      <ProseSection title="Related">
        <Bullets>
          <li><a className="text-link" href="#docs/indexing">Indexing and reindexing</a> — how snapshots are made and kept current.</li>
          <li><a className="text-link" href="#docs/impact">Impact and review</a> — what a change you are about to make will reach.</li>
          <li><a className="text-link" href="#docs/code-map">Code Map and graph</a> — open a hub and walk its neighbourhood.</li>
          <li><a className="text-link" href="#docs/observe">Observe</a> — log streams, incidents, alerts, builds and traces.</li>
        </Bullets>
      </ProseSection>
    </>
  );
}
