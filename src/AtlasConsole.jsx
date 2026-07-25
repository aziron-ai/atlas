import React, { useEffect, useMemo, useRef, useState } from "react";
import GraphExplorer from "./GraphExplorer";
import { getGraphData } from "./graphData";
import { convertExport } from "./exportConvert";

/* Atlas Console — a real Atlas terminal running in the browser over a pre-indexed
   sample of facebook/react (data/graph.json). Terminal-forward: the terminal is
   the experience; the graph is a small reactive minimap that lights up results.
   Every callers/callees/impact/search/symbol result is genuinely computed over
   the real 280-symbol / 675-edge export (reverse-edge index + BFS). */

function langLabel(v) {
  if (v === "cpp") return "C++";
  if (v === "typescript") return "TypeScript";
  if (v === "javascript") return "JavaScript";
  if (!v) return "unknown";
  return v.charAt(0).toUpperCase() + v.slice(1);
}
function pkgOf(path) {
  const p = (path || "").split("/");
  return p[0] === "packages" && p.length > 1 ? p[1] : (p[0] || "");
}
function lev(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const d = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i += 1) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= n; j += 1) {
      const t = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = t;
    }
  }
  return d[n];
}

function buildEngine(data) {
  const nodes = data.nodes;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const callersOf = new Map();
  const calleesOf = new Map();
  const push = (m, k, v) => { const a = m.get(k); if (a) a.push(v); else m.set(k, [v]); };
  data.edges.forEach((e) => {
    if (e.s === e.t) return;
    push(calleesOf, e.s, e.t); // s calls t
    push(callersOf, e.t, e.s);
  });
  const nameToIds = new Map();
  nodes.forEach((n) => push(nameToIds, n.name.toLowerCase(), n.id));
  for (const [, ids] of nameToIds) ids.sort((x, y) => byId.get(y).deg - byId.get(x).deg);

  const cite = (n) => (n.line ? `${n.path}:${n.line}` : n.path);

  function resolve(term) {
    const t = (term || "").replace(/^["'`]+|["'`]+$/g, "").toLowerCase();
    if (nameToIds.has(t)) {
      const ids = nameToIds.get(t);
      const others = [...new Set(ids.slice(1).map((x) => pkgOf(byId.get(x).path)))];
      return { id: ids[0], defs: ids.length, others };
    }
    // did-you-mean: closest names
    const cands = [];
    for (const n of nodes) {
      const nl = n.name.toLowerCase();
      if (nl.includes(t) || t.includes(nl)) cands.push([n, 0]);
      else { const d = lev(t, nl); if (d <= 2) cands.push([n, d]); }
    }
    cands.sort((a, b) => a[1] - b[1] || b[0].deg - a[0].deg);
    return { id: null, suggest: cands.slice(0, 3).map((c) => c[0].name) };
  }

  function callers(id, dir) {
    const src = dir === "callees" ? calleesOf : callersOf;
    const list = (src.get(id) || []).map((x) => byId.get(x))
      .sort((a, b) => b.deg - a.deg);
    return list;
  }

  function impact(id) {
    const seen = new Set([id]);
    let frontier = [id], hops = 0;
    while (frontier.length) {
      const next = [];
      for (const x of frontier) for (const c of (callersOf.get(x) || [])) {
        if (!seen.has(c)) { seen.add(c); next.push(c); }
      }
      if (next.length) hops += 1;
      frontier = next;
    }
    seen.delete(id);
    return { affected: [...seen], hops };
  }

  function search(term) {
    const t = term.toLowerCase();
    const hits = nodes.filter((n) => n.name.toLowerCase().includes(t) || (n.path || "").toLowerCase().includes(t));
    hits.sort((a, b) => {
      const as = a.name.toLowerCase().startsWith(t) ? 0 : 1;
      const bs = b.name.toLowerCase().startsWith(t) ? 0 : 1;
      return as - bs || b.deg - a.deg;
    });
    return hits;
  }

  function run(raw) {
    let line = raw.trim().replace(/^(atlas\s+)+/i, "");
    const [cmd, ...rest] = line.split(/\s+/);
    const arg = rest.join(" ");
    const c = (cmd || "").toLowerCase();

    if (c === "help" || c === "") {
      return { kind: "help" };
    }
    if (c === "search") {
      if (!arg) return { kind: "error", msg: "usage: atlas search <term>" };
      const hits = search(arg);
      return { kind: "search", term: arg, total: hits.length, rows: hits.slice(0, 40).map((n) => ({ name: n.name, kind: n.kind, cite: cite(n) })), highlight: hits.slice(0, 40).map((n) => n.id) };
    }
    if (c === "callers" || c === "callees") {
      if (!arg) return { kind: "error", msg: `usage: atlas ${c} <symbol>` };
      const r = resolve(arg);
      if (r.id == null) return { kind: "error", msg: `no symbol "${arg}"`, suggest: r.suggest };
      const list = callers(r.id, c);
      return { kind: c, name: byId.get(r.id).name, total: list.length,
        rows: list.map((n) => ({ name: n.name, kind: n.kind, cite: cite(n) })),
        highlight: [r.id, ...list.map((n) => n.id)] };
    }
    if (c === "impact") {
      if (!arg) return { kind: "error", msg: "usage: atlas impact <symbol>" };
      const r = resolve(arg);
      if (r.id == null) return { kind: "error", msg: `no symbol "${arg}"`, suggest: r.suggest };
      const { affected, hops } = impact(r.id);
      const per = new Map();
      affected.forEach((x) => { const k = pkgOf(byId.get(x).path); per.set(k, (per.get(k) || 0) + 1); });
      const bars = [...per.entries()].sort((a, b) => b[1] - a[1]);
      const max = bars.length ? bars[0][1] : 1;
      const top = bars.slice(0, 5).map(([pk, ct]) => ({ pkg: pk, count: ct, pct: Math.max(8, (ct / max) * 100) }));
      const restCt = bars.slice(5).reduce((s, x) => s + x[1], 0);
      if (restCt) top.push({ pkg: `+ ${bars.length - 5} more packages`, count: restCt, pct: Math.max(8, (restCt / max) * 100) });
      return { kind: "impact", name: byId.get(r.id).name, affected: affected.length, hops, bars: top, highlight: [r.id, ...affected] };
    }
    if (c === "symbol") {
      if (!arg) return { kind: "error", msg: "usage: atlas symbol <symbol>" };
      const r = resolve(arg);
      if (r.id == null) return { kind: "error", msg: `no symbol "${arg}"`, suggest: r.suggest };
      const n = byId.get(r.id);
      const cl = (callersOf.get(r.id) || []).length;
      const ce = (calleesOf.get(r.id) || []).length;
      const imp = impact(r.id).affected.length;
      return { kind: "symbol", node: { name: n.name, kind: n.kind, lang: n.lang, cite: cite(n) }, defs: r.defs || 1, others: r.others || [], callers: cl, callees: ce, impact: imp, highlight: [r.id, ...(callersOf.get(r.id) || []), ...(calleesOf.get(r.id) || [])] };
    }
    return { kind: "error", msg: `unknown command "${cmd}" — try: callers · callees · impact · search · symbol · help` };
  }

  const names = [];
  {
    const seen = new Set();
    for (const n of [...nodes].sort((a, b) => b.deg - a.deg)) {
      const k = n.name.toLowerCase();
      if (!seen.has(k)) { seen.add(k); names.push(n.name); }
    }
  }

  return { run, names, nameSet: new Set(names.map((n) => n.toLowerCase())), meta: data.meta };
}

/* ---- rendering ---- */
function Rows({ rows, run, total, initial = 6 }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? rows : rows.slice(0, initial);
  const hiddenHere = rows.length - shown.length;
  const beyond = (total ?? rows.length) - rows.length; // e.g. search capped at 40
  return (
    <>
      {shown.map((r, i) => (
        <div className="ac-row" key={i}>
          <button className="ac-sym" type="button" onClick={() => run(`atlas symbol ${r.name}`)}>{r.name}</button>
          <span className="ac-k">{r.kind}</span>
          <span className="ac-rp" dir="rtl"><bdi>{r.cite}</bdi></span>
        </div>
      ))}
      {hiddenHere > 0 && (
        <button className="ac-more" type="button" onClick={() => setExpanded(true)}>
          ▾ show {hiddenHere} more
        </button>
      )}
      {expanded && rows.length > initial && (
        <button className="ac-more" type="button" onClick={() => setExpanded(false)}>▴ collapse</button>
      )}
      {expanded && beyond > 0 && <div className="ac-faint">showing first {rows.length} of {total}</div>}
    </>
  );
}

function Result({ r, run, showMap }) {
  if (r.kind === "info") {
    return <div className="ac-ready">✓ {r.msg}</div>;
  }
  if (r.kind === "help") {
    const cmds = [["callers <symbol>", "who calls it"], ["callees <symbol>", "what it calls"], ["impact <symbol>", "blast radius (reverse reachability)"], ["symbol <symbol>", "definition + degree"], ["search <term>", "lexical search"], ["load", "open your own atlas export (or drag a JSON here)"]];
    return (
      <>
        <div className="ac-dim">Atlas over a pre-indexed sample of <b>facebook/react</b> — 280 symbols · 675 call edges.</div>
        {cmds.map(([a, b]) => (
          <div className="ac-row2" key={a}><span className="ac-cmd">atlas {a}</span><span className="ac-dim">{b}</span></div>
        ))}
        <div className="ac-faint">click a symbol in any result, or a node on the map, to inspect it.</div>
      </>
    );
  }
  if (r.kind === "error") {
    return (
      <>
        <div className="ac-err">{r.msg}</div>
        {r.suggest && r.suggest.length > 0 ? (
          <div className="ac-dim">did you mean {r.suggest.map((s, i) => (
            <span key={s}>{i ? " · " : ""}<button className="ac-sym" type="button" onClick={() => run(`atlas symbol ${s}`)}>{s}</button></span>
          ))}?</div>
        ) : r.suggest ? (
          <div className="ac-dim">try <span className="ac-cmd">atlas search &lt;term&gt;</span> to find symbols by substring</div>
        ) : null}
      </>
    );
  }
  if (r.kind === "callers" || r.kind === "callees") {
    return (
      <>
        <div><span className="ac-hd">{r.kind}</span> {r.name} <span className="ac-tot">total {r.total}</span></div>
        {r.total === 0 && (
          <div className="ac-dim">{r.kind === "callers" ? "no callers in this slice — nothing depends on it here" : "no callees — a leaf in this slice"}</div>
        )}
        <Rows rows={r.rows} run={run} total={r.total} />
      </>
    );
  }
  if (r.kind === "search") {
    return (
      <>
        <div><span className="ac-hd">search</span> {r.term} <span className="ac-tot">{r.total} hits</span></div>
        {r.total === 0 && <div className="ac-dim">no hits — try a shorter term</div>}
        <Rows rows={r.rows} run={run} total={r.total} />
        {r.total > 40 && <button className="ac-maplink" type="button" onClick={showMap}>◇ top 40 on the map →</button>}
      </>
    );
  }
  if (r.kind === "impact") {
    return (
      <>
        <div><span className="ac-hd">impact</span> {r.name} <span className="ac-tot">{r.affected} affected · {r.hops} hops</span></div>
        <div className="ac-bars">
          {r.bars.map((b, i) => (
            <div className="ac-brow" key={i}>
              <span className="ac-bl">{b.pkg}</span>
              <span className="ac-btrack"><i style={{ width: `${b.pct}%` }} /></span>
              <span className="ac-bn">{b.count}</span>
            </div>
          ))}
        </div>
        {r.affected === 0
          ? <div className="ac-dim">no dependents reach this symbol in this slice</div>
          : <button className="ac-maplink" type="button" onClick={showMap}>◇ show on the map →</button>}
      </>
    );
  }
  if (r.kind === "symbol") {
    const n = r.node;
    return (
      <div className="ac-card">
        <div className="ac-cname">{n.name}</div>
        <div className="ac-cline"><span className="ac-k">{n.kind} · {langLabel(n.lang)}</span> · {n.cite}</div>
        <div className="ac-clinks">
          <button className="ac-cmd" type="button" onClick={() => run(`atlas callers ${n.name}`)}>callers({r.callers})</button>
          <button className="ac-cmd" type="button" onClick={() => run(`atlas callees ${n.name}`)}>callees({r.callees})</button>
          <button className="ac-cmd" type="button" onClick={() => run(`atlas impact ${n.name}`)}>impact({r.impact})</button>
        </div>
        {r.defs > 1 && (
          <div className="ac-faint">{r.defs} definitions share this name — showing the highest-degree{r.others.length ? ` · also in ${r.others.slice(0, 3).join(", ")}` : ""}</div>
        )}
      </div>
    );
  }
  return null;
}

const TRY = [
  ["callers useState", "atlas callers useState"],
  ["impact error", "atlas impact error"],
  ["search hydrate", "atlas search hydrate"],
  ["symbol beginWork", "atlas symbol beginWork"],
  ["help", "atlas help"],
];

export default function AtlasConsole({ onClose, compact = false }) {
  const [fetched, setFetched] = useState(null);
  const [custom, setCustom] = useState(null);
  const data = custom || fetched;
  const [blocks, setBlocks] = useState([]);
  const [hl, setHl] = useState(null);
  const [input, setInput] = useState("");
  const [active, setActive] = useState("callers useState");
  const [mapOn, setMapOn] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const hist = useRef([]);
  const histAt = useRef(-1);
  const [sugIdx, setSugIdx] = useState(0);
  const [sugHidden, setSugHidden] = useState(false);
  const bid = useRef(0);
  const autoRan = useRef(false);
  const fileRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    let alive = true;
    getGraphData()
      .then((d) => { if (alive) setFetched(d); })
      .catch(() => { if (alive) setLoadError(true); });
    return () => { alive = false; };
  }, []);
  const eng = useMemo(() => (data ? buildEngine(data) : null), [data]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [blocks]);

  const pushInfo = (msg, isErr) => {
    setBlocks((bs) => [...bs, { id: ++bid.current, echo: null, r: { kind: isErr ? "error" : "info", msg } }]);
  };

  const loadExportFile = (file) => {
    if (!file) return;
    file.text().then((txt) => {
      let parsed;
      try { parsed = JSON.parse(txt); } catch (e) { pushInfo(`${file.name}: not valid JSON`, true); return; }
      try {
        const label = file.name.replace(/\.json$/i, "");
        const conv = convertExport(parsed, label);
        setCustom(conv);
        setHl(null);
        pushInfo(`loaded ${label} — ${conv.meta.shown_nodes} symbols · ${conv.meta.shown_edges} call edges (from ${conv.meta.nodes_total} exported)`);
      } catch (e) {
        pushInfo(`${file.name}: ${e.message}`, true);
      }
    });
  };

  const run = (raw) => {
    if (!eng) return;
    const line = raw.trim();
    if (!line) return;
    if (/^(atlas\s+)?load$/i.test(line)) {
      if (fileRef.current) fileRef.current.click();
      return;
    }
    hist.current.push(line);
    histAt.current = hist.current.length;
    const short = line.replace(/^atlas\s+/i, "");
    setActive(short);
    const r = eng.run(line);
    setBlocks((bs) => [...bs, { id: ++bid.current, echo: `atlas ${line.replace(/^(atlas\s+)+/i, "")}`, r }]);
    setHl(r.highlight && r.highlight.length ? [...new Set(r.highlight)] : null);
  };

  const customRan = useRef(null);
  useEffect(() => {
    if (custom && eng && customRan.current !== custom) {
      customRan.current = custom;
      const top = eng.names[0];
      if (top) { const t = setTimeout(() => run(`atlas callers ${top}`), 250); return () => clearTimeout(t); }
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [custom, eng]);

  useEffect(() => {
    if (eng && !autoRan.current) {
      autoRan.current = true;
      const t = setTimeout(() => run("atlas callers useState"), 650);
      return () => clearTimeout(t);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eng]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && onClose) onClose(); };
    window.addEventListener("keydown", onKey);
    if (!compact) {
      setTimeout(() => inputRef.current && inputRef.current.focus({ preventScroll: true }), 60);
    }
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, compact]);

  // ---- autocomplete over commands + real symbol names (degree-ranked) ----
  const ARG_CMDS = ["callers", "callees", "impact", "symbol", "search"];
  const CMDS = [...ARG_CMDS, "help"];
  const sugs = useMemo(() => {
    if (!eng) return [];
    // completing the binary name itself: "a" → "atl" → "atlas"
    if (/^\s*a(t(l(a(s)?)?)?)?$/i.test(input) && input.trim() !== "" && !/^\s*atlas$/i.test(input)) {
      return [{ v: "atlas", t: "bin" }];
    }
    // bare "atlas" (or "atlas ") → offer every command
    if (/^\s*atlas\s*$/i.test(input)) {
      return CMDS.map((c) => ({ v: c, t: "cmd" }));
    }
    const raw = input.replace(/^atlas\s*/i, "");
    if (raw !== "" && input.trim() === "") return [];
    const parts = raw.split(/\s+/);
    const trailing = /\s$/.test(raw);
    if (parts.length <= 1 && !trailing) {
      const t = (parts[0] || "").toLowerCase();
      if (!t) return [];
      return CMDS.filter((c) => c.startsWith(t) && c !== t).map((c) => ({ v: c, t: "cmd" }));
    }
    const cmd = (parts[0] || "").toLowerCase();
    if (!ARG_CMDS.includes(cmd)) return [];
    const arg = trailing ? "" : (parts[parts.length - 1] || "");
    const al = arg.toLowerCase();
    const out = [];
    for (const n of eng.names) {
      if (n.toLowerCase().startsWith(al) && n !== arg) { out.push({ v: n, t: "sym" }); if (out.length >= 6) break; }
    }
    return out;
  }, [input, eng]);
  useEffect(() => { setSugIdx(0); setSugHidden(false); }, [input]);

  const acceptSug = (pick) => {
    const chosen = pick || sugs[sugIdx];
    if (!chosen) return;
    const raw = input.replace(/^atlas\s*/i, "");
    const parts = raw.split(/\s+/);
    const trailing = /\s$/.test(raw);
    let next;
    if (chosen.t === "bin") next = "atlas ";
    else if (chosen.t === "cmd") next = `atlas ${chosen.v} `;
    else if (trailing) next = `atlas ${raw}${chosen.v}`;
    else next = `atlas ${[...parts.slice(0, -1), chosen.v].join(" ")}`;
    setInput(next);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) { el.focus({ preventScroll: true }); el.setSelectionRange(next.length, next.length); }
    });
  };

  // ghost = inline completion of the current token by the selected suggestion
  const ghost = useMemo(() => {
    const cur = sugHidden ? null : sugs[sugIdx];
    if (!cur) return "";
    const raw = input.replace(/^atlas\s*/i, "");
    if (/\s$/.test(raw)) return "";
    const parts = raw.split(/\s+/);
    const tok = parts[parts.length - 1] || "";
    if (!tok) return "";
    return cur.v.toLowerCase().startsWith(tok.toLowerCase()) ? cur.v.slice(tok.length) : "";
  }, [sugs, sugIdx, input, sugHidden]);

  const onTrapKey = (e) => {
    if (e.key !== "Tab" || compact) return;
    const root = e.currentTarget;
    const focusables = root.querySelectorAll("button, input, [tabindex]:not([tabindex='-1'])");
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  const onInputKey = (e) => {
    if (e.key === "Tab" || (e.key === "ArrowRight" && ghost && e.target.selectionStart === input.length)) {
      if (sugs.length) { e.preventDefault(); acceptSug(); return; }
    }
    if (e.key === "Enter") {
      // accept the open menu selection — unless the token is already an exact
      // symbol name (e.g. "error" while "erroredTask" is still suggested)
      const rawIn = input.replace(/^(atlas\s+)+/i, "");
      const lastTok = /\s$/.test(rawIn) ? "" : (rawIn.trim().split(/\s+/).pop() || "").toLowerCase();
      const exact = lastTok && eng && eng.nameSet.has(lastTok);
      if (sugs.length && !sugHidden && !exact) { e.preventDefault(); acceptSug(); return; }
      if (!eng) return; run(input); setInput("");
    }
    else if (e.key === "Escape" && sugs.length && !sugHidden) { e.stopPropagation(); setSugHidden(true); }
    else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (sugs.length > 1) setSugIdx((i) => (i - 1 + sugs.length) % sugs.length);
      else if (hist.current.length) { histAt.current = Math.max(0, histAt.current - 1); setInput(hist.current[histAt.current] || ""); }
    }
    else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (sugs.length > 1) setSugIdx((i) => (i + 1) % sugs.length);
      else { histAt.current = Math.min(hist.current.length, histAt.current + 1); setInput(hist.current[histAt.current] || ""); }
    }
  };

  return (
    <div
      className={`ac-app${mapOn ? " has-map" : ""}${dragging ? " dragging" : ""}`}
      role="dialog" aria-modal="true" aria-label="Atlas Console" onKeyDown={onTrapKey}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={(e) => { if (e.target === e.currentTarget) setDragging(false); }}
      onDrop={(e) => { e.preventDefault(); setDragging(false); loadExportFile(e.dataTransfer.files && e.dataTransfer.files[0]); }}
    >
      {dragging && <div className="ac-drop">drop an <b>atlas export</b> (JSON) to query your own repo</div>}
      <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: "none" }}
        onChange={(e) => { loadExportFile(e.target.files && e.target.files[0]); e.target.value = ""; }} />
      <header className="ac-bar">
        <span className="ac-dot" style={{ background: "#ff5f56" }} />
        <span className="ac-dot" style={{ background: "#ffbd2e" }} />
        <span className="ac-dot" style={{ background: "#27c93f" }} />
        <span className="ac-title"><span className="ac-live" /> Atlas Console <span className="ac-sub">— running in your browser</span></span>
        <span className="ac-pill">{(eng && eng.meta.repo) || "facebook/react"} · <b>pre-indexed</b> · client-side</span>
        <button
          type="button"
          className={`ac-toggle${mapOn ? " on" : ""}`}
          onClick={() => setMapOn((v) => !v)}
          aria-pressed={mapOn}
          title={mapOn ? "Hide the map" : "Show the map"}
        >
          <span className="d">◇</span> map {mapOn ? "on" : "off"}
        </button>
        {compact ? (
          <button className="ac-x" type="button" onClick={() => window.dispatchEvent(new CustomEvent("atlas:console"))} aria-label="Expand to full screen" title="Expand to full screen">⤢</button>
        ) : (
          onClose && <button className="ac-x" type="button" onClick={onClose} aria-label="Close console">✕</button>
        )}
      </header>

      <div className={`ac-main${mapOn ? " with-map" : ""}`}>
        <section className="ac-term" aria-label="Atlas terminal">
          <div className="ac-scroll" ref={scrollRef}>
            {eng && (
              <div className="ac-ready">✓ atlas ready — <b>{eng.meta.repo}</b> · {eng.meta.shown_nodes} symbols · {eng.meta.shown_edges} call edges · engine: client-side (wasm planned)</div>
            )}
            {blocks.length === 0 && !eng && !loadError && <div className="ac-dim">booting query engine over facebook/react…</div>}
            {loadError && <div className="ac-err">couldn’t load the index — reload the page to retry.</div>}
            {blocks.map((b) => (
              <div className="ac-blk" key={b.id} data-kind={b.r.kind}>
                {b.echo != null && <div className="ac-echo"><span className="ac-ps1">❯</span> <span className="ac-etxt">{b.echo}</span></div>}
                <Result r={b.r} run={run} showMap={() => setMapOn(true)} />
              </div>
            ))}
          </div>
          <div className="ac-chips">
            <span className="ac-lab">try</span>
            {(custom && eng
              ? [
                  [`callers ${eng.names[0]}`, `atlas callers ${eng.names[0]}`],
                  [`impact ${eng.names[1] || eng.names[0]}`, `atlas impact ${eng.names[1] || eng.names[0]}`],
                  [`symbol ${eng.names[2] || eng.names[0]}`, `atlas symbol ${eng.names[2] || eng.names[0]}`],
                  ["help", "atlas help"],
                ]
              : TRY
            ).map(([label, cmd]) => (
              <button key={cmd} type="button" className={`ac-chip${active === label ? " on" : ""}`} onClick={() => run(cmd)}>{label}</button>
            ))}
          </div>
          <div className="ac-prompt" onClick={() => inputRef.current && inputRef.current.focus()}>
            {sugs.length > 0 && !sugHidden && (
              <div className="ac-sugs" role="listbox" aria-label="Completions">
                {sugs.map((sg, i) => (
                  <button key={sg.v + sg.t} type="button" role="option" aria-selected={i === sugIdx}
                    className={`ac-sug${i === sugIdx ? " on" : ""}`}
                    onMouseEnter={() => setSugIdx(i)}
                    onClick={() => acceptSug(sg)}>
                    <span className="ac-sug-t">{sg.t === "sym" ? "ƒ" : "❯"}</span> {sg.v}
                  </button>
                ))}
                <span className="ac-sug-hint">tab to complete</span>
              </div>
            )}
            <span className="ac-p">~/react — atlas ❯</span>
            <span className="ac-inwrap">
              <span className="ac-ghost" aria-hidden="true"><i>{input}</i>{ghost}</span>
              <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onInputKey}
                placeholder="atlas callers <symbol>   ·   tab completes" aria-label="Atlas command" autoComplete="off" spellCheck={false} />
            </span>
          </div>
        </section>

        {mapOn && (
          <aside className="ac-map" aria-label="Code graph minimap">
            <div className="ac-map-h">
              <span>◇ map</span>
              <span className="ac-map-n">{hl ? `${hl.length} lit` : "280 symbols"}</span>
            </div>
            <div className="ac-map-body">
              <GraphExplorer bare dataOverride={data} highlightIds={hl} onInspect={(n) => run(`atlas symbol ${n.name}`)} className="ac-gx" />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
