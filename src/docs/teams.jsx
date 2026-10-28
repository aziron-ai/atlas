import React from "react";
import { Command, ProseSection, Bullets, Callout, Figure, Clip, RELEASE, GITHUB, WIKI } from "./ui.jsx";

export default function Page() {
  return (
    <>
      <p className="docs-lead">One Atlas can serve a whole team: one index, one watcher and one dashboard that everyone's browser, CLI and assistants talk to. Tokens decide who may read and who may write, an identity header gives each person their own Workbench threads, and developer machines can connect to share telemetry and skills. Reach for this page when Atlas moves off your laptop and onto a machine other people reach.</p>

      <ProseSection title="Open It">
        <p>Run the service on an address other machines can reach. It listens on loopback unless you say otherwise:</p>
        <Command>{`atlas token init
atlas serve --mcp --addr 0.0.0.0:3099`}</Command>
        <p>Two dashboard views tell you how the shared service is doing. <strong>System</strong> (<code>#/system</code>, under <strong>SYSTEM</strong>) shows the service's own uptime, memory, CPU, serving latency and storage, streamed live, with buttons for a self-diagnostic, clearing stale snapshots and compacting storage; its <strong>Operational settings</strong> editor and <strong>Fleet uplink</strong> card are further down the page. <strong>Devices</strong> (<code>#/devices</code>, under <strong>FLEET</strong>) lists the machines that connected to it.</p>
        <Figure src="assets/docs/teams/system-runtime.png" alt="System › Overview: uptime, memory, CPU, serving latency, graph DB size, lexical index size, telemetry DB size and events recorded" caption="System › Overview on the demo service." />
        <p><a className="text-link" href="#docs/service">Dashboard and HTTP API</a> lists every <code>atlas serve</code> flag; <a className="text-link" href="#docs/configuration">Configuration</a> lists the settings behind the editor.</p>
      </ProseSection>

      <ProseSection title="Protect It with Tokens">
        <p>A service with no token answers anyone who can reach it, and says so when it starts:</p>
        <Command label="atlas serve">{`API auth: off — no --token, ATLAS_API_TOKEN or ~/.atlas/api-token; \`atlas token init\` turns it on`}</Command>
        <p>Mint a token into <code>~/.atlas/api-token</code>, and optionally a read-only one, then restart the service:</p>
        <Command>{`$ atlas token init
atlas token: wrote a new read-write token to ~/.atlas/api-token (mode 0600); restart the serve to enforce it

$ atlas token init --ro
atlas token: wrote a new read-only token to ~/.atlas/api-token-ro (mode 0600); restart the serve to enforce it`}</Command>
        <Command label="atlas serve">{`API auth: on — read-write token from ~/.atlas/api-token; read-only token from ~/.atlas/api-token-ro`}</Command>
        <Bullets>
          <li>The service takes its token from <code>--token</code>, else <code>$ATLAS_API_TOKEN</code>, else <code>$ATLAS_HOME/api-token</code>. Prefer the file or the variable: a flag value shows up in <code>ps</code>.</li>
          <li>The <strong>read-write</strong> token can do everything: index, change state, trust skills, call <code>POST /mcp</code>.</li>
          <li>The <strong>read-only</strong> token is accepted only by routes classified as reads — give it to a dashboard or a reporting client that should look but not change anything.</li>
          <li><code>atlas token</code> prints the token the running service enforces, for <code>curl -H "Authorization: Bearer $(atlas token)"</code>. Reading another rung than your own shell's <code>ATLAS_API_TOKEN</code> needs <code>sudo</code>.</li>
        </Bullets>
        <p>What each caller gets, against a service with both tokens:</p>
        <Command>{`# no token
{"code":"unauthorized","detail":"missing or invalid bearer token","status":401,"title":"Unauthorized","type":"about:blank"}

# read-only token, GET /api/v1/repos
[200]

# read-only token, POST /api/v1/incidents/refresh
{"code":"read_only_token","detail":"the read-only Atlas token cannot call this route","error":"read_only_token","status":403,"title":"Forbidden","type":"about:blank"}

# read-write token, POST /api/v1/incidents/refresh
[200]`}</Command>
        <p>The dashboard asks for the token the first time a browser opens it. Paste it into <strong>Paste ATLAS_API_TOKEN</strong> and click <strong>Unlock dashboard</strong>; the browser keeps it and reloads the live view.</p>
        <Figure src="assets/docs/teams/token-prompt.png" alt="The Command Center with the Atlas token required banner, a Paste ATLAS_API_TOKEN field and an Unlock dashboard button" caption="A token-protected service refuses the dashboard's requests until a token is pasted." />
      </ProseSection>

      <ProseSection title="Give Each Person Their Own Threads">
        <p>The Ask Workbench keeps conversation threads on the service. With no identity configured every caller is the same local principal, and the service says so:</p>
        <Command label="atlas serve">{`workbench threads: local mode — no identity provider, every caller is the local principal (--identity-header / ATLAS_IDENTITY_HEADER or --jira-oauth turn identity mode on)`}</Command>
        <p>Put an authenticating gateway in front of the service and have it set a header naming the user:</p>
        <Command>{`atlas serve --addr 127.0.0.1:3099 --identity-header X-Atlas-User
# or: ATLAS_IDENTITY_HEADER=X-Atlas-User atlas serve`}</Command>
        <Command label="atlas serve">{`workbench threads: identity mode — users from X-Atlas-User beside the read-write token; the read-write token alone is the service principal, the read-only token a reader`}</Command>
        <Bullets>
          <li>Each thread is owned by the user the header names; a user sees their own threads and the ones shared with the tenant.</li>
          <li>The header is honoured only on a request that also carries the read-write token. The gateway holds that token, so a browser cannot claim to be someone else.</li>
          <li><code>--jira-oauth</code> is the other identity mode: each person signs in with Atlassian OAuth and gets their own Jira workspace. It needs the <code>ATLAS_JIRA_OAUTH_*</code> settings and restricts the shared graph APIs and MCP to the administrator token.</li>
        </Bullets>
        <p>See <a className="text-link" href="#docs/workbench">Ask Workbench</a> for how threads work.</p>
      </ProseSection>

      <ProseSection title="Connect Developer Machines">
        <p>A developer machine can register with the shared service so its usage telemetry and captured episodes reach the team's Atlas, and skills sync both ways:</p>
        <Command>{`atlas connect https://atlas.example.com --token "$ATLAS_SYNC_TOKEN"`}</Command>
        <Bullets>
          <li>The machine registers under a stable device identity (OS user and primary MAC address), writes <code>~/.atlas/config.json</code> and installs the Claude and Codex capture hooks (<code>--no-hooks</code> skips them).</li>
          <li><code>--level</code> decides what leaves the machine: <code>off</code>, <code>telemetry</code> (metrics only), <code>interactions</code> (normalized prompts and redacted traces — the default) or <code>full</code> (raw prompts, an org opt-in). Raw transcripts, tool outputs, answers and secrets never leave at any level.</li>
          <li><code>atlas sync status</code> shows the uplink and its cursors, <code>atlas sync now</code> pushes once, and <code>atlas disconnect</code> removes the connection and the hooks.</li>
          <li>Skills and automations travel with <code>atlas skill push</code> / <code>pull</code> and <code>atlas recall push</code> / <code>pull</code>; a pushed skill arrives on the team service as a candidate for review. See <a className="text-link" href="#docs/skills">Skills and automations</a>.</li>
        </Bullets>
        <p>Connected machines appear in <strong>Devices</strong> with their OS, Atlas version, last-seen time, events uplinked and tokens saved. The demo service has none yet:</p>
        <Figure src="assets/docs/teams/devices-empty.png" alt="The Devices view: No devices registered yet. On each dev machine run atlas connect this-server-url" caption="Devices before any machine connects." />
        <p>On the service side, the <strong>Fleet uplink</strong> card on <strong>System</strong> shows the most a device may share (<code>ATLAS_SYNC_ACCEPT_LEVEL</code>) and whether this machine itself is connected to a hub:</p>
        <Figure src="assets/docs/teams/fleet-uplink.png" alt="The Fleet uplink card: not connected to a hub; the server accepts up to the interactions level" caption="Fleet uplink on a service that is not itself connected to a hub." />
      </ProseSection>

      <ProseSection title="Share Repositories and Stores">
        <Bullets>
          <li><strong>Register a repository without indexing it here.</strong> <code>atlas link org/name --branch main</code> adds it to the registry so it joins cross-repository queries and shows in <code>atlas status</code>; run <code>atlas index</code> where the code is to fill it in.</li>
          <li><strong>Keep tenants apart.</strong> On a hosted service that holds several organisations' repositories, <code>--tenant</code> scopes every query to one of them; empty means all repositories.</li>
          <li><strong>Find the stores a machine has used.</strong> <code>atlas stores list</code> reads the store registry without opening any graph; <code>forget</code> and <code>prune</code> tidy it.</li>
          <li><strong>Use Postgres for a shared service.</strong> Point <code>--db</code> at a <code>postgres://</code> DSN instead of a SQLite file. The observability data — log streams, incidents, captured episodes — then lives in its own schema in the same database.</li>
        </Bullets>
        <Command>{`$ atlas stores list
LABEL       PATH                              REPOS  SYMBOLS  LAST INDEXED
atlas-demo  …/atlas-demo/atlas.db              1      11092    2026-10-28T05:16:55Z

$ atlas serve --addr 127.0.0.1:3099 --db "postgres://USER:PASSWORD@HOST:5432/atlas"`}</Command>
      </ProseSection>

      <ProseSection title="Put It Behind TLS">
        <p><code>atlas serve</code> speaks plain HTTP. When the service is reached from other machines, keep it on loopback or a private interface and terminate TLS at a reverse proxy in front of it. If the proxy also authenticates users, let it hold the read-write token and set the identity header, as above. Browser clients served from another origin must be listed in <code>ATLAS_MCP_ALLOWED_ORIGINS</code>; see <a className="text-link" href="#docs/service">Dashboard and HTTP API</a>.</p>
        <Callout kind="warn" label="Token handling">
          <p>Anyone holding the read-write token can query every repository the service indexes and change its state. Keep it out of shared links, logs, screenshots and source control.</p>
        </Callout>
      </ProseSection>

      <ProseSection title="From the CLI">
        <Command>{`$ atlas token --help
Print the bearer token the running \`atlas serve\` enforces — to stdout, and
nothing else, so \`curl -H "Authorization: Bearer $(atlas token)"\` works.
…
The serve resolves its own token once, at startup:
  --token  >  $ATLAS_API_TOKEN  >  $ATLAS_HOME/api-token  >  none (auth off)
(read-only tier: --token-ro > $ATLAS_API_TOKEN_RO > $ATLAS_HOME/api-token-ro).

Available Commands:
  init        Mint a random token into $ATLAS_HOME/api-token (0600) for serve and its local clients
  show        Same as \`atlas token\`: print the token the running serve enforces

$ atlas connect --help
Usage:
  atlas connect [server-url] [flags]

Flags:
      --level string         data-sharing level: off|telemetry|interactions|full (default interactions)
      --no-hooks             skip installing the Claude/Codex capture hooks
      --prompt-mode string   fine-grained prompt redaction override: norm|raw|off (the level's own mode wins when unset)
      --reset-device         recompute the device identity instead of reusing the persisted one
      --scope string         org scope for this device's events
      --token string         bearer token for the central Atlas (or ATLAS_SYNC_TOKEN)

$ atlas sync status
not connected (no server in ~/.atlas/config.json or ATLAS_SYNC_SERVER)`}</Command>
        <p>The <a className="text-link" href="#docs/cli">CLI reference</a> lists every command.</p>
      </ProseSection>

      <ProseSection title="Related">
        <Bullets>
          <li><a className="text-link" href="#docs/service">Dashboard and HTTP API</a> — serve flags, origins and the API.</li>
          <li><a className="text-link" href="#docs/configuration">Configuration</a> — settings, storage selection and profiles.</li>
          <li><a className="text-link" href="#docs/privacy">Privacy and data handling</a> — what leaves a machine at each level, and how to purge it.</li>
          <li><a className="text-link" href="#docs/workbench">Ask Workbench</a> — the threads identity mode gives each user.</li>
          <li><a className="text-link" href="#docs/skills">Skills and automations</a> — what connected machines share.</li>
        </Bullets>
      </ProseSection>
    </>
  );
}
