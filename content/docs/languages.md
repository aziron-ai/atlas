# Supported Languages and Formats

Atlas recognizes programming languages, templates, structured project files,
documents, and content formats. Capability depth varies by format: some
languages carry a reference-validated call graph, others a structural or
content index only. Use this page to determine what Atlas can prove for the
languages that matter to you.

## Capability Levels

Use these distinctions when evaluating a repository — "indexed" alone does not
tell you whether caller and impact queries will be accurate.

| Level | Typical capability |
| --- | --- |
| Code graph | Symbols, references, calls, and related-code context |
| Structural index | Named constructs and searchable structure |
| Content index | Searchable text or extracted document content |

Indexing a format does not guarantee identical call-graph or symbol accuracy
across every language.

## Language Maturity Ladder

Consult the ladder before relying on graph queries (`callers`, `impact`,
`path`) for a language: levels reflect validation depth, not just support. An
L2 language still indexes and searches; it has not yet reached verified
call-graph resolution. Atlas covers 40 code languages across these levels:

| Level | Meaning | Languages |
| --- | --- | --- |
| L5 — Reference-validated | Call graph cross-checked against an LSP server or SCIP indexer | C, C++, Dart, Fortran, Go, Java, JavaScript, Lua, PHP, Python, Rust, TypeScript, Zig |
| L4 — Real-repo call graph | Who-calls resolved and proven on a real repository | Apex, Astro, C#, Elixir, ETS, Groovy, Julia, Kotlin, R, Scala, SQL, Svelte, Swift, Verilog, Vue — plus, pending real-repo proof: Bash, Blade, BYOND, EJS, Objective-C, Pascal, PowerShell, Razor, Ruby |
| L2 — Real-repo tested | Runs on real code; call graph not yet resolved | Delphi, Terraform |
| L1 — Indexed | Parsed and symbols extracted | P4 |

The "pending real-repo proof" languages at L4 have resolved call graphs on
fixtures but have not yet been proven against a real repository. Treat them as
L4 capability with weaker evidence until the proof lands.

## Content Formats

Beyond code, Atlas indexes approximately 24 content formats (JSON, YAML, HTML,
PDF, and others) for search. These are content and structural indexes, not
call graphs:

- **Templates and frontend:** HTML, CSS, Vue, Svelte, Astro, EJS, Razor,
  Blade, Markdown, and MDX
- **Structured and project files:** JSON, YAML, TOML, XML, plist, CSV, TSV,
  Protocol Buffers, Go module files, .NET project files, Makefiles,
  Dockerfiles, configuration files, and plain text
- **Documents and media:** PDF, DOCX, XLSX, PPTX, and common image formats,
  indexed for content discovery

Treat document and media formats as content indexes rather than
programming-language call graphs.

## Check Evidence for Your Own Repositories

Fixture compatibility is not a substitute for production-repository accuracy —
verify support on the code you actually work with before depending on it.

```sh
atlas index .
atlas stats
atlas report --format plain
```

- `atlas index .` parses symbols, edges, and routes and persists the graph and
  lexical index.
- `atlas stats` shows graph and index telemetry statistics for the indexed
  repository, including recent snapshot telemetry rows.
- `atlas report` composes the snapshot's graph stats, top hubs, and top
  communities; `--format plain` prints the Markdown report directly.

Low edge counts or missing symbol kinds in `stats` and `report` output are the
fastest signal that a language sits lower on the ladder than your workflow
needs. Evaluate important languages on representative repositories and pin the
Atlas version used for the evaluation.

See [Indexing and Reindexing](indexing) for delta versus full reindex behavior
and [CLI Reference](cli) for the full command surface.

## Published Compatibility Evidence

Language support changes across releases. The public benchmark site includes a
dated, evidence-graded compatibility view with an interactive per-language
matrix:

- [Language benchmark matrix](https://aziron-ai.github.io/atlas/#languages)
- [Raw language artifacts](https://github.com/aziron-ai/atlas/tree/main/data/raw)

For how those numbers were measured, what they do and do not prove, and how to
reproduce them, read [Benchmarks and Methodology](benchmarks).
