# Atlas

**Local code intelligence for developers and AI coding assistants.**

Atlas indexes a repository and returns focused, source-grounded context about
symbols, callers, references, routes, and change impact. Results include file
and line references so developers and coding agents can inspect the evidence
without loading an entire codebase into a model context window.

[Documentation](https://github.com/aziron-ai/atlas/wiki) |
[Install](https://github.com/aziron-ai/atlas/wiki/Installation) |
[Releases](https://github.com/aziron-ai/atlas/releases) |
[Benchmarks](https://aziron-ai.github.io/atlas/) |
[Troubleshooting](https://github.com/aziron-ai/atlas/wiki/Troubleshooting)

## Quickstart

Install Atlas with Homebrew:

```sh
brew install --cask aziron-ai/atlas/atlas
```

Or install the npm wrapper:

```sh
npm install -g @aziron/atlas
```

Index a repository and connect Atlas to supported coding assistants:

```sh
cd /path/to/repository
atlas version
atlas index .
atlas bootstrap --dry-run
atlas bootstrap
atlas status
```

Atlas can then answer questions such as:

- Where is the checkout flow implemented?
- Who calls `CreateOrder`?
- What may be affected if `services/cart.go` changes?
- Which routes or repositories depend on this handler?

See [Getting Started](https://github.com/aziron-ai/atlas/wiki/Getting-Started)
for a guided first index and first query.

## What Atlas Provides

| Task | Capability |
| --- | --- |
| Find relevant code | Code-aware search and bounded context |
| Understand a symbol | Definitions, callers, callees, and references |
| Review a change | Repository and cross-repository impact analysis |
| Trace service dependencies | Routes, consumers, and dependencies |
| Support coding agents | MCP tools with source and line citations |
| Operate a local index | CLI status, dashboard, and HTTP API |

Atlas runs locally by default and stores its default index in the repository
workspace. A server is not required for local indexing, CLI queries, or stdio
MCP usage.

## Interfaces

Atlas is available through:

- the `atlas` command-line interface
- MCP integrations for Claude, Codex, Cursor, Gemini, and GitHub Copilot
- a local dashboard and HTTP API
- release archives and native Linux packages

Integration behavior varies by client. Follow
[AI Assistant Setup](https://github.com/aziron-ai/atlas/wiki/AI-Assistant-Setup)
for supported configurations.

## Installation Notes

Homebrew and npm installations run Atlas bootstrap to register supported local
assistant integrations. Review the planned changes first with:

```sh
atlas bootstrap --dry-run
```

For npm automation that must not update assistant configuration:

```sh
ATLAS_SKIP_BOOTSTRAP=1 npm install -g @aziron/atlas
```

Atlas release channels currently provide:

| Channel | Platforms |
| --- | --- |
| Homebrew cask | macOS and Linux, amd64 and arm64 |
| npm `@aziron/atlas` | macOS/Linux x64 and arm64; Windows x64 |
| Release archives | macOS/Linux amd64 and arm64; Windows amd64 |
| Linux packages | `.deb`, `.rpm`, and `.apk` for amd64 and arm64 |

Checksums and per-archive SBOMs are attached to each GitHub release. See
[Installation](https://github.com/aziron-ai/atlas/wiki/Installation) for direct
downloads and verification.

## Documentation

- [Getting Started](https://github.com/aziron-ai/atlas/wiki/Getting-Started)
- [Installation](https://github.com/aziron-ai/atlas/wiki/Installation)
- [Indexing and Reindexing](https://github.com/aziron-ai/atlas/wiki/Indexing-and-Reindexing)
- [CLI Reference](https://github.com/aziron-ai/atlas/wiki/CLI-Reference)
- [AI Assistant Setup](https://github.com/aziron-ai/atlas/wiki/AI-Assistant-Setup)
- [MCP Tools](https://github.com/aziron-ai/atlas/wiki/MCP-Tools)
- [Dashboard and HTTP API](https://github.com/aziron-ai/atlas/wiki/Dashboard-and-HTTP-API)
- [Configuration](https://github.com/aziron-ai/atlas/wiki/Configuration)
- [Privacy and Data Handling](https://github.com/aziron-ai/atlas/wiki/Privacy-and-Data-Handling)
- [Supported Languages](https://github.com/aziron-ai/atlas/wiki/Supported-Languages)
- [Benchmarks and Methodology](https://github.com/aziron-ai/atlas/wiki/Benchmarks-and-Methodology)
- [Troubleshooting](https://github.com/aziron-ai/atlas/wiki/Troubleshooting)
- [Upgrade and Uninstall](https://github.com/aziron-ai/atlas/wiki/Upgrade-and-Uninstall)

## Benchmarks and Data

The [Atlas benchmark site](https://aziron-ai.github.io/atlas/) presents dated
accuracy, token-use, and latency measurements with limitations and evidence
levels. Public benchmark data remains downloadable:

- [Processed site data](data/site-data.json)
- [Raw benchmark artifacts](data/raw/)
- [Agent benchmark reproduction guide](agent-bench/README.md)

Benchmark results describe the published test conditions and are not a
guarantee for every repository, language, machine, or coding assistant.

## Data Handling

Indexing and querying run locally by default. An MCP client or coding assistant
may send the snippets it receives to its configured model provider, subject to
that client's data policy. Network listeners and optional connected features
require additional configuration.

Review
[Privacy and Data Handling](https://github.com/aziron-ai/atlas/wiki/Privacy-and-Data-Handling)
before enabling network access or organization-connected features.

## Repository Scope

This public repository distributes Atlas release binaries, consumer
documentation, the benchmark site, and downloadable benchmark artifacts. The
Atlas CLI source tree is not published here.

## License

Atlas is distributed under the [Apache License 2.0](LICENSE).
