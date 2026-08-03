import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  Moon,
  Sun,
} from "lucide-react";
import SurveyChart, { LatencyScaleBar } from "./SurveyChart";

const RELEASE = "0.1.49";
const GITHUB = "https://github.com/aziron-ai/atlas";
const WIKI = `${GITHUB}/wiki`;

const PRODUCT_NAV = [
  ["Overview", "#overview"],
  ["Documentation", "#docs/getting-started"],
  ["Benchmarks", "#benchmarks"],
];

/* ===== motion: turn on the gated CSS before first paint (no flash) ===== */
if (typeof document !== "undefined") {
  document.documentElement.classList.add("atlas-anim");
}

const prefersReduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Count a display figure up to its EXACT source value when scrolled into view.
   The final rendered value always equals `value` — motion never alters a number. */
export function CountUp({ value, decimals = 0, prefix = "", suffix = "", duration = 900 }) {
  const ref = useRef(null);
  const [display, setDisplay] = useState(prefersReduced() ? value : 0);
  const done = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || done.current) return undefined;
    if (prefersReduced() || typeof IntersectionObserver === "undefined") {
      setDisplay(value);
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting || done.current) return;
          done.current = true;
          io.disconnect();
          const t0 = performance.now();
          const tick = (t) => {
            const p = Math.min(1, (t - t0) / duration);
            const eased = 1 - Math.pow(1 - p, 3);
            setDisplay(p >= 1 ? value : value * eased);
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [value, duration]);
  const shown = display > value ? value : display;
  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {shown.toFixed(decimals)}
      {suffix}
    </span>
  );
}

/* One reusable scroll-reveal for every [data-reveal] element. Resting state is
   visible (CSS hides only under no-preference), so no-JS/reduced-motion is safe. */
export function useReveal(deps = []) {
  useEffect(() => {
    if (prefersReduced() || typeof IntersectionObserver === "undefined") return undefined;
    const els = Array.from(document.querySelectorAll("[data-reveal]:not(.is-in)"));
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

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

function currentTheme() {
  return (
    (typeof document !== "undefined" &&
      document.documentElement.getAttribute("data-theme")) ||
    "dark"
  );
}
function applyTheme(next) {
  document.documentElement.setAttribute("data-theme", next);
  try {
    localStorage.setItem("atlas-theme", next);
  } catch (e) {
    /* storage may be blocked */
  }
  window.dispatchEvent(new CustomEvent("atlas:theme", { detail: next }));
}

function ThemeToggle() {
  const [theme, setTheme] = useState(currentTheme);
  useEffect(() => {
    const onTheme = (e) => setTheme(e.detail);
    window.addEventListener("atlas:theme", onTheme);
    return () => window.removeEventListener("atlas:theme", onTheme);
  }, []);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  };
  return (
    <button
      className="hdr-cell focusring"
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      title="Toggle theme"
    >
      {theme === "dark" ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
    </button>
  );
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef(null);

  const go = (hash) => {
    window.location.hash = hash;
  };
  const runExample = (key) => {
    if (!window.location.hash.startsWith("#overview") && window.location.hash !== "") {
      window.location.hash = "#overview";
    }
    setTimeout(() => window.dispatchEvent(new CustomEvent("atlas:run", { detail: key })), 80);
  };
  const items = useMemo(
    () => [
      { ic: "▸", label: "Overview", hint: "home", run: () => go("#overview") },
      { ic: "▸", label: "Benchmarks", hint: "accuracy · tokens · latency", run: () => go("#benchmarks") },
      { ic: "▸", label: "Documentation", hint: "getting started", run: () => go("#docs/getting-started") },
      { ic: "▸", label: "Languages", hint: "supported languages", run: () => go("#languages") },
      { ic: "$", label: "atlas callers WithField", hint: "run example", run: () => runExample("callers") },
      { ic: "$", label: "atlas symbol Entry", hint: "run example", run: () => runExample("symbol") },
      { ic: "$", label: "atlas impact --paths entry.go", hint: "run example", run: () => runExample("impact") },
      { ic: "⬇", label: "Install Atlas", hint: "brew · npm", run: () => go("#docs/installation") },
      { ic: "◐", label: "Toggle theme", hint: "dark / light", run: () => applyTheme(currentTheme() === "dark" ? "light" : "dark") },
      { ic: "↗", label: "GitHub repository", hint: "external", run: () => window.open(GITHUB, "_blank", "noopener") },
    ],
    []
  );
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((i) => `${i.label} ${i.hint}`.toLowerCase().includes(s));
  }, [q, items]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        setQ("");
        setIdx(0);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    const onOpen = () => { setOpen(true); setQ(""); setIdx(0); };
    window.addEventListener("atlas:cmdk", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("atlas:cmdk", onOpen);
    };
  }, []);
  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);
  useEffect(() => {
    setIdx(0);
  }, [q]);

  if (!open) return null;
  const exec = (i) => {
    setOpen(false);
    i.run();
  };
  const onListKey = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIdx((n) => Math.min(filtered.length - 1, n + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIdx((n) => Math.max(0, n - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[idx]) exec(filtered[idx]);
    }
  };
  return (
    <div className="cmdk-overlay" onClick={() => setOpen(false)} role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="cmdk" onClick={(e) => e.stopPropagation()}>
        <div className="cmdk-input">
          <span className="cmdk-prompt">atlas&nbsp;❯</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onListKey}
            placeholder="jump to a section or run a command…"
            aria-label="Command"
            spellCheck={false}
            autoComplete="off"
          />
          <span className="cmdk-esc">esc</span>
        </div>
        <ul className="cmdk-list" role="listbox">
          {filtered.map((i, n) => (
            <li
              key={i.label}
              role="option"
              aria-selected={n === idx}
              className={`cmdk-item${n === idx ? " on" : ""}`}
              onMouseEnter={() => setIdx(n)}
              onClick={() => exec(i)}
            >
              <span className="cmdk-ic">{i.ic}</span>
              <span className="cmdk-label">{i.label}</span>
              <span className="cmdk-hint">{i.hint}</span>
            </li>
          ))}
          {filtered.length === 0 && <li className="cmdk-empty">no matches</li>}
        </ul>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <img className="brand-mark" src="assets/atlas-mark.svg" alt="" width="31" height="26" aria-hidden="true" />
      <span className="brand-word">ATLAS</span>
    </span>
  );
}

export function ProductHeader({ version = RELEASE, active = "overview" }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    setOpen(false);
  }, [active]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`product-header sticky top-0 z-50${scrolled ? " is-scrolled" : ""}`}
      data-testid="product-nav"
    >
      <nav className="shell flex h-16 items-center justify-between gap-3" aria-label="Primary navigation">
        <a className="focusring text-inherit no-underline" href="#overview" aria-label="Atlas home">
          <Brand />
        </a>

        <div className="hidden items-center gap-1 lg:flex">
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

        <div className="flex items-center gap-3">
          <div className="hdr-seg">
            <button
              type="button"
              className="hdr-cell focusring"
              onClick={() => window.dispatchEvent(new CustomEvent("atlas:cmdk"))}
              aria-label="Open command palette"
              title="Command palette"
            >
              <span className="cmdk-prompt">❯</span>
              <kbd>⌘K</kbd>
            </button>
            <span className="hdr-sep" aria-hidden="true" />
            <span className="hdr-ver">v{version}</span>
            <span className="hdr-sep" aria-hidden="true" />
            <ThemeToggle />
            <span className="hdr-sep" aria-hidden="true" />
            <a className="hdr-cell focusring" href={GITHUB} target="_blank" rel="noreferrer" aria-label="Atlas on GitHub" title="GitHub">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
              </svg>
            </a>
          </div>
          <a className="btn btn-primary focusring hidden sm:inline-flex" href="#docs/installation">
            <Download className="h-4 w-4" aria-hidden /> Install
          </a>
          <button
            className="icon-btn focusring lg:hidden"
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
        <nav className="mobile-product-nav shell pb-4 lg:hidden" aria-label="Mobile navigation">
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

/* Hero headline that types itself in on load, then fades in the value subhead.
   Full text lives in aria-label for assistive tech and SEO. */
function TypedHeadline() {
  const LEAD = "Your codebase is a territory. ";
  const ACCENT = "Atlas is the map.";
  const total = LEAD.length + ACCENT.length;
  const reduce = prefersReduced();
  const [n, setN] = useState(reduce ? total : 0);
  const [done, setDone] = useState(reduce);
  useEffect(() => {
    if (reduce) return undefined;
    let i = 0;
    let t;
    const step = () => {
      i += 1;
      setN(i);
      if (i < total) t = setTimeout(step, 32);
      else setDone(true);
    };
    t = setTimeout(step, 320);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const lead = LEAD.slice(0, Math.min(n, LEAD.length));
  const acc = n > LEAD.length ? ACCENT.slice(0, n - LEAD.length) : "";
  return (
    <h1 className="mt-5" aria-label={`${LEAD}${ACCENT} Local code intelligence for developers and AI agents.`}>
      <span aria-hidden="true">
        {lead}
        <span className="accent">{acc}</span>
        {!done && <span className="type-caret" />}
      </span>
    </h1>
  );
}

/* Compact token-economy graphic that replaces the old text subhead: a whole-file
   dump vs Atlas's cited context — "a fraction of the tokens", shown, not told. */
function HeroTokenViz() {
  return (
    <div
      className="token-viz"
      aria-label="Per answer, reading the whole file costs many tokens; Atlas sends only cited context — a fraction of the tokens."
    >
      <div className="tv-cap">tokens an agent reads per answer</div>
      <div className="tv-row">
        <span className="tv-lab">whole file</span>
        <span className="tv-bar"><i className="tv-fill tv-raw" /></span>
      </div>
      <div className="tv-row">
        <span className="tv-lab tv-on">Atlas</span>
        <span className="tv-bar"><i className="tv-fill tv-atlas" /></span>
        <span className="tv-note">a fraction of the tokens</span>
      </div>
    </div>
  );
}

/* Interactive hero console — click a command to run it; it types out and reveals
   its cited output. Example output (schematic, like the survey chart) — not a benchmark. */
const HERO_CMDS = {
  callers: {
    label: "who calls WithField?",
    cmd: "atlas callers WithField",
    out: [
      [["callers ", "ht-hd"], ["WithField  ", ""], ["total 47", "ht-tot"]],
      [["  WithError  ", ""], ["func  ", "ht-k"], ["exported.go:57", "ht-loc"]],
      [["  TestEntryPanic  ", ""], ["func  ", "ht-k"], ["entry_test.go:175", "ht-loc"]],
      [["  … and 45 more, every one cited to file:line", "ht-dim"]],
    ],
  },
  symbol: {
    label: "define Entry",
    cmd: "atlas symbol Entry",
    out: [
      [["symbol ", "ht-hd"], ["Entry  ", ""], ["matches 1", "ht-tot"]],
      [["  Entry  ", ""], ["type  ", "ht-k"], ["entry.go:52-88", "ht-loc"]],
      [["  callers(3) · callees(6), all cited", "ht-dim"]],
    ],
  },
  impact: {
    label: "what breaks if entry.go changes?",
    cmd: "atlas impact --paths entry.go",
    out: [
      [["impact ", "ht-hd"], ["entry.go  ", ""], ["12 symbols · 5 files", "ht-tot"]],
      [["  hooks.go:41  ", "ht-loc"], ["logger.go:120  ", "ht-loc"], ["writer.go:88", "ht-loc"]],
      [["  + 3 covering tests", "ht-dim"]],
    ],
  },
};

function HeroConsole() {
  const ORDER = ["callers", "symbol", "impact"];
  const [active, setActive] = useState("callers");
  const [typed, setTyped] = useState("");
  const [lines, setLines] = useState(0);
  const runId = useRef(0);
  const rootRef = useRef(null);

  const run = (key) => {
    const id = ++runId.current;
    setActive(key);
    setTyped("");
    setLines(0);
    const { cmd, out } = HERO_CMDS[key];
    if (prefersReduced()) {
      setTyped(cmd);
      setLines(out.length);
      return;
    }
    const reveal = (n) => {
      if (id !== runId.current) return;
      setLines(n);
      if (n < out.length) setTimeout(() => reveal(n + 1), 140);
    };
    let i = 0;
    const type = () => {
      if (id !== runId.current) return;
      i += 1;
      setTyped(cmd.slice(0, i));
      if (i < cmd.length) setTimeout(type, 34);
      else setTimeout(() => reveal(0), 180);
    };
    setTimeout(type, 140);
  };

  useEffect(() => {
    const el = rootRef.current;
    if (!el || prefersReduced() || typeof IntersectionObserver === "undefined") {
      run("callers");
      return undefined;
    }
    let fired = false;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && !fired) {
            fired = true;
            run("callers");
            io.disconnect();
          }
        });
      },
      { threshold: 0.5 }
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // let the ⌘K palette drive the console
  useEffect(() => {
    const onRun = (e) => {
      if (e.detail && HERO_CMDS[e.detail]) run(e.detail);
    };
    window.addEventListener("atlas:run", onRun);
    return () => window.removeEventListener("atlas:run", onRun);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const out = HERO_CMDS[active].out;
  return (
    <div className="hero-console" ref={rootRef}>
      <div className="hc-bar" aria-hidden>
        <span className="hc-dot" style={{ background: "#ff5f56" }} />
        <span className="hc-dot" style={{ background: "#ffbd2e" }} />
        <span className="hc-dot" style={{ background: "#27c93f" }} />
        <span className="hc-title">~/your-repo — atlas</span>
      </div>
      <div className="hc-body" aria-live="polite">
        <div className="ht-line"><span className="ht-cmt"># {HERO_CMDS[active].label}</span></div>
        <div className="ht-line">
          <span className="ht-p">$</span> {typed}
          <span className="hc-caret" aria-hidden />
        </div>
        {out.slice(0, lines).map((segs, li) => (
          <div className="ht-line" key={li}>
            {segs.map(([t, cls], si) => (
              <span key={si} className={cls}>{t}</span>
            ))}
          </div>
        ))}
      </div>
      <div className="hc-chips" role="group" aria-label="Run an example Atlas command">
        {ORDER.map((k) => (
          <button
            key={k}
            type="button"
            className={`hc-chip focusring${active === k ? " on" : ""}`}
            onClick={() => run(k)}
          >
            atlas {k}
          </button>
        ))}
      </div>
    </div>
  );
}

function GridRef({ cell, name }) {
  return (
    <div className="gridref">
      <span className="cell">{cell}</span>
      <span className="prompt" aria-hidden>atlas&nbsp;❯</span>
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
    <button className={`icon-btn focusring${copied ? " copied-pop" : ""}`} type="button" onClick={copy} aria-label={`Copy ${command}`} title="Copy command">
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
  useReveal([data.version]);
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <ProductHeader version={data.version} active="overview" />
      <main id="main">
        {/* =================== A·1 hero =================== */}
        <section className="product-hero" data-testid="product-hero">
          <div className="shell pt-5 pb-14 lg:pb-20">
            <GridRef cell="A·1" name="Overview" />
            <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
              <div className="max-w-2xl hero-copy min-w-0">
                <div className="eyebrow"><span className="status-dot" /> Local code intelligence for developers &amp; AI agents</div>
                <TypedHeadline />
                <HeroTokenViz />
                <p className="lede mt-5 text-lg leading-relaxed">
                  Atlas surveys your repository into a local graph, then hands over only the
                  coordinates a query needs — symbol, callers, change impact — instead of the whole
                  codebase in the prompt.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <a className="btn btn-primary focusring" href="#docs/getting-started">
                    Get started <ArrowRight className="h-4 w-4" aria-hidden />
                  </a>
                  <button
                    type="button"
                    className="btn btn-try focusring"
                    onClick={() => window.dispatchEvent(new CustomEvent("atlas:console"))}
                  >
                    <span className="tny">❯</span> Try it now
                  </button>
                  <a className="btn btn-ghost focusring" href="#benchmarks">
                    View benchmark evidence
                  </a>
                </div>
                <div className="hero-install mt-6">
                  <code className="mono"><span className="hi-dollar">$</span> brew install --cask aziron-ai/atlas/atlas</code>
                  <CopyCommand command="brew install --cask aziron-ai/atlas/atlas" />
                </div>
                <HeroConsole />
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
                <h2 id="outcomes-title">Benchmarks &mdash; smaller context, faster queries, grounded answers</h2>
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
                    <td className="value"><CountUp value={h.fewerTokens} suffix="×" /> <small>fewer</small></td>
                    <td className="method">Real-repository comparison against the graph baseline in the published benchmark.</td>
                  </tr>
                  <tr>
                    <td className="ref">M-02</td>
                    <td className="measure-name">Query latency</td>
                    <td className="value"><CountUp value={17} suffix="×" /> <small>faster</small></td>
                    <td className="method">Reported benchmark mean: Atlas 7.4&nbsp;ms versus 128&nbsp;ms for the graph baseline. Plotted on the scale bar below.</td>
                  </tr>
                  <tr>
                    <td className="ref">M-03</td>
                    <td className="measure-name">Answer accuracy (F1)</td>
                    <td className="value"><CountUp value={h.atlasF1All} decimals={3} /></td>
                    <td className="method">Mean across 37 native language cells with real-model scoring.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="scalebar-block">
              <span className="kicker">Scale of latencies — mean milliseconds per query, warm in-process engine (M-02)</span>
              <LatencyScaleBar />
              <span className="kicker">End-to-end CLI adds ~30 ms of process spawn per side: ≈44 ms vs ≈450 ms (~9×) — expect the CLI numbers when reproducing from a shell loop.</span>
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
              {capabilityItems.map(({ glyph, title, copy }, i) => (
                <article className="cap" key={title} data-reveal style={{ "--i": i }}>
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
                <h2 id="workflow-title">Index, query, connect your assistant &mdash; in three commands</h2>
              </div>
              <a className="text-link focusring" href="#docs/getting-started">Open the getting started guide <ChevronRight className="h-4 w-4" aria-hidden /></a>
            </div>
            <div className="legs mt-9">
              {workflowItems.map((item, i) => (
                <article className="leg" key={item.n} data-reveal style={{ "--i": i }}>
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
                <h2 id="docs-title">Guides &amp; documentation &mdash; install, index, configure, connect</h2>
                <p className="lede mt-3">The documentation set, indexed like the sheets that border this one.</p>
              </div>
              <a className="text-link focusring" href={WIKI}>GitHub Wiki mirror <ExternalLink className="h-4 w-4" aria-hidden /></a>
            </div>
            <div className="sheets-grid mt-8">
              {DOC_PAGES.slice(0, 8).map((page, i) => (
                <a key={page.slug} href={`#docs/${page.slug}`} className="sheet-cell focusring" data-reveal style={{ "--i": i % 4 }}>
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

        {/* =================== H·1 community recognition =================== */}
        <section className="producthunt-band hairline" aria-labelledby="producthunt-title">
          <div className="shell py-12">
            <div className="producthunt-card">
              <div>
                <div className="kicker">Community recognition</div>
                <h2 id="producthunt-title">Atlas is live on Product Hunt</h2>
                <p>Explore the launch, share feedback, and help more developers discover local-first code intelligence.</p>
              </div>
              <a
                className="producthunt-badge focusring"
                data-testid="producthunt-badge"
                href="https://www.producthunt.com/products/atlas-44?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-atlas-47"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="View Atlas on Product Hunt"
              >
                <img
                  alt="Atlas - Local code intelligence for developers and AI assistants | Product Hunt"
                  width="250"
                  height="54"
                  loading="lazy"
                  decoding="async"
                  src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1203538&theme=light&t=1784726889410"
                />
              </a>
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
  { slug: "concepts", label: "Core concepts", summary: "The graph, snapshots, scope, output control, and surfaces." },
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
  { name: "First survey", letter: "A", slugs: ["getting-started", "installation", "concepts"] },
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
          <p className="docs-lead">Atlas ships through five channels that all install the same native binary. Pick the channel that matches how you manage software on the target machine:</p>
          <div className="docs-table-wrap"><table><thead><tr><th>Channel</th><th>Best for</th><th>Platforms</th></tr></thead><tbody>
            <tr><td>Homebrew</td><td>macOS/Linux workstations; managed upgrades</td><td>macOS/Linux amd64 and arm64</td></tr>
            <tr><td>npm (public registry)</td><td>Node toolchains, workstations, and public CI</td><td>macOS/Linux x64 and arm64; Windows x64</td></tr>
            <tr><td>npm (GitHub Packages)</td><td>Organization CI that already uses GitHub Packages</td><td>macOS/Linux x64 and arm64; Windows x64</td></tr>
            <tr><td>Release archive</td><td>Air-gapped hosts, exact-version pinning, Windows</td><td>macOS/Linux amd64 and arm64; Windows amd64</td></tr>
            <tr><td>Linux package</td><td>Fleet management with <code>.deb</code>/<code>.rpm</code>/<code>.apk</code></td><td>amd64 and arm64</td></tr>
          </tbody></table></div>
          <ProseSection title="Homebrew (macOS and Linux)">
            <p>Use Homebrew when you want the shortest path and automatic upgrades alongside your other tooling.</p>
            <Command>{`brew install --cask aziron-ai/atlas/atlas\natlas version`}</Command>
            <p>Homebrew names fully qualified casks as <code>&lt;owner&gt;/&lt;tap&gt;/&lt;cask&gt;</code>. The repository <code>aziron-ai/homebrew-atlas</code> becomes the tap <code>aziron-ai/atlas</code>; the cask and the installed executable are both named <code>atlas</code>.</p>
          </ProseSection>
          <ProseSection title="npm (public registry)">
            <p>Use npm when Atlas should install through an existing Node toolchain or CI pipeline. The public package needs no registry configuration or GitHub token:</p>
            <Command>{`npm install -g @aziron/atlas\natlas version`}</Command>
            <p>Pin an exact version for reproducible environments:</p>
            <Command>{`npm install -g @aziron/atlas@${RELEASE}`}</Command>
            <h3>GitHub Packages alternative</h3>
            <p>Atlas is also published to GitHub Packages as <code>@aziron-ai/atlas</code>. Use this coordinate when organization CI already authenticates to GitHub Packages. Point the <code>@aziron-ai</code> scope at GitHub and use a token with <code>read:packages</code>:</p>
            <Command>{`npm config set @aziron-ai:registry https://npm.pkg.github.com\nnpm config set //npm.pkg.github.com/:_authToken YOUR_GITHUB_TOKEN\nnpm install -g @aziron-ai/atlas\natlas version`}</Command>
            <Command>{`npm install -g @aziron-ai/atlas@${RELEASE}`}</Command>
            <p>Both npm coordinates install the same wrapper and native Atlas binary for the current platform.</p>
            <Callout kind="tip" label="Simpler path">
              <p>If you do not need npm specifically, Homebrew is the simpler path.</p>
            </Callout>
          </ProseSection>
          <ProseSection title="Release Archives">
            <p>Use a release archive when no package manager is available, on air-gapped hosts, or when you need to pin and checksum exact bytes. Choose the current version and platform from <a className="text-link" href="https://github.com/aziron-ai/atlas/releases/latest" target="_blank" rel="noreferrer">GitHub Releases</a>:</p>
            <Command>{`VERSION=${RELEASE}\nOS=darwin       # darwin or linux\nARCH=arm64      # arm64 or amd64\nASSET="atlas_\${VERSION}_\${OS}_\${ARCH}.tar.gz"\nBASE="https://github.com/aziron-ai/atlas/releases/download/v\${VERSION}"\n\ncurl -fLO "$BASE/$ASSET"\ncurl -fLO "$BASE/checksums.txt"\ngrep " $ASSET\\$" checksums.txt | shasum -a 256 -c -\ntar -xzf "$ASSET"\nsudo install -m 0755 atlas /usr/local/bin/atlas\natlas version`}</Command>
            <p>On Linux, replace the checksum command with <code>sha256sum -c -</code> when available.</p>
            <p><strong>Windows.</strong> Each release also includes a Windows amd64 archive. Download it from the same release page, extract the <code>atlas</code> executable, and add its directory to <code>PATH</code>. Alternatively, the npm channel above supports Windows x64.</p>
          </ProseSection>
          <ProseSection title="Native Linux Packages">
            <p>Use native packages when your fleet is managed through a distribution package manager. Each release includes <code>.deb</code>, <code>.rpm</code>, and <code>.apk</code> packages for amd64 and arm64. Download the matching package from the release page, then install:</p>
            <Command>{`# Debian or Ubuntu\nsudo dpkg -i atlas_${RELEASE}_linux_amd64.deb\n\n# Fedora or RHEL\nsudo rpm -U atlas_${RELEASE}_linux_amd64.rpm\n\n# Alpine\nsudo apk add --allow-untrusted atlas_${RELEASE}_linux_amd64.apk`}</Command>
          </ProseSection>
          <ProseSection title="Post-Install: Assistant Bootstrap">
            <p>Homebrew and npm installations run <code>atlas bootstrap</code> after install. Bootstrap registers Atlas as an MCP server and installs the atlas-first skill and CLAUDE.md directive for every detected assistant (Claude desktop and CLI, Codex, Copilot, Cursor, Gemini). It is idempotent — safe to run repeatedly and from a package post-install hook. Inspect the proposed changes at any time without writing anything:</p>
            <Command>{`atlas bootstrap --dry-run`}</Command>
            <p>To prevent the npm post-install bootstrap in managed environments:</p>
            <Command>{`ATLAS_SKIP_BOOTSTRAP=1 npm install -g @aziron/atlas`}</Command>
            <p>Archive and Linux-package installs do not configure assistants automatically; run <code>atlas bootstrap</code> yourself when you want them connected.</p>
          </ProseSection>
          <ProseSection title="PATH Note">
            <p>Assistants launch Atlas by resolving <code>atlas</code> from <code>PATH</code>, so the binary must be reachable from a login shell — not only your current session. Homebrew and the Linux packages handle this; for archives, <code>/usr/local/bin</code> (used above) is on <code>PATH</code> by default on most systems. For npm installs, ensure npm's global bin directory is on <code>PATH</code>.</p>
          </ProseSection>
          <ProseSection title="Verify the Installation">
            <p>Verification confirms three distinct things: the binary is on <code>PATH</code>, it runs, and it is the same binary your assistants will launch.</p>
            <Command>{`command -v atlas\natlas version\natlas doctor --verify atlas`}</Command>
            <p><code>atlas doctor</code> reports upgrade health and schema/index contract state; <code>--verify atlas</code> additionally checks for binary drift — whether the <code>atlas</code> on <code>PATH</code> (what assistants launch via <code>command:"atlas"</code>) matches the running binary. Drift typically means an old install shadows the new one earlier on <code>PATH</code>.</p>
            <p>Continue with <a className="text-link" href="#docs/getting-started">Getting Started</a>, or read <a className="text-link" href="#docs/concepts">Core Concepts</a> for the model behind the commands.</p>
          </ProseSection>
        </>
      );
    case "concepts":
      return (
        <>
          <p className="docs-lead">Every Atlas command shares the same underlying model: a local knowledge graph of your code, a snapshot timeline over its history, one workspace-resolution scheme, and one set of output controls. Understanding these once makes the whole <a className="text-link" href="#docs/cli">CLI Reference</a> predictable.</p>
          <ProseSection title="The Knowledge Graph">
            <p>Atlas answers structural questions from a <strong>knowledge graph</strong> rather than text search, so results are exact relationships, not pattern matches. The graph is built by <code>atlas index</code>, which parses a repository into:</p>
            <Bullets>
              <li><strong>Symbols</strong> — functions, methods, classes, and other definitions.</li>
              <li><strong>Call edges</strong> — who calls whom, powering <code>callers</code>, <code>path</code>, <code>impact</code>, and the graph-shape commands (<code>hubs</code>, <code>communities</code>).</li>
              <li><strong>Routes</strong> — the HTTP routes a repository serves and calls, powering cross-repo queries such as <code>consumers</code> and <code>dependencies</code>.</li>
              <li><strong>Coverage</strong> — test-to-symbol links, from static call-graph reachability or an imported runtime profile (<code>atlas coverage import</code>).</li>
            </Bullets>
            <p>Alongside the graph, indexing persists a lexical (BM25 + trigram) search index. Everything lives in an embedded SQLite database, by default <code>sqlite://./.atlas/atlas.db</code> inside the repository — no daemon or service is required to query it.</p>
            <Command>{`atlas index .`}</Command>
          </ProseSection>
          <ProseSection title="Snapshots and History">
            <p>Each indexed commit becomes a <strong>snapshot</strong>, giving the graph a per-commit timeline — you can ask not only what the code looks like, but how its structure changed. <code>atlas history</code> lists the timeline; <code>atlas snapshot-diff</code> computes a structural diff (symbols and edges added, removed, modified) between two snapshots, defaulting to the latest snapshot and the one before it. Both <code>--from</code> and <code>--to</code> accept a commit sha (prefix ok) or snapshot id.</p>
            <Command>{`atlas snapshot-diff --from a1b2c3d --to HEAD`}</Command>
          </ProseSection>
          <ProseSection title="Workspace Resolution">
            <p>Every command needs to know which repository and which database it is operating on; three global flags resolve that, and the defaults make the common case zero-config.</p>
            <div className="docs-table-wrap"><table><thead><tr><th>Flag</th><th>Meaning</th><th>Default</th></tr></thead><tbody>
              <tr><td><code>--repo</code></td><td>Repo workspace: a path, <code>org/name</code>, or <code>repo_id</code>; <code>'*'</code> = all repos on <code>search</code>/<code>semantic-search</code></td><td>the current directory</td></tr>
              <tr><td><code>--db</code></td><td>Storage DSN: <code>sqlite://PATH</code> or <code>postgres://...</code></td><td><code>sqlite://./.atlas/atlas.db</code></td></tr>
              <tr><td><code>--tenant</code></td><td>Tenant/org scope to isolate repos to (hosted multi-tenant)</td><td>empty = all repos</td></tr>
            </tbody></table></div>
            <p>Run from inside an indexed repository and no flags are needed. Point <code>--db</code> at a shared database to query many repositories from one place:</p>
            <Command>{`atlas search "rate limiter" --repo '*' --db sqlite:///srv/atlas/atlas.db`}</Command>
          </ProseSection>
          <ProseSection title="Output Control">
            <p>Output has two independent axes — shape and depth — so you can tune results for a terminal, a script, or an LLM context window.</p>
            <div className="docs-table-wrap"><table><thead><tr><th>Flag</th><th>Values</th><th>Default</th></tr></thead><tbody>
              <tr><td><code>--format</code></td><td><code>plain</code> | <code>json</code> | <code>compact</code> | <code>ndjson</code> — output shape</td><td><code>json</code></td></tr>
              <tr><td><code>--json</code></td><td>shorthand for <code>--format json</code></td><td>—</td></tr>
              <tr><td><code>--detail</code></td><td><code>low</code> | <code>medium</code> | <code>high</code> | <code>xhigh</code> — graph context per item</td><td><code>high</code></td></tr>
            </tbody></table></div>
            <p>Retrieval operations (<code>callers</code>, <code>refs</code>, <code>impact</code>) floor at <code>high</code> detail so they never silently drop the context they exist to provide; <code>xhigh</code> opts into cross-repo context. For agents, prefer <code>--format plain</code>: it carries the same answer in far fewer tokens than structured JSON, which matters when every query result lands in a model's context window.</p>
            <Command>{`atlas search "session store" --format plain --detail low`}</Command>
          </ProseSection>
          <ProseSection title="Three Surfaces">
            <p>The same graph is exposed three ways, so humans, services, and AI agents each get a native interface without separate infrastructure.</p>
            <Bullets>
              <li><strong>CLI</strong> — the commands in this documentation; scriptable via <code>--format</code>.</li>
              <li><strong>REST HTTP API</strong> — <code>atlas serve</code> runs the HTTP API on <code>127.0.0.1:3099</code> by default (use <code>--addr 0.0.0.0:3099</code> to expose it) and hosts the dashboard at that URL (pass <code>--open</code> to auto-open it in your browser); <code>--mcp</code> also mounts MCP over HTTP at <code>POST /mcp</code>.</li>
              <li><strong>MCP</strong> — <code>atlas mcp</code> exposes graph, search, and impact as MCP tools to LLM agents over stdio by default, with <code>--http</code>/<code>--sse</code> transports available. Both <code>serve</code> and <code>mcp</code> keep the graph fresh with a background repo watch (<code>--watch</code>, on by default; disable with <code>--watch=false</code> or <code>ATLAS_NO_WATCH=1</code>). <a className="text-link" href="#docs/getting-started">Getting Started</a> covers wiring assistants via <code>atlas bootstrap</code>; <a className="text-link" href="#docs/mcp">MCP Tools</a> covers the tool surface.</li>
            </Bullets>
            <Command>{`atlas serve --mcp`}</Command>
          </ProseSection>
          <ProseSection title="Read-Only Mode">
            <p>Use <code>--read-only</code> when the database must not change — CI caches, content-addressed artifacts, shared read replicas. It opens the database immutably: no migration runs, no WAL/journal files are created, and no <code>telemetry.db</code> appears next to it — artifact bytes hash identically after any query. A missing database errors instead of being created. If you still want telemetry in this mode, point <code>--telemetry-db</code> at an explicit writable path.</p>
            <Command>{`atlas symbol NewServer --read-only`}</Command>
          </ProseSection>
          <ProseSection title="Local-First vs Hosted">
            <p>Atlas is local by default: indexing, querying, serving, and MCP all run against your local database, and nothing leaves the machine. Two commands opt into a central Atlas server, and only for fleet telemetry and org skills:</p>
            <Bullets>
              <li><code>atlas connect</code> registers the machine with a central server under a stable device identity and installs capture hooks. What leaves the machine is governed by the data level (<code>--level</code>): <code>off</code>, <code>telemetry</code> (metrics only), <code>interactions</code> (normalized prompts + redacted traces; the default), or <code>full</code> (raw prompts; org opt-in). Raw transcripts, tool outputs, answers, and secrets never leave the machine at any level. <code>atlas disconnect</code> reverses it.</li>
              <li><code>atlas sync</code> is the fleet telemetry uplink — <code>sync status</code> shows the configuration, kill switches, and per-stream cursors; <code>sync now</code> pushes pending telemetry once.</li>
            </Bullets>
            <p>Connected machines can also exchange org-trusted skills and automations (<code>atlas skill push/pull</code>, <code>atlas recall push/pull</code>). Everything else — <code>index</code>, <code>search</code>, <code>callers</code>, <code>impact</code>, <code>serve</code>, <code>mcp</code> — works with no server and no account. On a hosted multi-tenant server, <code>--tenant</code> scopes queries to one org. See <a className="text-link" href="#docs/configuration">Configuration</a> for the related knobs.</p>
            <Command>{`atlas sync status`}</Command>
          </ProseSection>
        </>
      );
    case "indexing":
      return (
        <>
          <p className="docs-lead">Atlas answers are only as current as the selected index. This guide covers creating and updating an index, forcing a rebuild, keeping the graph fresh automatically, controlling what gets indexed, and maintaining the database that stores it. For what the graph contains, see <a className="text-link" href="#docs/concepts">Core Concepts</a>.</p>
          <ProseSection title="Create or Update an Index">
            <p>Run this once to build the graph, and again whenever you want to refresh it — the same command handles both cases. From a repository root:</p>
            <Command>{`atlas index .`}</Command>
            <p>To pin an explicit database instead of the default <code>sqlite://./.atlas/atlas.db</code>:</p>
            <Command>{`atlas --db "sqlite:///absolute/path/.atlas/atlas.db" index .`}</Command>
            <p><code>atlas index</code> parses symbols, edges, and routes, then persists the graph and the lexical search index. By default it indexes the working tree; use <code>--ref COMMIT_OR_BRANCH</code> to index a specific commit or branch instead.</p>
          </ProseSection>
          <ProseSection title="What Index Output Reports">
            <p>Read the index output to confirm what actually happened rather than assuming. With <code>--progress</code> (on by default for human output), Atlas prints start, periodic progress, and completion statistics to stderr. A run reports a delta update when files changed, or a no-op when the stored snapshot already matches the workspace. For profiling an index run, <code>--cpuprofile PATH</code> and <code>--memprofile PATH</code> write runtime/pprof profiles.</p>
          </ProseSection>
          <ProseSection title="Incremental Behavior">
            <p>Incremental updates are the default because they are much faster than full rebuilds: Atlas computes a delta against the previous snapshot and reindexes only what changed. To diff against a specific commit rather than the stored base, pass <code>--base COMMIT</code>.</p>
          </ProseSection>
          <ProseSection title="Forced Rebuild">
            <p>Use <code>--reindex</code> only when the incremental path cannot repair the index:</p>
            <Command>{`atlas index . --reindex`}</Command>
            <p>The legitimate reasons for a full rebuild are:</p>
            <ol className="docs-list numbered">
              <li>An upgrade reports an incompatible or stale index format, or <code>atlas doctor</code> recommends a rebuild.</li>
              <li>Parser or language support changed and old files must be reparsed.</li>
              <li>The workspace identity or indexed root was incorrect, or focused troubleshooting confirms the current index is incomplete.</li>
            </ol>
            <p>Do not make forced reindexing the default workflow. It is slower and discards the benefit of incremental updates.</p>
          </ProseSection>
          <ProseSection title="Watch Mode">
            <p>Use watch mode when you want the graph to stay fresh during active editing with no manual <code>atlas index</code> runs. <code>atlas watch</code> indexes the repo once, then watches the working tree and runs an incremental, working-tree-aware update on every file change. A burst of edits is coalesced into one update (<code>--debounce-ms</code>, default 250). It runs in the foreground until interrupted.</p>
            <Command>{`atlas watch .`}</Command>
            <p>The MCP and HTTP surfaces maintain freshness the same way — <code>atlas mcp</code> and <code>atlas serve</code> watch the repo by default. Disable watching when another process owns indexing:</p>
            <Command>{`atlas mcp --supervise --watch=false   # or set ATLAS_NO_WATCH=1`}</Command>
          </ProseSection>
          <ProseSection title="Semantic Vectors (Optional)">
            <p>Enable vectors only if you want embedding-based retrieval; the deterministic lexical and graph core never depends on them. Run the optional embedding pass at index time:</p>
            <Command>{`atlas index . --enable-vectors\natlas watch . --enable-vectors   # keep embeddings fresh on each update`}</Command>
            <p>With vectors enabled (<code>ATLAS_ENABLE_VECTORS=1</code> and a repo indexed with <code>--enable-vectors</code>), <code>atlas semantic-search</code> returns nearest symbols by cosine similarity. Otherwise it transparently degrades to lexical search and reports <code>degraded=true</code> / <code>mode_used=lexical</code>. By default the embedder is offline (deterministic token overlap); set <code>ATLAS_EMBED_URL</code> to use a real embedding model. See <a className="text-link" href="#docs/configuration">Configuration</a>.</p>
          </ProseSection>
          <ProseSection title="Excluding Files">
            <p>Exclude generated outputs, dependency caches, and nested repository snapshots so they do not pollute search results. Atlas skips paths git ignores by default (<code>--gitignore</code>, default true); pass <code>--gitignore=false</code> to index everything. Add Atlas-specific patterns to <code>.atlasignore</code>.</p>
          </ProseSection>
          <ProseSection title="Registering Without Indexing">
            <p>Use <code>atlas link</code> when a repo should participate in cross-repo queries and appear in <code>atlas status</code> before (or without) being indexed on this machine:</p>
            <Command>{`atlas link org/name --branch main`}</Command>
            <p><code>REPO</code> may be a filesystem path, a git remote URL, or a bare <code>org/name</code>. Linking is idempotent — re-linking updates the registration and reports <code>created=false</code>. Linking does not populate the graph; run <code>atlas index</code> for that. To remove a repo from the registry, <code>atlas repo rm</code> forgets it entirely: snapshots, symbols, edges, embeddings, and lexical documents.</p>
          </ProseSection>
          <ProseSection title="Performance Envelope">
            <p>Two behaviors matter on large or resource-constrained machines:</p>
            <Bullets>
              <li><strong>Streaming index.</strong> Full indexes of repos over ~15,000 candidate files automatically stream in bounded batches instead of holding the whole graph in memory — the Linux kernel (81k files, 1.86M symbols, 6.8M edges) indexes at ~1.3&nbsp;GiB peak RSS. Force it at any size with <code>ATLAS_STREAM_INDEX=1</code> (or off with <code>0</code>); tune with <code>ATLAS_STREAM_INDEX_THRESHOLD</code> and <code>ATLAS_STREAM_INDEX_BATCH</code>.</li>
              <li><strong>CPU ceiling.</strong> The parse/hash pool defaults to all cores. Cap it with <code>atlas index --workers N</code> or <code>ATLAS_INDEX_WORKERS</code> — e.g. <code>--workers 4</code> trades a little wall-time for headroom; <code>1</code> pins the run to a single core. (Go repos also run <code>go/types</code>, which spawns its own compilers outside this pool; other tree-sitter languages are fully bounded by it.)</li>
              <li><strong>Deletions cost more than edits.</strong> Adding or modifying files takes the fast scoped delta; deleting a Go file forces the whole-module type-check fallback (reverse-dependency edges must be re-derived), so a delete delta can approach cold-build time on Go-heavy repos. Batch deletions when you can.</li>
            </Bullets>
          </ProseSection>
          <ProseSection title="Database Maintenance">
            <p>Run maintenance when the database has grown or after an Atlas upgrade.</p>
            <Bullets>
              <li><code>atlas compact</code> reports reclaimable pages and truncates the WAL. Modern Atlas databases use online incremental auto-vacuum; legacy databases are converted with a one-time full VACUUM that takes an exclusive lock — stop <code>atlas serve</code> and watch processes first, or you get a lock error rather than partial work.</li>
              <li><code>atlas compact --full</code> additionally runs a full VACUUM and rebuilds the lexical (BM25) sidecar when it has outgrown its size bound — the only way dead segments are returned to the OS. Exclusive: quiesce other Atlas processes first.</li>
              <li><code>atlas compact --rebuild-lexical</code> rebuilds the lexical sidecar regardless of size — the fix for an empty or wedged sidecar, which otherwise silently degrades every search to SQL-only. <code>atlas doctor</code> reports when you need it.</li>
              <li><code>atlas migrate</code> applies storage migrations and reports the active contracts. Both <code>migrate</code> and <code>compact</code> accept <code>--all --root DIR</code> to process every local <code>.atlas/atlas.db</code> under a directory.</li>
            </Bullets>
          </ProseSection>
          <ProseSection title="Verify Freshness">
            <p>Confirm which index is answering before trusting results:</p>
            <Command>{`atlas status\natlas stats\natlas doctor`}</Command>
            <p>When multiple repositories or databases exist, pin both <code>--db</code> and <code>--repo</code>. If a running Atlas server is configured, CLI queries may use that server — unset <code>ATLAS_SERVER_URL</code> or pin an explicit database while diagnosing.</p>
          </ProseSection>
          <ProseSection title="Safe Recovery Order">
            <p>Follow this order so you never destroy data a cheaper step could have fixed:</p>
            <ol className="docs-list numbered">
              <li>Stop active <code>serve</code>, <code>watch</code>, and supervised MCP processes.</li>
              <li>Run <code>atlas status</code> and <code>atlas doctor</code>.</li>
              <li>Confirm the repository and database paths.</li>
              <li>Run <code>atlas migrate</code> when a schema upgrade is required.</li>
              <li>Rebuild lexical data only when recommended.</li>
              <li>Run <code>atlas index . --reindex</code> as the final non-destructive repair.</li>
              <li>Delete <code>.atlas</code> only when a complete data reset is intended.</li>
            </ol>
            <Callout kind="warn" label="Before deleting local data">
              <p>See <a className="text-link" href="#docs/troubleshooting">Troubleshooting</a> before removing data.</p>
            </Callout>
          </ProseSection>
        </>
      );
    case "cli":
      return (
        <>
          <p className="docs-lead">Every Atlas capability is a subcommand of the single <code>atlas</code> binary. This page is the complete map: global flags first, then each command grouped by task, with worked examples. For narrative guides, start with <a className="text-link" href="#docs/getting-started">Getting Started</a> and <a className="text-link" href="#docs/indexing">Indexing and Reindexing</a>.</p>
          <ProseSection title="Global Flags">
            <p>These flags apply to every command and control which database answers, which repo is in scope, and how output is shaped.</p>
            <div className="docs-table-wrap"><table><thead><tr><th>Flag</th><th>Purpose</th></tr></thead><tbody>
              <tr><td><code>--db</code></td><td>Storage DSN: <code>sqlite://PATH</code> or <code>postgres://...</code> (default <code>sqlite://./.atlas/atlas.db</code>).</td></tr>
              <tr><td><code>--detail</code></td><td>Output depth: <code>low</code>, <code>medium</code>, <code>high</code>, or <code>xhigh</code> — how much graph context to return per item. Default <code>high</code> for every format; <code>xhigh</code> opts into cross-repo context. Retrieval ops (callers/refs/impact) floor at <code>high</code>.</td></tr>
              <tr><td><code>--format</code></td><td>Output shape: <code>plain</code>, <code>json</code>, <code>compact</code>, or <code>ndjson</code> (<code>json</code> by default).</td></tr>
              <tr><td><code>--json</code></td><td>Shorthand for <code>--format json</code>.</td></tr>
              <tr><td><code>--read-only</code></td><td>Open the database immutably: no migration, no WAL/journal files, no <code>telemetry.db</code> created beside it — artifact bytes hash identically after any query. A missing database errors instead of being created.</td></tr>
              <tr><td><code>--repo</code></td><td>Repo workspace: path, <code>org/name</code>, or repo_id. Defaults to the current directory; <code>'*'</code> means all repos on <code>search</code>/<code>semantic-search</code>.</td></tr>
              <tr><td><code>--telemetry-db</code></td><td>Explicit path for the observability database — required if you want telemetry with <code>--read-only</code>. Default: <code>telemetry.db</code> beside the graph database.</td></tr>
              <tr><td><code>--tenant</code></td><td>Tenant/org scope to isolate repos to (hosted multi-tenant; empty = all repos).</td></tr>
            </tbody></table></div>
            <p>Combine them freely with any command:</p>
            <Command>{`atlas --repo /absolute/path status\natlas --db "sqlite:///absolute/path/.atlas/atlas.db" --format plain stats\natlas --detail xhigh explain NewServer\natlas --repo '*' search "rate limiter"`}</Command>
          </ProseSection>
          <ProseSection title="Index and Health">
            <p>Build the graph, keep it fresh, and verify that storage and schema are sound.</p>
            <div className="docs-table-wrap"><table><thead><tr><th>Command</th><th>Purpose</th></tr></thead><tbody>
              <tr><td><code>index</code></td><td>Index a repo: parse symbols, edges, and routes; persist the graph and lexical index. Incremental by default; <code>--reindex</code> forces a full rebuild; <code>--workers N</code> (or <code>ATLAS_INDEX_WORKERS</code>; 0 = all cores) caps the parse/hash pool to bound CPU on a large index.</td></tr>
              <tr><td><code>watch</code></td><td>Index once, then watch the working tree and apply debounced incremental updates on every file change. Foreground until interrupted.</td></tr>
              <tr><td><code>status</code></td><td>Storage and version health: schema/index-format contracts and per-repo snapshot format state (<code>--schema</code> for contract versions and drift).</td></tr>
              <tr><td><code>stats</code></td><td>Graph and index telemetry statistics for an indexed repo.</td></tr>
              <tr><td><code>doctor</code></td><td>Report upgrade health and schema/index contract state; <code>--verify</code> also checks whether the <code>atlas</code> on PATH matches the running binary; <code>--deep</code> runs a page-level integrity scan (<code>PRAGMA quick_check</code>) to catch on-disk corruption that reads silently tolerate.</td></tr>
              <tr><td><code>report</code></td><td>Compose graph stats, top hubs, and top communities; <code>--format plain</code> prints the Markdown report directly.</td></tr>
              <tr><td><code>migrate</code></td><td>Apply storage migrations and report the active contracts.</td></tr>
              <tr><td><code>compact</code></td><td>Reclaim space and truncate the WAL; <code>--full</code> also runs a full VACUUM and rebuilds an oversized lexical sidecar; <code>--rebuild-lexical</code> fixes an empty or wedged sidecar.</td></tr>
              <tr><td><code>link</code></td><td>Register a repo into the graph without indexing it, so it joins cross-repo queries and appears in <code>status</code>. Idempotent.</td></tr>
              <tr><td><code>repo</code></td><td>Repo registry maintenance — <code>repo rm</code> forgets a repo: snapshots, symbols, edges, embeddings, and lexical docs.</td></tr>
            </tbody></table></div>
            <Command>{`atlas index . --enable-vectors\natlas watch .\natlas doctor --verbose\natlas report --format plain`}</Command>
          </ProseSection>
          <ProseSection title="Search and Retrieval">
            <p>Find code and pull bounded, deterministic context about it.</p>
            <div className="docs-table-wrap"><table><thead><tr><th>Command</th><th>Purpose</th></tr></thead><tbody>
              <tr><td><code>search</code></td><td>Code-aware lexical search (BM25 + trigram) over the symbol index; <code>--mode lexical|semantic|hybrid</code>, plus <code>--kind</code> and <code>--path</code> filters.</td></tr>
              <tr><td><code>semantic-search</code></td><td>Embedding-based nearest-symbol search; transparently degrades to lexical (<code>degraded=true</code>) when vectors are unavailable.</td></tr>
              <tr><td><code>context</code></td><td>Bounded review-context bundle for changed/seed paths; budgets via <code>--intent</code> (<code>auto</code> is 16-32 KiB), per-request flags, or env vars.</td></tr>
              <tr><td><code>explain</code></td><td>Deterministic context bundle for a symbol: defs, callers/callees, imports, served routes, cross-repo consumers.</td></tr>
              <tr><td><code>symbol</code></td><td>Show a symbol's definition(s) with its callers and callees.</td></tr>
              <tr><td><code>snippet</code></td><td>Show a symbol's bounded implementation body (path:line, signature, source excerpt).</td></tr>
              <tr><td><code>callers</code></td><td>List symbols that directly call a symbol; scope overloaded names with <code>--package</code>, <code>--receiver</code>, or <code>--arity</code>.</td></tr>
              <tr><td><code>refs</code></td><td>List references to a symbol: call sites plus type-use references (params, fields, returns).</td></tr>
              <tr><td><code>neighbors</code></td><td>Depth-1 call neighborhood: a symbol's direct callers and callees.</td></tr>
              <tr><td><code>path</code></td><td>Shortest forward call path from one symbol to another (<code>--max-depth</code>, default 6).</td></tr>
            </tbody></table></div>
            <Command>{`atlas search "authentication middleware" --mode lexical --format plain\natlas context --paths internal/api/handler.go --intent review \\\n  --query "review correctness and regression risk"\natlas callers NewServer --limit 50 --receiver '*Server'\natlas path Handler ServeHTTP --max-depth 6`}</Command>
            <p>Use <code>search</code> for discovery; use <code>context</code> when reviewing changed paths and you need bounded related code; use <code>explain</code>/<code>symbol</code> when you already know the symbol.</p>
          </ProseSection>
          <ProseSection title="Graph Analysis">
            <p>Measure blast radius, contracts, structure, and change over time.</p>
            <div className="docs-table-wrap"><table><thead><tr><th>Command</th><th>Purpose</th></tr></thead><tbody>
              <tr><td><code>impact</code></td><td>Single-repo blast radius for a change: impacted symbols, files, and tests (<code>--tests</code> on by default).</td></tr>
              <tr><td><code>cross-repo-impact</code></td><td>Cross-repo blast radius: which other repos call routes the changed handlers serve.</td></tr>
              <tr><td><code>consumers</code></td><td>Other repos that call any route this repo serves.</td></tr>
              <tr><td><code>dependencies</code></td><td>Producer repos/handlers that serve HTTP calls this repo makes.</td></tr>
              <tr><td><code>route-contracts</code></td><td>The producer HTTP routes a repo serves — its public contract.</td></tr>
              <tr><td><code>coverage</code></td><td>Real covered/total line ratio when a runtime profile was imported (<code>coverage import</code>); otherwise static call-graph reachability.</td></tr>
              <tr><td><code>hubs</code></td><td>Rank the graph's hubs ("god nodes") by call-graph degree centrality.</td></tr>
              <tr><td><code>communities</code></td><td>Detect deterministic clusters of densely connected symbols.</td></tr>
              <tr><td><code>history</code></td><td>Per-commit snapshot timeline for a repo.</td></tr>
              <tr><td><code>snapshot-diff</code></td><td>Structural diff between two snapshots: symbols/edges added, removed, modified (alias: <code>diff</code>).</td></tr>
              <tr><td><code>export</code></td><td>Export the call graph as <code>json</code>, <code>mermaid</code>, <code>dot</code>, or a self-contained interactive <code>html</code> page; <code>--bundle DIR</code> writes graph.html plus report.md.</td></tr>
            </tbody></table></div>
            <Command>{`atlas impact --paths internal/api/handler.go --max-depth 3\natlas cross-repo-impact --paths internal/api/handler.go\natlas consumers --max-staleness-days 30\natlas export --symbol NewServer --depth 2 --format html -o graph.html`}</Command>
            <p>Cross-repository results depend on linked repositories and indexed service contracts — see <code>atlas link</code> above.</p>
          </ProseSection>
          <ProseSection title="Assistants and Surfaces">
            <p>Wire Atlas into AI assistants and serve it over MCP or HTTP. See <a className="text-link" href="#docs/mcp">MCP Tools</a> and <a className="text-link" href="#docs/service">Dashboard and HTTP API</a>.</p>
            <div className="docs-table-wrap"><table><thead><tr><th>Command</th><th>Purpose</th></tr></thead><tbody>
              <tr><td><code>bootstrap</code></td><td>Register Atlas as an MCP server and install the atlas-first skill and CLAUDE.md directive for all detected assistants (Claude desktop+CLI, Codex, Copilot, Cursor, Gemini). Idempotent.</td></tr>
              <tr><td><code>install</code></td><td>Install integration glue piecemeal: <code>install skill</code> (assistant registration), <code>install hook</code> (git hook that keeps the graph fresh), <code>install aziron</code>.</td></tr>
              <tr><td><code>uninstall</code></td><td>Reverse <code>bootstrap</code> across every assistant it provisions; touches only atlas-managed entries. <code>--purge</code> also deletes the <code>.atlas</code> index databases (the global <code>~/.atlas</code> and every registry-known repo’s <code>.atlas</code>), showing the blast radius and reclaimed total and requiring <code>--yes</code> (or <code>--dry-run</code>). Idempotent.</td></tr>
              <tr><td><code>mcp</code></td><td>Expose graph/search/impact as MCP tools over stdio (default), Streamable HTTP (<code>--http</code>), or legacy SSE (<code>--sse</code>); <code>--supervise</code> runs the warm gateway.</td></tr>
              <tr><td><code>serve</code></td><td>Run the REST HTTP API and dashboard on <code>127.0.0.1:3099</code>; <code>--mcp</code> also mounts MCP over HTTP at <code>POST /mcp</code>.</td></tr>
              <tr><td><code>skill</code></td><td>Author, test, render, and distribute runbook skills (<code>new</code>, <code>lint</code>, <code>test</code>, <code>register</code>, <code>render</code>, <code>push</code>, <code>pull</code>, and more).</td></tr>
            </tbody></table></div>
            <Command>{`atlas bootstrap --dry-run\natlas install skill --agent codex,claude,claude-desktop\natlas mcp --supervise\natlas serve --mcp`}</Command>
            <p>Both <code>mcp</code> and <code>serve</code> watch the repo by default to keep the graph fresh; disable with <code>--watch=false</code> or <code>ATLAS_NO_WATCH=1</code>.</p>
          </ProseSection>
          <ProseSection title="Fleet and Org">
            <p>Connect a machine to a central Atlas server and share telemetry or trusted automations. See <a className="text-link" href="#docs/privacy">Privacy and Data Handling</a> for what leaves the machine at each data level.</p>
            <div className="docs-table-wrap"><table><thead><tr><th>Command</th><th>Purpose</th></tr></thead><tbody>
              <tr><td><code>connect</code></td><td>Register this machine with the central Atlas server under a stable device identity and install capture hooks; <code>--level off|telemetry|interactions|full</code> governs what is shared (default <code>interactions</code>).</td></tr>
              <tr><td><code>disconnect</code></td><td>Disconnect from the central Atlas and remove capture hooks.</td></tr>
              <tr><td><code>sync</code></td><td>Fleet telemetry uplink: <code>sync status</code> shows configuration, kill switches, and cursors; <code>sync now</code> pushes all pending telemetry once.</td></tr>
              <tr><td><code>recall</code></td><td>Frequent-prompt mining, replayable automations, and org sync (<code>clusters</code>, <code>promote</code>, <code>push</code>, <code>pull</code>, <code>state</code>, and more).</td></tr>
            </tbody></table></div>
            <Command>{`atlas connect https://atlas.example.com --level interactions\natlas sync status\natlas recall clusters`}</Command>
          </ProseSection>
          <ProseSection title="Utilities">
            <div className="docs-table-wrap"><table><thead><tr><th>Command</th><th>Purpose</th></tr></thead><tbody>
              <tr><td><code>config</code></td><td>Inspect and persist configuration: <code>list</code> every knob with effective value and provenance, <code>get</code> one, <code>set</code> one into the workspace settings.json. See <a className="text-link" href="#docs/configuration">Configuration</a>.</td></tr>
              <tr><td><code>version</code></td><td>Print the installed Atlas version.</td></tr>
              <tr><td><code>completion</code></td><td>Generate shell completion scripts.</td></tr>
            </tbody></table></div>
            <Command>{`atlas config list\natlas config get ATLAS_MAX_DB_BYTES`}</Command>
          </ProseSection>
          <ProseSection title="Maintenance Safety">
            <p>Stop long-running Atlas processes (<code>serve</code>, <code>watch</code>, supervised MCP) before exclusive maintenance such as <code>compact --full</code>. Back up the complete <code>.atlas/</code> directory before destructive operations like <code>repo rm</code>:</p>
            <Command>{`atlas migrate\natlas compact --full\natlas repo rm owner/repository --yes`}</Command>
          </ProseSection>
          <ProseSection title="Authoritative Contract">
            <p>Flags and defaults can change between releases. <code>atlas --help</code> and <code>atlas &lt;command&gt; --help</code> are the authoritative contract for the release installed on your machine; prefer them over this page when they disagree.</p>
          </ProseSection>
        </>
      );
    case "assistants":
      return (
        <>
          <p className="docs-lead">Atlas registers its MCP server with Claude CLI, Claude Desktop, Codex, Cursor, Gemini, and GitHub Copilot, so any of these assistants can query your local code graph. This page covers automatic setup, repository-pinned setup, git hooks, verification, and removal. For what the tools return once connected, see <a className="text-link" href="#docs/mcp">MCP Tools</a>.</p>
          <ProseSection title="Automatic Setup with Bootstrap">
            <p>Use bootstrap when you want every detected assistant provisioned in one pass. In managed environments, always preview first:</p>
            <Command>{`atlas bootstrap --dry-run`}</Command>
            <p>Apply the changes:</p>
            <Command>{`atlas bootstrap`}</Command>
            <p>Restrict provisioning to selected clients, or exclude some:</p>
            <Command>{`atlas bootstrap --only codex,claude,claude-desktop\natlas bootstrap --skip cursor`}</Command>
            <p>Restart each assistant after its MCP configuration changes; most clients read MCP configuration only at startup.</p>
            <p><strong>What bootstrap writes.</strong> Bootstrap registers Atlas as an MCP server and installs the atlas-first skill plus a CLAUDE.md directive for all detected assistants. It bakes the absolute binary path into each config and registers the supervised gateway with no <code>--db</code>, so the workspace is resolved at query time rather than pinned at install time. The command is idempotent: it is safe to run repeatedly and from a package post-install hook. Re-running <em>merges</em> the existing atlas entry rather than replacing it, so a <code>--db</code> pin, extra args, or an <code>env</code> block you configured (for example via a repository-pinned <code>install skill --db</code>) are preserved. Use <code>--home</code> to override the home directory base when provisioning a different account's configuration.</p>
          </ProseSection>
          <ProseSection title="Repository-Pinned Setup">
            <p>Use a repository-pinned local MCP configuration when one assistant should always query one index:</p>
            <Command>{`cd /path/to/repository\natlas index .\n\natlas install skill \\\n  --agent codex,claude,claude-desktop \\\n  --repo "$PWD" \\\n  --db "sqlite://$PWD/.atlas/atlas.db" \\\n  --server-url=none`}</Command>
          </ProseSection>
          <ProseSection title="Dynamic Workspace Setup">
            <p>Bootstrap is appropriate when the assistant supplies the active workspace at runtime. Repository-scoped MCP tools still require one of:</p>
            <Bullets>
              <li>a workspace root supplied by the client</li>
              <li>a <code>workspace</code> argument</li>
              <li>a repository ID</li>
              <li>a repository pinned when MCP starts</li>
            </Bullets>
            <p>If none is available, Atlas returns <code>workspace_required</code> instead of selecting a repository silently.</p>
          </ProseSection>
          <ProseSection title="Shared Local Server">
            <p>Use one local service when multiple thin clients should share a single index and watcher:</p>
            <Command>{`atlas serve --mcp\n\natlas install skill \\\n  --agent codex,claude,claude-desktop \\\n  --repo "$PWD" \\\n  --server-url http://127.0.0.1:3099`}</Command>
            <p>Use a token before exposing the service beyond loopback. See <a className="text-link" href="#docs/service">Dashboard and HTTP API</a>.</p>
          </ProseSection>
          <ProseSection title="Keep the Graph Fresh with a Git Hook">
            <p>Install a local git hook when you want the index updated as part of your normal git workflow rather than by a running watcher:</p>
            <Command>{`atlas install hook`}</Command>
            <p>The hook keeps the Atlas graph fresh in the repository where it is installed.</p>
          </ProseSection>
          <ProseSection title="Client Configuration Locations">
            <p>Check these paths when auditing what setup wrote or when a client does not pick up the server:</p>
            <div className="docs-table-wrap"><table><thead><tr><th>Client</th><th>Typical location</th></tr></thead><tbody>
              <tr><td>Codex</td><td><code>~/.codex/config.toml</code></td></tr>
              <tr><td>Claude CLI</td><td><code>~/.claude.json</code></td></tr>
              <tr><td>Claude Desktop on macOS</td><td><code>~/Library/Application Support/Claude/claude_desktop_config.json</code></td></tr>
            </tbody></table></div>
            <p>Atlas preserves unrelated client configuration. Always review a dry run before applying changes in managed environments.</p>
          </ProseSection>
          <ProseSection title="Verify">
            <p>Confirm the integration end to end before relying on it:</p>
            <Command>{`atlas doctor --verify atlas\natlas status\natlas bootstrap --dry-run`}</Command>
            <p><code>doctor --verify atlas</code> also checks for binary drift: whether the <code>atlas</code> on <code>PATH</code> — what assistants launch via <code>command:"atlas"</code> — matches the running binary. Then ask the assistant a repository-specific question and confirm that the answer includes source file and line references.</p>
          </ProseSection>
          <ProseSection title="Remove the Integration">
            <p>Preview removal, then apply it:</p>
            <Command>{`atlas uninstall --dry-run\natlas uninstall`}</Command>
            <p>Uninstall reverses <code>atlas bootstrap</code> across every assistant it provisions: it removes the atlas MCP server entry from each config, the atlas skill markdown, and the atlas-managed block in the global CLAUDE.md. Nothing else is touched — other MCP servers, unrelated config keys, and your own CLAUDE.md content outside the atlas markers are preserved. Re-running reports <code>absent</code> and writes nothing. By default repository indexes are not deleted; <code>atlas uninstall --purge</code> also removes the <code>.atlas</code> index directories (the global <code>~/.atlas</code> and every registry-known repo’s <code>.atlas</code>), printing the blast radius and total reclaimed space first and requiring confirmation (<code>--yes</code> to skip it, <code>--dry-run</code> to preview). See <a className="text-link" href="#docs/privacy">Privacy and Data Handling</a> for data removal.</p>
          </ProseSection>
        </>
      );
    case "mcp":
      return (
        <>
          <p className="docs-lead">Atlas exposes its graph, search, and impact analysis as MCP tools, so a connected assistant answers repository questions with bounded, cited context instead of raw file dumps. This page covers the transports, the tool set, how workspace scope is resolved, and how to keep responses small.</p>
          <ProseSection title="Transports">
            <p>Choose the transport based on how the client launches Atlas. Desktop agents spawn a process and speak stdio; shared setups talk HTTP to one long-running service.</p>
            <p>Stdio (the default; local to the launching assistant):</p>
            <Command>{`atlas mcp --transport stdio`}</Command>
            <p>HTTP, mounted on the local service at <code>POST /mcp</code>:</p>
            <Command>{`atlas serve --mcp`}</Command>
            <p><code>atlas mcp</code> can also serve HTTP directly with <code>--http 127.0.0.1:8765</code> (Streamable HTTP) or <code>--sse 127.0.0.1:8766</code> (legacy HTTP+SSE); set <code>ATLAS_API_TOKEN</code> to require <code>Authorization: Bearer</code> on either. With <code>--supervise</code>, Atlas runs as the supervised warm MCP gateway: it uses the workspace database, starts a background watch, and serves <code>code_query</code> first. By default the MCP process also watches the repository to keep the graph fresh (<code>--watch=false</code> or <code>ATLAS_NO_WATCH=1</code> to disable; <code>--watch-path</code> to watch a different path).</p>
          </ProseSection>
          <ProseSection title="Tool Selection">
            <div className="docs-table-wrap"><table><thead><tr><th>Tool</th><th>Use it for</th></tr></thead><tbody>
              <tr><td><code>code_query</code></td><td>Natural-language questions about a repository</td></tr>
              <tr><td><code>search</code></td><td>Focused lexical or semantic discovery</td></tr>
              <tr><td><code>symbol</code></td><td>Definitions, snippets, callers, callees, refs, and coverage</td></tr>
              <tr><td><code>graph</code></td><td>Paths or neighborhoods between symbols</td></tr>
              <tr><td><code>impact</code></td><td>Repository or cross-repository blast radius</td></tr>
              <tr><td><code>routes</code></td><td>Served routes, consumers, and dependencies</td></tr>
              <tr><td><code>context</code></td><td>Code-review context for changed paths</td></tr>
              <tr><td><code>report</code></td><td>Repository-level code intelligence reports</td></tr>
              <tr><td><code>history</code></td><td>Indexed history and graph changes</td></tr>
              <tr><td><code>status</code></td><td>Index, readiness, and retrieval state</td></tr>
              <tr><td><code>link</code></td><td>Register a repository for workspace or cross-repository analysis</td></tr>
              <tr><td><code>record_feedback</code></td><td>Record result-quality feedback</td></tr>
              <tr><td><code>record_task</code></td><td>Record the outcome of a procedural task</td></tr>
            </tbody></table></div>
          </ProseSection>
          <ProseSection title="Choosing a Tool">
            <p>Start with <code>code_query</code> for most repository questions: it checks index readiness and returns cited context under a bounded response budget. Reach for a narrower tool when you already know the shape of the answer:</p>
            <Bullets>
              <li><code>symbol</code> when you have a name and want its definition, callers, callees, refs, or coverage. Add package, receiver, or arity filters when the name is overloaded.</li>
              <li><code>context</code> when reviewing a known set of changed files.</li>
              <li><code>impact</code> before a change, to size its blast radius.</li>
              <li><code>routes</code> for service contracts, consumers, and dependencies.</li>
              <li><code>status</code> when results look empty or stale — it reports index and readiness state, which distinguishes "no index" from "no matches".</li>
            </Bullets>
          </ProseSection>
          <ProseSection title="Workspace Scoping">
            <p>Repository-scoped tools need to know which repository they operate on. Atlas accepts scope from, in order of availability:</p>
            <Bullets>
              <li>a workspace root supplied by the client</li>
              <li>a <code>workspace</code> argument on the call</li>
              <li>a repository ID</li>
              <li>a repository pinned at launch time with <code>--repo</code></li>
            </Bullets>
            <p>If none is available, Atlas returns <code>workspace_required</code> instead of silently choosing a repository. In <code>--supervise</code> mode the gateway resolves the workspace per call and routes a <code>workspace</code> argument that names a <em>different</em> indexed repository to that repository’s own <code>.atlas</code> store (read-only), so one warm gateway can answer queries across every repo you have indexed.</p>
          </ProseSection>
          <ProseSection title="Result Statuses">
            <p>Check the status field before trusting a result — it tells you whether the answer is backed by an index at all.</p>
            <div className="docs-table-wrap"><table><thead><tr><th>Status</th><th>Meaning</th></tr></thead><tbody>
              <tr><td><code>ok</code></td><td>Atlas returned cited context</td></tr>
              <tr><td><code>indexing</code></td><td>An index was started or is still running</td></tr>
              <tr><td><code>no_index</code></td><td>No usable index exists for the workspace</td></tr>
              <tr><td><code>insufficient</code></td><td>The index could not support a cited answer</td></tr>
              <tr><td><code>budget_exceeded</code></td><td>Strict output budget was too small</td></tr>
              <tr><td><code>workspace_required</code></td><td>Repository scope was not declared</td></tr>
            </tbody></table></div>
          </ProseSection>
          <ProseSection title="Controlling Token Spend">
            <p>Tune detail and format so results fit the assistant's context window instead of trimming after the fact:</p>
            <Bullets>
              <li>Use <code>detail=low</code> when you only need counts or minimal metadata; <code>medium</code> for names and signatures; <code>high</code> for repository-local evidence; <code>xhigh</code> only when broader cross-repo context is required.</li>
              <li>Use <code>format=plain</code> for compact line-oriented output when the client does not need structured JSON.</li>
              <li>Set <code>max_tokens</code> to bound a <code>code_query</code> answer; an answer trimmed to fit is marked <code>truncated:true</code>. Strict budget mode refuses an oversized answer and returns <code>budget_exceeded</code> instead.</li>
            </Bullets>
          </ProseSection>
          <ProseSection title="Transport Security">
            <p>Stdio MCP is local to the launching assistant. HTTP MCP should stay on loopback unless authentication and origin restrictions are configured:</p>
            <Command>{`export ATLAS_API_TOKEN='replace-with-a-strong-token'\nexport ATLAS_MCP_ALLOWED_ORIGINS='https://trusted.example'\natlas serve --mcp --addr 0.0.0.0:3099`}</Command>
            <p>See <a className="text-link" href="#docs/privacy">Privacy and Data Handling</a> before enabling networked access, and <a className="text-link" href="#docs/service">Dashboard and HTTP API</a> for the full service surface.</p>
          </ProseSection>
        </>
      );
    case "service":
      return (
        <>
          <p className="docs-lead">One <code>atlas serve</code> process hosts the local dashboard, the HTTP API, the repository watcher, and — with <code>--mcp</code> — the MCP endpoint. Run it when you want a browsable view of the graph, when thin clients should share one index, or when other tooling needs a REST surface.</p>
          <ProseSection title="Start the Service">
            <p>Start with MCP mounted so assistants and HTTP clients share the same process:</p>
            <Command>{`atlas serve --mcp`}</Command>
            <p>Useful variants:</p>
            <Command>{`atlas serve --open        # also auto-open the dashboard in your browser\natlas serve --watch=false  # do not keep the graph fresh in the background`}</Command>
            <p>The default address is <code>http://127.0.0.1:3099</code>, with the dashboard at <code>http://127.0.0.1:3099/dashboard</code>.</p>
          </ProseSection>
          <ProseSection title="Serve Flags">
            <div className="docs-table-wrap"><table><thead><tr><th>Flag</th><th>Default</th><th>Effect</th></tr></thead><tbody>
              <tr><td><code>--addr</code></td><td><code>127.0.0.1:3099</code></td><td>Listen address; loopback by default. Use <code>0.0.0.0:3099</code> to expose on the network</td></tr>
              <tr><td><code>--mcp</code></td><td>off</td><td>Also mount MCP over HTTP at <code>POST /mcp</code></td></tr>
              <tr><td><code>--open</code></td><td><code>false</code></td><td>Auto-open the dashboard in your browser once ready (off by default; pass <code>--open</code> to enable). <code>serve</code> hosts the dashboard either way</td></tr>
              <tr><td><code>--watch</code></td><td><code>true</code></td><td>Keep the graph fresh by watching the repo; <code>--watch=false</code> or <code>ATLAS_NO_WATCH=1</code> to disable</td></tr>
              <tr><td><code>--watch-path</code></td><td><code>--repo</code>, else current dir</td><td>Repo path to watch when <code>--watch</code> is set</td></tr>
            </tbody></table></div>
            <p>Global flags such as <code>--db</code>, <code>--repo</code>, and <code>--read-only</code> apply as on any other command; see the <a className="text-link" href="#docs/cli">CLI Reference</a>.</p>
          </ProseSection>
          <ProseSection title="Health and API Discovery">
            <p>Use these endpoints to script readiness checks and to discover the API:</p>
            <Command>{`curl http://127.0.0.1:3099/healthz\ncurl http://127.0.0.1:3099/readyz\ncurl http://127.0.0.1:3099/openapi.json`}</Command>
            <Bullets>
              <li><code>healthz</code> confirms the process is running.</li>
              <li><code>readyz</code> confirms Atlas can answer a lightweight engine request.</li>
              <li><code>openapi.json</code> is the version-specific API contract. Generate clients and validate requests against this document rather than copying request shapes from historical examples.</li>
            </Bullets>
          </ProseSection>
          <ProseSection title="Common Requests">
            <Command>{`curl http://127.0.0.1:3099/api/v1/status\ncurl http://127.0.0.1:3099/api/v1/stats\ncurl "http://127.0.0.1:3099/api/v1/search?q=Checkout"`}</Command>
          </ProseSection>
          <ProseSection title="Binding Beyond Loopback">
            <p>Loopback is the safe default. Before binding to another interface, require a bearer token and restrict browser origins:</p>
            <Command>{`export ATLAS_API_TOKEN='replace-with-a-strong-token'\nexport ATLAS_MCP_ALLOWED_ORIGINS='https://trusted.example'\natlas serve --mcp --addr 0.0.0.0:3099`}</Command>
            <p>Authenticated request:</p>
            <Command>{`curl \\\n  -H "Authorization: Bearer $ATLAS_API_TOKEN" \\\n  http://host:3099/api/v1/status`}</Command>
            <p><code>ATLAS_API_TOKEN</code> protects <code>/api/v1/*</code> and <code>POST /mcp</code>. Browser clients from additional origins must also be explicitly allowed via <code>ATLAS_MCP_ALLOWED_ORIGINS</code>.</p>
            <p>When a token-protected dashboard requests credentials, supply the configured Atlas API token. The dashboard uses authenticated API calls and a short-lived stream credential for live updates.</p>
            <Callout kind="warn" label="Token handling">
              <p>Do not place the API token in shared links, logs, screenshots, or source control. Anyone holding the token can query every repository the service indexes.</p>
            </Callout>
          </ProseSection>
          <ProseSection title="TLS">
            <p>Atlas serves plain HTTP. When traffic leaves the machine, terminate TLS at a trusted reverse proxy in front of <code>atlas serve</code> rather than exposing the listener directly.</p>
          </ProseSection>
          <ProseSection title="Service Troubleshooting">
            <p>Start with Atlas's own diagnostics, then check the port:</p>
            <Command>{`atlas status\natlas doctor\nlsof -nP -iTCP:3099 -sTCP:LISTEN`}</Command>
            <p>If <code>healthz</code> passes but <code>readyz</code> fails, indexing or database maintenance may be blocking engine requests. Wait for the current operation or stop competing Atlas processes before retrying. See <a className="text-link" href="#docs/troubleshooting">Troubleshooting</a> for broader diagnosis.</p>
          </ProseSection>
        </>
      );
    case "configuration":
      return (
        <>
          <p className="docs-lead">Atlas works with zero configuration on a fresh checkout; every knob has a compiled default. This page explains where overrides live, which settings matter most, and the global flags that select storage, scope, and output shape. For the full command surface, see the <a className="text-link" href="#docs/cli">CLI Reference</a>.</p>
          <ProseSection title="Precedence">
            <p>Know where a value comes from before changing it. Effective configuration is resolved in this order (highest wins):</p>
            <ol className="docs-list numbered">
              <li>Environment variable</li>
              <li>Repository <code>.atlas/settings.json</code></li>
              <li>Compiled default</li>
            </ol>
            <p>A deployment environment variable always wins over a persisted edit. Environment variables suit automation and containers; repository settings suit stable local policy.</p>
          </ProseSection>
          <ProseSection title="Inspecting and Persisting Settings">
            <p>Use <code>atlas config</code> to see every knob's effective value and its provenance — not just what is set, but which layer set it:</p>
            <Command>{`atlas config list                        # every knob, value, and provenance\natlas config get ATLAS_MAX_DB_BYTES      # one knob's value and origin\natlas config set ATLAS_MAX_DB_BYTES 10GiB  # persist into .atlas/settings.json\natlas config set ATLAS_MAX_DB_BYTES ""     # clear a persisted override`}</Command>
          </ProseSection>
          <ProseSection title="Known Settings">
            <div className="docs-table-wrap"><table><thead><tr><th>Setting</th><th>Purpose</th></tr></thead><tbody>
              <tr><td><code>ATLAS_ENABLE_VECTORS</code></td><td>Enable optional semantic retrieval (pairs with an index built with <code>--enable-vectors</code>)</td></tr>
              <tr><td><code>ATLAS_EMBED_URL</code></td><td>Point semantic search at a real embedding model; the default embedder is offline (deterministic token overlap)</td></tr>
              <tr><td><code>ATLAS_NO_WATCH</code></td><td>Disable background file watching in <code>mcp</code> and <code>serve</code> (equivalent to <code>--watch=false</code>)</td></tr>
              <tr><td><code>ATLAS_WATCH_MODE</code></td><td>Select the watcher mode, including polling</td></tr>
              <tr><td><code>ATLAS_MEMORY_LIMIT</code></td><td>Bound Atlas memory use</td></tr>
              <tr><td><code>ATLAS_GOGC</code></td><td>Tune Go garbage collection</td></tr>
              <tr><td><code>ATLAS_MCP_CALL_TIMEOUT</code></td><td>Bound an MCP tool call</td></tr>
              <tr><td><code>ATLAS_MCP_ALLOWED_ORIGINS</code></td><td>Allow additional browser origins</td></tr>
              <tr><td><code>ATLAS_API_TOKEN</code></td><td>Require <code>Authorization: Bearer</code> on the HTTP API and HTTP/SSE MCP transports</td></tr>
              <tr><td><code>ATLAS_SERVER_URL</code></td><td>Route compatible CLI operations through a running server</td></tr>
              <tr><td><code>ATLAS_SKIP_BOOTSTRAP</code></td><td>Skip automatic bootstrap provisioning (for example in package post-install automation)</td></tr>
              <tr><td><code>ATLAS_SYNC_SERVER</code></td><td>Default central server URL for <code>atlas connect</code></td></tr>
              <tr><td><code>ATLAS_SYNC_TOKEN</code></td><td>Bearer token for <code>atlas connect</code></td></tr>
              <tr><td><code>ATLAS_CONTEXT_LIMIT</code>, <code>ATLAS_CONTEXT_MAX_FILES</code>, <code>ATLAS_CONTEXT_MAX_EDGES</code>, <code>ATLAS_CONTEXT_MAX_DEPTH</code></td><td>Default budgets for <code>atlas context</code>; per-request flags override, intent defaults apply otherwise</td></tr>
              <tr><td><code>ATLAS_LEXICAL_MAX_RATIO</code>, <code>ATLAS_MAX_LEXICAL_BYTES</code></td><td>Size bound on the lexical (BM25) sidecar that triggers a rebuild during <code>compact --full</code></td></tr>
              <tr><td><code>ATLAS_MAX_DB_BYTES</code></td><td>Bound the graph database size</td></tr>
              <tr><td><code>ATLAS_INDEX_WORKERS</code></td><td>Cap the parse/hash worker pool during indexing (0 = all cores); CLI equivalent <code>atlas index --workers N</code>. Lower it to bound CPU on a large index</td></tr>
              <tr><td><code>ATLAS_STREAM_INDEX</code>, <code>ATLAS_STREAM_INDEX_THRESHOLD</code>, <code>ATLAS_STREAM_INDEX_BATCH</code></td><td>Force/tune the streaming index that bounds memory on large repos (auto-engages above ~15,000 candidate files)</td></tr>
            </tbody></table></div>
            <p>Run <code>atlas config list</code> for the complete catalog with current names, defaults, descriptions, and accepted values for your installed release.</p>
          </ProseSection>
          <ProseSection title="Storage Selection">
            <p>Every command reads and writes one database, selected by <code>--db</code>. The DSN takes two forms: <code>sqlite://PATH</code> or <code>postgres://...</code></p>
            <p>The default is <code>sqlite://./.atlas/atlas.db</code> — repository-local, relative to the working directory. Pin an explicit database when several exist:</p>
            <Command>{`atlas --db "sqlite:///absolute/path/.atlas/atlas.db" status`}</Command>
            <Callout kind="tip" label="Fixed coordinates">
              <p>Use absolute database paths in assistant configurations: an assistant's process directory is rarely your repository root, so a relative DSN resolves to the wrong place.</p>
            </Callout>
          </ProseSection>
          <ProseSection title="Scope Selection">
            <p>When one database holds several repositories, select which repo answers with <code>--repo</code>. It accepts a filesystem path, an <code>org/name</code>, or a repo_id, and defaults to the current directory. On <code>search</code> and <code>semantic-search</code>, <code>--repo '*'</code> queries all repos. In hosted multi-tenant deployments, <code>--tenant</code> isolates repos to one tenant/org scope; empty means all repos.</p>
          </ProseSection>
          <ProseSection title="Output Defaults">
            <p>Treat output shape and depth as configuration, not per-query ceremony, when scripting against Atlas.</p>
            <Bullets>
              <li><code>--format</code> selects the shape: <code>plain</code>, <code>json</code> (default), <code>compact</code>, or <code>ndjson</code>. <code>--json</code> is shorthand for <code>--format json</code>.</li>
              <li><code>--detail</code> selects the depth: <code>low</code>, <code>medium</code>, <code>high</code> (default for every format), or <code>xhigh</code>, which opts into cross-repo context. Retrieval operations (callers/refs/impact) floor at <code>high</code>.</li>
            </Bullets>
          </ProseSection>
          <ProseSection title="Read-Only Mode and Telemetry">
            <p>Use <code>--read-only</code> when the database must not change — for example when hashing artifacts or querying a shared, immutable index. It opens the database immutably: no migration runs, no WAL/journal files are created, and no <code>telemetry.db</code> is created beside it, so the artifact bytes hash identically after any query. A missing database errors instead of being created.</p>
            <p>Because read-only mode suppresses the default telemetry database, telemetry with <code>--read-only</code> requires an explicit <code>--telemetry-db PATH</code>. Without <code>--read-only</code>, telemetry defaults to <code>telemetry.db</code> beside the graph database.</p>
            <Command>{`atlas --read-only --telemetry-db /srv/atlas/telemetry.db \\\n  --db "sqlite:///shared/index/.atlas/atlas.db" search "payment handler"`}</Command>
          </ProseSection>
          <ProseSection title="Resource-Constrained Environments">
            <p>Start conservative and confirm before raising limits:</p>
            <Command>{`export ATLAS_MEMORY_LIMIT=2GiB\nexport ATLAS_NO_WATCH=1\natlas index . --workers 4`}</Command>
            <p>On a large repo, <code>--workers N</code> (or <code>ATLAS_INDEX_WORKERS</code>) caps indexing CPU, and the streaming index (auto above ~15,000 files; force with <code>ATLAS_STREAM_INDEX=1</code>) bounds peak memory.</p>
            <p>For very large repositories, exclude generated files and dependency caches (see <a className="text-link" href="#docs/indexing">Indexing and Reindexing</a>) before increasing limits. Confirm behavior with <code>atlas status</code>, <code>atlas stats</code>, and <code>atlas doctor</code>.</p>
          </ProseSection>
        </>
      );
    case "privacy":
      return (
        <>
          <p className="docs-lead">Atlas indexes and queries your code locally by default; nothing leaves the machine unless you deliberately turn on a network feature. This page defines that boundary, what is stored where, how to run Atlas in audit-grade read-only mode, and which features are opt-in.</p>
          <ProseSection title={'What "Local by Default" Means'}>
            <p>Use this section to establish the baseline before granting any access:</p>
            <Bullets>
              <li>Source files are read from the selected workspace.</li>
              <li>The default index is stored in that workspace under <code>.atlas/</code>.</li>
              <li>CLI queries and stdio MCP do not require a hosted Atlas service.</li>
              <li>The local dashboard and API bind to loopback by default.</li>
            </Bullets>
            <p>This does not mean every tool connected to Atlas is offline. A coding assistant may forward the snippets Atlas returns over MCP to its configured model provider, subject to that client's settings and data policy.</p>
          </ProseSection>
          <ProseSection title="What Is Stored Where">
            <p>Know the on-disk layout before backing up, moving, or deleting an index. The <code>.atlas/</code> directory can contain the graph database (<code>atlas.db</code> by default), supporting retrieval data, settings, telemetry, and transient SQLite files (WAL/journal). Treat the directory as one data set: copy, back up, or delete it as a unit.</p>
            <p>Stop active Atlas processes (<code>atlas serve</code>, <code>atlas watch</code>, MCP with <code>--watch</code>) before copying, compacting, or deleting local data.</p>
          </ProseSection>
          <ProseSection title="Read-Only Mode for Audit-Grade Use">
            <p>Use <code>--read-only</code> when queries must provably not modify the artifact — for example when examining a database captured as evidence or shared by another team. The flag opens the database immutably:</p>
            <Bullets>
              <li>no migration runs</li>
              <li>no WAL or journal files are created</li>
              <li>no <code>telemetry.db</code> is created next to the graph database</li>
              <li>artifact bytes hash identically after any query</li>
              <li>a missing database errors instead of being created</li>
            </Bullets>
            <Command>{`atlas status --read-only --db "sqlite:///path/to/copy/atlas.db"`}</Command>
          </ProseSection>
          <ProseSection title="Telemetry">
            <p>Local observability data is kept separate from the graph. By default it lives in <code>telemetry.db</code> beside the graph database; set an explicit location with <code>--telemetry-db PATH</code>. With <code>--read-only</code>, no telemetry database is created — if you want telemetry in that mode, you must pass <code>--telemetry-db</code> explicitly.</p>
          </ProseSection>
          <ProseSection title="Fleet Features Are Opt-In">
            <p>Nothing is uplinked unless you run <code>atlas connect</code>. Connecting registers the machine with a central Atlas server under a stable device identity, writes <code>~/.atlas/config.json</code>, and installs the Claude/Codex capture hooks (<code>--no-hooks</code> to skip). There is no default hub: the server URL comes from the explicit argument, <code>ATLAS_SYNC_SERVER</code>, or the URL the machine is already connected to.</p>
            <p>What leaves the machine is governed by the data level:</p>
            <div className="docs-table-wrap"><table><thead><tr><th><code>--level</code></th><th>Shares</th></tr></thead><tbody>
              <tr><td><code>off</code></td><td>Nothing</td></tr>
              <tr><td><code>telemetry</code></td><td>Metrics only</td></tr>
              <tr><td><code>interactions</code></td><td>Normalized prompts + redacted traces (the default)</td></tr>
              <tr><td><code>full</code></td><td>Raw prompts (org opt-in)</td></tr>
            </tbody></table></div>
            <p>Raw transcripts, tool outputs, answers, and secrets never leave the machine at any level. Inspect and drive the uplink explicitly:</p>
            <Command>{`atlas sync status\natlas sync now`}</Command>
            <p><code>sync status</code> shows uplink configuration, kill switches, and per-stream cursors; <code>sync now</code> pushes all pending telemetry once. To leave the fleet and remove the capture hooks:</p>
            <Command>{`atlas disconnect`}</Command>
          </ProseSection>
          <ProseSection title="Before Enabling Network Access">
            <p>Review this checklist before binding the service beyond loopback:</p>
            <Bullets>
              <li>the bind address</li>
              <li>API authentication</li>
              <li>allowed browser origins</li>
              <li>reverse-proxy TLS</li>
              <li>the data policy of connected assistants and model providers</li>
              <li>any optional embedding or organization-connected service</li>
            </Bullets>
            <p>Protect non-loopback service access:</p>
            <Command>{`export ATLAS_API_TOKEN='replace-with-a-strong-token'\nexport ATLAS_MCP_ALLOWED_ORIGINS='https://trusted.example'\natlas serve --mcp --addr 0.0.0.0:3099`}</Command>
            <Callout kind="warn" label="Token handling">
              <p>Do not commit tokens to repository settings or shell scripts. See <a className="text-link" href="#docs/service">Dashboard and HTTP API</a> for token and TLS details.</p>
            </Callout>
          </ProseSection>
          <ProseSection title="Data Removal">
            <p>Remove Atlas-managed assistant configuration first:</p>
            <Command>{`atlas uninstall --dry-run\natlas uninstall`}</Command>
            <p>Package removal does not automatically delete repository indexes; run <code>atlas uninstall --purge</code> to delete the index databases automatically (the global <code>~/.atlas</code> and every registry-known repo’s <code>.atlas</code>, with a blast-radius report and confirmation), delete a <code>.atlas/</code> directory manually (with Atlas processes stopped) to remove one index, or use <code>atlas repo rm</code> to forget one repository's snapshots, symbols, edges, embeddings, and lexical documents from a shared database.</p>
          </ProseSection>
          <ProseSection title="Shared and Connected Environments">
            <p>When multiple users or repositories share an Atlas service:</p>
            <Bullets>
              <li>declare repository scope explicitly</li>
              <li>authenticate every network client</li>
              <li>restrict browser origins</li>
              <li>define retention and backup policy</li>
              <li>avoid mounting sensitive repositories into an index intended for a broader audience</li>
            </Bullets>
            <p>Atlas documentation describes product behavior, but the operator remains responsible for the policies of connected assistants, networks, and storage.</p>
          </ProseSection>
        </>
      );
    case "languages":
      return (
        <>
          <p className="docs-lead">Atlas recognizes programming languages, templates, structured project files, documents, and content formats. Capability depth varies by format: some languages carry a reference-validated call graph, others a structural or content index only. Use this page to determine what Atlas can prove for the languages that matter to you.</p>
          <ProseSection title="Capability Levels">
            <p>Use these distinctions when evaluating a repository — "indexed" alone does not tell you whether caller and impact queries will be accurate.</p>
            <div className="docs-table-wrap"><table><thead><tr><th>Level</th><th>Typical capability</th></tr></thead><tbody>
              <tr><td>Code graph</td><td>Symbols, references, calls, and related-code context</td></tr>
              <tr><td>Structural index</td><td>Named constructs and searchable structure</td></tr>
              <tr><td>Content index</td><td>Searchable text or extracted document content</td></tr>
            </tbody></table></div>
            <p>Indexing a format does not guarantee identical call-graph or symbol accuracy across every language.</p>
          </ProseSection>
          <ProseSection title="Language Maturity Ladder">
            <p>Consult the ladder before relying on graph queries (<code>callers</code>, <code>impact</code>, <code>path</code>) for a language: levels reflect validation depth, not just support. An L2 language still indexes and searches; it has not yet reached verified call-graph resolution. Atlas covers 40 code languages across these levels:</p>
            <div className="docs-table-wrap"><table><thead><tr><th>Level</th><th>Meaning</th><th>Languages</th></tr></thead><tbody>
              <tr><td>L5 — Reference-validated</td><td>Call graph cross-checked against an LSP server or SCIP indexer</td><td>C, C++, Dart, Fortran, Go, Java, JavaScript, Lua, PHP, Python, Rust, TypeScript, Zig</td></tr>
              <tr><td>L4 — Real-repo call graph</td><td>Who-calls resolved and proven on a real repository</td><td>Apex, Astro, C#, Elixir, ETS, Groovy, Julia, Kotlin, R, Scala, SQL, Svelte, Swift, Verilog, Vue — plus, pending real-repo proof: Bash, Blade, BYOND, EJS, Objective-C, Pascal, PowerShell, Razor, Ruby</td></tr>
              <tr><td>L2 — Real-repo tested</td><td>Runs on real code; call graph not yet resolved</td><td>Delphi, Terraform</td></tr>
              <tr><td>L1 — Indexed</td><td>Parsed and symbols extracted</td><td>P4</td></tr>
            </tbody></table></div>
            <p>The "pending real-repo proof" languages at L4 have resolved call graphs on fixtures but have not yet been proven against a real repository. Treat them as L4 capability with weaker evidence until the proof lands.</p>
          </ProseSection>
          <ProseSection title="Content Formats">
            <p>Beyond code, Atlas indexes approximately 24 content formats (JSON, YAML, HTML, PDF, and others) for search. These are content and structural indexes, not call graphs:</p>
            <Bullets>
              <li><strong>Templates and frontend:</strong> HTML, CSS, Vue, Svelte, Astro, EJS, Razor, Blade, Markdown, and MDX</li>
              <li><strong>Structured and project files:</strong> JSON, YAML, TOML, XML, plist, CSV, TSV, Protocol Buffers, Go module files, .NET project files, Makefiles, Dockerfiles, configuration files, and plain text</li>
              <li><strong>Documents and media:</strong> PDF, DOCX, XLSX, PPTX, and common image formats, indexed for content discovery</li>
            </Bullets>
            <p>Treat document and media formats as content indexes rather than programming-language call graphs.</p>
          </ProseSection>
          <ProseSection title="Check Evidence for Your Own Repositories">
            <p>Fixture compatibility is not a substitute for production-repository accuracy — verify support on the code you actually work with before depending on it.</p>
            <Command>{`atlas index .\natlas stats\natlas report --format plain`}</Command>
            <Bullets>
              <li><code>atlas index .</code> parses symbols, edges, and routes and persists the graph and lexical index.</li>
              <li><code>atlas stats</code> shows graph and index telemetry statistics for the indexed repository, including recent snapshot telemetry rows.</li>
              <li><code>atlas report</code> composes the snapshot's graph stats, top hubs, and top communities; <code>--format plain</code> prints the Markdown report directly.</li>
            </Bullets>
            <p>Low edge counts or missing symbol kinds in <code>stats</code> and <code>report</code> output are the fastest signal that a language sits lower on the ladder than your workflow needs. Evaluate important languages on representative repositories and pin the Atlas version used for the evaluation.</p>
            <p>See <a className="text-link" href="#docs/indexing">Indexing and Reindexing</a> for delta versus full reindex behavior and <a className="text-link" href="#docs/cli">CLI Reference</a> for the full command surface.</p>
          </ProseSection>
          <ProseSection title="Published Compatibility Evidence">
            <p>Language support changes across releases. The public benchmark site includes a dated, evidence-graded compatibility view with an interactive per-language matrix:</p>
            <Bullets>
              <li><a className="text-link" href="https://atlas.aziro.com/#languages" target="_blank" rel="noreferrer">Language benchmark matrix</a></li>
              <li><a className="text-link" href="https://github.com/aziron-ai/atlas/tree/main/data/raw" target="_blank" rel="noreferrer">Raw language artifacts</a></li>
            </Bullets>
            <p>For how those numbers were measured, what they do and do not prove, and how to reproduce them, read <a className="text-link" href="#docs/benchmarks">Benchmarks and Methodology</a>.</p>
          </ProseSection>
        </>
      );
    case "benchmarks":
      return (
        <>
          <p className="docs-lead">Atlas publishes benchmark results for accuracy, token use, latency, language compatibility, and agent workflows. Use this page to interpret those numbers correctly — every result is a dated measurement under stated conditions, not a general guarantee.</p>
          <p><a className="text-link" href="https://atlas.aziro.com/#benchmarks" target="_blank" rel="noreferrer">Open the Atlas benchmark explorer</a></p>
          <ProseSection title="How to Read a Result">
            <p>Work through this checklist before comparing tools or quoting a number — a result you cannot place in it is not evidence:</p>
            <ol className="docs-list numbered">
              <li><strong>Identify the setup.</strong> Atlas and baseline tool versions, repository URL and pinned commit, language and query set.</li>
              <li><strong>Identify the conditions.</strong> Hardware and operating system, cold-cache or warm-cache state, repeat count and aggregation method.</li>
              <li><strong>Identify the scoring.</strong> The accuracy oracle or reviewer, and the token measurement method (provider-reported usage versus a documented estimate).</li>
              <li><strong>Identify the failure handling.</strong> How failed and timed-out cases were counted. A mean that silently drops failures is not comparable to one that scores them.</li>
            </ol>
          </ProseSection>
          <ProseSection title="Evidence Categories">
            <p>Keep categories separate — do not combine them into one unsupported headline:</p>
            <Bullets>
              <li><strong>Compatibility:</strong> whether a format indexes successfully</li>
              <li><strong>Correctness:</strong> precision, recall, or F1 against an oracle</li>
              <li><strong>Latency:</strong> elapsed index or query time under stated cache conditions</li>
              <li><strong>Token use:</strong> measured model/tool usage or a documented estimate</li>
              <li><strong>Agent workflow:</strong> end-to-end behavior for a pinned assistant and task set</li>
            </Bullets>
          </ProseSection>
          <ProseSection title="Published Headline Results (July 2026)">
            <p>These are the current published numbers, each with its evidence conditions:</p>
            <div className="docs-table-wrap"><table><thead><tr><th>Result</th><th>Conditions</th></tr></thead><tbody>
              <tr><td>F1 0.757 at 21.2 context tokens, mean across all 37 languages</td><td>Native ground truth, real-LLM scored (222 cells, 666 model calls)</td></tr>
              <tr><td>F1 1.000 at 27.1 tokens on the 28 fully-supported languages</td><td>Full-file-dump accuracy at 6.1× fewer tokens; same fixture suite</td></tr>
              <tr><td>Graph-tool comparison: 0.539 F1 at 97 tokens</td><td>Atlas delivers 6.4× the accuracy per token and 36× fewer query tokens</td></tr>
              <tr><td>Query latency ~7.4 ms vs 128 ms for the graph tool</td><td>Real repositories, 36 languages; flat from 15 to 39,161 symbols</td></tr>
            </tbody></table></div>
            <p><em>Measurement layer:</em> the 7.4&nbsp;ms figure is warm <strong>in-process</strong> engine latency (what an MCP/serve session experiences per call). End-to-end <strong>CLI</strong> latency adds ~30&nbsp;ms of process spawn per side — roughly 44&nbsp;ms vs 450&nbsp;ms (~9×) — so shell-loop reproductions should expect the CLI numbers, not 7.4&nbsp;ms.</p>
          </ProseSection>
          <ProseSection title="Agent-Harness Token Benchmark (2026-07-10)">
            <p>This measures what a real agent actually spends. Claude Code and OpenAI Codex ran headless in sirupsen/logrus (@a23d315), restricted to one code-intelligence CLI per run, answering 19 caller questions scored against gopls call_hierarchy (LSP-truth) at the pinned commit. Token numbers are each harness's own usage accounting.</p>
            <div className="docs-table-wrap"><table><thead><tr><th>Agent</th><th>Context source</th><th>Mean total tokens</th><th>Mean tool calls</th><th>Mean F1</th></tr></thead><tbody>
              <tr><td>claude (claude-sonnet-5)</td><td>Atlas</td><td>61,561</td><td>2</td><td>0.882</td></tr>
              <tr><td>claude (claude-sonnet-5)</td><td>No tool (raw exploration)</td><td>144,385</td><td>4.9</td><td>0.569</td></tr>
              <tr><td>claude (claude-sonnet-5)</td><td>Graph tool</td><td>370,898</td><td>10.3</td><td>0.305</td></tr>
              <tr><td>codex (gpt-5.6-sol)</td><td>Atlas</td><td>27,981</td><td>1</td><td>0.881</td></tr>
              <tr><td>codex (gpt-5.6-sol)</td><td>No tool (raw exploration)</td><td>48,106</td><td>2.1</td><td>0.876</td></tr>
              <tr><td>codex (gpt-5.6-sol)</td><td>Graph tool</td><td>109,662</td><td>9.6</td><td>0.410</td></tr>
            </tbody></table></div>
            <p>Cross-agent absolute totals are <strong>not comparable</strong> — the two harnesses use different tokenizers and system-prompt floors (see each agent's calibration). Compare modes within an agent only.</p>
          </ProseSection>
          <ProseSection title="Reproduce It Yourself">
            <p>Every published number is reproducible from committed artifacts — verify before you cite:</p>
            <Bullets>
              <li><a className="text-link" href="https://github.com/aziron-ai/atlas/blob/main/data/site-data.json" target="_blank" rel="noreferrer">Processed site data (site-data.json)</a></li>
              <li><a className="text-link" href="https://github.com/aziron-ai/atlas/tree/main/data/raw" target="_blank" rel="noreferrer">Raw benchmark artifacts (data/raw)</a></li>
              <li><a className="text-link" href="https://github.com/aziron-ai/atlas/tree/main/data" target="_blank" rel="noreferrer">Evidence manifests</a></li>
              <li><a className="text-link" href="https://github.com/aziron-ai/atlas/tree/main/agent-bench" target="_blank" rel="noreferrer">Agent benchmark kit (agent-bench/)</a></li>
            </Bullets>
            <p>The agent suite ships with the pinned commit, frozen gopls question set, and isolation flags baked in:</p>
            <Command>{`python3 agent-bench/agent_token_bench.py \\\n  --setup \\\n  --agents auto \\\n  --qa-set agent-bench/QA_SET_logrus.json \\\n  --workdir agentbench-work`}</Command>
            <p>Read <a className="text-link" href="https://github.com/aziron-ai/atlas/blob/main/agent-bench/README.md" target="_blank" rel="noreferrer">agent-bench/README.md</a> for prerequisites, expected external cost, pinned inputs, and interpretation. Per-run records are in <a className="text-link" href="https://atlas.aziro.com/data/raw/AGENT_TOKEN_BENCH_PUBLIC.json" target="_blank" rel="noreferrer">AGENT_TOKEN_BENCH_PUBLIC.json</a>.</p>
          </ProseSection>
          <ProseSection title="Important Limitations">
            <Bullets>
              <li>Fixture results do not prove production-repository accuracy.</li>
              <li>One repository does not establish performance across a language.</li>
              <li>Different assistants may consume the same MCP result differently.</li>
              <li>Estimated tokens are not equivalent to provider-reported token usage.</li>
              <li>Warm-cache query latency is not cold-start installation or indexing time.</li>
              <li>Language support and result quality can differ by syntax and framework.</li>
            </Bullets>
            <p>Per-language support levels behind these results are summarized in <a className="text-link" href="#docs/languages">Supported Languages and Formats</a>.</p>
          </ProseSection>
          <ProseSection title="Reporting a Comparison">
            <p>If you publish your own comparison, include everything a reader needs to reproduce it:</p>
            <Bullets>
              <li>exact commands</li>
              <li>raw machine-readable output</li>
              <li>all failed and timed-out cases</li>
              <li>environment metadata</li>
              <li>evidence limitations</li>
              <li>the Atlas release tag and checksum</li>
            </Bullets>
            <p>Benchmark results are dated measurements under published conditions — not a guarantee for every repository, machine, language, or assistant.</p>
          </ProseSection>
        </>
      );
    case "troubleshooting":
      return (
        <>
          <p className="docs-lead">Most Atlas failures are diagnosable from three read-only commands. Capture the evidence first, then act.</p>
          <ProseSection title="First Response">
            <p>Before changing any local data, record the facts you will need to diagnose or report the problem: the repository path, the database path, the Atlas version, and the exact failing command. Then run:</p>
            <Command>{`atlas version\natlas status\natlas doctor`}</Command>
            <p>All three are read-only. If you skip this step and start deleting or rebuilding, you destroy the evidence that distinguishes a schema problem from a stale index from a wedged retrieval sidecar.</p>
          </ProseSection>
          <ProseSection title="Symptom to Action">
            <p>Match your symptom, apply the action, and re-run the failing command. Details for the harder cases follow the table.</p>
            <div className="docs-table-wrap"><table><thead><tr><th>Symptom</th><th>Action</th></tr></thead><tbody>
              <tr><td><code>atlas: command not found</code></td><td>Check <code>command -v atlas</code> and <code>$PATH</code>; reinstall via your channel — <code>brew reinstall --cask aziron-ai/atlas/atlas</code> or <code>npm install -g @aziron/atlas</code> (verify <code>npm prefix -g</code> is on PATH)</td></tr>
              <tr><td>Results are stale or from the wrong repository</td><td><code>atlas index .</code> then <code>atlas status</code>; pin scope with <code>atlas --repo /absolute/path status</code>; if still stale, <code>atlas doctor</code> then <code>atlas index . --reindex</code></td></tr>
              <tr><td><code>workspace_required</code> from MCP</td><td>Supply a workspace root, <code>workspace</code>, <code>repo_id</code>, or launch-time <code>--repo</code>. Atlas does not silently select a repository for scoped requests</td></tr>
              <tr><td>SQLite is busy or locked</td><td>Stop <code>atlas serve</code>, <code>atlas watch</code>, and supervised MCP processes; inspect the owner with <code>lsof "$PWD/.atlas/atlas.db"</code>; run maintenance serially after all writers exit</td></tr>
              <tr><td>Retrieval reports <code>sql_fallback</code></td><td>The lexical (BM25) sidecar is empty or wedged while the graph stays readable. Run <code>atlas doctor</code> to confirm, stop other Atlas processes, then <code>atlas compact --rebuild-lexical</code> and re-check with <code>atlas doctor</code></td></tr>
              <tr><td><code>index</code> warns <code>lexical sidecar unavailable, indexing without it</code></td><td>A warning, not a failure — the graph indexed fine. Another Atlas process held the sidecar lock (~2s timeout). It self-heals via lazy backfill; or stop other Atlas processes and run <code>atlas compact --rebuild-lexical</code>. See <strong>The lexical sidecar</strong> below</td></tr>
              <tr><td><code>index</code> warns <code>lexical segment-version probe failed (…) — opening anyway</code></td><td>Two Atlas processes raced to <em>write</em> the sidecar (e.g. a manual reindex beside a running <code>serve</code>/<code>watch</code>). One-off and self-healing like the row above; if it recurs constantly, quiesce the extra writer, then <code>atlas compact --rebuild-lexical</code></td></tr>
              <tr><td>Writes fail with <code>database disk image is malformed (11)</code> after reads looked healthy</td><td>On-disk corruption that lazy reads silently tolerated. <code>atlas doctor --deep</code> (v0.1.43+) runs the page-level scan (<code>PRAGMA quick_check</code>) and names the damaged pages before a write trips over them. Restore <code>.atlas</code> from a backup, or delete it and reindex</td></tr>
              <tr><td>Assistant does not list Atlas tools</td><td><code>atlas bootstrap --dry-run</code> to preview, <code>atlas doctor --verify atlas</code> to check binary drift; apply <code>atlas bootstrap</code>, then fully restart the assistant</td></tr>
              <tr><td>Doctor or status reports schema/index drift</td><td><code>atlas migrate</code> applies storage migrations and reports the active contracts; confirm with <code>atlas status --schema</code>, then <code>atlas index . --reindex</code> if snapshot formats have drifted</td></tr>
              <tr><td>Database keeps growing after deletions or reindexes</td><td><code>atlas compact</code> reports reclaimable pages and truncates the WAL; <code>atlas compact --full</code> also runs a full VACUUM and rebuilds an oversized lexical sidecar. Both <code>--full</code> and <code>--rebuild-lexical</code> are exclusive — quiesce other Atlas processes first</td></tr>
              <tr><td>Semantic search falls back to lexical</td><td>Expected when vectors are absent: reindex with <code>atlas index . --enable-vectors</code> and verify configuration with <code>atlas config list</code></td></tr>
            </tbody></table></div>
            <p>Other known cases, kept brief:</p>
            <Bullets>
              <li><strong>npm binary download fails:</strong> confirm the version exists on <a className="text-link" href="https://github.com/aziron-ai/atlas/releases" target="_blank" rel="noreferrer">GitHub Releases</a>, check proxy and GitHub access, and pin a published version.</li>
              <li><strong>macOS blocks a manual binary:</strong> prefer the Homebrew cask; for a trusted, checksum-verified binary run <code>xattr -dr com.apple.quarantine /usr/local/bin/atlas</code>.</li>
              <li><strong>MCP list is fast but calls are slow:</strong> an index or exclusive maintenance task may be running — check <code>atlas status</code> and <code>atlas doctor</code>; disable duplicate watchers; adjust <code>ATLAS_MCP_CALL_TIMEOUT</code> only after confirming the root cause.</li>
              <li><strong>HTTP 401 or 403:</strong> send <code>Authorization: Bearer $ATLAS_API_TOKEN</code>; for browser clients also configure <code>ATLAS_MCP_ALLOWED_ORIGINS</code>.</li>
              <li><strong>Port 3099 in use:</strong> find the owner with <code>lsof -nP -iTCP:3099 -sTCP:LISTEN</code>; stop it or choose another address (see <code>atlas serve --help</code>).</li>
              <li><strong><code>healthz</code> passes but <code>readyz</code> fails:</strong> Atlas is running but cannot complete a lightweight engine request — look for an active index, database lock, or maintenance operation.</li>
            </Bullets>
          </ProseSection>
          <ProseSection title="The lexical sidecar (and the SQL fallback)">
            <p>Atlas keeps two things under <code>.atlas/</code>. The <strong>graph database</strong> (<code>atlas.db</code>, SQLite) holds symbols, callers, references, routes, and change impact. A separate <strong>lexical sidecar</strong> (<code>.atlas/lexical/</code>, a Bleve BM25 index) powers fast text search. Graph queries never need the sidecar — only text and keyword search does.</p>
            <p>During <code>atlas index</code> you may see this line on stderr. It is a <strong>warning, not a failure</strong> — the graph index still built:</p>
            <Command label="stderr">{`atlas: index <repo>: lexical sidecar unavailable, indexing without it (lazy backfill will heal): <reason>`}</Command>
            <Bullets>
              <li><strong>Why it happens:</strong> another Atlas process — a running <code>atlas serve</code>, <code>atlas watch</code>, or a supervised/stale MCP session — holds the sidecar's exclusive lock. Atlas waits about two seconds for it (a bounded lock timeout), then indexes <em>without</em> the sidecar rather than failing the whole run. The usual trigger is running <code>atlas index</code> by hand while a server is already watching the same repo.</li>
              <li><strong>What it means:</strong> until the sidecar is populated, text search answers from a SQL scan instead of BM25. Those results are honestly labelled — <code>degraded: true</code> and <code>retrieval_mode: sql_fallback</code> — and are correct but slower and lower quality. Symbol, caller, ref, route, and impact queries are unaffected.</li>
              <li><strong>It heals on its own:</strong> in serve/watch mode a lazy backfill rebuilds the sidecar once the lock frees. To fix it now, stop the other Atlas processes and run <code>atlas compact --rebuild-lexical</code>, then confirm with <code>atlas doctor</code>.</li>
              <li><strong>To avoid it:</strong> don't run a manual <code>atlas index</code> while <code>serve</code>/<code>watch</code>/an MCP session holds the same <code>.atlas</code> — stop them first, or let the running server's watch pick up the change.</li>
            </Bullets>
            <Callout kind="tip" label="why status looked clean but doctor caught it">
              <p><code>atlas status</code> reports <strong>version and contract health only</strong> — schema, index-format, lexical, and MCP contract versions plus per-repo snapshot format. It never opens the sidecar, so a wedged or empty sidecar leaves <code>status</code> green. <code>atlas doctor</code> checks <strong>runtime health</strong>, opens the sidecar, and reports <code>lexical_degraded</code> when it is empty or wedged. That split is by design: if search behaves oddly but <code>status</code> is clean, run <code>atlas doctor</code>.</p>
            </Callout>
          </ProseSection>
          <ProseSection title="Read the Diagnosis">
            <p>Knowing what each diagnostic actually reports keeps you from applying the wrong fix.</p>
            <Bullets>
              <li><strong><code>atlas doctor</code></strong> reports Atlas upgrade health and the schema/index contract state. It also tells you when the lexical sidecar needs <code>atlas compact --rebuild-lexical</code> — the condition that otherwise degrades every search to SQL-only silently. It also reports <code>mcp_registrations</code> health — flagging assistant MCP configs that launch a nonexistent binary (broken now) or a version-pinned path that breaks on the next upgrade, with <code>atlas bootstrap</code> as the one-line fix. Add <code>--verify atlas</code> to check binary drift: whether the <code>atlas</code> on PATH (what assistants launch) matches the running binary. Add <code>--deep</code> to run a page-level integrity scan (<code>PRAGMA quick_check</code>) that catches on-disk corruption reads silently tolerate. Add <code>--all --root DIR</code> to scan every <code>.atlas/atlas.db</code> under a directory.</li>
              <li><strong><code>atlas status</code></strong> reports storage/version health: the schema and index-format contracts plus per-repo snapshot format state. Add <code>--schema</code> to see the schema/index-format/lexical/MCP contract versions and per-repo snapshot format drift.</li>
              <li><strong><code>atlas migrate</code></strong> is the corresponding fix for schema findings: it applies storage migrations and reports the active contracts. <code>--all --root DIR</code> migrates every local SQLite database under a directory.</li>
            </Bullets>
          </ProseSection>
          <ProseSection title="Logs and Telemetry">
            <p>When you need runtime evidence rather than a health verdict, look here:</p>
            <Bullets>
              <li><strong><code>atlas stats</code></strong> shows graph and index telemetry statistics for an indexed repository; <code>--limit</code> controls how many recent snapshot telemetry rows are returned (default 20).</li>
              <li><strong>Observability database:</strong> telemetry is stored in <code>telemetry.db</code> beside the graph database by default; relocate it with <code>--telemetry-db PATH</code>. With <code>--read-only</code>, no <code>telemetry.db</code> is created unless you pass <code>--telemetry-db</code> explicitly.</li>
              <li><strong><code>atlas sync status</code></strong> (connected fleets only) shows uplink configuration, kill switches, and per-stream cursors.</li>
            </Bullets>
          </ProseSection>
          <ProseSection title="Before Deleting Data">
            <Callout kind="warn" label="Destructive-data checkpoint">
              <p>Deleting <code>.atlas/</code> is irreversible and is almost never the right first move. Complete every step below before removing anything.</p>
            </Callout>
            <ol className="docs-list numbered">
              <li>Stop every Atlas process.</li>
              <li>Confirm the exact database and repository paths.</li>
              <li>Back up the full <code>.atlas/</code> directory.</li>
              <li>Run <code>atlas doctor</code>.</li>
              <li>Attempt migration, lexical rebuild, or reindex first.</li>
            </ol>
            <p>Delete local Atlas data only when a complete reset is intended. For the removal procedure itself, see <a className="text-link" href="#docs/upgrade">Upgrade and Uninstall</a>. For index behavior and reindex options, see <a className="text-link" href="#docs/indexing">Indexing and Reindexing</a>; for assistant wiring, see <a className="text-link" href="#docs/assistants">AI Assistant Setup</a>; for knob provenance, see <a className="text-link" href="#docs/configuration">Configuration</a>.</p>
          </ProseSection>
        </>
      );
    case "upgrade":
      return (
        <>
          <p className="docs-lead">Upgrade the binary through the channel you installed with, then run the post-upgrade sequence — the binary and the on-disk data have separate version contracts, and skipping the sequence is the most common source of post-upgrade drift.</p>
          <ProseSection title="Upgrade per Channel">
            <p>Use the same channel you installed from (see <a className="text-link" href="#docs/installation">Installation</a>).</p>
            <p>Homebrew:</p>
            <Command>{`brew update\nbrew upgrade --cask aziron-ai/atlas/atlas\natlas version`}</Command>
            <p>npm:</p>
            <Command>{`npm install -g @aziron/atlas\natlas version`}</Command>
            <p>Pin a version for reproducible automation:</p>
            <Command>{`npm install -g @aziron/atlas@${RELEASE}`}</Command>
            <p>For GitHub Packages, use <code>{`@aziron-ai/atlas@${RELEASE}`}</code> with the existing registry authentication.</p>
            <p>Archives: download the new tar.gz, .deb, .rpm, or .apk from <a className="text-link" href="https://github.com/aziron-ai/atlas/releases/latest" target="_blank" rel="noreferrer">GitHub Releases</a>, replace the installed binary, and confirm with <code>atlas version</code>.</p>
          </ProseSection>
          <ProseSection title="Post-Upgrade Sequence">
            <p>Run these four commands after every upgrade. Each one closes a specific gap that a binary swap leaves open:</p>
            <Command>{`atlas bootstrap\natlas migrate\natlas status --schema\natlas doctor --verify atlas`}</Command>
            <Bullets>
              <li><strong><code>atlas bootstrap</code></strong> refreshes the assistant glue: it re-registers Atlas as an MCP server and reinstalls the skill and CLAUDE.md directive for detected assistants, baking in the absolute binary path. It is idempotent — safe to run repeatedly.</li>
              <li><strong><code>atlas migrate</code></strong> applies Atlas storage migrations to the database and reports the active contracts. Use <code>--all --root DIR</code> to migrate every <code>.atlas/atlas.db</code> under a directory.</li>
              <li><strong><code>atlas status --schema</code></strong> reports the schema/index-format/lexical/MCP contract versions and per-repo snapshot format drift, so you can see whether existing snapshots match what the new binary expects.</li>
              <li><strong><code>atlas doctor --verify atlas</code></strong> reports upgrade health and the schema/index contract state, and additionally checks binary drift — whether the <code>atlas</code> on PATH (what assistants launch via <code>command:"atlas"</code>) matches the binary you just upgraded.</li>
            </Bullets>
          </ProseSection>
          <ProseSection title="Reading Doctor Output After an Upgrade">
            <p>Act on what doctor reports rather than rebuilding preemptively. A clean report means the upgrade is complete. If doctor or status flags schema or index contract drift, run <code>atlas migrate</code> and re-check. If doctor reports the lexical sidecar needs rebuilding, use <code>atlas compact --rebuild-lexical</code> (see <a className="text-link" href="#docs/troubleshooting">Troubleshooting</a>). Run a full rebuild only when status, doctor, or the release notes require it:</p>
            <Command>{`atlas index . --reindex`}</Command>
          </ProseSection>
          <ProseSection title="Before Downgrading">
            <p>Back up the full <code>.atlas/</code> directory first. Do not assume an older binary can open a database already migrated by a newer release. Use a separate database (<code>--db</code>) for downgrade testing when possible.</p>
          </ProseSection>
          <ProseSection title="Uninstall">
            <p>Remove Atlas in this order: assistant integrations first, then the package, then (only if intended) local data.</p>
            <p><strong>1. Remove assistant integrations.</strong> <code>atlas uninstall</code> reverses <code>atlas bootstrap</code> across every assistant it provisions (Claude CLI and desktop, Cursor, Gemini, Codex, Copilot): it removes the atlas MCP server entry from each config, the atlas skill markdown, and the atlas-managed block in the global CLAUDE.md. Nothing else is touched — other MCP servers, unrelated config keys, and your own CLAUDE.md content outside the atlas markers are preserved. It is idempotent: re-running reports <code>absent</code> and writes nothing.</p>
            <Command>{`atlas uninstall --dry-run\natlas uninstall`}</Command>
            <p>If this machine is connected to a central Atlas server, also disconnect — <code>atlas disconnect</code> disconnects from the central Atlas and removes the capture hooks:</p>
            <Command>{`atlas disconnect`}</Command>
            <p><strong>2. Remove the package.</strong></p>
            <Command>{`brew uninstall --cask aziron-ai/atlas/atlas   # Homebrew\nnpm uninstall -g @aziron/atlas                # public npm\nnpm uninstall -g @aziron-ai/atlas             # GitHub Packages\nsudo rm /usr/local/bin/atlas                  # manual binary`}</Command>
            <p><strong>3. Remove local data — read first.</strong></p>
            <Callout kind="warn" label="Local data survives the package">
              <p>Package removal does not delete repository indexes. Every indexed repository keeps its <code>.atlas/</code> directory — index, settings, retrieval data, telemetry, and retained snapshots — until you remove it. Stop all Atlas processes and confirm the exact paths before deleting; removal is permanent.</p>
            </Callout>
            <p><code>atlas uninstall --purge</code> removes the <code>.atlas</code> index directories for you — the global <code>~/.atlas</code> and every registry-known repo’s <code>.atlas</code> — printing the blast radius and total reclaimed space first, and requiring confirmation (<code>--yes</code> to skip it, <code>--dry-run</code> to preview). To remove them by hand instead, per repository, after stopping all Atlas processes and verifying the path:</p>
            <Command>{`rm -rf /absolute/path/to/repository/.atlas`}</Command>
            <p>User-level data, only when all user-level Atlas data and installed Atlas skills should go:</p>
            <Command>{`rm -rf "$HOME/.atlas"`}</Command>
          </ProseSection>
          <ProseSection title="Verify Removal">
            <Command>{`command -v atlas || true`}</Command>
            <p>Also inspect the assistant configuration locations listed in <a className="text-link" href="#docs/assistants">AI Assistant Setup</a> if a client was configured manually.</p>
          </ProseSection>
        </>
      );
    default:
      return (
        <>
          <p className="docs-lead">This guide takes a repository from unindexed to queryable: build the local index, verify it is healthy, run the core queries, and connect an AI assistant. Atlas is local-first — everything below runs on your machine against an embedded database, with no server or account required. For the mental model behind these commands, see <a className="text-link" href="#docs/concepts">Core Concepts</a>.</p>
          <ProseSection title="1. Check Prerequisites">
            <p>Confirm the binary is installed and on <code>PATH</code> before anything else, because assistants and scripts resolve <code>atlas</code> from <code>PATH</code> too.</p>
            <Command>{`command -v atlas\natlas version`}</Command>
            <p>If either command fails, follow <a className="text-link" href="#docs/installation">Installation</a> first. You also need a local checkout of the repository you want to index; a git repository is required for commit-pinned indexing (<code>--ref</code>) and the per-commit snapshot history.</p>
          </ProseSection>
          <ProseSection title="2. Index a Repository">
            <p>Indexing builds everything Atlas knows about a repository: it parses symbols, call edges, and routes, and persists the <strong>knowledge graph</strong> plus a lexical search index.</p>
            <Command>{`cd /path/to/repository\natlas index .`}</Command>
            <p>Progress is printed to stderr while the run reports discovery and completion stats. Results are stored in an embedded SQLite database in the repository: <code>.atlas/atlas.db</code></p>
            <p>By default the indexer skips paths git ignores (build output, caches, vendored runtimes); pass <code>--gitignore=false</code> to index everything. The first run parses the whole repository; later runs are incremental deltas. Use <code>--reindex</code> to force a full rebuild, and <code>--ref</code> to index a specific commit or branch instead of the working tree. See <a className="text-link" href="#docs/indexing">Indexing and Reindexing</a> for exclusions, watch mode, and the optional embedding pass (<code>--enable-vectors</code>).</p>
          </ProseSection>
          <ProseSection title="3. Confirm Readiness">
            <p>Verify the index before relying on query results, so an empty or drifted database does not silently return nothing.</p>
            <Command>{`atlas status\natlas stats`}</Command>
            <p><code>atlas status</code> reports storage and version health: the schema and index-format contracts and the per-repo snapshot format state. <code>atlas stats</code> reports graph and index telemetry for the indexed repository. Look for your repository identity, a current snapshot, and non-zero symbol and edge counts. Zero counts or a missing repository mean the index did not build — see <a className="text-link" href="#docs/troubleshooting">Troubleshooting</a>.</p>
          </ProseSection>
          <ProseSection title="4. Run the First Queries">
            <p>Each query answers a different question; pick the one that matches what you already know.</p>
            <p>Use <code>search</code> when you know words or phrases but not exact names — it is code-aware lexical search (BM25 + trigram) over the symbol index:</p>
            <Command>{`atlas search "authentication middleware" --format plain`}</Command>
            <p>Use <code>symbol</code> when you know a name and want its definition(s) together with its callers and callees:</p>
            <Command>{`atlas symbol NewServer`}</Command>
            <p>Use <code>callers</code> before changing a function's behavior or signature, to see exactly which symbols call it directly:</p>
            <Command>{`atlas callers NewServer --limit 25`}</Command>
            <p>Use <code>refs</code> when a rename or type change is on the table — it lists call sites plus type-use references (params, fields, returns):</p>
            <Command>{`atlas refs NewServer`}</Command>
            <p>Use <code>context</code> when reviewing a change — it builds a bounded review-context bundle (16–32 KiB with the default <code>auto</code> intent) around the changed files:</p>
            <Command>{`atlas context \\\n  --paths path/to/changed-file.go \\\n  --query "review correctness and regression risk" \\\n  --format json`}</Command>
            <p>For the blast radius of a change — impacted symbols, files, and covering tests — use <code>impact</code>:</p>
            <Command>{`atlas impact --paths path/to/changed-file.go`}</Command>
            <p>Run <code>atlas &lt;command&gt; --help</code> for the full flag list of your installed version, or see the <a className="text-link" href="#docs/cli">CLI Reference</a>.</p>
          </ProseSection>
          <ProseSection title="5. Connect an AI Assistant">
            <p>Bootstrap registers Atlas as an MCP server and installs the atlas-first skill and CLAUDE.md directive for every detected assistant (Claude desktop and CLI, Codex, Copilot, Cursor, Gemini), so assistants query the graph instead of grepping. Preview what would be written first:</p>
            <Command>{`atlas bootstrap --dry-run`}</Command>
            <p>Then apply it:</p>
            <Command>{`atlas bootstrap`}</Command>
            <p>Bootstrap is idempotent — safe to run repeatedly. Use <code>--only</code> or <code>--skip</code> (comma-separated agent lists) to limit which assistants are provisioned. Restart the assistant after configuration changes, and run <code>atlas doctor --verify atlas</code> to confirm the <code>atlas</code> on <code>PATH</code> — what assistants launch — matches the binary you installed. See <a className="text-link" href="#docs/mcp">MCP Tools</a> for the tool surface assistants receive.</p>
          </ProseSection>
          <ProseSection title="6. Keep the Index Fresh">
            <p>Query results are only as current as the last index run. After meaningful changes, run an incremental update:</p>
            <Command>{`atlas index .`}</Command>
            <p>For a foreground process that re-indexes on every file change (edits within 250 ms are coalesced into one update):</p>
            <Command>{`atlas watch`}</Command>
            <p>Reserve <code>atlas index . --reindex</code> for format changes or recovery, per <a className="text-link" href="#docs/indexing">Indexing and Reindexing</a>.</p>
          </ProseSection>
          <ProseSection title="Where to Go Next">
            <Bullets>
              <li><a className="text-link" href="#docs/concepts">Core Concepts</a> — the graph, snapshots, workspaces, and output control that every command shares.</li>
              <li><a className="text-link" href="#docs/cli">CLI Reference</a> — every command and flag.</li>
              <li><a className="text-link" href="#docs/mcp">MCP Tools</a> — what assistants can call after bootstrap.</li>
              <li><a className="text-link" href="#docs/configuration">Configuration</a> — knob precedence and <code>atlas config</code>.</li>
              <li><a className="text-link" href="#docs/troubleshooting">Troubleshooting</a> — empty results, drift, and recovery.</li>
            </Bullets>
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
