import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  BookOpen,
  Bot,
  Check,
  ChevronRight,
  CircleHelp,
  CloudDownload,
  Code2,
  Copy,
  Database,
  Download,
  ExternalLink,
  FileCode2,
  Gauge,
  Globe2,
  KeyRound,
  Network,
  PackageCheck,
  RefreshCw,
  Search,
  Server,
  Settings2,
  ShieldCheck,
  Terminal,
  Trash2,
  Workflow,
  Zap,
} from "lucide-react";

const RELEASE = "0.1.36";
const GITHUB = "https://github.com/aziron-ai/atlas";
const WIKI = `${GITHUB}/wiki`;

const PRODUCT_NAV = [
  ["Overview", "#overview"],
  ["Documentation", "#docs/getting-started"],
  ["Benchmarks", "#benchmarks"],
  ["Data", "data/site-data.json"],
];

export const BENCHMARK_ANCHORS = new Set([
  "benchmarks",
  "hero",
  "summary",
  "knob",
  "languages",
  "versus",
  "field",
  "real",
  "agents",
  "graph",
  "evidence",
  "install",
]);

export function routeFromHash() {
  const hash = window.location.hash.replace(/^#/, "") || "overview";
  if (hash.startsWith("docs")) {
    return { view: "docs", page: hash.split("/")[1] || "getting-started" };
  }
  if (BENCHMARK_ANCHORS.has(hash)) return { view: "benchmarks", page: hash };
  return { view: "overview", page: "overview" };
}

export function useSiteRoute() {
  const [route, setRoute] = useState(routeFromHash);
  useEffect(() => {
    const onHash = () => setRoute(routeFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return route;
}

function Brand() {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span className="atlas-mark mono" aria-hidden>A</span>
      <span className="font-semibold" style={{ fontSize: 15 }}>ATLAS</span>
    </span>
  );
}

export function ProductHeader({ version = RELEASE, active = "overview" }) {
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [active]);

  return (
    <header className="product-header sticky top-0 z-50" data-testid="product-nav">
      <nav className="shell flex h-16 items-center justify-between gap-3" aria-label="Primary navigation">
        <a className="focusring text-inherit no-underline" href="#overview" aria-label="Atlas home">
          <Brand />
        </a>

        <div className="hidden items-center gap-1 md:flex">
          {PRODUCT_NAV.map(([label, href]) => {
            const key = label.toLowerCase();
            const selected =
              (active === "docs" && key === "documentation") ||
              (active === "benchmarks" && key === "benchmarks") ||
              active === key;
            return (
              <a
                key={label}
                className="product-navlink focusring"
                data-active={selected}
                href={href}
                download={key === "data" ? "" : undefined}
              >
                {label}
              </a>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <span className="chip hidden sm:inline-flex">v{version}</span>
          <a className="icon-btn focusring hidden sm:inline-flex" href={GITHUB} target="_blank" rel="noreferrer" aria-label="Atlas on GitHub" title="GitHub">
            <Code2 className="h-4 w-4" aria-hidden />
          </a>
          <a className="btn btn-primary focusring hidden sm:inline-flex" href="#docs/installation">
            <Download className="h-4 w-4" aria-hidden /> Install
          </a>
          <button
            className="icon-btn focusring md:hidden"
            type="button"
            aria-label="Toggle navigation"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            <span className="mono" aria-hidden>{open ? "x" : "="}</span>
          </button>
        </div>
      </nav>
      {open && (
        <nav className="mobile-product-nav shell pb-4 md:hidden" aria-label="Mobile navigation">
          {PRODUCT_NAV.map(([label, href]) => (
            <a key={label} className="focusring" href={href}>{label}</a>
          ))}
          <a className="focusring" href="#docs/installation">Install Atlas</a>
          <a className="focusring" href={GITHUB} target="_blank" rel="noreferrer">GitHub</a>
        </nav>
      )}
    </header>
  );
}

function CopyCommand({ command }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
    } catch {
      // Clipboard access can be blocked in a non-secure local preview.
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <button className="icon-btn focusring" type="button" onClick={copy} aria-label={`Copy ${command}`} title="Copy command">
      {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
    </button>
  );
}

function Command({ children, label = "Terminal" }) {
  const command = Array.isArray(children) ? children.join("\n") : String(children);
  return (
    <div className="product-command">
      <div className="flex items-center justify-between gap-3">
        <span className="mono text-xs" style={{ color: "var(--faint)" }}>{label}</span>
        <CopyCommand command={command} />
      </div>
      <pre><code>{command}</code></pre>
    </div>
  );
}

function Metric({ icon: Icon, value, label, note, color }) {
  return (
    <div className="product-metric">
      <div className="flex items-center gap-2" style={{ color }}>
        <Icon className="h-4 w-4" aria-hidden />
        <span className="mono text-xs font-semibold uppercase">{label}</span>
      </div>
      <div className="mono mt-4 text-3xl font-semibold" style={{ color: "var(--text)" }}>{value}</div>
      <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>{note}</p>
    </div>
  );
}

function ProductConsole() {
  return (
    <div className="product-console" aria-label="Example Atlas code intelligence result">
      <div className="product-console-head">
        <span className="flex items-center gap-2"><span className="status-dot" /> atlas context</span>
        <span>local / sqlite</span>
      </div>
      <div className="product-console-body">
        <div><span className="console-prompt">$</span> atlas context --paths internal/auth.go --query "review risk"</div>
        <div className="mt-5 console-label">PRIMARY SYMBOL</div>
        <div className="mt-2 flex items-start gap-3">
          <FileCode2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--primary)" }} aria-hidden />
          <div>
            <div style={{ color: "var(--text)" }}>AuthorizeRequest</div>
            <div className="console-muted">internal/auth.go:84</div>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="console-result">
            <span className="console-label">CALLERS</span>
            <strong>6 cited</strong>
          </div>
          <div className="console-result">
            <span className="console-label">IMPACT</span>
            <strong>3 paths</strong>
          </div>
        </div>
        <div className="mt-4 console-line"><span /> handlers/session.go:42</div>
        <div className="console-line"><span /> middleware/access.go:19</div>
        <div className="console-line"><span /> tests/auth_test.go:116</div>
      </div>
    </div>
  );
}

function InstallSwitcher() {
  const options = {
    Homebrew: "brew install --cask aziron-ai/atlas/atlas",
    npm: "npm install -g @aziron/atlas",
    Linux: `curl -LO ${GITHUB}/releases/download/v${RELEASE}/atlas_${RELEASE}_linux_amd64.tar.gz`,
  };
  const [active, setActive] = useState("Homebrew");
  return (
    <div className="install-switcher" data-testid="product-install">
      <div className="seg" role="tablist" aria-label="Installation method">
        {Object.keys(options).map((label) => (
          <button
            className="seg-btn focusring"
            data-active={active === label}
            key={label}
            onClick={() => setActive(label)}
            role="tab"
            type="button"
            aria-selected={active === label}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mt-3 flex min-w-0 items-center justify-between gap-3 rounded-lg">
        <code className="mono min-w-0 overflow-x-auto whitespace-nowrap text-sm">{options[active]}</code>
        <CopyCommand command={options[active]} />
      </div>
    </div>
  );
}

const capabilityItems = [
  { icon: Search, title: "Find the right code", copy: "Search symbols, definitions, references, and focused snippets across the active repository." },
  { icon: Network, title: "Follow relationships", copy: "Inspect callers, callees, graph paths, routes, dependencies, and likely change impact." },
  { icon: Bot, title: "Ground AI reviews", copy: "Give Claude, Codex, and MCP-compatible assistants bounded context with file and line evidence." },
  { icon: Database, title: "Keep control locally", copy: "Store repository intelligence in a local SQLite database with no Atlas server dependency." },
];

const workflowItems = [
  { n: "01", title: "Index", command: "atlas index .", copy: "Atlas discovers supported files and builds a repository-local graph." },
  { n: "02", title: "Query", command: 'atlas context --paths changed.go --query "review risk"', copy: "Retrieve compact context for the symbol or change under review." },
  { n: "03", title: "Connect", command: "atlas bootstrap --dry-run", copy: "Preview MCP setup for installed coding assistants, then apply it." },
];

export function ProductHome({ data }) {
  const h = data.report.headline;
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <ProductHeader version={data.version} active="overview" />
      <main id="main">
        <section className="product-hero" data-testid="product-hero">
          <div className="shell grid items-center gap-12 py-16 lg:grid-cols-[minmax(0,0.9fr)_minmax(480px,1.1fr)] lg:py-20">
            <div className="max-w-2xl">
              <div className="eyebrow"><span className="status-dot" /> Local code intelligence for AI-assisted engineering</div>
              <h1 className="mt-6">Atlas</h1>
              <p className="mt-5 text-xl leading-relaxed" style={{ color: "var(--muted)" }}>
                Give developers and coding assistants precise repository context without sending the entire codebase into the prompt.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a className="btn btn-primary focusring" href="#docs/getting-started">
                  Get started <ArrowRight className="h-4 w-4" aria-hidden />
                </a>
                <a className="btn btn-ghost focusring" href="#benchmarks">
                  View benchmark evidence <Gauge className="h-4 w-4" aria-hidden />
                </a>
              </div>
              <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm" style={{ color: "var(--muted)" }}>
                <span className="flex items-center gap-2"><Check className="h-4 w-4" style={{ color: "var(--success)" }} aria-hidden /> One local binary</span>
                <span className="flex items-center gap-2"><Check className="h-4 w-4" style={{ color: "var(--success)" }} aria-hidden /> SQLite storage</span>
                <span className="flex items-center gap-2"><Check className="h-4 w-4" style={{ color: "var(--success)" }} aria-hidden /> CLI, MCP, HTTP</span>
              </div>
            </div>
            <ProductConsole />
          </div>
        </section>

        <section className="product-band hairline" aria-labelledby="outcomes-title">
          <div className="shell py-16">
            <div className="product-section-head">
              <div>
                <div className="kicker">Measured outcomes</div>
                <h2 id="outcomes-title">Smaller context. Faster retrieval. Source-grounded answers.</h2>
              </div>
              <a className="text-link focusring" href="#benchmarks">Methodology and raw evidence <ChevronRight className="h-4 w-4" aria-hidden /></a>
            </div>
            <div className="mt-8 grid gap-px overflow-hidden rounded-lg md:grid-cols-3" style={{ background: "var(--line)" }}>
              <Metric icon={Zap} value={`${h.fewerTokens}x`} label="Fewer query tokens" note="Real-repository comparison against the graph baseline in the published benchmark." color="var(--primary)" />
              <Metric icon={Activity} value="17x" label="Faster queries" note="Reported benchmark mean: Atlas 7.4 ms versus 128 ms for the graph baseline." color="var(--secondary)" />
              <Metric icon={ShieldCheck} value={String(h.atlasF1All)} label="Answer F1" note="Mean across 37 fixture-truth language cells with real-model scoring." color="var(--warning)" />
            </div>
            <p className="mt-4 text-xs" style={{ color: "var(--faint)" }}>
              Results are dated measurements under published conditions, not guarantees for every repository or machine.
            </p>
          </div>
        </section>

        <section className="hairline" aria-labelledby="capabilities-title">
          <div className="shell py-16">
            <div className="product-section-head">
              <div>
                <div className="kicker">What Atlas does</div>
                <h2 id="capabilities-title">One index for daily code navigation and AI review</h2>
              </div>
            </div>
            <div className="mt-9 grid gap-7 sm:grid-cols-2 lg:grid-cols-4">
              {capabilityItems.map(({ icon: Icon, title, copy }) => (
                <article className="capability-item" key={title}>
                  <span className="feature-icon"><Icon className="h-5 w-5" aria-hidden /></span>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="product-band hairline" aria-labelledby="workflow-title">
          <div className="shell py-16">
            <div className="product-section-head">
              <div>
                <div className="kicker">Three-step workflow</div>
                <h2 id="workflow-title">From checkout to cited context</h2>
              </div>
              <a className="text-link focusring" href="#docs/getting-started">Open the getting started guide <ChevronRight className="h-4 w-4" aria-hidden /></a>
            </div>
            <div className="workflow-grid mt-9">
              {workflowItems.map((item) => (
                <article key={item.n}>
                  <span className="mono workflow-number">{item.n}</span>
                  <h3>{item.title}</h3>
                  <code className="mono">{item.command}</code>
                  <p>{item.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="hairline" aria-labelledby="install-title-product">
          <div className="shell grid items-center gap-10 py-16 lg:grid-cols-[minmax(0,0.8fr)_minmax(460px,1.2fr)]">
            <div>
              <div className="kicker">Install Atlas</div>
              <h2 id="install-title-product" className="mt-3">Run locally on macOS, Linux, or Windows</h2>
              <p className="mt-4 leading-relaxed" style={{ color: "var(--muted)" }}>
                Homebrew, npm, native Linux packages, and release archives all expose the same <code className="mono">atlas</code> command.
              </p>
              <a className="text-link focusring mt-5" href="#docs/installation">Installation and verification guide <ArrowRight className="h-4 w-4" aria-hidden /></a>
            </div>
            <InstallSwitcher />
          </div>
        </section>

        <section className="product-band hairline" aria-labelledby="docs-title">
          <div className="shell py-16">
            <div className="product-section-head">
              <div>
                <div className="kicker">Product documentation</div>
                <h2 id="docs-title">Operate Atlas with confidence</h2>
              </div>
              <a className="text-link focusring" href={WIKI}>GitHub Wiki mirror <ExternalLink className="h-4 w-4" aria-hidden /></a>
            </div>
            <div className="doc-link-grid mt-8">
              {DOC_PAGES.slice(0, 8).map((page) => (
                <a key={page.slug} href={`#docs/${page.slug}`} className="doc-link focusring">
                  <page.icon className="h-5 w-5" aria-hidden />
                  <span><strong>{page.label}</strong><small>{page.summary}</small></span>
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="privacy-band hairline">
          <div className="shell flex flex-col gap-6 py-12 md:flex-row md:items-center md:justify-between">
            <div className="flex max-w-3xl items-start gap-4">
              <span className="feature-icon shrink-0"><ShieldCheck className="h-5 w-5" aria-hidden /></span>
              <div>
                <h2>Local by default</h2>
                <p className="mt-2" style={{ color: "var(--muted)" }}>
                  Atlas reads the selected workspace and stores its index under <code className="mono">.atlas/</code>. CLI queries and stdio MCP need no hosted Atlas service.
                </p>
              </div>
            </div>
            <a className="btn btn-ghost focusring shrink-0" href="#docs/privacy">Privacy and data handling <ArrowRight className="h-4 w-4" aria-hidden /></a>
          </div>
        </section>
      </main>
      <ProductFooter version={data.version} />
    </>
  );
}

const DOC_PAGES = [
  { slug: "getting-started", label: "Getting started", icon: Zap, summary: "Create an index and run the first cited query." },
  { slug: "installation", label: "Installation", icon: CloudDownload, summary: "Homebrew, npm, archives, and Linux packages." },
  { slug: "indexing", label: "Indexing and reindexing", icon: RefreshCw, summary: "Incremental updates, rebuilds, and freshness." },
  { slug: "cli", label: "CLI reference", icon: Terminal, summary: "Core commands for search, graphs, and impact." },
  { slug: "assistants", label: "AI assistant setup", icon: Bot, summary: "Connect Codex, Claude, and MCP clients." },
  { slug: "mcp", label: "MCP tools", icon: Workflow, summary: "Choose the right bounded code-intelligence tool." },
  { slug: "service", label: "Dashboard and API", icon: Server, summary: "Run the local service, dashboard, and HTTP MCP." },
  { slug: "configuration", label: "Configuration", icon: Settings2, summary: "Database, limits, security, and precedence." },
  { slug: "privacy", label: "Privacy and data", icon: ShieldCheck, summary: "Understand local storage and network boundaries." },
  { slug: "languages", label: "Languages and formats", icon: Code2, summary: "Capability levels across code and content." },
  { slug: "benchmarks", label: "Benchmark methodology", icon: Gauge, summary: "Interpret and reproduce published evidence." },
  { slug: "troubleshooting", label: "Troubleshooting", icon: CircleHelp, summary: "Diagnose installs, stale indexes, locks, and MCP." },
  { slug: "upgrade", label: "Upgrade and uninstall", icon: Trash2, summary: "Update safely or remove Atlas and local data." },
];

function ProseSection({ title, children }) {
  return (
    <section className="docs-prose-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Bullets({ children }) {
  return <ul className="docs-list">{children}</ul>;
}

function DocsPage({ slug }) {
  switch (slug) {
    case "installation":
      return (
        <>
          <p className="docs-lead">Install the native <code>atlas</code> binary through Homebrew, npm, a release archive, or a Linux package.</p>
          <ProseSection title="Homebrew">
            <Command>brew install --cask aziron-ai/atlas/atlas{"\n"}atlas version</Command>
            <p>The repository <code>aziron-ai/homebrew-atlas</code> becomes the tap <code>aziron-ai/atlas</code>; the cask and installed command are both named <code>atlas</code>.</p>
          </ProseSection>
          <ProseSection title="npm">
            <Command>npm install -g @aziron/atlas{"\n"}atlas version</Command>
            <p>The npm wrapper downloads the native binary for the current platform. Pin a release with <code>npm install -g @aziron/atlas@{RELEASE}</code>.</p>
            <p>Homebrew and npm run bootstrap after installation. In a managed environment, preview with <code>atlas bootstrap --dry-run</code> or set <code>ATLAS_SKIP_BOOTSTRAP=1</code> for npm.</p>
          </ProseSection>
          <ProseSection title="Release archives and Linux packages">
            <Command>{`VERSION=${RELEASE}\nOS=darwin       # darwin or linux\nARCH=arm64      # arm64 or amd64\ncurl -fLO "${GITHUB}/releases/download/v$VERSION/atlas_\${VERSION}_\${OS}_\${ARCH}.tar.gz"`}</Command>
            <p>Releases also provide <code>.deb</code>, <code>.rpm</code>, and <code>.apk</code> packages for Linux amd64 and arm64, plus Windows amd64 archives.</p>
          </ProseSection>
          <ProseSection title="Verify">
            <Command>command -v atlas{"\n"}atlas version{"\n"}atlas doctor --verify atlas</Command>
          </ProseSection>
        </>
      );
    case "indexing":
      return (
        <>
          <p className="docs-lead">Atlas answers are only as current as the selected index. Normal updates are incremental; forced rebuilds are a recovery tool.</p>
          <ProseSection title="Create or update an index">
            <Command>cd /path/to/repository{"\n"}atlas index .{"\n"}atlas status{"\n"}atlas stats</Command>
            <p>The default repository database is <code>sqlite://./.atlas/atlas.db</code>. Later runs update changed files or report a no-op.</p>
          </ProseSection>
          <ProseSection title="Force a rebuild">
            <Command>atlas index . --reindex</Command>
            <Bullets>
              <li>Use it after an incompatible index-format or parser upgrade.</li>
              <li>Use it when <code>atlas doctor</code> recommends a rebuild.</li>
              <li>Use it after confirming the indexed root or repository identity was wrong.</li>
            </Bullets>
          </ProseSection>
          <ProseSection title="Watch, vectors, and exclusions">
            <Command>atlas watch .{"\n"}atlas index . --enable-vectors</Command>
            <p>Atlas respects <code>.gitignore</code>. Add product-specific exclusions to <code>.atlasignore</code>. Semantic vectors are optional; lexical and graph retrieval continue when vectors are disabled.</p>
          </ProseSection>
          <ProseSection title="Safe recovery order">
            <ol className="docs-list numbered">
              <li>Stop active <code>serve</code>, <code>watch</code>, and supervised MCP processes.</li>
              <li>Confirm the repository and database with <code>atlas status</code> and <code>atlas doctor</code>.</li>
              <li>Run <code>atlas migrate</code> when the schema requires it.</li>
              <li>Use <code>atlas index . --reindex</code> before deleting local data.</li>
            </ol>
          </ProseSection>
        </>
      );
    case "cli":
      return (
        <>
          <p className="docs-lead">Use <code>atlas --help</code> and <code>atlas &lt;command&gt; --help</code> as the authoritative contract for the installed release.</p>
          <ProseSection title="Scope and health">
            <Command>{`atlas --repo /absolute/path status\natlas --db "sqlite:///absolute/path/.atlas/atlas.db" stats\natlas doctor\natlas report --format plain`}</Command>
          </ProseSection>
          <ProseSection title="Search and review context">
            <Command>{`atlas search "authentication middleware" --format plain\natlas context --paths internal/api/handler.go --query "review correctness and regression risk" --intent review`}</Command>
          </ProseSection>
          <ProseSection title="Symbols and relationships">
            <Command>atlas symbol NewServer{"\n"}atlas snippet NewServer{"\n"}atlas callers NewServer --limit 50{"\n"}atlas refs NewServer{"\n"}atlas path Handler ServeHTTP --max-depth 6</Command>
          </ProseSection>
          <ProseSection title="Impact, routes, and history">
            <Command>atlas impact --paths internal/api/handler.go --max-depth 3{"\n"}atlas cross-repo-impact --paths internal/api/handler.go{"\n"}atlas route-contracts{"\n"}atlas history --limit 20{"\n"}atlas snapshot-diff --from HEAD~1 --to HEAD</Command>
          </ProseSection>
        </>
      );
    case "assistants":
      return (
        <>
          <p className="docs-lead">Atlas can register MCP and skill configuration for Codex, Claude CLI, Claude Desktop, Cursor, Gemini, and GitHub Copilot.</p>
          <ProseSection title="Automatic setup">
            <Command>atlas bootstrap --dry-run{"\n"}atlas bootstrap --only codex,claude,claude-desktop</Command>
            <p>Review the dry run in managed environments, apply it, then restart each assistant.</p>
          </ProseSection>
          <ProseSection title="Repository-pinned setup">
            <Command>{`cd /path/to/repository\natlas index .\natlas install skill \\\n  --agent codex,claude,claude-desktop \\\n  --repo "$PWD" \\\n  --db "sqlite://$PWD/.atlas/atlas.db" \\\n  --server-url=none`}</Command>
          </ProseSection>
          <ProseSection title="Common client locations">
            <div className="docs-table-wrap"><table><thead><tr><th>Client</th><th>Typical location</th></tr></thead><tbody>
              <tr><td>Codex</td><td><code>~/.codex/config.toml</code></td></tr>
              <tr><td>Claude CLI</td><td><code>~/.claude.json</code></td></tr>
              <tr><td>Claude Desktop</td><td><code>~/Library/Application Support/Claude/claude_desktop_config.json</code></td></tr>
            </tbody></table></div>
          </ProseSection>
          <ProseSection title="Verify or remove">
            <Command>atlas doctor --verify atlas{"\n"}atlas status{"\n"}atlas uninstall --dry-run</Command>
          </ProseSection>
        </>
      );
    case "mcp":
      return (
        <>
          <p className="docs-lead">MCP exposes bounded, repository-scoped code intelligence to assistants over stdio or the local HTTP service.</p>
          <ProseSection title="Start MCP">
            <Command>atlas mcp --transport stdio{"\n"}# or{"\n"}atlas serve --mcp</Command>
          </ProseSection>
          <ProseSection title="Choose a tool">
            <div className="docs-table-wrap"><table><thead><tr><th>Tool</th><th>Use it for</th></tr></thead><tbody>
              <tr><td><code>code_query</code></td><td>Natural-language repository questions with cited context</td></tr>
              <tr><td><code>symbol</code></td><td>Definitions, snippets, callers, callees, references, and coverage</td></tr>
              <tr><td><code>context</code></td><td>Code-review context for known changed paths</td></tr>
              <tr><td><code>impact</code></td><td>Repository or cross-repository blast radius</td></tr>
              <tr><td><code>routes</code></td><td>Served routes, consumers, and dependencies</td></tr>
              <tr><td><code>status</code></td><td>Index readiness and retrieval health</td></tr>
            </tbody></table></div>
          </ProseSection>
          <ProseSection title="Scope and result status">
            <p>Supply a workspace root, <code>workspace</code>, repository ID, or launch-time <code>--repo</code>. Atlas returns <code>workspace_required</code> instead of silently selecting a repository.</p>
            <Bullets>
              <li><code>ok</code>: cited context returned.</li>
              <li><code>no_index</code>: no usable index for the workspace.</li>
              <li><code>insufficient</code>: the index cannot support a cited answer.</li>
              <li><code>budget_exceeded</code>: strict output budget was too small.</li>
            </Bullets>
          </ProseSection>
        </>
      );
    case "service":
      return (
        <>
          <p className="docs-lead">One local process can host the dashboard, HTTP API, watcher, and MCP endpoint.</p>
          <ProseSection title="Start and inspect">
            <Command>atlas serve --mcp{"\n"}curl http://127.0.0.1:3099/healthz{"\n"}curl http://127.0.0.1:3099/readyz{"\n"}curl http://127.0.0.1:3099/openapi.json</Command>
            <p>The dashboard is available at <code>http://127.0.0.1:3099/dashboard</code>. Use the OpenAPI document for the version-specific HTTP contract.</p>
          </ProseSection>
          <ProseSection title="Protect non-loopback access">
            <Command>{`export ATLAS_API_TOKEN='replace-with-a-strong-token'\nexport ATLAS_MCP_ALLOWED_ORIGINS='https://trusted.example'\natlas serve --mcp --addr 0.0.0.0:3099`}</Command>
            <p>Use TLS at a trusted reverse proxy when traffic leaves the machine. Never place API tokens in shared links, logs, screenshots, or source control.</p>
          </ProseSection>
        </>
      );
    case "configuration":
      return (
        <>
          <p className="docs-lead">Configuration resolves from environment variables, then repository settings, then compiled defaults.</p>
          <ProseSection title="Inspect and persist settings">
            <Command>atlas config list{"\n"}atlas config get ATLAS_MAX_DB_BYTES{"\n"}atlas config set ATLAS_MAX_DB_BYTES 10GiB</Command>
          </ProseSection>
          <ProseSection title="Common controls">
            <div className="docs-table-wrap"><table><thead><tr><th>Setting</th><th>Purpose</th></tr></thead><tbody>
              <tr><td><code>ATLAS_ENABLE_VECTORS</code></td><td>Enable optional semantic retrieval</td></tr>
              <tr><td><code>ATLAS_MEMORY_LIMIT</code></td><td>Bound process memory</td></tr>
              <tr><td><code>ATLAS_NO_WATCH</code></td><td>Disable automatic file watching</td></tr>
              <tr><td><code>ATLAS_MCP_CALL_TIMEOUT</code></td><td>Bound an MCP call</td></tr>
              <tr><td><code>ATLAS_API_TOKEN</code></td><td>Protect HTTP API and MCP access</td></tr>
              <tr><td><code>ATLAS_SERVER_URL</code></td><td>Route compatible CLI operations through a server</td></tr>
            </tbody></table></div>
          </ProseSection>
          <ProseSection title="Explicit database">
            <Command>{`atlas --db "sqlite:///absolute/path/.atlas/atlas.db" status`}</Command>
            <p>Use absolute database paths in assistant configuration so they do not depend on the assistant process directory.</p>
          </ProseSection>
        </>
      );
    case "privacy":
      return (
        <>
          <p className="docs-lead">Indexing and querying run locally by default. Source files are read from the selected workspace and the default index is stored under <code>.atlas/</code>.</p>
          <ProseSection title="Local boundary">
            <Bullets>
              <li>CLI queries and stdio MCP require no hosted Atlas service.</li>
              <li>The dashboard and API bind to loopback by default.</li>
              <li>A connected coding assistant may send returned snippets to its configured model provider under that client's policy.</li>
            </Bullets>
          </ProseSection>
          <ProseSection title="Before enabling network access">
            <Command>{`export ATLAS_API_TOKEN='replace-with-a-strong-token'\nexport ATLAS_MCP_ALLOWED_ORIGINS='https://trusted.example'\natlas serve --mcp --addr 0.0.0.0:3099`}</Command>
            <p>Review authentication, browser origins, TLS, assistant data policy, optional embedding services, retention, and backup policy.</p>
          </ProseSection>
          <ProseSection title="Local data">
            <p>Treat the full <code>.atlas/</code> directory as one data set when backing up or moving an index. Stop active Atlas processes before copying, compacting, or deleting it.</p>
          </ProseSection>
        </>
      );
    case "languages":
      return (
        <>
          <p className="docs-lead">Atlas recognizes programming languages, templates, structured project files, documents, and content formats. Capability depth varies by format.</p>
          <ProseSection title="Capability levels">
            <div className="docs-table-wrap"><table><thead><tr><th>Level</th><th>Typical capability</th></tr></thead><tbody>
              <tr><td>Code graph</td><td>Symbols, references, calls, and related-code context</td></tr>
              <tr><td>Structural index</td><td>Named constructs and searchable structure</td></tr>
              <tr><td>Content index</td><td>Searchable text or extracted document content</td></tr>
            </tbody></table></div>
          </ProseSection>
          <ProseSection title="Language families">
            <p>Code coverage includes Go, Python, JavaScript, TypeScript, Java, C, C++, C#, Rust, Ruby, PHP, Kotlin, Scala, Swift, Objective-C, Dart, Lua, Zig, Elixir, Julia, Fortran, R, SQL, shell, Terraform/HCL, and additional domain-specific languages.</p>
            <p>Atlas also indexes frontend templates, project metadata, structured content, office documents, PDFs, and selected media for discovery. Content indexing does not imply programming-language call graphs.</p>
          </ProseSection>
          <ProseSection title="Check current evidence">
            <Command>atlas index .{"\n"}atlas stats{"\n"}atlas report --format plain</Command>
            <p><a className="text-link" href="#languages">Open the evidence-graded language matrix</a> and evaluate important languages on representative repositories.</p>
          </ProseSection>
        </>
      );
    case "benchmarks":
      return (
        <>
          <p className="docs-lead">Atlas publishes dated evidence for accuracy, token use, latency, language compatibility, and end-to-end agent workflows.</p>
          <ProseSection title="Read a result correctly">
            <ol className="docs-list numbered">
              <li>Confirm tool versions, repository URL, and pinned commit.</li>
              <li>Confirm hardware, operating system, cache state, and repeat count.</li>
              <li>Identify the correctness oracle and token measurement method.</li>
              <li>Include failed and timed-out cases rather than dropping them.</li>
            </ol>
          </ProseSection>
          <ProseSection title="Evidence categories">
            <Bullets>
              <li><strong>Compatibility:</strong> whether a format indexes successfully.</li>
              <li><strong>Correctness:</strong> precision, recall, or F1 against an oracle.</li>
              <li><strong>Latency:</strong> elapsed index or query time under stated cache conditions.</li>
              <li><strong>Agent workflow:</strong> end-to-end behavior for a pinned assistant and task set.</li>
            </Bullets>
          </ProseSection>
          <ProseSection title="Download and reproduce">
            <div className="flex flex-wrap gap-3">
              <a className="btn btn-primary focusring" href="#benchmarks">Interactive benchmark</a>
              <a className="btn btn-ghost focusring" href="data/site-data.json" download><Download className="h-4 w-4" aria-hidden /> site-data.json</a>
              <a className="btn btn-ghost focusring" href={`${GITHUB}/tree/main/data`} target="_blank" rel="noreferrer">Raw artifacts <ExternalLink className="h-4 w-4" aria-hidden /></a>
            </div>
          </ProseSection>
        </>
      );
    case "troubleshooting":
      return (
        <>
          <p className="docs-lead">Record the repository path, database path, Atlas version, and exact failing command before changing local data.</p>
          <ProseSection title="Start here">
            <Command>atlas version{"\n"}atlas status{"\n"}atlas doctor</Command>
          </ProseSection>
          <ProseSection title="Common repairs">
            <div className="docs-table-wrap"><table><thead><tr><th>Symptom</th><th>First action</th></tr></thead><tbody>
              <tr><td>Command not found</td><td><code>command -v atlas</code> and inspect <code>PATH</code></td></tr>
              <tr><td>Stale results</td><td><code>atlas index .</code>, then <code>atlas doctor</code></td></tr>
              <tr><td><code>workspace_required</code></td><td>Supply workspace, repo ID, or launch-time <code>--repo</code></td></tr>
              <tr><td>SQLite busy or locked</td><td>Stop serve/watch/MCP and inspect with <code>lsof .atlas/atlas.db</code></td></tr>
              <tr><td><code>sql_fallback</code></td><td><code>atlas compact --rebuild-lexical</code> after stopping writers</td></tr>
              <tr><td>Assistant has no tools</td><td><code>atlas bootstrap --dry-run</code>, apply, then restart the client</td></tr>
            </tbody></table></div>
          </ProseSection>
          <ProseSection title="Before deleting data">
            <p>Stop all Atlas processes, confirm the exact repository and database, back up <code>.atlas/</code>, run doctor, and attempt migration or reindex first.</p>
          </ProseSection>
        </>
      );
    case "upgrade":
      return (
        <>
          <p className="docs-lead">Upgrade the package, refresh assistant configuration, migrate supported schemas, and rebuild only when status or release notes require it.</p>
          <ProseSection title="Upgrade">
            <Command>brew update{"\n"}brew upgrade --cask aziron-ai/atlas/atlas{"\n"}# or{"\n"}npm install -g @aziron/atlas{"\n"}atlas version</Command>
          </ProseSection>
          <ProseSection title="Post-upgrade checks">
            <Command>atlas bootstrap{"\n"}atlas migrate{"\n"}atlas status --schema{"\n"}atlas doctor --verify atlas</Command>
          </ProseSection>
          <ProseSection title="Uninstall">
            <Command>atlas uninstall --dry-run{"\n"}atlas uninstall{"\n"}brew uninstall --cask aziron-ai/atlas/atlas{"\n"}# or: npm uninstall -g @aziron/atlas</Command>
            <p>Package removal does not delete repository indexes. Remove <code>/absolute/path/to/repository/.atlas</code> only after stopping all Atlas processes and confirming that a complete local-data reset is intended.</p>
          </ProseSection>
        </>
      );
    default:
      return (
        <>
          <p className="docs-lead">Create a local Atlas index, run focused queries, and prepare an MCP-compatible coding assistant.</p>
          <ProseSection title="1. Open and index a repository">
            <Command>cd /path/to/repository{"\n"}git status --short{"\n"}atlas index .</Command>
            <p>Atlas stores the default local database at <code>.atlas/atlas.db</code> and reports discovery and indexing progress.</p>
          </ProseSection>
          <ProseSection title="2. Confirm readiness">
            <Command>atlas status{"\n"}atlas stats</Command>
            <p>Check repository identity, indexed snapshot, file and symbol counts, and retrieval health before relying on results.</p>
          </ProseSection>
          <ProseSection title="3. Run the first queries">
            <Command>{`atlas search "authentication middleware" --format plain\natlas symbol NewServer\natlas callers NewServer --limit 25\natlas refs NewServer\natlas context --paths changed.go --query "review correctness and regression risk" --format json`}</Command>
          </ProseSection>
          <ProseSection title="4. Connect an assistant">
            <Command>atlas bootstrap --dry-run{"\n"}atlas bootstrap</Command>
            <p>Restart the assistant after applying configuration. Use <code>atlas install skill</code> for repository-pinned client setup.</p>
          </ProseSection>
        </>
      );
  }
}

export function Documentation({ data, page = "getting-started" }) {
  const selected = useMemo(() => DOC_PAGES.find((item) => item.slug === page) || DOC_PAGES[0], [page]);
  useEffect(() => window.scrollTo({ top: 0, behavior: "auto" }), [selected.slug]);
  return (
    <>
      <a className="skip-link" href="#docs-main">Skip to documentation</a>
      <ProductHeader version={data.version} active="docs" />
      <main id="docs-main" className="docs-shell shell">
        <aside className="docs-sidebar" aria-label="Documentation sections">
          <div className="kicker mb-3">Documentation</div>
          <nav>
            {DOC_PAGES.map((item) => (
              <a className="focusring" data-active={item.slug === selected.slug} key={item.slug} href={`#docs/${item.slug}`}>
                <item.icon className="h-4 w-4 shrink-0" aria-hidden />
                <span>{item.label}</span>
              </a>
            ))}
          </nav>
          <div className="mt-6 border-t pt-5" style={{ borderColor: "var(--line)" }}>
            <a className="text-link focusring text-sm" href={WIKI}>GitHub Wiki mirror <ExternalLink className="h-3.5 w-3.5" aria-hidden /></a>
          </div>
        </aside>

        <div className="docs-mobile-select">
          <label htmlFor="docs-page">Documentation section</label>
          <select id="docs-page" value={selected.slug} onChange={(event) => { window.location.hash = `docs/${event.target.value}`; }}>
            {DOC_PAGES.map((item) => <option value={item.slug} key={item.slug}>{item.label}</option>)}
          </select>
        </div>

        <article className="docs-article" data-testid="docs-article">
          <div className="docs-breadcrumb"><a href="#overview">Atlas</a><ChevronRight className="h-3.5 w-3.5" aria-hidden /><span>Documentation</span></div>
          <div className="flex items-start gap-4">
            <span className="feature-icon shrink-0"><selected.icon className="h-5 w-5" aria-hidden /></span>
            <div>
              <h1>{selected.label}</h1>
              <p className="mt-2 text-sm" style={{ color: "var(--faint)" }}>{selected.summary}</p>
            </div>
          </div>
          <div className="docs-prose mt-10">
            <DocsPage slug={selected.slug} />
          </div>
          <div className="docs-next">
            <div>
              <span className="kicker">Need more context?</span>
              <p>Use the installed command help for release-specific flags, or browse the Wiki mirror.</p>
            </div>
            <a className="btn btn-ghost focusring" href={WIKI}>Open Wiki <ExternalLink className="h-4 w-4" aria-hidden /></a>
          </div>
        </article>
      </main>
      <ProductFooter version={data.version} />
    </>
  );
}

export function ProductFooter({ version = RELEASE }) {
  return (
    <footer className="product-footer hairline">
      <div className="shell grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <Brand />
          <p className="mt-3 max-w-sm text-sm" style={{ color: "var(--muted)" }}>Local code intelligence for developers and AI coding assistants.</p>
          <span className="chip mt-4">v{version}</span>
        </div>
        <div>
          <div className="kicker mb-3">Product</div>
          <div className="footer-links">
            <a href="#docs/getting-started">Documentation</a>
            <a href="#benchmarks">Benchmarks</a>
            <a href="data/site-data.json" download>Download data</a>
          </div>
        </div>
        <div>
          <div className="kicker mb-3">Project</div>
          <div className="footer-links">
            <a href={GITHUB}>GitHub repository</a>
            <a href={`${GITHUB}/releases/latest`}>Latest release</a>
            <a href="https://www.npmjs.com/package/@aziron/atlas">npm package</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
