// Shared, module-level cache for data/graph.json.
// Every consumer (GraphExplorer instances, AtlasConsole terminal + minimap,
// the §08 embed AND the full-screen overlay) awaits the SAME promise, so the
// network fetch + JSON parse happen exactly once per page load — and because
// they all hold the same object identity, downstream WeakMap caches (layout,
// query engine) also compute exactly once.
let promise = null;

export function getGraphData() {
  if (!promise) {
    promise = fetch("data/graph.json").then((r) => {
      if (!r.ok) throw new Error(`graph.json: HTTP ${r.status}`);
      return r.json();
    });
    // allow retry on a failed load instead of caching the failure forever
    promise.catch(() => { promise = null; });
  }
  return promise;
}
