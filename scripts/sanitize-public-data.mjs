#!/usr/bin/env node
// Scrub local-machine paths and internal identifiers from every published
// data artifact, then re-stamp the artifact hashes that reference them.
//
// This site is public. Bench runs happen on private machines and private
// workspaces, and the raw artifacts they emit carry strings like
// /Users/<name>/... and /tmp/<workdir>/... — none of which belong on a
// public page or in a public download. The scrub keeps every measurement
// byte-identical in meaning (tool identities, versions, counts, timings)
// and rewrites only the path prefixes that identify a person or a machine.
//
// Idempotent: running it twice is a no-op.
// Usage: node scripts/sanitize-public-data.mjs
"use strict";

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(repoRoot, "data");
const rawDir = path.join(dataDir, "raw");

// Ordered: the most specific rewrite first so the generic ones never
// half-eat it. `<atlas-src>` = the Atlas source checkout on the bench host.
const RULES = [
  [/\/Users\/[A-Za-z0-9._-]+\/workspace\/[A-Za-z0-9._-]+\/aziron-atlas/g, "<atlas-src>"],
  [/\/Users\/[A-Za-z0-9._-]+/g, "$HOME"],
  [/\/home\/[A-Za-z0-9._-]+/g, "$HOME"],
  [/\/root\//g, "$HOME/"],
  [/\/tmp\//g, "$WORK/"],
  [/damirdarasu/g, "bench"],
];

// Nothing below may survive in any published file. "$HOME"/"$WORK" are the
// sanctioned placeholders, so the check targets the raw forms only.
const BANNED = [/\/Users\//, /damirdarasu/, /\/tmp\/atlas-live/, /MsysTechnologies/i];

function scrub(text) {
  let out = text;
  for (const [re, to] of RULES) out = out.replace(re, to);
  return out;
}

const files = [];
for (const dir of [dataDir, rawDir]) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isFile() && /\.(json|md)$/.test(f)) files.push(p);
  }
}

let changed = 0;
for (const p of files) {
  const before = fs.readFileSync(p, "utf8");
  const after = scrub(before);
  if (after !== before) {
    fs.writeFileSync(p, after);
    changed++;
    console.log(`scrubbed ${path.relative(repoRoot, p)}`);
  }
}

// Re-stamp: benchmark-data.json's sourceArtifacts records bytes+sha256 of the
// raw files it was derived from; scrubbing those files changes both.
const bmPath = path.join(dataDir, "benchmark-data.json");
const bm = JSON.parse(fs.readFileSync(bmPath, "utf8"));
let restamped = 0;
for (const a of bm.sourceArtifacts || []) {
  const p = path.join(repoRoot, a.path);
  if (!fs.existsSync(p)) continue;
  const buf = fs.readFileSync(p);
  const sha = crypto.createHash("sha256").update(buf).digest("hex");
  if (a.sha256 !== sha || a.bytes !== buf.length) {
    a.sha256 = sha;
    a.bytes = buf.length;
    restamped++;
  }
}
if (restamped) fs.writeFileSync(bmPath, JSON.stringify(bm, null, 2) + "\n");

// Hard verification pass — fail the build rather than publish a leak.
const leaks = [];
for (const p of files) {
  const text = fs.readFileSync(p, "utf8");
  for (const re of BANNED) if (re.test(text)) leaks.push(`${path.relative(repoRoot, p)}: ${re}`);
}
if (leaks.length) {
  console.error("LEAKS REMAIN:\n" + leaks.join("\n"));
  process.exit(1);
}
console.log(`sanitized ${changed} files, restamped ${restamped} artifact hashes, leak check CLEAN (${files.length} files)`);
