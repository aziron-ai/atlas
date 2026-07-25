import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { ArrowRight, Check, Copy, Download, ExternalLink } from "lucide-react";
import GraphExplorer from "./GraphExplorer";
import AtlasConsole from "./AtlasConsole";
import {
  CommandPalette,
  CountUp,
  Documentation,
  ProductHeader,
  ProductHome,
  useReveal,
  useSiteRoute,
} from "./ProductDocs";

/* ============================================================
   Atlas — Benchmark & Field Comparison
   Top-to-bottom redesign. One payload (data/site-data.json), two
   labeled evidence tiers: the July-2026 report is the citation,
   the Linux re-run corroborates it. No chart CDN — inline SVG.
   ============================================================ */

const fmt = new Intl.NumberFormat("en-US");

function cn(...c) {
  return c.filter(Boolean).join(" ");
}
function num(v) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "—";
  return fmt.format(v);
}
function f1fmt(v) {
  if (v === null || v === undefined) return "—";
  return Number(v).toFixed(3);
}
function langLabel(v) {
  const m = {
    cpp: "C++", javascript: "JavaScript", typescript: "TypeScript", objc: "Objective-C",
    csharp: "C#", ejs: "EJS", ets: "ETS", sql: "SQL", php: "PHP", r: "R", c: "C",
    powershell: "PowerShell", p4: "P4", byond: "BYOND",
  };
  if (m[v]) return m[v];
  if (!v) return "unknown";
  return String(v).replace(/\b\w/g, (c) => c.toUpperCase());
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const fn = (e) => setReduced(e.matches);
    mq.addEventListener?.("change", fn);
    return () => mq.removeEventListener?.("change", fn);
  }, []);
  return reduced;
}

/* ======================= shared primitives ============================== */

function CopyButton({ text, label = "copy" }) {
  const [copied, setCopied] = useState(false);
  const tRef = useRef(0);
  const onCopy = useCallback(() => {
    const done = () => {
      setCopied(true);
      window.clearTimeout(tRef.current);
      tRef.current = window.setTimeout(() => setCopied(false), 1400);
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(done);
      } else done();
    } catch {
      done();
    }
  }, [text]);
  useEffect(() => () => window.clearTimeout(tRef.current), []);
  return (
    <button
      type="button"
      data-testid="copy-button"
      onClick={onCopy}
      aria-label={copied ? "Copied" : `Copy ${label}`}
      className="focusring mono inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold transition"
      style={{
        border: "1px solid var(--line-strong)",
        background: "var(--surface-raised)",
        color: copied ? "var(--primary)" : "var(--muted)",
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
      {copied ? "copied ✓" : "copy"}
    </button>
  );
}

function SectionHeader({ kicker, title, children, actions, id }) {
  return (
    <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl">
        {kicker && <div className="kicker" style={{ color: "var(--primary)" }}>{kicker}</div>}
        <h2
          id={id}
          className="mt-3 text-balance font-semibold tracking-tight"
          style={{ fontSize: "clamp(22px,3vw,30px)", lineHeight: 1.1, letterSpacing: "-0.015em" }}
        >
          {title}
        </h2>
        {children && (
          <p className="mt-3" style={{ fontSize: 15, lineHeight: 1.6, color: "var(--muted)" }}>
            {children}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2 md:justify-end">{actions}</div>}
    </div>
  );
}

const EVIDENCE_COLORS = {
  "fixture-truth": "var(--primary)",
  "LSP-truth": "var(--secondary)",
  "perf-only": "var(--warning)",
  "agent-harness": "var(--g2)",
};
const EVIDENCE_LABELS = {
  "fixture-truth": "native",
};
function EvidenceTag({ kind, children }) {
  const color = EVIDENCE_COLORS[kind] || "var(--muted)";
  const label = children || EVIDENCE_LABELS[kind] || kind;
  return (
    <span className="chip" style={{ borderColor: color, color }} title={label}>
      {label}
    </span>
  );
}

/* A fresh-run corroboration chip — visually distinct (dashed) from the
   canonical report numbers so the two evidence tiers never blur. */
function FreshChip({ children, title }) {
  return (
    <span
      className="chip"
      title={title || "Linux corroboration run — deterministic re-run on independent hardware"}
      style={{ borderStyle: "dashed", borderColor: "var(--primary-dim)", color: "var(--primary)" }}
    >
      <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--primary)", display: "inline-block" }} />
      {children}
    </span>
  );
}

function StatBig({ value, label, sub, accent }) {
  return (
    <div className="min-w-0">
      <div className="num" style={{ fontSize: "clamp(26px,3vw,34px)", fontWeight: 600, color: accent || "var(--text)", lineHeight: 1 }}>
        {value}
      </div>
      <div className="kicker mt-2">{label}</div>
      {sub && <div className="mt-1" style={{ fontSize: 12, color: "var(--faint)" }}>{sub}</div>}
    </div>
  );
}

function TermBlock({ lines }) {
  const text = lines.join("\n");
  return (
    <div className="term">
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: "1px solid var(--line)", background: "var(--surface)" }}>
        <span className="mono" style={{ fontSize: 11, color: "var(--faint)" }}>zsh</span>
        <CopyButton text={text} label="command" />
      </div>
      <div className="term-body">
        {lines.map((l, i) => (
          <div key={i}>
            <span className="term-prompt">$ </span>
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}

/* =========================== console bar ================================ */

const NAV_ITEMS = [
  ["Frontier", "hero"],
  ["Knob", "knob"],
  ["Languages", "languages"],
  ["Versus", "versus"],
  ["Field", "field"],
  ["Proof", "real"],
  ["Agents", "agents"],
  ["Evidence", "evidence"],
];

// Secondary in-page navigation for the long benchmark report. The primary
// site nav (Overview / Documentation / Benchmarks / Data) is provided by the
// shared <ProductHeader>, which stays consistent across every view — this
// strip only jumps between sections of the benchmark page and sits beneath it.
function ConsoleBar({ active }) {
  return (
    <nav
      data-testid="benchmark-subnav"
      className="sticky z-30"
      style={{
        top: 64,
        background: "var(--header-bg)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--line)",
      }}
      aria-label="Benchmark sections"
    >
      <div className="shell flex h-11 items-center gap-1 overflow-x-auto">
        <span className="kicker hidden shrink-0 pr-2 sm:inline" style={{ color: "var(--faint)" }}>
          Sections
        </span>
        {NAV_ITEMS.map(([label, anchor]) => (
          <a
            key={anchor}
            className="navlink focusring shrink-0"
            href={`#${anchor}`}
            data-active={active === anchor}
          >
            {label}
          </a>
        ))}
      </div>
    </nav>
  );
}

/* ===================== hero — the efficiency frontier =================== */

function FrontierChart({ frontier }) {
  const W = 580, H = 396;
  const L = 52, R = 570, T = 20, B = 350;
  const x = (tok) => L + (tok / 300) * (R - L);
  const y = (f1) => B - f1 * (B - T);
  const xTicks = [0, 50, 100, 150, 200, 250, 300];
  const yTicks = [0, 0.25, 0.5, 0.75, 1.0];
  const P = Object.fromEntries(frontier.map((p) => [p.id, { ...p, px: x(p.tokens), py: y(p.f1) }]));
  const color = (p) => (p.kind === "atlas" ? "var(--primary)" : p.kind === "rival" ? "var(--danger)" : "var(--muted)");

  // per-point label anchoring, hand-placed so nothing collides at any width
  const labels = [
    { id: "atlas-low", dx: 12, dy: -22, anchor: "start" },
    { id: "atlas-medium", dx: 14, dy: 26, anchor: "start" },
    { id: "atlas-high", dx: 24, dy: -18, anchor: "start" },
    { id: "atlas-xhigh", dx: -13, dy: -22, anchor: "end" },
    { id: "graphify", dx: 12, dy: 4, anchor: "start" },
    { id: "raw-file", dx: 12, dy: 18, anchor: "start" },
  ];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label="Efficiency frontier: answer accuracy (F1) versus context tokens for six context sources. Atlas high sits in the ideal top-left quadrant at F1 0.757 and 21 tokens."
      style={{ display: "block" }}
    >
      {/* ideal quadrant — a soft corner glow, not a box: hard edges read as a
          rendering glitch and a fixed-width border clips the label on wider
          font stacks */}
      <defs>
        <radialGradient id="idealGlow" cx="0" cy="0" r="1">
          <stop offset="0" stopColor="rgba(37,99,235,0.11)" />
          <stop offset="1" stopColor="rgba(37,99,235,0)" />
        </radialGradient>
      </defs>
      <rect x={L} y={T} width={x(120) - L} height={y(0.55) - T} fill="url(#idealGlow)" />
      <text x={L + 10} y={T + 16} className="mono" fontSize="10" fontWeight="700" fill="var(--primary)" letterSpacing="0.14em">
        IDEAL
      </text>
      <text x={L + 10} y={T + 30} className="mono" fontSize="9.5" fill="var(--primary-dim)">
        accurate & cheap
      </text>

      {/* grid + axes */}
      {yTicks.map((t) => (
        <g key={`y${t}`}>
          <line x1={L} x2={R} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth="1" />
          <text x={L - 8} y={y(t) + 4} textAnchor="end" className="mono" fontSize="10" fill="var(--faint)">
            {t.toFixed(2)}
          </text>
        </g>
      ))}
      {xTicks.map((t) => (
        <text key={`x${t}`} x={x(t)} y={B + 20} textAnchor="middle" className="mono" fontSize="10" fill="var(--faint)">
          {t}
        </text>
      ))}
      <line x1={L} x2={R} y1={B} y2={B} stroke="var(--line-strong)" strokeWidth="1" />
      <line x1={L} x2={L} y1={T} y2={B} stroke="var(--line-strong)" strokeWidth="1" />
      <text x={(L + R) / 2} y={H - 6} textAnchor="middle" className="mono" fontSize="10.5" fill="var(--muted)" letterSpacing="0.1em">
        AVG CONTEXT TOKENS PER QUERY →
      </text>
      <text x={14} y={(T + B) / 2} textAnchor="middle" className="mono" fontSize="10.5" fill="var(--muted)" letterSpacing="0.1em" transform={`rotate(-90 14 ${(T + B) / 2})`}>
        ANSWER ACCURACY (F1) ↑
      </text>

      {/* high → xhigh: same accuracy, 13.6× the tokens */}
      <line x1={P["atlas-high"].px + 8} x2={P["atlas-xhigh"].px - 8} y1={P["atlas-high"].py} y2={P["atlas-xhigh"].py} stroke="var(--line-strong)" strokeDasharray="3 5" />
      <text x={(P["atlas-high"].px + P["atlas-xhigh"].px) / 2 + 20} y={P["atlas-high"].py + 16} textAnchor="middle" className="mono" fontSize="9.5" fill="var(--faint)">
        same F1 · 13.6× the tokens
      </text>

      {/* points */}
      {frontier.map((p) => {
        const pt = P[p.id];
        const lb = labels.find((l) => l.id === p.id);
        return (
          <g key={p.id}>
            {p.star && (
              <>
                <circle cx={pt.px} cy={pt.py} r={13} fill="none" stroke="var(--primary)" strokeOpacity="0.45" />
                <circle cx={pt.px} cy={pt.py} r={19} fill="none" stroke="var(--primary)" strokeOpacity="0.16" />
              </>
            )}
            <circle cx={pt.px} cy={pt.py} r={p.star ? 6.5 : 5} fill={color(p)} stroke="var(--bg)" strokeWidth="1.5" />
            <text
              x={pt.px + lb.dx}
              y={pt.py + lb.dy}
              textAnchor={lb.anchor}
              className="mono"
              fontSize={p.star ? 12 : 10.5}
              fontWeight={p.star ? 700 : 500}
              fill={p.star ? "var(--text)" : "var(--muted)"}
            >
              {p.label}
            </text>
            <text
              x={pt.px + lb.dx}
              y={pt.py + lb.dy + 13}
              textAnchor={lb.anchor}
              className="mono"
              fontSize="9.5"
              fill={p.star ? "var(--primary)" : "var(--faint)"}
            >
              {p.f1.toFixed(2)} F1 · {Math.round(p.tokens)} tok
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Hero({ data }) {
  const r = data.report;
  const f = data.fresh;
  const h = r.headline;
  return (
    <section id="hero" data-testid="hero" className="measure-grid" aria-labelledby="hero-title">
      <div className="shell pb-14 pt-14 lg:pb-20 lg:pt-20">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <div className="min-w-0">
            <div className="kicker" style={{ color: "var(--primary)" }}>
              Aziron Atlas · {r.label}
            </div>
            <h1
              id="hero-title"
              className="mt-4 text-balance font-semibold tracking-tight"
              style={{ fontSize: "clamp(30px,4.6vw,50px)", lineHeight: 1.05, letterSpacing: "-0.02em" }}
            >
              The most accurate code answer,
              <br />
              <span style={{ color: "var(--primary)" }}>for the fewest tokens.</span>
            </h1>
            <p className="mt-5 max-w-xl" style={{ fontSize: 16, lineHeight: 1.65, color: "var(--muted)" }}>
              When a coding agent asks <span className="mono" style={{ color: "var(--text)" }}>“who calls this function?”</span>,
              Atlas answers at F1 {h.atlasF1All} from just {h.atlasTokAll} context tokens — measured across 37 languages
              with a real LLM scoring every cell. The graph tool needed {Math.round(h.graphifyTok)} tokens to score {h.graphifyF1}.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-4">
              <StatBig value={<CountUp value={h.atlasF1All} decimals={3} />} label="Atlas F1 · all 37 langs" sub={`@ ${h.atlasTokAll} tokens`} accent="var(--primary)" />
              <StatBig value={<CountUp value={h.atlasF1Supported} decimals={3} />} label={`F1 · ${h.supportedLangs} supported`} sub={`@ ${h.atlasTokSupported} tokens`} />
              <StatBig value={<CountUp value={h.accPerToken} decimals={1} suffix="×" />} label="Accuracy per token" sub="vs. graph tool" />
              <StatBig value={<CountUp value={h.fewerTokens} suffix="×" />} label="Fewer query tokens" sub="for a better answer" />
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-2" data-testid="fresh-chips">
              <span className="mono" style={{ fontSize: 11, color: "var(--faint)", letterSpacing: "0.1em" }}>
                CORROBORATED —
              </span>
              <FreshChip>{f.saturation.perfect}/{f.saturation.total} langs fixture-perfect</FreshChip>
              <FreshChip>{f.latency.ratio}× faster queries</FreshChip>
              <FreshChip>gopls-truth F1 {f.lspTruth.meanF1.toFixed(3)}</FreshChip>
              <span className="mono hidden sm:inline" style={{ fontSize: 11, color: "var(--faint)" }}>
                Linux re-run, deterministic
              </span>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="#install" className="btn btn-primary focusring" style={{ textDecoration: "none" }}>
                Get Atlas <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
              <a href="#evidence" className="btn btn-ghost focusring" style={{ textDecoration: "none" }}>
                Inspect the evidence
              </a>
              <span className="mono" style={{ fontSize: 11.5, color: "var(--faint)" }}>
                {r.method.cells} cells · {r.method.modelCalls} model calls · scored by {r.method.scoringModel}
              </span>
            </div>
          </div>

          <div className="panel min-w-0 p-4 sm:p-5" data-testid="frontier">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="kicker">The efficiency frontier · 37 languages</div>
              <EvidenceTag kind="fixture-truth" />
            </div>
            <FrontierChart frontier={r.frontier} />
            <p className="mt-2" style={{ fontSize: 12, lineHeight: 1.55, color: "var(--faint)" }}>
              Every context source an agent could be handed, placed by accuracy against cost. Atlas high owns the ideal
              quadrant; xhigh proves more tokens buy nothing; the raw file is perfect but 7.4× the price.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ===================== executive summary ================================ */

function MiniPerTokenBars({ table }) {
  const rows = table.filter((r) => ["atlas high", "graph tool", "raw file (ceiling)"].includes(r.source));
  const max = Math.max(...rows.map((r) => r.per100));
  return (
    <div className="mt-4 flex flex-col gap-2.5">
      {rows.map((r) => (
        <div key={r.source} className="grid items-center gap-2" style={{ gridTemplateColumns: "86px 1fr 44px" }}>
          <span className="mono truncate" style={{ fontSize: 11, color: "var(--muted)" }}>
            {r.source.replace(" (ceiling)", "")}
          </span>
          <div className="h-2.5 rounded-full" style={{ background: "var(--bg2)" }}>
            <div
              className="h-2.5 rounded-full"
              style={{
                width: `${(r.per100 / max) * 100}%`,
                background: r.source === "atlas high" ? "var(--primary)" : r.source === "graph tool" ? "var(--danger)" : "var(--muted)",
                opacity: r.source === "atlas high" ? 1 : 0.75,
              }}
            />
          </div>
          <span className="num text-right" style={{ fontSize: 12 }}>{r.per100.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

function ExecSummary({ data }) {
  const r = data.report;
  const f = data.fresh;
  return (
    <section id="summary" data-testid="summary" className="shell py-16" aria-labelledby="summary-title">
      <SectionHeader id="summary-title" kicker="01 · Executive summary" title="What the numbers say">
        Agents pay for every context token, on every call, across the whole organization — so the real KPI is
        accuracy per token. Four results, each carrying its evidence class.
      </SectionHeader>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="panel min-w-0 p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="kicker">Accuracy per 100 tokens</div>
            <EvidenceTag kind="fixture-truth" />
          </div>
          <div className="num mt-3" style={{ fontSize: 30, fontWeight: 600, color: "var(--primary)" }}>6.4×</div>
          <p className="mt-1" style={{ fontSize: 13, lineHeight: 1.55, color: "var(--muted)" }}>
            Atlas high delivers 3.56 F1 per 100 tokens; the graph tool 0.56. Best answer, lowest cost.
          </p>
          <MiniPerTokenBars table={r.headlineTable} />
        </div>

        <div className="panel min-w-0 p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="kicker">Perfect & cheap where supported</div>
            <EvidenceTag kind="fixture-truth" />
          </div>
          <div className="num mt-3" style={{ fontSize: 30, fontWeight: 600 }}>F1 1.000</div>
          <p className="mt-1" style={{ fontSize: 13, lineHeight: 1.55, color: "var(--muted)" }}>
            On the {r.headline.supportedLangs} fully-parsed languages Atlas matches a full-file dump —
            at {r.headline.atlasTokSupported} tokens vs 165, 6.1× fewer. The graph tool tops out at 0.605 there.
          </p>
          <div className="mt-4">
            <FreshChip>fresh run: {f.saturation.perfect}/{f.saturation.total} languages perfect</FreshChip>
          </div>
        </div>

        <div className="panel min-w-0 p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="kicker">Holds on production code</div>
            <EvidenceTag kind="LSP-truth" />
          </div>
          <div className="num mt-3" style={{ fontSize: 30, fontWeight: 600 }}>0.975 <span style={{ fontSize: 15, color: "var(--danger)" }}>vs 0.084</span></div>
          <p className="mt-1" style={{ fontSize: 13, lineHeight: 1.55, color: "var(--muted)" }}>
            On {r.goFlagship.repo}, scored against gopls call-hierarchy truth, Atlas holds F1 0.975 while the
            graph tool and a raw dump collapse — a 12× gap on real fan-in.
          </p>
          <div className="mt-4">
            <FreshChip>re-run on a second Go service: {f.lspTruth.meanF1.toFixed(3)}</FreshChip>
          </div>
        </div>

        <div className="panel min-w-0 p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="kicker">Accuracy you can dial</div>
            <EvidenceTag kind="fixture-truth" />
          </div>
          <div className="num mt-3" style={{ fontSize: 30, fontWeight: 600 }}>1 knob</div>
          <p className="mt-1" style={{ fontSize: 13, lineHeight: 1.55, color: "var(--muted)" }}>
            A single <span className="mono">--detail</span> flag moves the budget from a 3-token stub to a 288-token
            dump. <span style={{ color: "var(--text)" }}>high</span> is the sweet spot — all the accuracy at 1/13th
            of the tokens.
          </p>
          <a href="#knob" className="link mt-4 inline-flex items-center gap-1" style={{ fontSize: 13 }}>
            See the knob <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </a>
        </div>
      </div>

      <div className="panel mt-4 flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--warning)", borderStyle: "dashed" }}>
        <p style={{ fontSize: 13, lineHeight: 1.55, color: "var(--muted)" }}>
          <span className="mono" style={{ color: "var(--warning)" }}>HONEST LIMITS — </span>
          at report time 9 of 37 languages had parser gaps. The saturation run has since fixed all 9 on
          native evidence; they carry a <span style={{ color: "var(--warning)" }}>“pending real-repo proof”</span> badge
          until a production-repo run lands.
        </p>
        <a href="#languages" className="link inline-flex shrink-0 items-center gap-1" style={{ fontSize: 13 }}>
          Maturity ladder <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </a>
      </div>
    </section>
  );
}

/* ========================= the detail knob ============================== */

function KnobChart({ levels }) {
  const W = 560, H = 330;
  const L = 46, R = 514, T = 30, B = 272;
  const plotW = R - L, plotH = B - T;
  const slot = (i) => L + (i + 0.5) * (plotW / levels.length);
  const yF1 = (v) => B - v * plotH;
  const yTok = (v) => B - (v / 300) * plotH;
  const barW = 52;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="The detail knob: F1 climbs from 0 at low to a plateau of 0.76 at high; token cost stays near 21 through high then jumps to 288 at xhigh." style={{ display: "block" }}>
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <g key={t}>
          <line x1={L} x2={R} y1={yF1(t)} y2={yF1(t)} stroke="var(--grid)" />
          <text x={L - 8} y={yF1(t) + 4} textAnchor="end" className="mono" fontSize="10" fill="var(--faint)">{t.toFixed(2)}</text>
        </g>
      ))}
      {[0, 100, 200, 300].map((t) => (
        <text key={t} x={R + 8} y={yTok(t) + 4} textAnchor="start" className="mono" fontSize="10" fill="rgba(217,119,6,0.72)">{t}</text>
      ))}
      <line x1={L} x2={R} y1={B} y2={B} stroke="var(--line-strong)" />

      {/* default halo behind high */}
      <rect x={slot(2) - barW / 2 - 12} y={T - 4} width={barW + 24} height={B - T + 30} rx={10} fill="rgba(37,99,235,0.06)" stroke="rgba(37,99,235,0.3)" strokeDasharray="4 4" />

      {/* token bars */}
      {levels.map((lv, i) => (
        <g key={lv.id}>
          <rect x={slot(i) - barW / 2} y={yTok(lv.tokens)} width={barW} height={Math.max(B - yTok(lv.tokens), 2)} rx={Math.min(5, Math.max(B - yTok(lv.tokens), 2) / 2)} fill="rgba(217,119,6,0.28)" stroke="rgba(217,119,6,0.72)" />
          <text x={slot(i)} y={yTok(lv.tokens) - 7} textAnchor="middle" className="mono" fontSize="11" fontWeight="600" fill="var(--warning)">
            {lv.tokens}t
          </text>
          <text x={slot(i)} y={B + 18} textAnchor="middle" className="mono" fontSize="12" fontWeight={lv.id === "high" ? 700 : 500} fill={lv.id === "high" ? "var(--primary)" : "var(--muted)"}>
            {lv.id}
          </text>
          {lv.id === "high" && (
            <text x={slot(i)} y={B + 34} textAnchor="middle" className="mono" fontSize="9.5" fill="var(--primary)" letterSpacing="0.12em">
              DEFAULT
            </text>
          )}
        </g>
      ))}

      {/* F1 line + dots */}
      <path
        d={levels.map((lv, i) => `${i ? "L" : "M"}${slot(i)},${yF1(lv.f1)}`).join(" ")}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="2.5"
      />
      {levels.map((lv, i) => (
        <g key={`d${lv.id}`}>
          <circle cx={slot(i)} cy={yF1(lv.f1)} r={5.5} fill="var(--primary)" stroke="var(--bg)" strokeWidth="2" />
          <text
            x={slot(i) - 12}
            y={yF1(lv.f1) + (lv.f1 === 0 ? -24 : -10)}
            textAnchor="end"
            className="mono"
            fontSize="11"
            fontWeight="600"
            fill="var(--primary)"
            paintOrder="stroke"
            stroke="var(--surface)"
            strokeWidth="4"
          >
            {lv.f1.toFixed(2)}
          </text>
        </g>
      ))}

      <text x={L} y={16} className="mono" fontSize="10" fill="var(--primary)" letterSpacing="0.12em">F1 (LEFT)</text>
      <text x={R} y={16} textAnchor="end" className="mono" fontSize="10" fill="var(--warning)" letterSpacing="0.12em">CONTEXT TOKENS (RIGHT)</text>
    </svg>
  );
}

function DetailKnob({ data }) {
  const k = data.report.detailKnob;
  return (
    <section id="knob" data-testid="knob" className="shell py-16" aria-labelledby="knob-title">
      <SectionHeader
        id="knob-title"
        kicker="02 · The detail knob"
        title="One knob, four budgets — accuracy you can dial"
        actions={<EvidenceTag kind="fixture-truth" />}
      >
        <span className="mono" style={{ color: "var(--text)" }}>{k.flag}</span> trades context depth for tokens.
        Accuracy climbs to a plateau at <span className="mono" style={{ color: "var(--primary)" }}>high</span>;
        beyond it, tokens jump 14× for no gain.
      </SectionHeader>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="panel min-w-0 p-4 sm:p-5">
          <KnobChart levels={k.levels} />
          <p className="mt-2" style={{ fontSize: 12, lineHeight: 1.55, color: "var(--faint)" }}>
            Means across all 37 languages, real-LLM scored. The teal line is F1 (left axis); amber bars are context
            tokens (right axis).
          </p>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          {k.levels.map((lv) => (
            <div
              key={lv.id}
              className="panel-raised flex items-start gap-4 p-4"
              style={lv.id === k.defaultLevel ? { borderColor: "var(--primary-dim)", boxShadow: "0 0 0 1px var(--primary-dim)" } : undefined}
            >
              <div className="mono shrink-0 rounded-md px-2 py-1 text-xs font-bold" style={{ background: "var(--bg2)", border: "1px solid var(--line-strong)", color: lv.id === k.defaultLevel ? "var(--primary)" : "var(--muted)" }}>
                {lv.id}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span style={{ fontSize: 13.5, fontWeight: 600 }}>{lv.what}</span>
                  <span className="num" style={{ fontSize: 12.5, color: "var(--muted)" }}>
                    {lv.tokens} tok · F1 {lv.f1.toFixed(2)}
                  </span>
                </div>
                <p className="mt-1" style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--faint)" }}>{lv.note}</p>
              </div>
            </div>
          ))}
          <div className="panel flex items-center gap-3 p-4" style={{ borderStyle: "dashed" }}>
            <span aria-hidden style={{ color: "var(--primary)", fontSize: 18 }}>⌀</span>
            <p style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--muted)" }}>{k.floorNote}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============ languages by maturity — the ladder, viz + table =========== */

const LEVEL_STYLE = {
  L5: { color: "var(--primary)", fill: "rgba(37,99,235,0.12)" },
  L4: { color: "var(--secondary)", fill: "rgba(122,162,255,0.12)" },
  L2: { color: "var(--warning)", fill: "rgba(217,119,6,0.1)" },
  L1: { color: "var(--muted)", fill: "rgba(154,163,179,0.10)" },
};

function LangChip({ lang, level, pending, promoted }) {
  const st = LEVEL_STYLE[level];
  return (
    <span
      className="mono inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5"
      data-testid="maturity-lang"
      title={
        pending ? "native F1 1.000 on the Linux saturation run — L4 pending a real-repo call-graph proof"
        : promoted ? "newly promoted: call graph cross-checked against the language's own LSP server on a real public repository (promotion run below)"
        : undefined
      }
      style={{
        fontSize: 12,
        fontWeight: 600,
        color: pending ? "var(--warning)" : "var(--text)",
        background: pending ? "rgba(217,119,6,0.08)" : st.fill,
        border: `1px ${pending ? "dashed" : "solid"} ${pending ? "var(--warning)" : promoted ? "var(--primary)" : "var(--line-strong)"}`,
      }}
    >
      {langLabel(lang)}
      {pending && <span style={{ fontSize: 9, letterSpacing: "0.08em", opacity: 0.85 }}>PENDING</span>}
      {promoted && <span style={{ fontSize: 9, letterSpacing: "0.08em", color: "var(--primary)" }}>NEW</span>}
    </span>
  );
}

function MaturityLadder({ maturity }) {
  const pendingSet = new Set(maturity.pending.langs);
  const promotedSet = new Set(maturity.promoted?.langs || []);
  const bands = maturity.levels.map((lv) => {
    if (lv.id === "L4") return { ...lv, extra: maturity.pending.langs, count: `${lv.langs.length} + ${maturity.pending.langs.length} pending` };
    if (lv.id === "L2") return { ...lv, langs: lv.langs.filter((l) => !pendingSet.has(l)), count: `${lv.langs.filter((l) => !pendingSet.has(l)).length} remaining`, note: `${maturity.pending.langs.length} more shown at L4 above, pending proof` };
    return { ...lv, count: String(lv.langs.length) };
  });
  const maxCount = Math.max(...bands.map((b) => b.langs.length + (b.extra || []).length));
  return (
    <div className="flex flex-col" data-testid="maturity-ladder">
      {bands.map((b, i) => {
        const st = LEVEL_STYLE[b.id];
        const total = b.langs.length + (b.extra || []).length;
        return (
          <div key={b.id} className="relative grid gap-4 py-5 md:grid-cols-[210px_minmax(0,1fr)]" style={{ borderTop: i ? "1px solid var(--line)" : "none" }}>
            {/* ladder rail */}
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <span className="mono grid shrink-0 place-items-center rounded-md" style={{ width: 34, height: 34, fontSize: 13, fontWeight: 700, color: st.color, background: st.fill, border: `1px solid ${st.color}` }}>
                  {b.id}
                </span>
                <div className="min-w-0">
                  <div className="truncate" style={{ fontSize: 14, fontWeight: 600 }}>{b.name}</div>
                  <div className="mono truncate" style={{ fontSize: 10.5, color: "var(--faint)", letterSpacing: "0.06em" }}>{b.short}</div>
                </div>
              </div>
              <p className="mt-2" style={{ fontSize: 12, lineHeight: 1.5, color: "var(--muted)" }}>{b.desc}</p>
              <div className="mt-2.5 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "var(--bg2)", maxWidth: 120 }}>
                  <div className="h-1.5 rounded-full" style={{ width: `${(total / maxCount) * 100}%`, background: st.color, opacity: 0.85 }} />
                </div>
                <span className="mono" style={{ fontSize: 11, color: st.color, fontWeight: 700 }}>{b.count}</span>
              </div>
            </div>
            {/* the languages */}
            <div className="min-w-0">
              <div className="flex flex-wrap gap-2">
                {b.langs.map((l) => <LangChip key={l} lang={l} level={b.id} promoted={b.id === "L5" && promotedSet.has(l)} />)}
                {(b.extra || []).map((l) => <LangChip key={l} lang={l} level="L4" pending />)}
              </div>
              {b.note && (
                <div className="mono mt-2.5" style={{ fontSize: 11, color: "var(--faint)" }}>{b.note}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MaturityTable({ data }) {
  const r = data.report;
  const maturity = r.maturity;
  const [q, setQ] = useState("");
  const freshByLang = useMemo(
    () => Object.fromEntries(data.fresh.perLanguage.map((p) => [p.lang, p])),
    [data]
  );
  const reportByLang = useMemo(
    () => Object.fromEntries(r.perLanguage.map((p) => [p.lang, p])),
    [r]
  );
  const pendingSet = new Set(maturity.pending.langs);
  const order = { L5: 0, L4: 1, L2: 2, L1: 3 };
  const rows = useMemo(() => {
    const out = [];
    for (const lv of maturity.levels) {
      for (const lang of lv.langs) {
        out.push({ lang, level: pendingSet.has(lang) ? "L4*" : lv.id, sortLevel: pendingSet.has(lang) ? 1.5 : order[lv.id], pending: pendingSet.has(lang) });
      }
    }
    return out
      .filter((x) => !q || x.lang.includes(q.toLowerCase()) || langLabel(x.lang).toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => a.sortLevel - b.sortLevel || a.lang.localeCompare(b.lang));
  }, [q, maturity]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <input
          className="field focusring"
          style={{ maxWidth: 280 }}
          placeholder={`Filter ${maturity.totalCodeLanguages} languages…`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Filter languages"
        />
        <span className="mono" style={{ fontSize: 11.5, color: "var(--faint)" }}>
          report columns: native, LLM-scored · fresh column: Linux deterministic re-run
        </span>
      </div>
      <div className="tablewrap" style={{ maxHeight: 520, overflowY: "auto" }}>
        <table className="dtable" data-testid="maturity-table" style={{ minWidth: 760 }}>
          <thead>
            <tr>
              <th>language</th>
              <th>maturity</th>
              <th>atlas F1 (report)</th>
              <th>tokens</th>
              <th>graph tool F1</th>
              <th>fresh F1 (linux)</th>
              <th>status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((x) => {
              const rep = reportByLang[x.lang];
              const fr = freshByLang[x.lang];
              const st = LEVEL_STYLE[x.pending ? "L4" : x.level] || LEVEL_STYLE.L1;
              return (
                <tr key={x.lang}>
                  <td className="num" style={{ fontWeight: 600 }}>{langLabel(x.lang)}</td>
                  <td>
                    <span className="chip" style={{ borderColor: x.pending ? "var(--warning)" : st.color, color: x.pending ? "var(--warning)" : st.color, borderStyle: x.pending ? "dashed" : "solid" }}>
                      {x.pending ? "L4 · pending real-repo proof" : x.level}
                    </span>
                  </td>
                  <td className="num" style={{ color: rep ? (rep.atlasF1 === 1 ? "var(--primary)" : "var(--danger)") : "var(--faint)" }}>
                    {rep ? rep.atlasF1.toFixed(3) : "—"}
                  </td>
                  <td className="num" style={{ color: "var(--muted)" }}>{rep ? rep.atlasTok : "—"}</td>
                  <td className="num" style={{ color: "var(--muted)" }}>{rep ? rep.graphF1.toFixed(3) : "—"}</td>
                  <td className="num" style={{ color: fr ? (fr.f1 === 1 ? "var(--primary)" : "var(--danger)") : "var(--faint)" }}>
                    {fr ? fr.f1.toFixed(3) : "—"}
                  </td>
                  <td style={{ fontSize: 12, color: "var(--muted)" }}>
                    {x.pending ? "fixed in saturation run" : rep ? rep.status : "beyond the 37-language benchmark set"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function L5PromotionPanel({ l5run }) {
  const passed = l5run.rows.filter((r) => r.pass);
  const med = l5run.medians;
  const fmtX = (x) => (x == null ? "–" : x >= 100 ? `${Math.round(x)}×` : `${x}×`);
  return (
    <div className="panel mt-6 p-5 sm:p-6" data-testid="l5-promotion">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 style={{ fontSize: 15, fontWeight: 700 }}>{l5run.label}</h3>
        <span className="mono" style={{ fontSize: 11, color: "var(--faint)" }}>
          gate: ≥{l5run.gate.min_symbols} symbols · F1 ≥ {l5run.gate.mean_f1} · precision ≥ {l5run.gate.mean_precision}
        </span>
      </div>
      <p className="mt-2" style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--muted)" }}>
        Each candidate language’s <em>who-calls</em> answers are cross-checked against the language’s own
        LSP server on a real public repository — the same evidence class that graded the original seven
        L5 languages. Truth prefers <span className="mono">callHierarchy</span>; servers without it use
        references with documentSymbol enclosure, call-shaped sites only. Both sides are restricted to
        textually-defined callers (macro-expanded names are listed, not scored), and an extra caller only
        counts against precision when no textual call site corroborates it — every excusal ships in the
        raw artifact. Scoring is a deterministic set comparison; no LLM anywhere.
      </p>
      <div className="mt-3 mb-4 flex flex-wrap gap-2">
        <span className="chip" style={{ borderColor: "var(--primary)", color: "var(--primary)" }}>
          {passed.length} of {l5run.rows.length} candidates promoted
        </span>
        {med.xServeLatGraphify != null && (
          <span className="chip">{fmtX(med.xServeLatGraphify)} faster than the graph tool per query (warm Atlas daemon vs its CLI — it has no daemon mode; CLI-vs-CLI {fmtX(med.xLatGraphify)})</span>
        )}
        {med.xLatLspCold != null && (
          <span className="chip">{fmtX(med.xLatLspCold)} faster than spawning the reference server per session</span>
        )}
        {med.xTokLsp != null && (
          <span className="chip">{fmtX(med.xTokLsp)} fewer answer tokens than the reference server’s JSON</span>
        )}
        {med.xTokRawRead != null && (
          <span className="chip">{fmtX(med.xTokRawRead)} fewer tokens than reading the implicated files</span>
        )}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="dtable" data-testid="l5-promotion-table" style={{ minWidth: 980 }}>
          <thead>
            <tr>
              <th>language</th><th>repository</th><th>reference truth</th><th>mode</th>
              <th className="num">syms</th><th className="num">F1</th><th className="num">P</th><th className="num">R</th>
              <th className="num">atlas warm/CLI ms</th><th className="num">LSP cold ms</th>
              <th className="num">graph CLI ms</th><th className="num">tok ×LSP</th><th className="num">tok ×read</th>
              <th>verdict</th>
            </tr>
          </thead>
          <tbody>
            {l5run.rows.map((r) => (
              <tr key={r.lang}>
                <td className="mono">{langLabel(r.lang)}</td>
                <td className="mono">{r.repo ? <a className="focusring" href={`https://github.com/${r.repo}`} target="_blank" rel="noreferrer">{r.repo}</a> : "–"}</td>
                <td className="mono">{r.reference}</td>
                <td className="mono">{r.mode}</td>
                <td className="num">{r.symbols}</td>
                <td className="num" style={{ color: r.f1 >= 0.9 ? "var(--primary)" : "var(--warning)", fontWeight: 700 }}>{r.f1?.toFixed(3)}</td>
                <td className="num">{r.precision?.toFixed(3)}</td>
                <td className="num">{r.recall?.toFixed(3)}</td>
                <td className="num">{r.atlasServeMs != null ? `${r.atlasServeMs} / ${r.atlasCliMs}` : r.atlasCliMs}</td>
                <td className="num">{r.lspColdMs != null ? Math.round(r.lspColdMs).toLocaleString() : "–"}</td>
                <td className="num">{r.graphifyMs ?? "–"}</td>
                <td className="num">{fmtX(r.xTokLsp)}</td>
                <td className="num">{fmtX(r.xTokRawRead)}</td>
                <td className="mono" style={{ color: r.pass ? "var(--primary)" : "var(--warning)", fontWeight: 700 }}>
                  {r.pass ? "PASS → L5" : "stays L4"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3" style={{ fontSize: 12, lineHeight: 1.6, color: "var(--faint)" }}>
        Latency lanes are compared like-for-like and labeled: Atlas CLI vs graph-tool CLI (both cold
        process spawns); warm Atlas daemon (the MCP path agents actually use) vs the reference server’s
        per-session spawn — the reference servers are precise by construction and remain the accuracy
        target, but they are session tools, not query daemons. Languages that missed the gate stay L4
        with their numbers shown — nothing is promoted on a partial score.
      </p>
    </div>
  );
}

function MaturitySection({ data }) {
  const maturity = data.report.maturity;
  const [view, setView] = useState("ladder");
  const l5 = maturity.levels.find((l) => l.id === "L5").langs.length;
  const l4 = maturity.levels.find((l) => l.id === "L4").langs.length;
  return (
    <section id="languages" data-testid="languages" className="py-16" style={{ background: "var(--bg2)" }} aria-labelledby="languages-title">
      <div className="shell">
        <SectionHeader
          id="languages-title"
          kicker="03 · Language maturity"
          title={`${maturity.totalCodeLanguages} code languages, graded by proof — not by claim`}
          actions={
            <div className="seg" role="tablist" aria-label="Maturity view">
              {[["ladder", "Ladder"], ["table", "Table"]].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  data-testid={`maturity-view-${key}`}
                  className="seg-btn focusring"
                  data-active={view === key}
                  aria-selected={view === key}
                  onClick={() => setView(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          }
        >
          Every language sits on a five-level ladder by how much independent evidence backs its call graph —
          from “indexed” to “validated against a language server”. {maturity.note} Atlas also indexes
          ~{maturity.contentFormats} content formats (JSON, YAML, HTML, PDF, …) for search.
        </SectionHeader>

        <div className="mb-6 flex flex-wrap gap-2">
          <span className="chip" style={{ borderColor: "var(--primary)", color: "var(--primary)" }}>{l5} reference-validated</span>
          {maturity.promoted?.langs?.length ? (
            <span className="chip" style={{ borderColor: "var(--primary)", color: "var(--primary)" }}>
              +{maturity.promoted.langs.length} newly promoted — LSP-truth on real repos
            </span>
          ) : null}
          <span className="chip" style={{ borderColor: "var(--secondary)", color: "var(--secondary)" }}>{l4} real-repo call graph</span>
          <span className="chip" style={{ borderColor: "var(--warning)", color: "var(--warning)", borderStyle: "dashed" }}>
            {maturity.pending.langs.length} fixed · pending real-repo proof
          </span>
          <FreshChip title={maturity.pending.evidence}>
            saturation run: {data.fresh.saturation.before} → {data.fresh.saturation.perfect}/{data.fresh.saturation.total} fixture-perfect
          </FreshChip>
        </div>

        <div className="panel p-5 sm:p-6">
          {view === "ladder" ? <MaturityLadder maturity={maturity} /> : <MaturityTable data={data} />}
        </div>

        {data.l5run && <L5PromotionPanel l5run={data.l5run} />}

        <p className="mt-4" style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--faint)" }}>
          <span className="mono" style={{ color: "var(--warning)" }}>PENDING</span> = {maturity.pending.evidence}.
          Until that run lands, the report’s ladder (which counts them at L2) remains the citation.
        </p>
      </div>
    </section>
  );
}

/* ================= head-to-head vs the graph tool ======================= */

function WinMap({ perLanguage, fresh }) {
  const cls = (p) => {
    const g = p.graphF1 >= 0.9;
    if (p.atlasF1 === 1 && !g) return "atlas";
    if (p.atlasF1 === 1 && g) return "both";
    if (p.atlasF1 < 1 && g) return "graph";
    return "neither";
  };
  const C = {
    atlas: { bg: "rgba(37,99,235,0.14)", border: "var(--primary)", label: "Atlas only" },
    both: { bg: "rgba(122,162,255,0.14)", border: "var(--secondary)", label: "both perfect" },
    graph: { bg: "rgba(217,119,6,0.12)", border: "var(--warning)", label: "graph tool only (full-source dump)" },
    neither: { bg: "transparent", border: "var(--line-strong)", label: "neither (report) — fixed in fresh run" },
  };
  const counts = { atlas: 0, both: 0, graph: 0, neither: 0 };
  perLanguage.forEach((p) => counts[cls(p)]++);
  return (
    <div>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(86px, 1fr))" }} data-testid="winmap">
        {perLanguage.map((p) => {
          const k = cls(p);
          return (
            <div
              key={p.lang}
              className="mono rounded-md px-1.5 py-1.5 text-center"
              title={`${langLabel(p.lang)} — atlas F1 ${p.atlasF1.toFixed(2)} @ ${p.atlasTok} tok · graph ${p.graphF1.toFixed(2)} @ ${p.graphTok} tok`}
              style={{ fontSize: 11, fontWeight: 600, background: C[k].bg, border: `1px solid ${C[k].border}`, color: k === "neither" ? "var(--faint)" : "var(--text)" }}
            >
              {langLabel(p.lang)}
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        {Object.entries(C).map(([k, v]) => (
          <span key={k} className="inline-flex items-center gap-1.5" style={{ fontSize: 12, color: "var(--muted)" }}>
            <span aria-hidden style={{ width: 10, height: 10, borderRadius: 3, background: v.bg, border: `1px solid ${v.border}`, display: "inline-block" }} />
            {counts[k]} {v.label}
          </span>
        ))}
      </div>
      <div className="mt-3">
        <FreshChip>fresh Linux run: Atlas perfect on all {fresh.saturation.total}/{fresh.saturation.total} — the “neither/graph-only” cells are the pending-proof set</FreshChip>
      </div>
    </div>
  );
}

function Versus({ data }) {
  const sc = data.report.scorecard;
  const f = data.fresh;
  return (
    <section id="versus" data-testid="versus" className="shell py-16" aria-labelledby="versus-title">
      <SectionHeader id="versus-title" kicker="04 · Head-to-head" title="Atlas vs Graphify — the scorecard">
        Graphify is the only other tool that covers every language from one binary, so it is the honest incumbent
        to beat. Accuracy and answer size come from fixtures; latency, tokens and build time from real repositories.
      </SectionHeader>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {sc.stats.map((s) => (
          <div key={s.label} className="panel p-5 text-center">
            <div className="num" style={{ fontSize: "clamp(26px,3vw,34px)", fontWeight: 700, color: "var(--primary)" }}>{s.value}</div>
            <div className="kicker mt-2" style={{ letterSpacing: "0.1em" }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start">
        <div className="tablewrap min-w-0">
          <table className="dtable" style={{ minWidth: 640 }}>
            <thead>
              <tr>
                <th>metric</th>
                <th>atlas</th>
                <th>graphify</th>
                <th>advantage</th>
                <th>evidence</th>
              </tr>
            </thead>
            <tbody>
              {sc.rows.map((r) => (
                <tr key={r.metric}>
                  <td style={{ fontWeight: 600, fontSize: 12.5 }}>{r.metric}</td>
                  <td className="num" style={{ color: "var(--primary)" }}>{r.atlas}</td>
                  <td className="num" style={{ color: "var(--muted)" }}>{r.graphify}</td>
                  <td className="num" style={{ color: "var(--text)" }}>{r.advantage}</td>
                  <td className="mono" style={{ fontSize: 11, color: "var(--faint)" }}>{r.evidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="panel p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="kicker">Who resolves callers, per language</div>
              <EvidenceTag kind="fixture-truth" />
            </div>
            <WinMap perLanguage={data.report.perLanguage} fresh={f} />
          </div>
          <div className="panel p-4" style={{ borderStyle: "dashed" }}>
            <p style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--muted)" }}>
              <span className="mono" style={{ color: "var(--primary)" }}>DETERMINISTIC — </span>{sc.note}
            </p>
            <div className="mt-3">
              <FreshChip>fresh run medians: {f.latency.atlasMedianMs} ms vs {f.latency.graphifyMedianMs} ms per query ({f.latency.ratio}×)</FreshChip>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ==================== the tool field (landscape) ======================== */

function FieldChart({ field }) {
  const rows = [...field].sort((a, b) => a.indexS - b.indexS);
  const W = 580;
  const rowH = 30, T = 34, B = 34, L = 128, R = 560;
  const H = T + rows.length * rowH + B;
  const lo = Math.log10(0.01), hi = Math.log10(20);
  const x = (v) => L + ((Math.log10(v) - lo) / (hi - lo)) * (R - L);
  const ticks = [0.01, 0.1, 1, 10];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Index and build time across the tool field on a log scale. Atlas cold build 0.28 seconds is among the fastest; its warm re-index 0.03 seconds is far ahead; jdtls and scip-java take 9 to 11 seconds." style={{ display: "block" }}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={T - 10} y2={H - B + 6} stroke="var(--grid)" />
          <text x={x(t)} y={H - B + 22} textAnchor="middle" className="mono" fontSize="10" fill="var(--faint)">
            {t < 1 ? `${t}s` : `${t}s`}
          </text>
        </g>
      ))}
      <text x={R} y={16} textAnchor="end" className="mono" fontSize="10" fill="var(--muted)" letterSpacing="0.1em">
        INDEX / BUILD TIME · LOG SCALE · LOWER IS BETTER
      </text>
      {rows.map((r, i) => {
        const yMid = T + i * rowH + rowH / 2;
        const isAtlas = r.tool === "atlas";
        const barColor = isAtlas ? "var(--primary)" : r.tool === "graphify" ? "var(--danger)" : "var(--muted)";
        return (
          <g key={r.tool}>
            <text x={L - 10} y={yMid + 3.5} textAnchor="end" className="mono" fontSize="11.5" fontWeight={isAtlas ? 700 : 500} fill={isAtlas ? "var(--primary)" : "var(--muted)"}>
              {r.tool}
            </text>
            <line x1={x(0.01)} x2={x(r.indexS)} y1={yMid} y2={yMid} stroke={barColor} strokeWidth={isAtlas ? 7 : 5} strokeLinecap="round" opacity={isAtlas ? 1 : 0.55} />
            <circle cx={x(r.indexS)} cy={yMid} r={isAtlas ? 5 : 4} fill={barColor} />
            {r.warmS && (
              <>
                <circle cx={x(r.warmS)} cy={yMid} r={4.5} fill="var(--bg)" stroke="var(--primary)" strokeWidth="2" />
                <text x={x(r.warmS)} y={yMid - 9} textAnchor="middle" className="mono" fontSize="9" fill="var(--primary)">
                  warm {r.warmS}s
                </text>
              </>
            )}
            <text x={x(r.indexS) + 10} y={yMid + 3.5} className="mono" fontSize="10.5" fill={isAtlas ? "var(--text)" : "var(--faint)"}>
              {r.indexS}s
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function FieldSection({ data }) {
  const field = data.report.field;
  return (
    <section id="field" data-testid="field" className="shell py-16" aria-labelledby="field-title">
      <SectionHeader id="field-title" kicker="05 · The whole field" title="Not just Graphify — LSP servers and SCIP indexers too" actions={<EvidenceTag kind="perf-only" />}>
        The real comparison set is the whole code-intelligence stack, measured over the 7 languages every tool can
        attempt. Atlas and Graphify are the only one-install, all-language tools; the rest are per-language authorities.
      </SectionHeader>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="tablewrap min-w-0">
          <table className="dtable" style={{ minWidth: 520 }}>
            <thead>
              <tr>
                <th>tool</th>
                <th>type</th>
                <th>coverage</th>
                <th>one tool?</th>
              </tr>
            </thead>
            <tbody>
              {field.map((t) => (
                <tr key={t.tool}>
                  <td className="num" style={{ fontWeight: 600, color: t.tool === "atlas" ? "var(--primary)" : "var(--text)" }}>{t.tool}</td>
                  <td style={{ fontSize: 12.5, color: "var(--muted)" }}>{t.type}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 overflow-hidden rounded-full" style={{ background: "var(--bg2)" }}>
                        <div className="h-1.5 rounded-full" style={{ width: `${(t.langs / 7) * 100}%`, background: t.tool === "atlas" ? "var(--primary)" : "var(--muted)" }} />
                      </div>
                      <span className="num" style={{ fontSize: 12 }}>{t.langs}/7</span>
                    </div>
                  </td>
                  <td>
                    {t.oneTool ? (
                      <span className="chip" style={{ borderColor: "var(--success)", color: "var(--success)" }}>yes</span>
                    ) : (
                      <span className="chip">no</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel min-w-0 p-4 sm:p-5">
          <FieldChart field={field} />
        </div>
      </div>

      <p className="mt-5 max-w-4xl" style={{ fontSize: 13, lineHeight: 1.6, color: "var(--muted)" }}>
        {data.report.fieldNote}
      </p>
    </section>
  );
}

/* ================== real-repository proof =============================== */

function FlagshipBars({ flagship }) {
  const max = Math.max(...flagship.rows.map((r) => r.f1));
  return (
    <div className="mt-5 flex items-end justify-around gap-4">
      {flagship.rows.map((r) => {
        const isAtlas = r.tool === "Atlas";
        const h = Math.max((r.f1 / max) * 118, 4);
        return (
          <div key={r.tool} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
            <span className="num" style={{ fontSize: 15, fontWeight: 700, color: isAtlas ? "var(--primary)" : "var(--muted)" }}>
              {r.f1.toFixed(3)}
            </span>
            <div
              className="w-full rounded-t-md"
              style={{
                maxWidth: 84,
                height: h,
                background: isAtlas ? "var(--primary)" : "var(--surface-raised)",
                border: `1px solid ${isAtlas ? "var(--primary)" : "var(--line-strong)"}`,
                opacity: isAtlas ? 0.9 : 1,
              }}
            />
            <div className="mono truncate" style={{ fontSize: 11, color: "var(--muted)" }}>{r.tool}</div>
            <div className="mono" style={{ fontSize: 10, color: "var(--faint)" }}>{num(r.tokens)} tok</div>
          </div>
        );
      })}
    </div>
  );
}

function LatencyScatter({ liveRepos, meanMs }) {
  const pts = liveRepos.filter((r) => r.perQueryMs != null && r.symbols > 0);
  const W = 560, H = 280;
  const L = 46, R = 546, T = 20, B = 232;
  const lo = Math.log10(10), hi = Math.log10(50000);
  const x = (s) => L + ((Math.log10(Math.max(s, 10)) - lo) / (hi - lo)) * (R - L);
  const yMax = 16;
  const y = (ms) => B - (Math.min(ms, yMax) / yMax) * (B - T);
  const xt = [[10, "10"], [100, "100"], [1000, "1k"], [10000, "10k"]];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Query latency versus repository size across ${pts.length} real repositories. Latency stays flat — the report mean is ${meanMs} milliseconds — regardless of repo size.`} style={{ display: "block" }}>
      {[0, 4, 8, 12, 16].map((t) => (
        <g key={t}>
          <line x1={L} x2={R} y1={y(t)} y2={y(t)} stroke="var(--grid)" />
          <text x={L - 8} y={y(t) + 3.5} textAnchor="end" className="mono" fontSize="10" fill="var(--faint)">{t}</text>
        </g>
      ))}
      {xt.map(([v, lb]) => (
        <text key={v} x={x(v)} y={B + 18} textAnchor="middle" className="mono" fontSize="10" fill="var(--faint)">{lb}</text>
      ))}
      <line x1={L} x2={R} y1={B} y2={B} stroke="var(--line-strong)" />
      <text x={(L + R) / 2} y={H - 4} textAnchor="middle" className="mono" fontSize="10" fill="var(--muted)" letterSpacing="0.1em">
        REPOSITORY SIZE — SYMBOLS · LOG SCALE →
      </text>
      <text x={12} y={(T + B) / 2} textAnchor="middle" className="mono" fontSize="10" fill="var(--muted)" letterSpacing="0.1em" transform={`rotate(-90 12 ${(T + B) / 2})`}>
        QUERY MS
      </text>

      <line x1={L} x2={R} y1={y(meanMs)} y2={y(meanMs)} stroke="var(--primary)" strokeDasharray="5 5" opacity="0.7" />
      <text x={R} y={y(meanMs) + 17} textAnchor="end" className="mono" fontSize="10" fill="var(--primary)" paintOrder="stroke" stroke="var(--surface)" strokeWidth="4">
        report mean {meanMs} ms
      </text>

      {pts.map((p) => (
        <circle key={p.lang} cx={x(p.symbols)} cy={y(p.perQueryMs)} r="4.5" fill="var(--primary)" opacity="0.65" stroke="var(--bg)" strokeWidth="1">
          <title>{`${langLabel(p.lang)} · ${p.repo} — ${num(p.symbols)} symbols · ${p.perQueryMs} ms/query`}</title>
        </circle>
      ))}
    </svg>
  );
}

function RealRepo({ data }) {
  const flagship = data.report.goFlagship;
  const las = data.report.latencyAtScale;
  const f = data.fresh;
  const xr = f.crossRepo;
  return (
    <section id="real" data-testid="real" className="py-16" style={{ background: "var(--bg2)" }} aria-labelledby="real-title">
      <div className="shell">
        <SectionHeader id="real-title" kicker="06 · Production proof" title="Fixtures prove the ceiling. Real repositories prove it in production.">
          Independent ground truth an LSP server defines, latency that ignores repository size, and route-level
          intelligence across repositories — measured, not asserted.
        </SectionHeader>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="panel min-w-0 p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="kicker">Go flagship · {flagship.repo}</div>
              <EvidenceTag kind="LSP-truth" />
            </div>
            <p className="mt-2" style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--muted)" }}>
              Scored against {flagship.truth} — an authority neither tool can influence. A {flagship.advantage}× gap
              on production fan-in.
            </p>
            <FlagshipBars flagship={flagship} />
            <div className="mt-4">
              <FreshChip>re-run vs gopls on a second production Go service: F1 {f.lspTruth.meanF1.toFixed(3)} over {f.lspTruth.symbols} symbols</FreshChip>
            </div>
          </div>

          <div className="panel min-w-0 p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="kicker">Latency at scale · {data.liveRepos.length} real repos</div>
              <EvidenceTag kind="perf-only" />
            </div>
            <p className="mt-2" style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--muted)" }}>
              {num(las.largestSymbols)}-symbol repos answer in about the same time as 100-symbol ones —
              a {num(las.sizeRange)}× size range, flat latency.
            </p>
            <div className="mt-3">
              <LatencyScatter liveRepos={data.liveRepos} meanMs={las.meanMs} />
            </div>
          </div>

          <div className="panel min-w-0 p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="kicker">Cross-repo intelligence</div>
              <FreshChip>fresh run</FreshChip>
            </div>
            <p className="mt-2" style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--muted)" }}>
              {xr.note}. Atlas links HTTP routes a server exposes to the client code that calls them — so
              “what breaks if I change this endpoint?” has an answer across repository boundaries.
            </p>
            <dl className="mt-5 grid grid-cols-2 gap-4">
              <div>
                <dt className="kicker">producer routes</dt>
                <dd className="num mt-1" style={{ fontSize: 24, fontWeight: 600 }}>{num(xr.producerRoutes)}</dd>
              </div>
              <div>
                <dt className="kicker">consumer references</dt>
                <dd className="num mt-1" style={{ fontSize: 24, fontWeight: 600 }}>{num(xr.consumerRefs)}</dd>
              </div>
              <div>
                <dt className="kicker">linked dependencies</dt>
                <dd className="num mt-1" style={{ fontSize: 24, fontWeight: 600, color: "var(--primary)" }}>
                  {xr.queries.dependencies?.count ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="kicker">query latency</dt>
                <dd className="num mt-1" style={{ fontSize: 24, fontWeight: 600 }}>
                  ~{Math.round(xr.queries.consumers?.latencyMs ?? 0)} ms
                </dd>
              </div>
            </dl>
            <div className="mono mt-5 flex flex-wrap gap-2" style={{ fontSize: 11 }}>
              {["route-contracts", "consumers", "dependencies", "cross-repo-impact"].map((c) => (
                <span key={c} className="chip">atlas {c}</span>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-4" style={{ fontSize: 12.5, color: "var(--faint)" }}>
          Why latency holds: {las.why}
        </p>
      </div>
    </section>
  );
}

/* ============= agents in the loop — harness token benchmark ============= */

const MODE_LABELS = { atlas: "Atlas", graphify: "Graph tool", baseline: "No tool (raw exploration)" };
const MODE_ORDER = { atlas: 0, graphify: 1, baseline: 2 };

function AgentPanel({ agentMeta, cells }) {
  const rows = cells
    .filter((c) => c.agent === agentMeta.id)
    .sort((a, b) => (MODE_ORDER[a.mode] ?? 9) - (MODE_ORDER[b.mode] ?? 9));
  const max = Math.max(...rows.map((r) => r.totalTokens || 0), 1);
  return (
    <div className="panel min-w-0 p-5" data-testid={`agent-panel-${agentMeta.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="kicker">{agentMeta.id} · {agentMeta.model || "default model"}</div>
        <EvidenceTag kind="agent-harness" />
      </div>
      <p className="mt-2" style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--muted)" }}>
        Harness floor {num(agentMeta.calibrationTotal)} tok for a no-tool “OK” — the baseline every run pays before
        the first question. Bars are mean total tokens per answered question.
      </p>
      <div className="mt-4 flex flex-col gap-3">
        {rows.map((r) => {
          const isAtlas = r.mode === "atlas";
          const w = Math.max(((r.totalTokens || 0) / max) * 100, 2);
          return (
            <div key={r.mode} className="min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="mono truncate" style={{ fontSize: 11.5, color: isAtlas ? "var(--primary)" : "var(--muted)" }}>
                  {MODE_LABELS[r.mode] || r.mode}
                </span>
                <span className="num" style={{ fontSize: 13, fontWeight: 700, color: isAtlas ? "var(--primary)" : "var(--text)" }}>
                  {num(r.totalTokens)} tok
                </span>
              </div>
              <div className="mt-1 h-2.5 w-full rounded" style={{ background: "var(--surface-raised)" }}>
                <div
                  className="h-full rounded"
                  style={{ width: `${w}%`, background: isAtlas ? "var(--primary)" : r.mode === "graphify" ? "var(--danger)" : "var(--not-comparable)", opacity: 0.85 }}
                />
              </div>
              <div className="mono mt-1 flex flex-wrap gap-x-4" style={{ fontSize: 10.5, color: "var(--faint)" }}>
                <span>F1 {r.f1 == null ? "—" : r.f1.toFixed(3)}</span>
                <span>{r.turns == null ? "—" : r.turns} tool calls</span>
                <span>{num(r.billedProxy)} billed-proxy tok</span>
                <span>{r.ok}/{r.n} ok</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mono mt-4 flex flex-wrap gap-2" style={{ fontSize: 11 }}>
        {Object.entries(agentMeta.vsAtlas || {}).map(([m, v]) => (
          v?.totalTokens ? (
            <span key={m} className="chip" style={{ borderColor: "var(--g2)", color: "var(--g2)" }}>
              {MODE_LABELS[m] || m}: {v.totalTokens}× Atlas tokens
            </span>
          ) : null
        ))}
      </div>
    </div>
  );
}

function AgentBench({ data }) {
  const ab = data.agentBench;
  if (!ab) return null;
  return (
    <section id="agents" data-testid="agents" className="shell py-16" aria-labelledby="agents-title">
      <SectionHeader
        id="agents-title"
        kicker="07 · Agents in the loop"
        title="What a real agent actually spends"
        actions={<EvidenceTag kind="agent-harness" />}
      >
        Context-size benchmarks measure the tool's output. This measures the whole loop: Claude Code and OpenAI Codex
        run headless in a checkout of {ab.repo} (@{ab.commit7}), restricted to one code-intelligence CLI per run, and the
        harness's own token accounting is recorded — {ab.nQuestions} caller questions, ground truth {ab.truth}.
      </SectionHeader>

      <div className="grid gap-4 lg:grid-cols-2" data-testid="agent-panels">
        {ab.agents.map((a) => (
          <AgentPanel key={a.id} agentMeta={a} cells={ab.cells} />
        ))}
      </div>

      <div className="panel mt-4 p-5" data-testid="agent-run-yourself">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="kicker">Run it from your machine</div>
            <p className="mt-2" style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--muted)" }}>
              The whole suite ships in this repository under <span className="mono">agent-bench/</span> — pinned repo
              commit, frozen gopls question set, isolation flags baked in. Needs {ab.suiteNeeds}. Your absolute numbers
              will differ with models and dates; the mode-vs-mode gap is the reproducible part.
            </p>
          </div>
          <a
            className="focusring chip"
            href="https://github.com/aziron-ai/atlas/tree/main/agent-bench"
            target="_blank"
            rel="noreferrer"
            style={{ textDecoration: "none" }}
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden /> agent-bench/
          </a>
        </div>
        <div className="codeblock mt-3 flex items-start justify-between gap-2 rounded-md p-3" style={{ background: "var(--surface-raised)" }}>
          <pre className="mono min-w-0 overflow-x-auto" style={{ fontSize: 12, lineHeight: 1.6 }}>{ab.suiteCmd}</pre>
          <CopyButton text={ab.suiteCmd.replace(/\\\n\s*/g, "")} />
        </div>
        <p className="mono mt-3" style={{ fontSize: 11, color: "var(--faint)" }}>
          {ab.caveat} {ab.billedProxyNote} Raw per-run records:{" "}
          <a className="link focusring" href={ab.artifact} download>AGENT_TOKEN_BENCH_PUBLIC.json</a>.
        </p>
      </div>
    </section>
  );
}

/* ========================= graph explorer =============================== */

function GraphSection() {
  return (
    <section id="graph" data-testid="graph" className="shell py-16" aria-labelledby="graph-title">
      <SectionHeader id="graph-title" kicker="08 · The map Atlas builds" title="The deterministic symbol & call graph">
        This is the “smallest useful slice” made visible: real <span className="mono">atlas export --all</span> output
        of <span className="mono">facebook/react</span>, downsampled to a connected core. Hover a node, drag, pan, zoom;
        click a hub to focus it — or <button type="button" className="text-link" onClick={() => window.dispatchEvent(new CustomEvent("atlas:console"))}>query it live ❯</button>.
      </SectionHeader>
      <div className="gx-frame">
        <GraphExplorer className="atlas-graph-full" />
      </div>
    </section>
  );
}

/* ==================== evidence, limits & provenance ===================== */

function EvidenceSection({ data }) {
  const r = data.report;
  const f = data.fresh;
  const tiers = { report: "report", fresh: "fresh run", derived: "derived" };
  return (
    <section id="evidence" data-testid="evidence" className="shell py-16" aria-labelledby="evidence-title">
      <SectionHeader id="evidence-title" kicker="09 · Evidence & limits" title="Graded evidence, disclosed limits, downloadable data">
        No result mixes a favorable subset with an all-language headline without saying so. These are the rules the
        numbers on this page play by — and the places Atlas is not yet proven.
      </SectionHeader>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="panel p-5">
            <div className="kicker mb-4">Evidence classes</div>
            <div className="flex flex-col gap-3">
              {r.method.evidenceClasses.map((e) => (
                <div key={e.id} className="flex items-start gap-3">
                  <EvidenceTag kind={e.id} />
                  <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--muted)" }}>{e.desc}</p>
                </div>
              ))}
            </div>
            <div className="hairline mt-4 pt-4">
              <div className="kicker mb-3">Cross-model agreement</div>
              <div className="tablewrap">
                <table className="dtable dtable-compact" style={{ minWidth: 0 }}>
                  <thead>
                    <tr>
                      <th>context source</th>
                      <th>haiku 4.5</th>
                      <th>sonnet 5</th>
                      <th>agreement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.crossModel.rows.map((row) => (
                      <tr key={row.source}>
                        <td style={{ fontSize: 12.5 }}>{row.source}</td>
                        <td className="num">{row.haiku.toFixed(3)}</td>
                        <td className="num">{row.sonnet.toFixed(3)}</td>
                        <td className="mono" style={{ fontSize: 11, color: "var(--success)" }}>{row.agreement}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3" style={{ fontSize: 12, lineHeight: 1.55, color: "var(--faint)" }}>{r.crossModel.note}</p>
            </div>
          </div>

          <div className="panel p-5" style={{ borderColor: "var(--warning)", borderStyle: "dashed" }}>
            <div className="kicker mb-3" style={{ color: "var(--warning)" }}>Stated plainly — known limits</div>
            <ul className="flex flex-col gap-2.5" style={{ fontSize: 13, lineHeight: 1.6, color: "var(--muted)" }}>
              {r.limits.map((l, i) => (
                <li key={i} className="flex gap-2.5">
                  <span aria-hidden style={{ color: "var(--warning)" }}>—</span>
                  <span>{l}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="panel p-5" data-testid="artifact-drawer">
            <div className="mb-1 flex items-center justify-between gap-3">
              <div className="kicker">The evidence drawer</div>
              <a href="data/site-data.json" download data-testid="download-link" className="btn btn-ghost focusring" style={{ minHeight: 34, padding: "0 12px", fontSize: 13, textDecoration: "none" }}>
                <Download className="h-3.5 w-3.5" aria-hidden /> site-data.json
              </a>
            </div>
            <p className="mb-4" style={{ fontSize: 12.5, color: "var(--muted)" }}>
              Every number on this page traces to one of these committed artifacts.
            </p>
            <ul className="flex flex-col" role="list">
              {data.artifacts.map((a) => (
                <li key={a.path} className="flex items-center justify-between gap-3 py-2" style={{ borderTop: "1px solid var(--line)" }}>
                  <div className="min-w-0">
                    <a className="mono focusring link block truncate" href={a.path} download data-source-artifact data-testid="download-link" style={{ fontSize: 12.5, textDecoration: "none" }}>
                      {a.name}
                    </a>
                    <div className="truncate" style={{ fontSize: 11.5, color: "var(--faint)" }}>{a.note}</div>
                  </div>
                  <span className="chip shrink-0" style={a.tier === "fresh" ? { borderStyle: "dashed", borderColor: "var(--primary-dim)", color: "var(--primary)" } : undefined}>
                    {tiers[a.tier]}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <TermBlock lines={["curl -LO https://aziron-ai.github.io/atlas/data/site-data.json"]} />
            </div>
            <a className="link mt-3 inline-flex items-center gap-1" style={{ fontSize: 12.5 }} href="https://github.com/aziron-ai/atlas/tree/main/data" target="_blank" rel="noreferrer">
              Browse all raw artifacts on GitHub <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          </div>

          <div className="panel p-5" data-testid="provenance">
            <div className="kicker mb-4">Provenance</div>
            <dl className="mono flex flex-col gap-2.5" style={{ fontSize: 12.5 }}>
              {[
                ["scoring model", r.method.scoringModel],
                ["sampling", r.method.sampling],
                ["coverage", `${r.method.cells} cells · ${r.method.modelCalls} model calls`],
                ["native", "15 callers + 3 decoys, by construction"],
                ["fresh-run host", f.platform],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="shrink-0" style={{ color: "var(--faint)" }}>{k}</dt>
                  <dd className="text-right" style={{ color: "var(--text)" }}>{v}</dd>
                </div>
              ))}
            </dl>
            <div className="kicker mb-3 mt-5">Fresh-run tool pins</div>
            <div className="flex flex-wrap gap-1.5">
              {f.tools
                .map((t) => {
                  // pull the version-looking token out of raw `--version` output
                  const m = String(t.version || "").match(/v?\d+\.\d+[^\s(),]*/);
                  return { tool: t.tool, pin: m ? m[0] : t.tool === "atlas" ? "dev" : null, full: t.version };
                })
                .filter((t) => t.pin)
                .slice(0, 10)
                .map((t) => (
                  <span key={t.tool} className="chip" title={t.full}>
                    {t.tool} {t.pin}
                  </span>
                ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================ install =================================== */

// Install commands follow the released version carried in site-data.json —
// bump package.json, re-run build-site-data, and the URLs stay current.
const installTabs = (v) => ({
  homebrew: {
    label: "Homebrew",
    sub: "macOS cask",
    lines: ["brew install --cask aziron-ai/atlas/atlas", "atlas version"],
  },
  npm: {
    label: "npm",
    sub: "node wrapper",
    lines: ["npm install -g @aziron/atlas", "atlas version"],
  },
  linux: {
    label: "Linux",
    sub: "amd64 / arm64",
    lines: [
      `curl -LO https://github.com/aziron-ai/atlas/releases/download/v${v}/atlas_${v}_linux_amd64.tar.gz`,
      `tar -xzf atlas_${v}_linux_amd64.tar.gz`,
      "sudo install -m 0755 atlas /usr/local/bin/atlas",
      "atlas version",
    ],
  },
});

function UsageStep({ n, title, line, copy }) {
  return (
    <div data-testid="usage-step" className="panel min-w-0 p-5">
      <div className="flex items-center gap-3">
        <span
          className="mono grid place-items-center rounded-full"
          style={{ width: 26, height: 26, background: "var(--surface-raised)", border: "1px solid var(--line-strong)", color: "var(--primary)", fontSize: 12, fontWeight: 600 }}
        >
          {n}
        </span>
        <h3 className="font-semibold" style={{ fontSize: 15 }}>{title}</h3>
      </div>
      <div className="mt-4">
        <TermBlock lines={[line]} />
      </div>
      <p className="mt-3" style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--muted)" }}>{copy}</p>
    </div>
  );
}

function Install({ version }) {
  const [tab, setTab] = useState("homebrew");
  const INSTALL_TABS = useMemo(() => installTabs(version), [version]);
  return (
    <section id="install" data-testid="install" className="shell py-16" aria-labelledby="install-title">
      <SectionHeader
        id="install-title"
        kicker="10 · Install & connect"
        title="One local binary, a SQLite graph, MCP for agents"
        actions={
          <>
            <a className="focusring chip" href="https://github.com/aziron-ai/atlas/releases/latest" target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
              releases/latest <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
            <a className="focusring chip" href="https://github.com/aziron-ai/atlas/pkgs/npm/atlas" target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
              npm
            </a>
          </>
        }
      >
        The default database is <span className="mono">sqlite://./.atlas/atlas.db</span> — no shared server required.
        Retrieval defaults to <span className="mono" style={{ color: "var(--primary)" }}>--detail high</span>, the
        knob’s sweet spot.
      </SectionHeader>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="panel min-w-0 p-5">
          <div className="seg mb-4" role="tablist" aria-label="Install method">
            {Object.entries(INSTALL_TABS).map(([key, t]) => (
              <button
                key={key}
                type="button"
                role="tab"
                data-testid={`install-tab-${key}`}
                className="seg-btn focusring"
                data-active={tab === key}
                aria-selected={tab === key}
                onClick={() => setTab(key)}
              >
                {t.label}
              </button>
            ))}
          </div>
          {Object.entries(INSTALL_TABS).map(([key, t]) => (
            <div key={key} className={tab === key ? "" : "hidden"} aria-hidden={tab !== key}>
              <div className="kicker mb-3">{t.sub}</div>
              <TermBlock lines={t.lines} />
              {key === "linux" && (
                <p className="mt-3" style={{ fontSize: 12, color: "var(--faint)" }}>
                  Release assets also include .deb, .rpm and .apk packages for amd64 and arm64.
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="grid min-w-0 gap-4">
          <UsageStep n="1" title="Index a repository" line="atlas index ." copy="Builds the local symbol, call, route and search graph into SQLite and reports discovery and indexing progress." />
          <UsageStep
            n="2"
            title="Retrieve code context"
            line={`atlas context --paths path/to/changed-file.go --query "review risk" --format json`}
            copy="Returns the compact context bundle this page benchmarks — callers, callees, routes — around any change."
          />
          <UsageStep
            n="3"
            title="Connect agents"
            line="atlas mcp --transport stdio"
            copy="Or use `atlas bootstrap --dry-run` to preview setup for Codex, Claude, and other supported assistants."
          />
        </div>
      </div>
    </section>
  );
}

/* ============================== app ===================================== */

function useScrollSpy(ids) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return undefined;
    const sections = ids.map((id) => document.getElementById(id)).filter(Boolean);
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-50% 0px -45% 0px", threshold: [0, 0.25, 0.5] }
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [ids.join(",")]);
  return active;
}

function BenchmarkExperience({ data }) {
  const active = useScrollSpy(["hero", "summary", "knob", "languages", "versus", "field", "real", "agents", "graph", "evidence", "install"]);
  useReveal([data.version]);

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <ProductHeader version={data.version} active="benchmarks" />
      <ConsoleBar active={active} />
      <main id="main">
        <Hero data={data} />
        <ExecSummary data={data} />
        <DetailKnob data={data} />
        <MaturitySection data={data} />
        <Versus data={data} />
        <FieldSection data={data} />
        <RealRepo data={data} />
        <AgentBench data={data} />
        <GraphSection />
        <EvidenceSection data={data} />
        <Install version={data.version} />
      </main>
      <footer className="hairline" style={{ marginTop: 8 }}>
        <div className="shell flex flex-col gap-2 py-8 sm:flex-row sm:items-center sm:justify-between">
          <span className="mono" style={{ fontSize: 12, color: "var(--faint)" }}>
            {data.report.label} · fresh run {data.generatedAt.slice(0, 10)}
          </span>
          <span className="mono" style={{ fontSize: 12, color: "var(--faint)" }}>
            Atlas v{data.version} · static, data-driven, self-contained
          </span>
        </div>
      </footer>
    </>
  );
}

function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const route = useSiteRoute();

  useEffect(() => {
    fetch("data/site-data.json", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(`Unable to load site data: ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => {
        console.error(e);
        setError(e);
      });
  }, []);

  if (error) {
    return (
      <main className="shell py-16">
        <div className="panel p-6" style={{ borderColor: "var(--danger)" }}>
          <div className="kicker" style={{ color: "var(--danger)" }}>load error</div>
          <p className="mt-2" style={{ color: "var(--text)" }}>{error.message}</p>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="shell py-24" aria-busy="true">
        <div className="panel p-6">
          <div className="kicker">loading</div>
          <div className="mt-4 flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-3 rounded" style={{ background: "var(--surface-raised)", width: `${80 - i * 18}%` }} />
            ))}
          </div>
          <p className="mono mt-5" style={{ fontSize: 12, color: "var(--faint)" }}>
            fetching data/site-data.json…
          </p>
        </div>
      </main>
    );
  }

  let view;
  if (route.view === "docs") view = <Documentation data={data} page={route.page} />;
  else if (route.view === "benchmarks") view = <BenchmarkExperience data={data} />;
  else view = <ProductHome data={data} />;
  return (
    <>
      {view}
      <CommandPalette />
      <ConsoleOverlay />
    </>
  );
}

/* Full-screen "Try now" Atlas Console overlay — opened by the hero button or ⌘K. */
function ConsoleOverlay() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("atlas:console", onOpen);
    return () => window.removeEventListener("atlas:console", onOpen);
  }, []);
  if (!open) return null;
  return (
    <div className="ac-overlay">
      <AtlasConsole onClose={() => setOpen(false)} />
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
