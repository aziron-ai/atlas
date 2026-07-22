# Dashboard and HTTP API

One `atlas serve` process hosts the local dashboard, the HTTP API, the
repository watcher, and — with `--mcp` — the MCP endpoint. Run it when you
want a browsable view of the graph, when thin clients should share one index,
or when other tooling needs a REST surface.

## Start the Service

Start with MCP mounted so assistants and HTTP clients share the same process:

```sh
atlas serve --mcp
```

Useful variants:

```sh
atlas serve --open        # also auto-open the dashboard in your browser
atlas serve --watch=false  # do not keep the graph fresh in the background
```

Default address and dashboard:

```text
http://127.0.0.1:3099
http://127.0.0.1:3099/dashboard
```

## Serve Flags

| Flag | Default | Effect |
| --- | --- | --- |
| `--addr` | `127.0.0.1:3099` | Listen address; loopback by default. Use `0.0.0.0:3099` to expose on the network |
| `--mcp` | off | Also mount MCP over HTTP at `POST /mcp` |
| `--open` | `false` | Auto-open the dashboard in your browser once ready (off by default; pass `--open` to enable). `serve` hosts the dashboard either way |
| `--watch` | `true` | Keep the graph fresh by watching the repo; `--watch=false` or `ATLAS_NO_WATCH=1` to disable |
| `--watch-path` | `--repo`, else current dir | Repo path to watch when `--watch` is set |

Global flags such as `--db`, `--repo`, and `--read-only` apply as on any other
command; see the [CLI Reference](cli).

## Health and API Discovery

Use these endpoints to script readiness checks and to discover the API:

```sh
curl http://127.0.0.1:3099/healthz
curl http://127.0.0.1:3099/readyz
curl http://127.0.0.1:3099/openapi.json
```

- `healthz` confirms the process is running.
- `readyz` confirms Atlas can answer a lightweight engine request.
- `openapi.json` is the version-specific API contract. Generate clients and
  validate requests against this document rather than copying request shapes
  from historical examples.

## Common Requests

```sh
curl http://127.0.0.1:3099/api/v1/status
curl http://127.0.0.1:3099/api/v1/stats
curl "http://127.0.0.1:3099/api/v1/search?q=Checkout"
```

## Binding Beyond Loopback

Loopback is the safe default. Before binding to another interface, require a
bearer token and restrict browser origins:

```sh
export ATLAS_API_TOKEN='replace-with-a-strong-token'
export ATLAS_MCP_ALLOWED_ORIGINS='https://trusted.example'
atlas serve --mcp --addr 0.0.0.0:3099
```

Authenticated request:

```sh
curl \
  -H "Authorization: Bearer $ATLAS_API_TOKEN" \
  http://host:3099/api/v1/status
```

`ATLAS_API_TOKEN` protects `/api/v1/*` and `POST /mcp`. Browser clients from
additional origins must also be explicitly allowed via
`ATLAS_MCP_ALLOWED_ORIGINS`.

When a token-protected dashboard requests credentials, supply the configured
Atlas API token. The dashboard uses authenticated API calls and a short-lived
stream credential for live updates.

### Token Handling

> **Warning:** Do not place the API token in shared links, logs, screenshots,
> or source control. Anyone holding the token can query every repository the
> service indexes.

## TLS

Atlas serves plain HTTP. When traffic leaves the machine, terminate TLS at a
trusted reverse proxy in front of `atlas serve` rather than exposing the
listener directly.

## Service Troubleshooting

Start with Atlas's own diagnostics, then check the port:

```sh
atlas status
atlas doctor
lsof -nP -iTCP:3099 -sTCP:LISTEN
```

If `healthz` passes but `readyz` fails, indexing or database maintenance may
be blocking engine requests. Wait for the current operation or stop competing
Atlas processes before retrying. See [Troubleshooting](troubleshooting) for
broader diagnosis.
