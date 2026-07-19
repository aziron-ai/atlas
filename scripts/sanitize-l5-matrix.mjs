#!/usr/bin/env node
// Produce data/raw/L5_MATRIX_PUBLIC.json from a raw bench/L5_MATRIX.json.
//
// The raw artifact is public-safe by construction EXCEPT for failure rows,
// whose error/stderr snippets can carry local filesystem paths. This script
// keeps every scored number and every per-symbol row (including the excused
// blind-spot lists — auditability is the point) and reduces failure rows to
// a status + a path-free reason.
//
// Usage: node scripts/sanitize-l5-matrix.mjs /path/to/bench/L5_MATRIX.json
"use strict";

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = process.argv[2];
if (!src) throw new Error("Usage: node scripts/sanitize-l5-matrix.mjs /path/to/L5_MATRIX.json");

const m = JSON.parse(fs.readFileSync(src, "utf8"));

const scrub = (s) =>
  String(s ?? "")
    .replace(/\/(?:Users|home|private|tmp|opt|var)\/[^\s'"\]]*/g, "<path>")
    .slice(0, 200);

m.results = (m.results || []).map((r) => {
  const out = { ...r };
  // failure diagnostics: keep the shape, drop anything path-like
  if (out.error) out.error = scrub(out.error);
  if (out.prepare_warn) out.prepare_warn = scrub(out.prepare_warn);
  if (out.missing) out.missing = scrub(out.missing);
  if (out.atlas_index?.err) out.atlas_index = { ...out.atlas_index, err: scrub(out.atlas_index.err) };
  return out;
});

const text = JSON.stringify(m, null, 2) + "\n";
const BANNED = [/\/Users\//, /\/home\//, /damirdarasu/i];
for (const re of BANNED) {
  if (re.test(text)) throw new Error(`sanitized artifact still leaks: ${re}`);
}
const dest = path.join(repoRoot, "data", "raw", "L5_MATRIX_PUBLIC.json");
fs.writeFileSync(dest, text);
console.log(`wrote ${path.relative(repoRoot, dest)} — ${m.results.length} language rows, leak check CLEAN`);
