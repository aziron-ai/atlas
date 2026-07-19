# Dashboard and HTTP API

Atlas can run a local dashboard, HTTP API, repository watcher, and MCP endpoint
from one process.

## Start the Service

```sh
atlas serve
```

Useful variants:

```sh
atlas serve --open=false
atlas serve --open=false --watch=false
atlas serve --mcp
```

Default address:

```text
http://127.0.0.1:3099
```

Dashboard:

```text
http://127.0.0.1:3099/dashboard
```

## Health and API Discovery

```sh
curl http://127.0.0.1:3099/healthz
curl http://127.0.0.1:3099/readyz
curl http://127.0.0.1:3099/openapi.json
```

- `healthz` confirms the process is running.
- `readyz` confirms Atlas can answer a lightweight engine request.
- `openapi.json` is the version-specific API contract.

## Common Requests

```sh
curl http://127.0.0.1:3099/api/v1/status
curl http://127.0.0.1:3099/api/v1/stats
curl "http://127.0.0.1:3099/api/v1/search?q=Checkout"
```

Use the OpenAPI document rather than copying old request shapes from historical
examples.

## Protect Network Access

Loopback is the safe default. Before binding to another interface:

```sh
export ATLAS_API_TOKEN='replace-with-a-strong-token'
atlas serve --mcp --addr 0.0.0.0:3099
```

Authenticated request:

```sh
curl \
  -H "Authorization: Bearer $ATLAS_API_TOKEN" \
  http://host:3099/api/v1/status
```

`ATLAS_API_TOKEN` protects `/api/v1/*` and `POST /mcp`. Browser clients from
additional origins must also be explicitly allowed:

```sh
export ATLAS_MCP_ALLOWED_ORIGINS='https://trusted.example'
```

Use TLS at a trusted reverse proxy when traffic leaves the machine.

## Dashboard Authentication

When a token-protected dashboard requests credentials, supply the configured
Atlas API token. The dashboard uses authenticated API calls and a short-lived
stream credential for live updates.

Do not place the API token in shared links, logs, screenshots, or source
control.

## Service Troubleshooting

```sh
atlas status
atlas doctor
lsof -nP -iTCP:3099 -sTCP:LISTEN
```

If `healthz` passes but `readyz` fails, indexing or database maintenance may be
blocking engine requests. Wait for the current operation or stop competing
Atlas processes before retrying.
