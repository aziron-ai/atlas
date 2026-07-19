import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
} from "lucide-react";
import SurveyChart, { LatencyScaleBar } from "./SurveyChart";

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

/* compass-rose brand mark */
function Brand() {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden>
        <circle cx="13" cy="13" r="11.5" fill="none" stroke="var(--primary)" strokeWidth="1.4" />
        <circle cx="13" cy="13" r="7" fill="none" stroke="var(--primary)" strokeWidth="0.7" opacity="0.55" />
        <path d="M13 3.5 L15 13 L13 22.5 L11 13 Z" fill="var(--primary)" />
        <path d="M3.5 13 L13 11 L22.5 13 L13 15 Z" fill="var(--text)" opacity="0.85" />
      </svg>
      <span className="brand-word">ATLAS</span>
    </span>
  );
}

export function ProductHeader({ version = RELEASE, active = "overview" }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(false);
  }, [active]);

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
            <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
            </svg>
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

function GridRef({ cell, name }) {
  return (
    <div className="gridref">
      <span className="cell">{cell}</span>
      <span className="name">{name}</span>
      <span className="rule" aria-hidden />
    </div>
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
  const command = Array.isArray(children) ? children.join("") : String(children);
  return (
    <div className="product-command">
      <div className="flex items-center justify-between gap-3">
        <span className="cmd-label">{label}</span>
        <CopyCommand command={command} />
      </div>
      <pre><code>{command}</code></pre>
    </div>
  );
}

function InstallSwitcher() {
  const options = {
    Homebrew: "brew install --cask aziron-ai/atlas/atlas",
    npm: "npm install -g @aziron-ai/atlas",
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
      <div className="mt-3 flex min-w-0 items-center justify-between gap-3">
        <code className="mono min-w-0 overflow-x-auto whitespace-nowrap text-sm">{options[active]}</code>
        <CopyCommand command={options[active]} />
      </div>
    </div>
  );
}

/* capability glyphs drawn in the chart idiom */
function CapGlyph({ kind }) {
  const common = { width: 30, height: 30, viewBox: "0 0 30 30", fill: "none", stroke: "currentColor", strokeWidth: 1.5, "aria-hidden": true };
  if (kind === "search") {
    return (
      <svg {...common} style={{ color: "var(--primary)" }}>
        <circle cx="13" cy="13" r="7.5" />
        <path d="M18.5 18.5 L25 25" />
        <path d="M13 9.5 v7 M9.5 13 h7" strokeWidth="1" />
      </svg>
    );
  }
  if (kind === "graph") {
    return (
      <svg {...common} style={{ color: "var(--primary)" }}>
        <circle cx="6" cy="24" r="2.5" />
        <circle cx="15" cy="8" r="2.5" />
        <circle cx="25" cy="20" r="2.5" />
        <path d="M7.5 22 Q10 13 13 10 M17 9.5 Q22 13 24 17.5" strokeDasharray="3 2.5" />
      </svg>
    );
  }
  if (kind === "target") {
    return (
      <svg {...common} style={{ color: "var(--primary)" }}>
        <circle cx="15" cy="15" r="10.5" />
        <circle cx="15" cy="15" r="5.5" strokeDasharray="2.2 2" />
        <circle cx="15" cy="15" r="1.4" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return (
    <svg {...common} style={{ color: "var(--primary)" }}>
      <path d="M5 25 V11 L15 4.5 L25 11 V25" strokeDasharray="3 2.2" />
      <path d="M11 25 v-7 h8 v7" />
    </svg>
  );
}

const capabilityItems = [
  { glyph: "search", title: "Find the right code", copy: "Search symbols, definitions, references, and focused snippets across the active repository — the fix for “where is this, exactly?”" },
  { glyph: "graph", title: "Follow relationships", copy: "Inspect callers, callees, graph paths, routes, dependencies, and likely change impact before you commit to a change." },
  { glyph: "target", title: "Ground AI reviews", copy: "Give Claude, Codex, and MCP-compatible assistants bounded context with file-and-line evidence, so every claim carries its coordinates." },
  { glyph: "home", title: "Keep control locally", copy: "Store repository intelligence in a local SQLite database, with no Atlas server dependency and nothing leaving your machine." },
];

const workflowItems = [
  { n: "1", title: "Survey the territory", command: "atlas index .", copy: "Atlas discovers supported files and builds a repository-local graph — symbols, references, and call routes." },
  { n: "2", title: "Take a bearing", command: 'atlas context --paths changed.go --query "review risk"', copy: "Retrieve compact, cited context for the symbol or change under review — a bearing, not a data dump." },
  { n: "3", title: "Hand the chart to your assistant", command: "atlas bootstrap --dry-run", copy: "Preview MCP setup for installed coding assistants, then apply it — Atlas becomes their navigator." },
];

export function ProductHome({ data }) {
  const h = data.report.headline;
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <ProductHeader version={data.version} active="overview" />
      <main id="main">
        {/* =================== A·1 hero =================== */}
        <section className="product-hero" data-testid="product-hero">
          <div className="shell py-14 lg:py-20">
            <GridRef cell="A·1" name="Overview" />
            <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
              <div className="max-w-2xl">
                <div className="eyebrow"><span className="status-dot" /> Local code intelligence for AI-assisted engineering</div>
                <h1 className="mt-5">Your codebase is a territory. <span className="accent">Atlas is the map.</span></h1>
                <p className="lede mt-5 text-lg leading-relaxed">
                  Give developers and coding assistants precise repository context without sending
                  the entire codebase into the prompt. Atlas surveys your repository into a local
                  graph, then answers each query with the few coordinates that matter — symbol,
                  callers, impact — every one cited to file and line.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <a className="btn btn-primary focusring" href="#docs/getting-started">
                    Get started <ArrowRight className="h-4 w-4" aria-hidden />
                  </a>
                  <a className="btn btn-ghost focusring" href="#benchmarks">
                    View benchmark evidence
                  </a>
                </div>
                <div className="hero-facts mt-7">
                  <span>One local binary</span>
                  <span>SQLite storage</span>
                  <span>CLI, MCP, HTTP</span>
                </div>
              </div>
              <SurveyChart />
            </div>
          </div>
        </section>

        {/* =================== B·1 survey data =================== */}
        <section className="product-band hairline" aria-labelledby="outcomes-title">
          <div className="shell py-16">
            <GridRef cell="B·1" name="Survey data" />
            <div className="product-section-head">
              <div>
                <h2 id="outcomes-title">Measurements from the field</h2>
                <p className="lede mt-3">
                  Smaller context, faster retrieval, source-grounded answers — recorded as a
                  surveyor would record them: value, instrument, and conditions.
                </p>
              </div>
              <a className="text-link focusring" href="#benchmarks">Methodology and raw evidence <ChevronRight className="h-4 w-4" aria-hidden /></a>
            </div>

            <div className="survey-table-wrap mt-8">
              <table className="survey">
                <caption>Table of recorded measurements — published benchmark</caption>
                <thead>
                  <tr>
                    <th scope="col">Ref</th>
                    <th scope="col">Measurement</th>
                    <th scope="col">Result</th>
                    <th scope="col">Method &amp; conditions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="ref">M-01</td>
                    <td className="measure-name">Query context tokens</td>
                    <td className="value">{h.fewerTokens}× <small>fewer</small></td>
                    <td className="method">Real-repository comparison against the graph baseline in the published benchmark.</td>
                  </tr>
                  <tr>
                    <td className="ref">M-02</td>
                    <td className="measure-name">Query latency</td>
                    <td className="value">17× <small>faster</small></td>
                    <td className="method">Reported benchmark mean: Atlas 7.4&nbsp;ms versus 128&nbsp;ms for the graph baseline. Plotted on the scale bar below.</td>
                  </tr>
                  <tr>
                    <td className="ref">M-03</td>
                    <td className="measure-name">Answer accuracy (F1)</td>
                    <td className="value">{String(h.atlasF1All)}</td>
                    <td className="method">Mean across 37 fixture-truth language cells with real-model scoring.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="scalebar-block">
              <span className="kicker">Scale of latencies — mean milliseconds per query (M-02)</span>
              <LatencyScaleBar />
            </div>

            <p className="survey-foot">
              Results are dated measurements under published conditions, not guarantees for every
              repository or machine.
            </p>
          </div>
        </section>

        {/* =================== C·1 the instrument =================== */}
        <section className="hairline" aria-labelledby="capabilities-title">
          <div className="shell py-16">
            <GridRef cell="C·1" name="The instrument" />
            <div className="product-section-head">
              <div>
                <h2 id="capabilities-title">One index for daily navigation and AI review</h2>
              </div>
            </div>
            <div className="cap-grid mt-9">
              {capabilityItems.map(({ glyph, title, copy }) => (
                <article className="cap" key={title}>
                  <CapGlyph kind={glyph} />
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* =================== D·1 plotted route =================== */}
        <section className="product-band hairline" aria-labelledby="workflow-title">
          <div className="shell py-16">
            <GridRef cell="D·1" name="Plotted route" />
            <div className="product-section-head">
              <div>
                <h2 id="workflow-title">From checkout to cited context, in three legs</h2>
              </div>
              <a className="text-link focusring" href="#docs/getting-started">Open the getting started guide <ChevronRight className="h-4 w-4" aria-hidden /></a>
            </div>
            <div className="legs mt-9">
              {workflowItems.map((item) => (
                <article className="leg" key={item.n}>
                  <div className="leg-mark"><span className="pt">{item.n}</span><span className="rule" aria-hidden /></div>
                  <h3>{item.title}</h3>
                  <p>{item.copy}</p>
                  <div className="cmd">
                    <code><span className="p">$ </span>{item.command}</code>
                    <CopyCommand command={item.command} />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* =================== E·1 provisioning =================== */}
        <section className="hairline" aria-labelledby="install-title-product">
          <div className="shell py-16">
            <GridRef cell="E·1" name="Provisioning" />
            <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(460px,1.2fr)]">
              <div>
                <h2 id="install-title-product">Run locally on macOS, Linux, or Windows</h2>
                <p className="lede mt-4 leading-relaxed">
                  Homebrew, npm, native Linux packages, and release archives all expose the same <code className="mono">atlas</code> command.
                </p>
                <a className="text-link focusring mt-5" href="#docs/installation">Installation and verification guide <ArrowRight className="h-4 w-4" aria-hidden /></a>
              </div>
              <InstallSwitcher />
            </div>
          </div>
        </section>

        {/* =================== F·1 adjoining sheets =================== */}
        <section className="product-band hairline" aria-labelledby="docs-title">
          <div className="shell py-16">
            <GridRef cell="F·1" name="Index to adjoining sheets" />
            <div className="product-section-head">
              <div>
                <h2 id="docs-title">Operate Atlas with confidence</h2>
                <p className="lede mt-3">The documentation set, indexed like the sheets that border this one.</p>
              </div>
              <a className="text-link focusring" href={WIKI}>GitHub Wiki mirror <ExternalLink className="h-4 w-4" aria-hidden /></a>
            </div>
            <div className="sheets-grid mt-8">
              {DOC_PAGES.slice(0, 8).map((page, i) => (
                <a key={page.slug} href={`#docs/${page.slug}`} className="sheet-cell focusring">
                  <span className="no">SHEET {String(i + 1).padStart(2, "0")}</span>
                  <h3>{page.label}</h3>
                  <p>{page.summary}</p>
                  <span className="go">open →</span>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* =================== G·1 boundary line =================== */}
        <section className="privacy-band hairline">
          <div className="shell py-14">
            <GridRef cell="G·1" name="Boundary line" />
            <div className="boundary">
              <div>
                <h2>Local by default. The survey never leaves the territory.</h2>
                <p>
                  Atlas reads the selected workspace and stores its index under <code className="mono">.atlas/</code>.
                  CLI queries and stdio MCP need no hosted Atlas service — the dashed line around
                  this panel is the trust boundary, and everything Atlas knows stays inside it.
                </p>
                <a className="text-link focusring mt-4" href="#docs/privacy">Privacy and data handling <ArrowRight className="h-4 w-4" aria-hidden /></a>
              </div>
              <div className="boundary-facts" aria-label="Local-by-default facts">
                <div><span className="tick">▸</span><span>Index stored in a local SQLite database under <code className="mono">.atlas/</code></span></div>
                <div><span className="tick">▸</span><span>No hosted service; no code leaves your machine</span></div>
                <div><span className="tick">▸</span><span>One binary you can run, inspect, and delete</span></div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <ProductFooter version={data.version} />
    </>
  );
}

const DOC_PAGES = [
  { slug: "getting-started", label: "Getting started", summary: "Create an index and run the first cited query." },
  { slug: "installation", label: "Installation", summary: "Homebrew, npm, archives, and Linux packages." },
  { slug: "indexing", label: "Indexing and reindexing", summary: "Incremental updates, rebuilds, and freshness." },
  { slug: "cli", label: "CLI reference", summary: "Core commands for search, graphs, and impact." },
  { slug: "assistants", label: "AI assistant setup", summary: "Connect Codex, Claude, and MCP clients." },
  { slug: "mcp", label: "MCP tools", summary: "Choose the right bounded code-intelligence tool." },
  { slug: "service", label: "Dashboard and API", summary: "Run the local service, dashboard, and HTTP MCP." },
  { slug: "configuration", label: "Configuration", summary: "Database, limits, security, and precedence." },
  { slug: "privacy", label: "Privacy and data", summary: "Understand local storage and network boundaries." },
  { slug: "languages", label: "Languages and formats", summary: "Capability levels across code and content." },
  { slug: "benchmarks", label: "Benchmark methodology", summary: "Interpret and reproduce published evidence." },
  { slug: "troubleshooting", label: "Troubleshooting", summary: "Diagnose installs, stale indexes, locks, and MCP." },
  { slug: "upgrade", label: "Upgrade and uninstall", summary: "Update safely or remove Atlas and local data." },
];

/* sidebar groups: letter = group ref, order within = position ref */
const DOC_GROUPS = [
  { name: "First survey", letter: "A", slugs: ["getting-started", "installation"] },
  { name: "Operating the instrument", letter: "B", slugs: ["indexing", "cli", "configuration", "service"] },
  { name: "Assistants", letter: "C", slugs: ["assistants", "mcp"] },
  { name: "Trust & evidence", letter: "D", slugs: ["privacy", "languages", "benchmarks"] },
  { name: "Maintenance", letter: "E", slugs: ["troubleshooting", "upgrade"] },
];

function sheetRef(slug) {
  const n = DOC_PAGES.findIndex((p) => p.slug === slug) + 1;
  const group = DOC_GROUPS.find((g) => g.slugs.includes(slug));
  const pos = group ? group.slugs.indexOf(slug) + 1 : 1;
  return `SHEET ${String(n).padStart(2, "0")} · ${group ? group.letter : "A"}·${pos}`;
}

function StationGlyph() {
  return (
    <span className="station" aria-hidden>
      <svg width="12" height="11" viewBox="0 0 12 11">
        <polygon points="6,1 1,10 11,10" fill="none" stroke="var(--primary)" strokeWidth="1.4" />
        <circle cx="6" cy="7" r="1.2" fill="var(--primary)" />
      </svg>
    </span>
  );
}

function sectionId(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function ProseSection({ title, children }) {
  return (
    <section className="docs-prose-section" data-toc-id={sectionId(title)}>
      <h2 id={sectionId(title)}>{title}</h2>
      {children}
    </section>
  );
}

function Bullets({ children }) {
  return <ul className="docs-list">{children}</ul>;
}

function Callout({ kind = "tip", label, children }) {
  return (
    <div className={`callout ${kind}`}>
      <span className="co-label">{label}</span>
      {children}
    </div>
  );
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
          <ProseSection title="npm (GitHub Packages)">
            <Command>{`npm config set @aziron-ai:registry https://npm.pkg.github.com\nnpm config set //npm.pkg.github.com/:_authToken YOUR_GITHUB_TOKEN\nnpm install -g @aziron-ai/atlas\natlas version`}</Command>
            <p>The npm package is published to GitHub Packages, so point the <code>@aziron-ai</code> scope there with a GitHub token that has <code>read:packages</code> (GitHub Packages requires auth even for public packages). Pin a release with <code>npm install -g @aziron-ai/atlas@{RELEASE}</code>.</p>
            <Callout kind="tip" label="Simpler path">
              <p>Homebrew is the simpler path if you don't need npm. Homebrew and npm run bootstrap after installation. In a managed environment, preview with <code>atlas bootstrap --dry-run</code> or set <code>ATLAS_SKIP_BOOTSTRAP=1</code> for npm.</p>
            </Callout>
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
            <Callout kind="warn" label="Before deleting local data — follow the route in order">
              <ol className="docs-list numbered">
                <li>Stop active <code>serve</code>, <code>watch</code>, and supervised MCP processes.</li>
                <li>Confirm the repository and database with <code>atlas status</code> and <code>atlas doctor</code>.</li>
                <li>Run <code>atlas migrate</code> when the schema requires it.</li>
                <li>Use <code>atlas index . --reindex</code> before deleting local data.</li>
              </ol>
            </Callout>
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
            <p>Use TLS at a trusted reverse proxy when traffic leaves the machine.</p>
            <Callout kind="warn" label="Token handling">
              <p>Never place API tokens in shared links, logs, screenshots, or source control.</p>
            </Callout>
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
            <Callout kind="tip" label="Fixed coordinates">
              <p>Use absolute database paths in assistant configuration so they do not depend on the assistant process directory.</p>
            </Callout>
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
            <Callout kind="warn" label="Destructive-data checkpoint">
              <p>Stop all Atlas processes, confirm the exact repository and database, back up <code>.atlas/</code>, run doctor, and attempt migration or reindex first.</p>
            </Callout>
          </ProseSection>
        </>
      );
    case "upgrade":
      return (
        <>
          <p className="docs-lead">Upgrade the package, refresh assistant configuration, migrate supported schemas, and rebuild only when status or release notes require it.</p>
          <ProseSection title="Upgrade">
            <Command>brew update{"\n"}brew upgrade --cask aziron-ai/atlas/atlas{"\n"}# or{"\n"}npm install -g @aziron-ai/atlas{"\n"}atlas version</Command>
          </ProseSection>
          <ProseSection title="Post-upgrade checks">
            <Command>atlas bootstrap{"\n"}atlas migrate{"\n"}atlas status --schema{"\n"}atlas doctor --verify atlas</Command>
          </ProseSection>
          <ProseSection title="Uninstall">
            <Command>atlas uninstall --dry-run{"\n"}atlas uninstall{"\n"}brew uninstall --cask aziron-ai/atlas/atlas{"\n"}# or: npm uninstall -g @aziron-ai/atlas</Command>
            <Callout kind="warn" label="Local data survives the package">
              <p>Package removal does not delete repository indexes. Remove <code>/absolute/path/to/repository/.atlas</code> only after stopping all Atlas processes and confirming that a complete local-data reset is intended.</p>
            </Callout>
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
  const [filter, setFilter] = useState("");
  const [toc, setToc] = useState([]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [selected.slug]);

  /* "On this sheet" — collected from the rendered article so the rail
     always matches the visible headings. */
  useEffect(() => {
    const nodes = document.querySelectorAll('[data-testid="docs-article"] .docs-prose-section h2');
    setToc(Array.from(nodes, (n) => ({ id: n.id, text: n.textContent })));
  }, [selected.slug]);

  const q = filter.trim().toLowerCase();
  const matches = (item) =>
    !q || `${item.label} ${item.summary} ${item.slug}`.toLowerCase().includes(q);
  const anyMatch = DOC_PAGES.some(matches);
  const idx = DOC_PAGES.findIndex((item) => item.slug === selected.slug);
  const prev = idx > 0 ? DOC_PAGES[idx - 1] : null;
  const next = idx < DOC_PAGES.length - 1 ? DOC_PAGES[idx + 1] : null;

  const scrollToSection = (event, id) => {
    event.preventDefault();
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ block: "start" });
  };

  return (
    <>
      <a className="skip-link" href="#docs-main">Skip to documentation</a>
      <ProductHeader version={data.version} active="docs" />
      <main id="docs-main" className="docs-shell shell">
        <aside className="docs-sidebar" aria-label="Index of sheets">
          <div className="kicker mb-3">Index of sheets</div>
          <input
            className="filter"
            type="search"
            placeholder="filter sheets…"
            aria-label="Filter sheets by title or summary"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
          <nav>
            {DOC_GROUPS.map((group) => {
              const visible = group.slugs
                .map((slug) => DOC_PAGES.find((item) => item.slug === slug))
                .filter((item) => item && matches(item));
              if (!visible.length) return null;
              return (
                <div className="sb-group" key={group.name}>
                  <div className="sb-group-name">{group.name}</div>
                  {visible.map((item) => (
                    <a
                      className="sb-link focusring"
                      data-active={item.slug === selected.slug}
                      aria-current={item.slug === selected.slug ? "page" : undefined}
                      key={item.slug}
                      href={`#docs/${item.slug}`}
                    >
                      <StationGlyph />
                      <span className="t">
                        {item.label}
                        <span className="ref">{sheetRef(item.slug)}</span>
                      </span>
                    </a>
                  ))}
                </div>
              );
            })}
            {!anyMatch && <div className="sb-none">No sheets match this filter.</div>}
          </nav>
          <div className="sidebar-foot">
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
          <div className="docs-breadcrumb">
            <a href="#overview">Atlas</a>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            <a href="#docs/getting-started">Documentation</a>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            <span className="here">{selected.label}</span>
          </div>
          <header>
            <div className="doc-refline">
              <span className="gridref" style={{ margin: 0 }}><span className="cell">{sheetRef(selected.slug)}</span></span>
              <span className="rule" aria-hidden />
              <span className="stamp">LAST SURVEYED v{data.version}</span>
            </div>
            <h1>{selected.label}</h1>
            <p className="doc-summary">{selected.summary}</p>
          </header>
          <div className="docs-prose mt-6">
            <DocsPage slug={selected.slug} />
          </div>

          <nav className="adjoining" aria-label="Adjoining sheets">
            <span className="kicker">Adjoining sheets</span>
            <div className="adj-grid">
              {prev && (
                <a className="adj-card prev focusring" href={`#docs/${prev.slug}`}>
                  <span className="dir">◀ {sheetRef(prev.slug).split(" · ")[0]}</span>
                  <span className="nm">{prev.label}</span>
                  <span className="sm">{prev.summary}</span>
                </a>
              )}
              {next && (
                <a className="adj-card next focusring" href={`#docs/${next.slug}`}>
                  <span className="dir">{sheetRef(next.slug).split(" · ")[0]} ▶</span>
                  <span className="nm">{next.label}</span>
                  <span className="sm">{next.summary}</span>
                </a>
              )}
            </div>
            <p className="adj-wiki">Every sheet is mirrored on the <a className="text-link" href={WIKI}>GitHub Wiki <ExternalLink className="h-3.5 w-3.5" aria-hidden /></a>.</p>
          </nav>
        </article>

        <aside className="toc-rail" aria-label="On this sheet">
          <div className="toc-title">On this sheet</div>
          <ol>
            {toc.map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`} onClick={(event) => scrollToSection(event, item.id)}>{item.text}</a>
              </li>
            ))}
          </ol>
        </aside>
      </main>
      <ProductFooter version={data.version} />
    </>
  );
}

export function ProductFooter({ version = RELEASE }) {
  return (
    <footer className="product-footer hairline">
      <div className="shell pt-10">
        <div className="colophon-orn" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path d="M9 1 L10.6 9 L9 17 L7.4 9 Z" fill="var(--primary)" />
            <path d="M1 9 L9 7.4 L17 9 L9 10.6 Z" fill="var(--muted)" />
          </svg>
        </div>
        <p className="colophon-line1">Atlas — local code intelligence</p>
        <p className="colophon-line2">Edition v{version} · Surveyed locally, published by Aziron</p>
      </div>
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
            <a href="https://github.com/aziron-ai/atlas/pkgs/npm/atlas">npm package</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
