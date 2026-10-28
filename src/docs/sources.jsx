import React from "react";
import { Command, ProseSection, Bullets, Callout, Figure, Clip, RELEASE, GITHUB, WIKI } from "./ui.jsx";

export default function Page() {
  return (
    <>
      <p className="docs-lead">A connected source brings the records around your code — pull requests and issues, tickets, wiki pages, dashboards and alert rules, builds, traces, drive files — into Atlas as a virtual repository. Each record becomes a real file with real line ranges, indexed like code, so a citation into a pull request validates by path and hash exactly the way a citation into a function does. Reach for it when the answer you need is the why behind the code: the ticket that asked for a change, the pull request that made it, the alert that fires on it.</p>

      <ProseSection title="Open It">
        <p>Sources are added and synced from the CLI. Two dashboard pages show them:</p>
        <Bullets>
          <li><strong>Connectors</strong> in FLEET (<code>#/connectors</code>) — the monitoring kinds (Prometheus, Grafana, Jenkins, Tempo) beside the log pulls, each with its status and a <strong>Configure</strong> form.</li>
          <li><strong>System</strong> → <strong>App integrations</strong> (<code>#/system?tab=integrations</code>) — the GitHub and Pulse lanes of the Ask Workbench, and Jira sign-in.</li>
        </Bullets>
        <Figure src="assets/docs/sources/connectors-view.png" alt="The Connectors view: cards for Grafana Loki, Elasticsearch, Prometheus, Grafana, Jenkins, Jenkins console pull and Tempo, two of them configured" caption="Connectors on the demo service: a Loki log pull and the public Prometheus at demo.promlabs.com are configured; the other cards wait for Configure." />
        <p>In a terminal, <code>atlas source list</code> shows what is configured and <code>atlas source status</code> what each source has actually synced.</p>
      </ProseSection>

      <ProseSection title="Choose a Kind">
        <p>Eight kinds are registered. Each turns its records into Markdown documents under its own virtual repository (<code>github://&lt;name&gt;</code>, <code>prometheus://&lt;name&gt;</code>, …):</p>
        <div className="docs-table-wrap"><table>
          <thead><tr><th>Kind</th><th>What becomes a document</th><th>Credential</th><th>Also feeds</th></tr></thead>
          <tbody>
            <tr><td><code>github</code></td><td>Pull requests and issues of each <code>--repo owner/name</code>, as <code>github/&lt;owner&gt;/&lt;repo&gt;/pull/&lt;n&gt;.md</code> and <code>…/issue/&lt;n&gt;.md</code></td><td><code>--token-env GITHUB_TOKEN</code></td><td>The Workbench's GitHub lane</td></tr>
            <tr><td><code>jira</code></td><td>The issues of <code>--project KEY</code> (or a <code>--jql</code> filter)</td><td><code>--email</code> and <code>--token-env</code>; none for a public instance</td><td>The Workbench's Jira lane</td></tr>
            <tr><td><code>confluence</code></td><td>The pages of <code>--space KEY</code> (optionally narrowed with <code>--cql</code>)</td><td><code>--email</code> and <code>--token-env</code>; none for a public instance</td><td>The Workbench's Confluence lane</td></tr>
            <tr><td><code>onedrive</code></td><td>The files of a drive (<code>--drive me</code>), optionally one <code>--folder</code></td><td>A bearer token in <code>--token-env</code>; there is no anonymous tier</td><td>—</td></tr>
            <tr><td><code>grafana</code></td><td>Dashboards and alert rules, as <code>grafana/dashboards/&lt;uid&gt;.md</code> and <code>grafana/alerts/&lt;uid&gt;.md</code></td><td>A Viewer service-account token in <code>--token-env</code></td><td>Dashboard and alert-rule citations in Incidents</td></tr>
            <tr><td><code>prometheus</code></td><td>Its rules</td><td>None, or a bearer for a proxy that demands one</td><td><code>atlas metrics</code>, Alerts &amp; Metrics</td></tr>
            <tr><td><code>jenkins</code></td><td>Jobs and builds</td><td>None where the controller allows it, else <code>--email &lt;user id&gt;</code> and <code>--token-env</code></td><td><code>atlas builds</code>, Builds</td></tr>
            <tr><td><code>tempo</code></td><td>The services it saw</td><td>None, or a bearer for a proxy</td><td><code>atlas traces</code>, Traces</td></tr>
          </tbody>
        </table></div>
      </ProseSection>

      <ProseSection title="Add and Sync a Source">
        <p>The demo service has one public source: the pull requests and issues of <code>inference-gateway/inference-gateway</code> on GitHub. Adding it validates the connection and writes the configuration; it pulls nothing:</p>
        <Command>{`atlas source add github --kind github --repo inference-gateway/inference-gateway --token-env GITHUB_TOKEN --window 90d`}</Command>
        <Command label="JSON">{`{
  "name": "github",
  "kind": "github",
  "repos": ["inference-gateway/inference-gateway"],
  "token_env": "GITHUB_TOKEN",
  "credential_rung": "none",
  "credential_reason": "$GITHUB_TOKEN is empty and the gh CLI is not installed",
  "window": "90d",
  "validated": true,
  "validated_by": "connector",
  "next": "atlas source sync github"
}`}</Command>
        <Callout kind="tip" label="Credentials are names">
          <p><code>--token-env</code> names an environment variable; the token is read from it at sync time and never stored, so the sources file cannot leak one. Here the variable is set for the one sync command only.</p>
        </Callout>
        <p><code>atlas source sync</code> does the work: it pulls everything changed since the stored cursor, writes each record as a file, and indexes the result as a virtual repository:</p>
        <Command>{`GITHUB_TOKEN=$(gh auth token) atlas source sync github`}</Command>
        <Command label="JSON">{`{
  "name": "github",
  "repo_full_name": "github://github",
  "window": "90d",
  "docs_fetched": 287,
  "docs_written": 287,
  "indexed_files": 287,
  "symbols": 1402,
  "reconciled": true,
  "next_reconcile_at": "2026-11-04T05:45:02Z",
  "duration_ms": 228002
}`}</Command>
        <p>287 pull requests and issues updated in the last 90 days became 287 files in <code>github://github</code>. A sync that finds nothing new is a no-op, not a new snapshot, and a sync that fails part-way resumes from its last checkpoint. <code>atlas source status</code> reports what is held:</p>
        <Command>{`atlas source status github`}</Command>
        <Command label="JSON">{`{
  "name": "github",
  "kind": "github",
  "token_env": "GITHUB_TOKEN",
  "token_present": false,
  "credential_rung": "none",
  "repo_full_name": "github://github",
  "docs": 287,
  "window": "90d",
  "oldest_updated": "2026-07-31T09:51:54Z",
  "newest_updated": "2026-10-27T17:54:30Z",
  "last_synced_at": "2026-10-28T05:41:16Z",
  "next_reconcile_at": "2026-11-04T05:45:02Z"
}`}</Command>
        <p><code>token_present</code> is <code>false</code> because the variable was set only for the sync.</p>
      </ProseSection>

      <ProseSection title="Configure a Monitoring Source from the Dashboard">
        <p>The monitoring kinds can also be added on <strong>Connectors</strong>. <strong>Configure</strong> opens a form: a source name, the base URL and the <em>name</em> of the variable that holds the token. As you type, the card shows the same write two other ways — the CLI command and the HTTP request.</p>
        <Clip src="assets/docs/sources/configure-a-source.mp4" alt="Opening Configure on the Grafana card, typing a source name, a base URL and GRAFANA_SA_TOKEN, and the CLI and HTTP spellings filling in" caption="The Grafana form. The token field takes a variable name, and the CLI and POST spellings update as you type. The clip stops before Save." />
        <p><strong>Save &amp; validate</strong> has the service reach the URL and check the configuration before anything is written; the result appears in the card. A configured card shows the source's state and offers <strong>Edit</strong> and <strong>Remove</strong>. Log pulls and the Observe views are covered in <a className="text-link" href="#docs/observe">Observe</a>.</p>
      </ProseSection>

      <ProseSection title="Find Pull Requests and Issues in Answers">
        <p>Once synced, the records answer like code. Search the virtual repository from the CLI:</p>
        <Command>{`atlas search --repo github://github --format plain streaming`}</Command>
        <Command label="Output">{`search  mode lexical  total 20
  matches  118  (page limit 20)
  #578: fix(proxy): relay upstream status and body on streaming /proxy requests  section  github/inference-gateway/inference-gateway/pull/578.md:24  :: …
  #695: [BUG] MCP streaming mode leaks tool_call deltas to the client …  section  github/inference-gateway/inference-gateway/issue/695.md:15  :: …
  #696: fix(mcp): keep agent tool-call chunks off the client stream  section  github/inference-gateway/inference-gateway/pull/696.md:24  :: …
  …`}</Command>
        <p>On <strong>Ask Atlas</strong>, choose <strong>docs</strong> and the <code>github://github</code> repository: the answer quotes the passage verbatim, cites the document by path and line, and offers <strong>Open in Github ↗</strong> to the original.</p>
        <Figure src="assets/docs/sources/ask-github-pr.png" alt="Ask Atlas over github://github for Retry-After header: the best passage is the title of pull request 752, cited as github/inference-gateway/inference-gateway/pull/752.md, with Open document and Open in Github" caption="Pull request #752 found by Ask Atlas: 6 documents answer, the best passage cited by path and line." />
      </ProseSection>

      <ProseSection title="See a Source's State in the Dashboard">
        <p><strong>System</strong> → <strong>App integrations</strong> → <strong>Integrations</strong> shows each GitHub source as the service sees it: the repositories it covers, how many records it holds, its credential, its window, the last sync and the webhook address to paste into the repository's settings.</p>
        <Figure src="assets/docs/sources/github-integration.png" alt="The Integrations card: GitHub with no credential, source github with 287 PRs and issues stored, repo inference-gateway/inference-gateway, credential none, window 90d, last sync, and the webhook URL; Pulse with nothing pushed" caption="The demo's GitHub source: 287 records, a 90-day window, and no credential in the service's own environment." />
        <p>The <strong>Credential</strong> row is the rung the service is on: <strong>env</strong> (the variable the source names is set in the service's environment), <strong>gh_cli</strong> (<code>gh auth token</code>, used only by a service listening on loopback) or <strong>none</strong>. The service reads the variable from its <em>own</em> environment — for a background service, the environment it was started with, not your shell's. The Ask Workbench's GitHub lane — pull requests, checks and reviews read for a question — needs that credential. On the demo the service was started without it, so the lane reads <strong>not connected</strong> under every answer, while the synced records stay searchable. <strong>Connect</strong> leads to this page.</p>
        <Figure src="assets/docs/sources/workbench-source-lanes.png" alt="The source lanes under a Workbench answer: Atlas 11, Git 3, GitHub not connected, Jira not connected, Confluence not connected, Pulse not connected, each with Connect" caption="The lanes under a Workbench answer on the demo: Atlas and Git answered; GitHub, Jira, Confluence and Pulse are not connected." width={720} />
      </ProseSection>

      <ProseSection title="Keep a Source Current">
        <Bullets>
          <li><strong>Rolling window.</strong> A Jira or GitHub source pulls only records <em>updated</em> within its window — 180 days unless <code>--window</code> says otherwise — and the same window is the corpus's time-to-live: a record that falls behind it leaves at the next sync. Other kinds are unbounded unless you set one; Prometheus refuses one. <code>atlas source set &lt;name&gt; --window 26w</code> changes it: widening back-fills exactly the newly covered range, narrowing prunes locally without a request.</li>
          <li><strong>Schedule.</strong> A running service resyncs its sources every 15 minutes by default (<code>atlas serve --source-sync-every</code>); <code>--sync-every</code> on a source overrides it, and <code>0</code> opts that source out. The demo's GitHub source is synced by hand:</li>
        </Bullets>
        <Command>{`atlas source set github --sync-every 0`}</Command>
        <Command label="JSON">{`{
  "name": "github",
  "next": "atlas source sync github",
  "sync_every": "0",
  "sync_every_effect": "the serve no longer syncs this source on a schedule; its webhook and \`atlas source sync\` still do"
}`}</Command>
        <Bullets>
          <li><strong>Deletions.</strong> A sync removes records the source no longer lists by reconciling its membership every 7 days (<code>--reconcile-every</code>), or at once with <code>atlas source sync &lt;name&gt; --reconcile</code>. <code>--full</code> re-pulls everything from the beginning.</li>
          <li><strong>Webhooks.</strong> A webhook makes a change visible in seconds instead of at the next sync. For Jira, <code>atlas source webhook &lt;name&gt; --secret-env NAME</code> prints the setup, <code>--register</code> creates it through Jira's admin API and <code>--verify</code> waits for the first delivery. For GitHub, the Integrations card gives the address (<code>/api/v1/sources/&lt;name&gt;/webhook</code>) for the <code>pull_request</code>, <code>issues</code> and <code>push</code> events, signed with <code>X-Hub-Signature-256</code>.</li>
        </Bullets>
      </ProseSection>

      <ProseSection title="Connect Jira">
        <p>Jira connects two ways, for two jobs:</p>
        <Bullets>
          <li><strong>As a source</strong> — one project materialized into the corpus with the service's credential, so tickets are searchable, citable and offered to the Workbench's Jira lane. A public instance needs no credential: leave <code>--email</code> and <code>--token-env</code> off.</li>
          <li><strong>As sign-in</strong> — each person connects their own Atlassian account under <strong>System</strong> → <strong>App integrations</strong> → <strong>Jira</strong> and searches Jira live with their own permissions. The service must be started with <code>--jira-oauth</code> and the <code>ATLAS_JIRA_OAUTH_*</code> settings.</li>
        </Bullets>
        <Command>{`atlas source add jira-ops --kind jira --url https://jira.example.com --project OPS \\
  --email you@example.com --token-env JIRA_API_TOKEN --window 90d
atlas source sync jira-ops`}</Command>
        <p>The demo service has neither, and its Jira card says so:</p>
        <Figure src="assets/docs/sources/jira-card.png" alt="The Jira card under App integrations: Not connected, Jira sign-in is not configured, Ask your Atlas administrator to enable Jira sign-in for this Command Center" caption="Jira under App integrations on a service started without --jira-oauth." width={720} />
      </ProseSection>

      <ProseSection title="Remove a Source">
        <Command>{`atlas source remove github          # forget how the corpus was fetched; keep the corpus
atlas source remove github --purge  # also delete the materialized files`}</Command>
        <p>Without <code>--purge</code> the files and the indexed snapshots stay, so re-adding the source resumes where it left off. On <strong>Connectors</strong>, <strong>Remove</strong> does the same for a monitoring source after a second click to confirm.</p>
      </ProseSection>

      <ProseSection title="From the API">
        <div className="docs-table-wrap"><table>
          <thead><tr><th>Route</th><th>Does</th></tr></thead>
          <tbody>
            <tr><td><code>GET /api/v1/sources</code></td><td>Every source with its kind, window, credential rung, document count and sync state</td></tr>
            <tr><td><code>POST /api/v1/sources</code></td><td>Add or replace a source; the service validates it before writing</td></tr>
            <tr><td><code>DELETE /api/v1/sources/{"{name}"}</code></td><td>Remove a source</td></tr>
            <tr><td><code>POST /api/v1/sources/{"{name}"}/webhook</code></td><td>The webhook door a Jira or GitHub delivery posts to</td></tr>
            <tr><td><code>GET /api/v1/sources/pulse/status</code></td><td>The findings Pulse has pushed</td></tr>
          </tbody>
        </table></div>
        <p>Writes need the read-write token where a token is set. See <a className="text-link" href="#docs/service">Dashboard and API</a> and, for every flag, the <a className="text-link" href="#docs/cli">CLI reference</a>.</p>
      </ProseSection>

      <ProseSection title="Related">
        <Bullets>
          <li><a className="text-link" href="#docs/workbench">Ask Workbench</a> — where the GitHub, Jira, Confluence and Pulse lanes answer.</li>
          <li><a className="text-link" href="#docs/search-and-ask">Search and Ask</a> — searching code and documents together.</li>
          <li><a className="text-link" href="#docs/observe">Observe</a> — log pulls, metrics, builds and traces from the monitoring kinds.</li>
          <li><a className="text-link" href="#docs/privacy">Privacy and data</a> — what a sync stores and where.</li>
        </Bullets>
      </ProseSection>
    </>
  );
}
