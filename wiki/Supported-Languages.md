# Supported Languages and Formats

Atlas recognizes programming languages, templates, structured project files,
documents, and content formats. Capability depth varies by format.

## Capability Levels

Use these distinctions when evaluating a repository:

| Level | Typical capability |
| --- | --- |
| Code graph | Symbols, references, calls, and related-code context |
| Structural index | Named constructs and searchable structure |
| Content index | Searchable text or extracted document content |

Indexing a format does not guarantee identical call-graph or symbol accuracy
across every language.

## Common Code Languages

Atlas includes support for major languages such as:

- Go, Python, JavaScript, and TypeScript
- Java, C, C++, and C#
- Rust, Ruby, PHP, Kotlin, and Scala
- Swift, Objective-C, Dart, Lua, Zig, and Elixir
- Julia, Fortran, R, SQL, and shell languages
- Terraform/HCL and several hardware or domain-specific languages

## Templates and Frontend Formats

Supported indexing families include formats such as:

- HTML, CSS, Vue, Svelte, Astro, and EJS
- Razor and Blade
- Markdown and MDX

## Structured and Project Files

Atlas can index common repository metadata and structured content, including:

- JSON, YAML, TOML, XML, plist, CSV, and TSV
- Protocol Buffers
- Go module files and .NET project files
- Makefiles, Dockerfiles, configuration files, and plain text

## Documents and Media

Selected document and media formats can be indexed for content discovery,
including PDF, DOCX, XLSX, PPTX, and common image formats. These formats should
be treated as content indexes rather than programming-language call graphs.

## Check Current Evidence

Language support changes across releases. Use:

```sh
atlas index .
atlas stats
atlas report --format plain
```

The public benchmark site includes a dated, evidence-graded compatibility view:

- [Language benchmark](https://aziron-ai.github.io/atlas/#languages)
- [Raw language artifacts](https://github.com/aziron-ai/atlas/tree/main/data/raw)

Fixture compatibility is not a substitute for production-repository accuracy.
Evaluate important languages on representative repositories and pin the Atlas
version used for the evaluation.
