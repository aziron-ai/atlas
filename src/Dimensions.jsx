import React from "react";

/* ============================ DIMENSIONS =================================
 * The strength profile: one section that answers "why Atlas" across every
 * dimension that matters to an agent platform — accuracy, latency, tokens,
 * index speed, language coverage, cross-repo detection — each number carrying
 * its evidence class, rendered from data/dimensions-data.json (built by
 * scripts/build-dimensions-data.mjs from the aziron-atlas bench artifacts).
 * No chart CDN — inline SVG/CSS only, same rule as the rest of the site.
 * ========================================================================= */

function EvidenceChip({ children }) {
  return (
    <span
      className="mono inline-block rounded px-1.5 py-0.5"
      style={{ fontSize: 10, color: "var(--faint)", border: "1px solid var(--line)", background: "var(--bg2)" }}
    >
      {children}
    </span>
  );
}

function DimCard({ label, atlas, versus, sub, tone }) {
  return (
    <div className="panel flex flex-col gap-2 p-4" style={{ minWidth: 0 }}>
      <div className="kicker" style={{ color: "var(--faint)", fontSize: 10.5 }}>{label}</div>
      <div className="flex items-baseline gap-2">
        <span className="mono" style={{ fontSize: 26, fontWeight: 650, color: tone || "var(--primary)", letterSpacing: "-0.02em" }}>
          {atlas}
        </span>
        {versus && (
          <span className="mono" style={{ fontSize: 12, color: "var(--faint)" }}>{versus}</span>
        )}
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.45, color: "var(--muted)" }}>{sub}</div>
    </div>
  );
}

/* Per-language F1 strip: two aligned rows of 37 cells. Atlas's row is solid;
 * graphify's row shows exactly where the portable competitor goes dark. The
 * strip IS the coverage argument — no summary number is as convincing as 37
 * green cells over a row with 16 holes. */
function F1Strip({ perLanguage }) {
  const cell = (ok, lang, f1, tool) => (
    <div
      key={`${tool}-${lang}`}
      title={`${lang} — ${tool} F1 ${f1 == null ? "n/a" : f1.toFixed(2)}`}
      className="h-4 flex-1 rounded-[2px]"
      style={{
        minWidth: 7,
        background: ok ? "var(--primary)" : f1 === 0 ? "var(--danger)" : "var(--warning)",
        opacity: ok ? 0.95 : 0.75,
      }}
    />
  );
  return (
    <div className="flex flex-col gap-2" role="img" aria-label="Per-language F1: Atlas 37 of 37 perfect; graphify 21 of 37">
      {[
        ["atlas", (r) => r.f1],
        ["graphify", (r) => r.graphifyF1],
      ].map(([tool, get]) => (
        <div key={tool} className="flex items-center gap-2">
          <span className="mono w-16 shrink-0 text-right" style={{ fontSize: 11, color: tool === "atlas" ? "var(--primary)" : "var(--muted)" }}>
            {tool}
          </span>
          <div className="flex flex-1 gap-[3px]">{perLanguage.map((r) => cell(get(r) === 1, r.language, get(r), tool))}</div>
          <span className="mono w-12 shrink-0" style={{ fontSize: 11, color: "var(--faint)" }}>
            {perLanguage.filter((r) => get(r) === 1).length}/{perLanguage.length}
          </span>
        </div>
      ))}
      <div className="mono flex justify-between" style={{ fontSize: 10, color: "var(--faint)" }}>
        <span>{perLanguage[0]?.language}</span>
        <span>hover a cell for the language · red = F1 0.00 on the same fixture</span>
        <span>{perLanguage[perLanguage.length - 1]?.language}</span>
      </div>
    </div>
  );
}

/* Latency: every language on one log-scale track. Two dot clusters — Atlas in
 * the ~20ms decade, graphify in the ~200ms decade — make the 9x gap legible
 * without a single number. */
function LatencyField({ perLanguage }) {
  const all = perLanguage.flatMap((r) => [r.atlasMs, r.graphifyMs].filter((v) => v != null));
  const min = Math.min(...all), max = Math.max(...all);
  const x = (v) => ((Math.log10(v) - Math.log10(min * 0.8)) / (Math.log10(max * 1.2) - Math.log10(min * 0.8))) * 100;
  const ticks = [10, 30, 100, 300];
  return (
    <div className="flex flex-col gap-1">
      <div className="relative h-24 rounded-lg" style={{ background: "var(--bg2)", border: "1px solid var(--line)" }}>
        {ticks.map((t) => (
          <div key={t} className="absolute top-0 h-full" style={{ left: `${x(t)}%`, borderLeft: "1px dashed var(--line)" }}>
            <span className="mono absolute -top-0.5 pl-1" style={{ fontSize: 10, color: "var(--faint)" }}>{t}ms</span>
          </div>
        ))}
        {perLanguage.map((r, i) => (
          <React.Fragment key={r.language}>
            <div
              title={`${r.language} — atlas ${r.atlasMs}ms`}
              className="absolute h-2 w-2 rounded-full"
              style={{ left: `${x(r.atlasMs)}%`, top: `${18 + (i % 9) * 6}px`, background: "var(--primary)", opacity: 0.9 }}
            />
            {r.graphifyMs != null && (
              <div
                title={`${r.language} — graphify ${r.graphifyMs}ms`}
                className="absolute h-2 w-2 rounded-full"
                style={{ left: `${x(r.graphifyMs)}%`, top: `${18 + (i % 9) * 6}px`, background: "var(--warning)", opacity: 0.6 }}
              />
            )}
          </React.Fragment>
        ))}
      </div>
      <div className="mono flex items-center gap-4" style={{ fontSize: 11, color: "var(--muted)" }}>
        <span className="flex items-center gap-1.5"><i className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--primary)" }} /> atlas (median 22.9ms)</span>
        <span className="flex items-center gap-1.5"><i className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--warning)", opacity: 0.7 }} /> graphify (median 207.7ms)</span>
        <span style={{ color: "var(--faint)" }}>log scale · every dot = one language, identical fixture, this machine</span>
      </div>
    </div>
  );
}

/* Tool landscape: the "one binary vs a fleet" argument as a coverage bar per
 * tool with its role spelled out — LSP/SCIP authorities are the reference
 * standard (one language each), not competitors to dunk on. */
function ToolLandscape({ toolLandscape }) {
  const max = Math.max(...toolLandscape.map((t) => t.languages));
  return (
    <div className="flex flex-col gap-2.5">
      {toolLandscape.map((t) => (
        <div key={t.tool} className="grid items-center gap-3" style={{ gridTemplateColumns: "11rem minmax(0,1fr) 9rem" }}>
          <div className="min-w-0">
            <div className="mono truncate" style={{ fontSize: 12.5, color: t.tool === "atlas" ? "var(--primary)" : "var(--text)" }}>{t.tool}</div>
            <div className="truncate" style={{ fontSize: 11, color: "var(--faint)" }}>{t.kind}</div>
          </div>
          <div className="h-3 rounded-full" style={{ background: "var(--bg2)", border: "1px solid var(--line)" }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max((t.languages / max) * 100, 2.5)}%`,
                background: t.tool === "atlas" ? "var(--primary)" : "var(--line-strong)",
              }}
            />
          </div>
          <div className="mono text-right" style={{ fontSize: 11.5, color: "var(--muted)" }}>
            {t.languages} lang{t.languages === 1 ? "" : "s"}
            {t.queryMs != null ? ` · ${t.queryMs}ms` : ""}
            {t.f1 != null ? ` · F1 ${t.f1}` : ""}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Dimensions({ dims }) {
  if (!dims) return null;
  const h = dims.headline;
  const xrq = h.crossRepo && h.crossRepo.queries;
  return (
    <section id="dimensions" data-testid="dimensions" className="shell py-16" aria-labelledby="dim-title">
      <div className="mb-7">
        <div className="kicker" style={{ color: "var(--primary)" }}>
          Six dimensions · fixture-truth + LSP-truth + real-repo evidence · reproducible from bench/
        </div>
        <h2 id="dim-title" className="mt-3 text-balance font-semibold tracking-tight" style={{ fontSize: "clamp(22px,3vw,30px)", lineHeight: 1.1, letterSpacing: "-0.015em" }}>
          The strength profile: right answer, every language, in tens of milliseconds
        </h2>
        <p className="mt-3 max-w-3xl" style={{ fontSize: 15, lineHeight: 1.6, color: "var(--muted)" }}>
          One deterministic binary measured across the dimensions an agent platform actually pays for. Every number
          below keeps its evidence class, and every claim regenerates from{" "}
          <a href="data/dimensions-data.json" download style={{ color: "var(--primary)" }}>dimensions-data.json</a>.
        </p>
      </div>

      {/* six dimension cards */}
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <DimCard label="accuracy — callers F1" atlas={`${h.accuracy.atlasPerfect}/${h.accuracy.total}`} versus={`gfy ${h.accuracy.graphifyPerfect}/${h.accuracy.total}`} sub="perfect languages, fixture-truth (exact set F1, no LLM)" />
        <DimCard label="query latency" atlas={`${h.latency.atlasMedianMs}ms`} versus={`gfy ${h.latency.graphifyMedianMs}ms`} sub={`${h.latency.ratio}x faster, median over 37 languages, CLI-spawn included`} />
        <DimCard label="accuracy per 100 tokens" atlas={h.tokens.accuracyPer100Tok.atlas} versus={`gfy ${h.tokens.accuracyPer100Tok.graphify}`} sub="answer correctness bought per token of context handed to the agent" />
        <DimCard label="index speed" atlas={`${h.speed.medianFixtureIndexMs}ms`} sub="median fixture reindex; real 272-file repo indexes in seconds, incrementally" />
        <DimCard label="coverage" atlas={`${h.coverage.languages}`} sub="languages with a perfect who-calls answer from ONE binary" />
        <DimCard label="LSP-truth check" atlas={h.lspTruth.meanF1.toFixed(3)} versus="vs gopls" sub={`real production Go repo, ${h.lspTruth.symbols} symbols — the authority check`} />
      </div>

      {/* accuracy strip */}
      <div className="panel mb-6 p-5 sm:p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="mono" style={{ fontSize: 13, color: "var(--text)" }}>
            Per-language callers F1 — Atlas vs the closest portable competitor, identical fixtures
          </div>
          <EvidenceChip>fixture-truth · exact set comparison · no LLM scoring</EvidenceChip>
        </div>
        <F1Strip perLanguage={dims.perLanguage} />
      </div>

      {/* latency field */}
      <div className="panel mb-6 p-5 sm:p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="mono" style={{ fontSize: 13, color: "var(--text)" }}>Query latency, all 37 languages on one log scale</div>
          <EvidenceChip>median of 3 runs · identical fixtures · same machine</EvidenceChip>
        </div>
        <LatencyField perLanguage={dims.perLanguage} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* tool landscape */}
        <div className="panel p-5 sm:p-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="mono" style={{ fontSize: 13, color: "var(--text)" }}>The tool landscape: one binary vs a fleet</div>
            <EvidenceChip>coverage measured here · LSP/SCIP are the reference standard</EvidenceChip>
          </div>
          <ToolLandscape toolLandscape={dims.toolLandscape} />
          <p className="mt-3" style={{ fontSize: 12, lineHeight: 1.55, color: "var(--faint)" }}>
            LSP servers and SCIP indexers are precise by construction — they are the ground truth Atlas is scored
            against (gopls: {h.lspTruth.meanF1.toFixed(3)} on a real repo), not straw men. Matching Atlas's coverage
            with them means installing, configuring, and warming one tool per language.
          </p>
        </div>

        {/* cross-repo detection */}
        <div className="panel p-5 sm:p-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="mono" style={{ fontSize: 13, color: "var(--text)" }}>Cross-repo detection on a real workspace</div>
            <EvidenceChip>Go API server + React app, indexed together</EvidenceChip>
          </div>
          {h.crossRepo ? (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg p-3" style={{ background: "var(--bg2)", border: "1px solid var(--line)" }}>
                  <div className="mono" style={{ fontSize: 22, fontWeight: 650, color: "var(--primary)" }}>{h.crossRepo.producerRoutes}</div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)" }}>producer HTTP routes extracted from the server — its public contract, mapped automatically</div>
                </div>
                <div className="rounded-lg p-3" style={{ background: "var(--bg2)", border: "1px solid var(--line)" }}>
                  <div className="mono" style={{ fontSize: 22, fontWeight: 650, color: "var(--primary)" }}>{h.crossRepo.consumerRows}</div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)" }}>consumer call sites recorded — the raw material for blast-radius across repos</div>
                </div>
              </div>
              {xrq && (
                <div className="mono flex flex-col gap-1" style={{ fontSize: 11.5, color: "var(--muted)" }}>
                  {Object.entries(xrq).map(([op, q]) => (
                    <div key={op} className="flex justify-between">
                      <span>{op.replace(/_/g, "-")}</span>
                      <span style={{ color: "var(--faint)" }}>{q.latency_ms}ms{typeof q.count === "number" ? ` · ${q.count} rows` : ""}</span>
                    </div>
                  ))}
                </div>
              )}
              <p style={{ fontSize: 12, lineHeight: 1.55, color: "var(--faint)" }}>
                Who calls this endpoint? What breaks downstream if this handler changes? Those answers need routes
                linked ACROSS repositories — extraction shown here runs on every index, no extra infrastructure.
              </p>
            </div>
          ) : (
            <p style={{ fontSize: 12.5, color: "var(--muted)" }}>cross-repo measurements pending for this run</p>
          )}
        </div>
      </div>
    </section>
  );
}
