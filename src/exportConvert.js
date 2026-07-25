// Convert a raw `atlas export --all --format json` payload (nodes keyed by
// SHA NodeIDs, edges {from,to}) into the console's compact graph shape:
//   { meta, nodes:[{id,name,kind,lang,path,deg,c,line}], edges:[{s,t}] }
// This is the client-side port of the offline downsampler that produced the
// facebook/react sample: filter to real code symbols, grow a connected core,
// sparsify to the strongest edges, community = top-level module. Deterministic.
// Already-converted payloads (edges with {s,t}) pass through untouched.

const KINDS = new Set(["function", "method", "class"]);
const SKIP_LANGS = new Set(["markdown", "json", "yaml", "toml", "config", "text", "html", "css"]);
const BAD_PATH = /(^|\/)(__tests__|__mocks__|__fixtures__|fixtures|tests?|spec|node_modules|vendor|dist|build|\.github)(\/|$)|\.test\.|\.spec\.|-test\./i;
const TARGET = 280;
const PER_NODE = 8;

function moduleOf(path) {
  const parts = (path || "").split("/");
  if (parts[0] === "packages" && parts.length > 2) return `packages/${parts[1]}`;
  return parts.length > 1 ? parts[0] : "(root)";
}

export function convertExport(raw, label) {
  if (raw && Array.isArray(raw.nodes) && Array.isArray(raw.edges)) {
    if (raw.edges.length === 0 || (raw.edges[0] && raw.edges[0].s !== undefined)) {
      // already in console shape
      return raw;
    }
  } else {
    throw new Error("not an atlas export — expected { nodes: [...], edges: [...] }");
  }

  const strict = (n) =>
    KINDS.has(n.kind) &&
    (n.name || "").trim() &&
    (n.path || "") &&
    !BAD_PATH.test(n.path) &&
    !SKIP_LANGS.has((n.language || "").toLowerCase());
  const loose = (n) => (n.name || "").trim() && !SKIP_LANGS.has((n.language || "").toLowerCase());

  let byId = new Map(raw.nodes.filter(strict).map((n) => [n.id, n]));
  const connect = (pool) => {
    const adj = new Map();
    for (const e of raw.edges) {
      const a = e.from, b = e.to;
      if (a === b || !pool.has(a) || !pool.has(b)) continue;
      if (!adj.has(a)) adj.set(a, new Set());
      if (!adj.has(b)) adj.set(b, new Set());
      adj.get(a).add(b);
      adj.get(b).add(a);
    }
    return adj;
  };
  let adj = connect(byId);
  // tiny/odd exports: relax the filter so we still show something real
  if ([...byId.keys()].filter((k) => adj.has(k)).length < 20) {
    byId = new Map(raw.nodes.filter(loose).map((n) => [n.id, n]));
    adj = connect(byId);
  }
  const pool = [...byId.keys()].filter((k) => adj.has(k));
  if (pool.length < 3) throw new Error("no connected code symbols in this export");
  const deg = new Map(pool.map((k) => [k, adj.get(k).size]));

  // connected core: grow from the top hub, highest-degree first (deterministic)
  const byDeg = (a, b) => deg.get(b) - deg.get(a) || (a < b ? -1 : 1);
  const seed = [...pool].sort(byDeg)[0];
  const selected = new Set([seed]);
  while (selected.size < Math.min(TARGET, pool.length)) {
    let best = null;
    for (const nid of selected) {
      for (const m of adj.get(nid)) {
        if (selected.has(m)) continue;
        if (best === null || byDeg(m, best) < 0) best = m;
      }
    }
    if (best === null) break;
    selected.add(best);
  }
  const sel = [...selected].sort(byDeg);
  const idx = new Map(sel.map((nid, i) => [nid, i]));

  // directed core edges, sparsified to the strongest PER_NODE per endpoint
  const directed = new Set();
  for (const e of raw.edges) {
    if (idx.has(e.from) && idx.has(e.to) && e.from !== e.to) {
      directed.add(`${idx.get(e.from)},${idx.get(e.to)}`);
    }
  }
  const edges = [...directed].map((k) => k.split(",").map(Number));
  const degc = new Map();
  for (const [s, t] of edges) {
    degc.set(s, (degc.get(s) || 0) + 1);
    degc.set(t, (degc.get(t) || 0) + 1);
  }
  const inc = new Map();
  for (const e of edges) {
    for (const end of [e[0], e[1]]) {
      if (!inc.has(end)) inc.set(end, []);
      inc.get(end).push(e);
    }
  }
  const kept = new Set();
  for (let i = 0; i < sel.length; i += 1) {
    const es = (inc.get(i) || [])
      .slice()
      .sort((a, b) => (degc.get(b[0]) + degc.get(b[1])) - (degc.get(a[0]) + degc.get(a[1])))
      .slice(0, PER_NODE);
    for (const e of es) kept.add(e.join(","));
  }
  const keptEdges = [...kept].map((k) => k.split(",").map(Number)).sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  // communities: top-level modules ranked by member count → c0..c5
  const modCount = new Map();
  for (const nid of sel) {
    const m = moduleOf(byId.get(nid).path);
    modCount.set(m, (modCount.get(m) || 0) + 1);
  }
  const ranked = [...modCount.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([m]) => m);
  const rank = new Map(ranked.map((m, r) => [m, Math.min(r, 5)]));

  const coreDeg = new Map();
  for (const [s, t] of keptEdges) {
    coreDeg.set(s, (coreDeg.get(s) || 0) + 1);
    coreDeg.set(t, (coreDeg.get(t) || 0) + 1);
  }

  const nodes = sel.map((nid, i) => {
    const n = byId.get(nid);
    return {
      id: i,
      name: n.name,
      kind: n.kind || "symbol",
      lang: (n.language || "").toLowerCase(),
      path: n.path || "",
      deg: coreDeg.get(i) || 0,
      c: rank.get(moduleOf(n.path)),
      line: Number(n.line) || 0,
    };
  });

  return {
    meta: {
      repo: label || "your export",
      source: "atlas export --all",
      nodes_total: raw.nodes.length,
      edges_total: raw.edges.length,
      shown_nodes: nodes.length,
      shown_edges: keptEdges.length,
      communities: Math.min(6, modCount.size),
    },
    nodes,
    edges: keptEdges.map(([s, t]) => ({ s, t })),
  };
}
