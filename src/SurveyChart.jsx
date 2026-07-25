import React, { useEffect, useRef, useState } from "react";

/* ============================================================
   SurveyChart — the hero figure of the Cartograph landing.
   One real Atlas query drawn as a survey sheet: the primary
   symbol as a triangulation station, its cited callers as
   routes, impact paths dashed in coral, module boundaries as
   nested contours. Deterministic layout; no randomness.
   ============================================================ */

const C = {
  contour: "var(--contour-2)",
  contourSoft: "var(--contour)",
  ink: "var(--text)",
  muted: "var(--muted)",
  faint: "var(--faint)",
  signal: "var(--primary)",
  route: "var(--chart-settlement)",
  impact: "var(--danger)",
  settlement: "var(--chart-settlement)",
  ground: "var(--chart-ground)",
};

const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';
const DISP = 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif';

/* Catmull-Rom closed loop -> cubic beziers */
function blobPath(pts) {
  const n = pts.length;
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n; i += 1) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0]},${p2[1]}`;
  }
  return `${d}Z`;
}

function shrink(pts, f) {
  let cx = 0;
  let cy = 0;
  pts.forEach((p) => {
    cx += p[0];
    cy += p[1];
  });
  cx /= pts.length;
  cy /= pts.length;
  return pts.map((p) => [cx + (p[0] - cx) * f, cy + (p[1] - cy) * f]);
}

function routePath(a, b, bend) {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  return `M${a[0]},${a[1]}Q${(mx + px * bend).toFixed(1)},${(my + py * bend).toFixed(1)} ${b[0]},${b[1]}`;
}

const W = 720;
const H = 560;
const M = 26;
const S = [398, 296]; /* the surveyed point */

const TERRITORIES = [
  { name: "INTERNAL / AUTH", lx: 462, ly: 402, pts: [[300, 205], [472, 182], [560, 268], [500, 392], [352, 418], [262, 318]] },
  { name: "HANDLERS", lx: 96, ly: 226, pts: [[76, 102], [232, 80], [292, 158], [212, 226], [96, 200]] },
  { name: "MIDDLEWARE", lx: 84, ly: 342, pts: [[66, 356], [216, 342], [258, 428], [172, 500], [72, 466]] },
  { name: "TESTS", lx: 508, ly: 78, pts: [[506, 78], [652, 62], [694, 132], [618, 196], [514, 158]] },
];

const SCATTER = [
  [120, 140], [190, 118], [250, 176], [110, 300], [200, 390], [130, 452],
  [560, 130], [640, 100], [660, 170], [330, 250], [430, 230], [500, 320],
  [400, 380], [320, 350], [610, 250], [660, 350], [560, 470], [300, 480],
];

const CALLERS = [
  { p: [172, 132], bend: -34, label: "handlers/session.go:42", lx: 60, ly: 118, anchor: "start" },
  { p: [150, 402], bend: 30, label: "middleware/access.go:19", lx: 56, ly: 428, anchor: "start" },
  { p: [592, 112], bend: 30, label: "tests/auth_test.go:116", lx: 700, ly: 96, anchor: "end" },
  { p: [268, 246], bend: -12 },
  { p: [212, 328], bend: 14 },
  { p: [524, 176], bend: 16 },
];

const IMPACTS = [
  { p: [586, 338], bend: -22 },
  { p: [624, 436], bend: -14 },
  { p: [470, 486], bend: 20 },
];

const halo = {
  paintOrder: "stroke",
  stroke: C.ground,
  strokeWidth: 3.5,
  strokeLinejoin: "round",
};

function Legend() {
  return (
    <figcaption className="chart-legend">
      <div className="lg">
        <svg width="34" height="16" viewBox="0 0 34 16" aria-hidden>
          <polygon points="17,2 11,13 23,13" fill="none" stroke={C.signal} strokeWidth="1.6" />
          <circle cx="17" cy="9.5" r="1.5" fill={C.signal} />
        </svg>
        <span>Surveyed symbol — the query&rsquo;s primary result</span>
      </div>
      <div className="lg">
        <svg width="34" height="16" viewBox="0 0 34 16" aria-hidden>
          <circle cx="17" cy="8" r="3.4" fill={C.settlement} stroke={C.ground} strokeWidth="1" />
        </svg>
        <span>File (settlement) — larger when cited with file:line</span>
      </div>
      <div className="lg">
        <svg width="34" height="16" viewBox="0 0 34 16" aria-hidden>
          <path d="M2,12 Q17,2 32,10" fill="none" stroke={C.route} strokeWidth="1.5" />
        </svg>
        <span>Caller route — 6 cited; 3 labeled with grid references</span>
      </div>
      <div className="lg">
        <svg width="34" height="16" viewBox="0 0 34 16" aria-hidden>
          <path d="M2,11 Q17,3 30,8" fill="none" stroke={C.impact} strokeWidth="1.4" strokeDasharray="5 4" markerEnd="url(#imp-arrow)" />
        </svg>
        <span>Impact path — 3 likely change-propagation routes</span>
      </div>
      <div className="lg">
        <svg width="34" height="16" viewBox="0 0 34 16" aria-hidden>
          <ellipse cx="17" cy="8" rx="14" ry="6" fill="none" stroke={C.contour} strokeWidth="1.1" />
          <ellipse cx="17" cy="8" rx="9" ry="3.6" fill="none" stroke={C.contour} strokeWidth="0.7" />
        </svg>
        <span>Contour — module boundary (auth, handlers, tests…)</span>
      </div>
      <p className="legend-note">
        Positions are schematic; every file:line reference is exact and returned by the query.
      </p>
    </figcaption>
  );
}

export default function SurveyChart() {
  const cols = 6;
  const rows = 4;
  const letters = ["A", "B", "C", "D", "E", "F"];
  return (
    <figure className="chart-panel" style={{ margin: 0 }} aria-label="Map figure: one Atlas query drawn as a survey chart">
      <div className="chart-head">
        <span className="title">Sheet A·1 — one query, charted</span>
        <span className="coord mono">atlas context --query "review risk"</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Survey chart of one Atlas query. The surveyed symbol AuthorizeRequest at internal/auth.go line 84 sits at the center of the auth territory. Six caller routes converge on it, three labeled: handlers/session.go line 42, middleware/access.go line 19, and tests/auth_test.go line 116. Three dashed impact paths lead outward to dependent files. Contour lines mark module boundaries."
      >
        <defs>
          <marker id="imp-arrow" viewBox="0 0 8 8" refX="6.5" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0.5 L7.5,4 L0,7.5 Z" fill={C.impact} />
          </marker>
        </defs>

        {/* map frame with graticule ticks + edge grid refs */}
        <rect x={M} y={M} width={W - 2 * M} height={H - 2 * M} fill="none" stroke={C.contour} strokeWidth="1" />
        {Array.from({ length: cols }, (_, i) => {
          const gx = M + (i + 0.5) * ((W - 2 * M) / cols);
          return (
            <g key={`c${i}`}>
              <line x1={gx} y1={M} x2={gx} y2={M + 5} stroke={C.contour} />
              <line x1={gx} y1={H - M} x2={gx} y2={H - M - 5} stroke={C.contour} />
              <text x={gx} y={M - 9} textAnchor="middle" fill={C.faint} fontSize="9.5" fontFamily={MONO}>
                {letters[i]}
              </text>
            </g>
          );
        })}
        {Array.from({ length: rows }, (_, i) => {
          const gy = M + (i + 0.5) * ((H - 2 * M) / rows);
          return (
            <g key={`r${i}`}>
              <line x1={M} y1={gy} x2={M + 5} y2={gy} stroke={C.contour} />
              <line x1={W - M} y1={gy} x2={W - M - 5} y2={gy} stroke={C.contour} />
              <text x={M - 12} y={gy + 3} textAnchor="middle" fill={C.faint} fontSize="9.5" fontFamily={MONO}>
                {i + 1}
              </text>
            </g>
          );
        })}
        {Array.from({ length: cols - 1 }, (_, i) => {
          const gx = M + (i + 1) * ((W - 2 * M) / cols);
          return <line key={`gv${i}`} x1={gx} y1={M} x2={gx} y2={H - M} stroke={C.contourSoft} strokeWidth="0.6" />;
        })}
        {Array.from({ length: rows - 1 }, (_, i) => {
          const gy = M + (i + 1) * ((H - 2 * M) / rows);
          return <line key={`gh${i}`} x1={M} y1={gy} x2={W - M} y2={gy} stroke={C.contourSoft} strokeWidth="0.6" />;
        })}

        {/* territories: module boundaries as nested contours */}
        {TERRITORIES.map((t) => (
          <g key={t.name}>
            {[1, 0.72, 0.45].map((f, j) => (
              <path
                key={f}
                d={blobPath(f === 1 ? t.pts : shrink(t.pts, f))}
                fill={j === 0 ? "rgba(148,163,184,0.08)" : "none"}
                stroke={C.contour}
                strokeWidth={j === 0 ? 1.1 : 0.7}
              />
            ))}
            <text x={t.lx} y={t.ly} fill={C.faint} fontSize="9.5" letterSpacing="0.22em" fontFamily={DISP}>
              {t.name}
            </text>
          </g>
        ))}

        {/* background settlements: other indexed files */}
        {SCATTER.map((p) => (
          <circle key={`${p[0]}-${p[1]}`} cx={p[0]} cy={p[1]} r="1.6" fill={C.faint} opacity="0.5" />
        ))}

        {/* six caller routes (3 carry their published grid references) */}
        {CALLERS.map((c, idx) => (
          <g key={`caller-${c.p[0]}-${c.p[1]}`}>
            <path
              className="route-anim"
              d={routePath(c.p, S, c.bend)}
              fill="none"
              stroke={C.route}
              strokeWidth={c.label ? 1.5 : 1.1}
              opacity={c.label ? 0.9 : 0.55}
              pathLength="1"
              style={{ animationDelay: `${0.25 + idx * 0.12}s` }}
            />
            <circle cx={c.p[0]} cy={c.p[1]} r={c.label ? 4 : 2.6} fill={C.settlement} stroke={C.ground} strokeWidth="1.2" />
            {c.label ? (
              <g>
                <text x={c.lx} y={c.ly} fill={C.ink} fontSize="10.5" fontFamily={MONO} textAnchor={c.anchor} fontWeight="600" style={halo}>
                  {c.label}
                </text>
                <text x={c.lx} y={c.ly + 13} fill={C.faint} fontSize="7.5" fontFamily={DISP} letterSpacing="0.2em" textAnchor={c.anchor} style={halo}>
                  CITED CALLER
                </text>
              </g>
            ) : null}
          </g>
        ))}

        {/* three impact paths: dashed coral, arrowed, leading outward */}
        <g className="fade-anim">
          {IMPACTS.map((m) => (
            <g key={`impact-${m.p[0]}-${m.p[1]}`}>
              <path
                d={routePath(S, m.p, m.bend)}
                fill="none"
                stroke={C.impact}
                strokeWidth="1.4"
                strokeDasharray="5 4"
                markerEnd="url(#imp-arrow)"
                opacity="0.85"
              />
              <circle cx={m.p[0]} cy={m.p[1]} r="2.6" fill={C.impact} opacity="0.8" />
            </g>
          ))}
          <text x={596} y={480} fill={C.impact} fontSize="8.5" fontFamily={DISP} letterSpacing="0.18em" textAnchor="middle" style={halo}>
            3 IMPACT PATHS
          </text>
        </g>

        {/* station symbol: triangulation mark */}
        <g>
          <circle className="station-pulse" cx={S[0]} cy={S[1]} r="15" fill="none" stroke={C.signal} opacity="0.35" />
          <circle cx={S[0]} cy={S[1]} r="24" fill="none" stroke={C.signal} opacity="0.14" />
          <polygon
            points={`${S[0]},${S[1] - 9} ${S[0] - 8},${S[1] + 6} ${S[0] + 8},${S[1] + 6}`}
            fill={C.ground}
            stroke={C.signal}
            strokeWidth="1.8"
          />
          <circle cx={S[0]} cy={S[1] + 0.5} r="2" fill={C.signal} />
        </g>
        <text x={S[0] + 30} y={S[1] - 4} fill={C.signal} fontSize="13" fontWeight="700" fontFamily={DISP} letterSpacing="0.03em" style={halo}>
          AuthorizeRequest
        </text>
        <text x={S[0] + 30} y={S[1] + 12} fill={C.muted} fontSize="10.5" fontFamily={MONO} style={halo}>
          internal/auth.go:84
        </text>
        <text x={S[0] + 30} y={S[1] + 26} fill={C.faint} fontSize="7.5" fontFamily={DISP} letterSpacing="0.18em" style={halo}>
          6 CITED CALLERS · 3 IMPACT PATHS
        </text>

        {/* cartouche: the query that produced this figure */}
        <g>
          <rect x={M + 14} y={H - M - 58} width="268" height="44" fill="var(--chart-ground)" stroke={C.contour} />
          <rect x={M + 17} y={H - M - 55} width="262" height="38" fill="none" stroke={C.contourSoft} />
          <text x={M + 28} y={H - M - 41} fill={C.faint} fontSize="8" fontFamily={DISP} letterSpacing="0.24em">
            SURVEY OF ONE QUERY
          </text>
          <text x={M + 28} y={H - M - 25} fill={C.ink} fontSize="10" fontFamily={MONO}>
            atlas context --query "review risk"
          </text>
        </g>
      </svg>
      <Legend />
    </figure>
  );
}

/* Latency scale bar (M-02): 7.4 ms vs 128 ms on an honest linear scale */
export function LatencyScaleBar() {
  const SW = 700;
  const SH = 96;
  const SL = 16;
  const SR = SW - 16;
  const axisY = 58;
  const maxMs = 130;
  const sx = (ms) => SL + (ms / maxMs) * (SR - SL);
  const blocks = Array.from({ length: 13 }, (_, i) => i);
  const ticks = [0, 25, 50, 75, 100, 125];
  const markers = [
    { ms: 7.4, label: "ATLAS · 7.4 ms", color: C.signal, anchor: "start", dx: -6, atlas: true },
    { ms: 128, label: "GRAPH BASELINE · 128 ms", color: C.muted, anchor: "end", dx: 6 },
  ];

  const ref = useRef(null);
  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [inView, setInView] = useState(!!reduce);
  useEffect(() => {
    if (reduce || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return undefined;
    }
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setInView(true);
            io.disconnect();
          }
        });
      },
      { threshold: 0.45 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduce]);

  return (
    <svg
      ref={ref}
      className={`lsb${inView ? " in" : ""}`}
      viewBox={`0 0 ${SW} ${SH}`}
      role="img"
      aria-label="Latency scale bar from 0 to 130 milliseconds. Atlas is marked at 7.4 milliseconds; the graph baseline at 128 milliseconds."
    >
      {blocks.map((i) => (
        <rect
          key={i}
          className="lsb-block"
          style={{ "--bi": i }}
          x={sx(i * 10)}
          y={axisY - 4}
          width={sx(10) - sx(0)}
          height="8"
          fill={i % 2 ? "rgba(148,163,184,0.14)" : "rgba(148,163,184,0.34)"}
          stroke={C.contour}
          strokeWidth="0.5"
        />
      ))}
      {ticks.map((t) => (
        <g key={t}>
          <line x1={sx(t)} y1={axisY + 6} x2={sx(t)} y2={axisY + 11} stroke={C.faint} />
          <text x={sx(t)} y={axisY + 24} textAnchor="middle" fill={C.faint} fontSize="10" fontFamily={MONO}>
            {t}
          </text>
        </g>
      ))}
      <text x={SR} y={axisY + 24} textAnchor="end" fill={C.faint} fontSize="10" fontFamily={MONO}>
        ms
      </text>
      {markers.map((f, mi) => (
        <g key={f.label} className={`lsb-mark${f.atlas ? " atlas" : ""}`} style={{ "--md": mi }}>
          {f.atlas && (
            <circle className="lsb-halo" cx={sx(f.ms)} cy={axisY - 29} r="3" fill="none" stroke={f.color} strokeWidth="1.4" />
          )}
          <line className="lsb-stem" x1={sx(f.ms)} y1={axisY - 4} x2={sx(f.ms)} y2={axisY - 26} stroke={f.color} strokeWidth="1.5" />
          <circle className="lsb-dot" cx={sx(f.ms)} cy={axisY - 29} r="3" fill={f.color} />
          <text className="lsb-label" x={sx(f.ms) + f.dx} y={axisY - 38} textAnchor={f.anchor} fill={f.color} fontSize="11" fontWeight="700" fontFamily={MONO}>
            {f.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
