# Atlas Documentation

Atlas provides local code intelligence for developers and AI coding
assistants. It indexes repositories and returns focused, source-grounded
answers about symbols, callers, references, routes, and change impact.

## Start Here

1. [Install Atlas](Installation).
2. Follow the [Getting Started](Getting-Started) guide.
3. Learn when to [index or reindex](Indexing-and-Reindexing).
4. Connect [Claude, Codex, or another assistant](AI-Assistant-Setup).

## Common Tasks

| Goal | Guide |
| --- | --- |
| See every surface in one frame | [What Atlas Does](What-Atlas-Does) |
| Install or verify Atlas | [Installation](Installation) |
| Index a repository | [Indexing and Reindexing](Indexing-and-Reindexing) |
| Run every command from a terminal | [CLI Reference](CLI-Reference) |
| Connect an AI assistant | [AI Assistant Setup](AI-Assistant-Setup) |
| Choose an MCP tool | [MCP Tools](MCP-Tools) |
| Use the dashboard or API | [Dashboard and HTTP API](Dashboard-and-HTTP-API) |
| Find your way around the dashboard | [The Dashboard](The-Dashboard) |
| Walk the call graph | [Code Map and Graph](Code-Map-and-Graph) |
| Search and inspect code | [Search and Ask](Search-and-Ask) |
| Ask the codebase in plain language | [Ask Workbench](Ask-Workbench) |
| Size a change before making it | [Impact and Review](Impact-and-Review) |
| See what changed between indexes | [Change Lens and History](Change-Lens-and-History) |
| Index tickets, pages and monitoring tools beside code | [Connected Sources](Connected-Sources) |
| Read logs, alerts, builds and traces | [Observe](Observe) |
| Turn repeated work into skills | [Skills and Automations](Skills-and-Automations) |
| Share one Atlas with a team | [One Atlas for a Team](One-Atlas-for-a-Team) |
| Configure limits and behavior | [Configuration](Configuration) |
| Diagnose stale or incomplete results | [Troubleshooting](Troubleshooting) |
| Upgrade or remove Atlas | [Upgrade and Uninstall](Upgrade-and-Uninstall) |

## Product Principles

- **Local by default:** indexing and querying work without a hosted service.
- **Evidence first:** results identify the source file and line where possible.
- **Bounded context:** tools return focused context instead of whole-repository
  dumps.
- **One index, multiple interfaces:** use Atlas through CLI, MCP, or the local
  HTTP service.

## Current Release

Use [GitHub Releases](https://github.com/aziron-ai/atlas/releases/latest) as the
version source of truth. Release archives include checksums and per-archive
SBOMs.

The primary
[Atlas product documentation](https://aziron-ai.github.io/atlas/#docs/getting-started)
is mirrored in this Wiki. Benchmark data remains available in the
[benchmark explorer](https://aziron-ai.github.io/atlas/#benchmarks) and public
[data directory](https://github.com/aziron-ai/atlas/tree/main/data). Read
[Benchmarks and Methodology](Benchmarks-and-Methodology) before comparing
results.
