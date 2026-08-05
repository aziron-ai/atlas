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
| L5 — Reference-validated | Call graph cross-checked against the language's own LSP server or a SCIP indexer, on a real public repository | C, C++, Elixir, Fortran, Go, Java, JavaScript, Kotlin, Lua, PHP, Python, Ruby, Rust, Swift, TypeScript, Zig |
| L4 — Real-repo call graph | Who-calls resolved and proven on a real repository | Apex, Astro, C#, Dart, ETS, Groovy, Julia, R, Scala, SQL, Svelte, Verilog, Vue |
| L2 — Real-repo tested | Runs on real code; call graph not yet resolved | Bash, Blade, BYOND, Delphi, EJS, Objective-C, Pascal, PowerShell, Razor, Terraform |
| L1 — Indexed | Parsed and symbols extracted | P4 |

**What changed, and what came off.** L5 goes from 13 to **16**. Newly promoted on
LSP-truth against a real public repository: **Ruby** (1.000/1.000 vs solargraph on
rack), **Elixir** (1.000/1.000 vs elixir-ls on plug), **Swift** (.9415/.9417 vs
sourcekit-lsp), **Kotlin** (.9395/.9022 vs kotlin-language-server — precision clears
the gate by .0022). **Rust** (.9297/.9652) and **PHP** (.9098/1.000) are recovered
under a fail-closed binder; both of July's higher numbers for them are retracted.

**Dart comes off L5.** July published a dart PASS at .9249. The verifier re-run
measures **.8631** (precision .9723) against the same reference server on the same
pinned repository: the earlier number rode a fan-out the truth filter should have
refused. Dart returns to L4 until `toString`-scale fan-out and `package:` re-export
families bind. **Scala** is an honest fail at **.5533** and is published as one:
normalising Metals's val-attributed callers to their enclosing defs made the truth
honest and exposed that scopt's cross-file OParser builder chains are invisible to
Atlas. The blocker is named and measured rather than hidden by a flattering truth set.

**Requalified — a claim this page used to make.** Earlier versions asserted that
Bash, Blade, BYOND, EJS, Objective-C, Pascal, PowerShell, Razor and Ruby each scored
"native F1 1.000 on the Linux saturation run". That is **false at this commit** — the
branch it came from never merged. Re-measured on the constructed-truth fixture:
**Bash, BYOND, Objective-C and PowerShell** are fixture-perfect and stay at L2 with
that as their only evidence; **Blade, EJS, Pascal and Razor** return an empty caller
list (F1 0.000). The site-wide fixture score is **32/37**, not 37/37.

**Ruby is the exception worth reading.** Ruby also scores 0.000 on that fixture, and
that zero is *designed*: the fixture's callers are top-level, and the binder refuses
to attribute a top-level call to an owner it cannot prove rather than guessing one.
Ruby's L5 promotion cites the LSP lane against a real repository and never the
fixture. A fixture pass is a floor, not a promotion.

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

- [Language benchmark matrix](https://atlas.aziro.com/#languages)
- [Raw language artifacts](https://github.com/aziron-ai/atlas/tree/main/data/raw)

For how those numbers were measured, what they do and do not prove, and how to
reproduce them, read [Benchmarks and Methodology](benchmarks).
