# One Atlas for a team

One Atlas can serve a whole team: one index, one watcher and one dashboard that
everyone's browser, CLI and assistants talk to. Tokens decide who may read and
who may write, an identity header gives each person their own Workbench
threads, and developer machines can connect to share telemetry and skills.
Reach for this page when Atlas moves off your laptop and onto a machine other
people reach.

## Open It

Run the service on an address other machines can reach. It listens on loopback
unless you say otherwise:

```sh
atlas token init
atlas serve --mcp --addr 0.0.0.0:3099
```

Two dashboard views tell you how the shared service is doing. **System**
(`#/system`, under **SYSTEM**) shows the service's own uptime, memory, CPU,
serving latency and storage, streamed live, with buttons for a self-diagnostic,
clearing stale snapshots and compacting storage; its **Operational settings**
editor and **Fleet uplink** card are further down the page. **Devices**
(`#/devices`, under **FLEET**) lists the machines that connected to it.

![System › Overview: uptime, memory, CPU, serving latency, graph DB size, lexical index size, telemetry DB size and events recorded](assets/docs/teams/system-runtime.png "System › Overview on the demo service.")

[Dashboard and HTTP API](service) lists every `atlas serve` flag;
[Configuration](configuration) lists the settings behind the editor.

## Protect It with Tokens

A service with no token answers anyone who can reach it, and says so when it
starts:

```text
API auth: off — no --token, ATLAS_API_TOKEN or ~/.atlas/api-token; `atlas token init` turns it on
```

Mint a token into `~/.atlas/api-token`, and optionally a read-only one, then
restart the service:

```text
$ atlas token init
atlas token: wrote a new read-write token to ~/.atlas/api-token (mode 0600); restart the serve to enforce it

$ atlas token init --ro
atlas token: wrote a new read-only token to ~/.atlas/api-token-ro (mode 0600); restart the serve to enforce it
```

```text
API auth: on — read-write token from ~/.atlas/api-token; read-only token from ~/.atlas/api-token-ro
```

- The service takes its token from `--token`, else `$ATLAS_API_TOKEN`, else
  `$ATLAS_HOME/api-token`. Prefer the file or the variable: a flag value shows
  up in `ps`.
- The **read-write** token can do everything: index, change state, trust
  skills, call `POST /mcp`.
- The **read-only** token is accepted only by routes classified as reads — give
  it to a dashboard or a reporting client that should look but not change
  anything.
- `atlas token` prints the token the running service enforces, for
  `curl -H "Authorization: Bearer $(atlas token)"`. Reading another rung than
  your own shell's `ATLAS_API_TOKEN` needs `sudo`.

What each caller gets, against a service with both tokens:

```text
# no token
{"code":"unauthorized","detail":"missing or invalid bearer token","status":401,"title":"Unauthorized","type":"about:blank"}

# read-only token, GET /api/v1/repos
[200]

# read-only token, POST /api/v1/incidents/refresh
{"code":"read_only_token","detail":"the read-only Atlas token cannot call this route","error":"read_only_token","status":403,"title":"Forbidden","type":"about:blank"}

# read-write token, POST /api/v1/incidents/refresh
[200]
```

The dashboard asks for the token the first time a browser opens it. Paste it
into **Paste ATLAS_API_TOKEN** and click **Unlock dashboard**; the browser
keeps it and reloads the live view.

![The Command Center with the Atlas token required banner, a Paste ATLAS_API_TOKEN field and an Unlock dashboard button](assets/docs/teams/token-prompt.png "A token-protected service refuses the dashboard's requests until a token is pasted.")

## Give Each Person Their Own Threads

The Ask Workbench keeps conversation threads on the service. With no identity
configured every caller is the same local principal, and the service says so:

```text
workbench threads: local mode — no identity provider, every caller is the local principal (--identity-header / ATLAS_IDENTITY_HEADER or --jira-oauth turn identity mode on)
```

Put an authenticating gateway in front of the service and have it set a header
naming the user:

```sh
atlas serve --addr 127.0.0.1:3099 --identity-header X-Atlas-User
# or: ATLAS_IDENTITY_HEADER=X-Atlas-User atlas serve
```

```text
workbench threads: identity mode — users from X-Atlas-User beside the read-write token; the read-write token alone is the service principal, the read-only token a reader
```

- Each thread is owned by the user the header names; a user sees their own
  threads and the ones shared with the tenant.
- The header is honoured only on a request that also carries the read-write
  token. The gateway holds that token, so a browser cannot claim to be someone
  else.
- `--jira-oauth` is the other identity mode: each person signs in with
  Atlassian OAuth and gets their own Jira workspace. It needs the
  `ATLAS_JIRA_OAUTH_*` settings and restricts the shared graph APIs and MCP to
  the administrator token.

See [Ask Workbench](workbench) for how threads work.

## Connect Developer Machines

A developer machine can register with the shared service so its usage
telemetry and captured episodes reach the team's Atlas, and skills sync both
ways:

```sh
atlas connect https://atlas.example.com --token "$ATLAS_SYNC_TOKEN"
```

- The machine registers under a stable device identity (OS user and primary
  MAC address), writes `~/.atlas/config.json` and installs the Claude and Codex
  capture hooks (`--no-hooks` skips them).
- `--level` decides what leaves the machine: `off`, `telemetry` (metrics only),
  `interactions` (normalized prompts and redacted traces — the default) or
  `full` (raw prompts, an org opt-in). Raw transcripts, tool outputs, answers
  and secrets never leave at any level.
- `atlas sync status` shows the uplink and its cursors, `atlas sync now` pushes
  once, and `atlas disconnect` removes the connection and the hooks.
- Skills and automations travel with `atlas skill push` / `pull` and
  `atlas recall push` / `pull`; a pushed skill arrives on the team service as a
  candidate for review. See [Skills and automations](skills).

Connected machines appear in **Devices** with their OS, Atlas version,
last-seen time, events uplinked and tokens saved. The demo service has none
yet:

![The Devices view: No devices registered yet. On each dev machine run atlas connect this-server-url](assets/docs/teams/devices-empty.png "Devices before any machine connects.")

On the service side, the **Fleet uplink** card on **System** shows the most a
device may share (`ATLAS_SYNC_ACCEPT_LEVEL`) and whether this machine itself is
connected to a hub:

![The Fleet uplink card: not connected to a hub; the server accepts up to the interactions level](assets/docs/teams/fleet-uplink.png "Fleet uplink on a service that is not itself connected to a hub.")

## Share Repositories and Stores

- **Register a repository without indexing it here.** `atlas link org/name
  --branch main` adds it to the registry so it joins cross-repository queries
  and shows in `atlas status`; run `atlas index` where the code is to fill it
  in.
- **Keep tenants apart.** On a hosted service that holds several organisations'
  repositories, `--tenant` scopes every query to one of them; empty means all
  repositories.
- **Find the stores a machine has used.** `atlas stores list` reads the store
  registry without opening any graph; `forget` and `prune` tidy it.
- **Use Postgres for a shared service.** Point `--db` at a `postgres://` DSN
  instead of a SQLite file. The observability data — log streams, incidents,
  captured episodes — then lives in its own schema in the same database.

```text
$ atlas stores list
LABEL       PATH                              REPOS  SYMBOLS  LAST INDEXED
atlas-demo  …/atlas-demo/atlas.db              1      11092    2026-10-28T05:16:55Z

$ atlas serve --addr 127.0.0.1:3099 --db "postgres://USER:PASSWORD@HOST:5432/atlas"
```

## Put It Behind TLS

`atlas serve` speaks plain HTTP. When the service is reached from other
machines, keep it on loopback or a private interface and terminate TLS at a
reverse proxy in front of it. If the proxy also authenticates users, let it
hold the read-write token and set the identity header, as above. Browser
clients served from another origin must be listed in
`ATLAS_MCP_ALLOWED_ORIGINS`; see [Dashboard and HTTP API](service).

**Token handling.** Anyone holding the read-write token can query every
repository the service indexes and change its state. Keep it out of shared
links, logs, screenshots and source control.

## From the CLI

```text
$ atlas token --help
Print the bearer token the running `atlas serve` enforces — to stdout, and
nothing else, so `curl -H "Authorization: Bearer $(atlas token)"` works.
…
The serve resolves its own token once, at startup:
  --token  >  $ATLAS_API_TOKEN  >  $ATLAS_HOME/api-token  >  none (auth off)
(read-only tier: --token-ro > $ATLAS_API_TOKEN_RO > $ATLAS_HOME/api-token-ro).

Available Commands:
  init        Mint a random token into $ATLAS_HOME/api-token (0600) for serve and its local clients
  show        Same as `atlas token`: print the token the running serve enforces

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
not connected (no server in ~/.atlas/config.json or ATLAS_SYNC_SERVER)
```

The [CLI reference](cli) lists every command.

## Related

- [Dashboard and HTTP API](service) — serve flags, origins and the API.
- [Configuration](configuration) — settings, storage selection and profiles.
- [Privacy and data handling](privacy) — what leaves a machine at each level,
  and how to purge it.
- [Ask Workbench](workbench) — the threads identity mode gives each user.
- [Skills and automations](skills) — what connected machines share.
