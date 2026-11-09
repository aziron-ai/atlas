#!/usr/bin/env python3
"""Natural-language retrieval relevance benchmark and gate (aziron-ai/atlas#44).

Runs the frozen, labelled query sets in relevance-bench/queries/ against three
Atlas retrieval surfaces on a FRESH store of each frozen corpus
(relevance-bench/CORPORA.json) and scores the ranked results offline:

  search      `atlas search QUERY --limit 10 --json`            (CLI, lexical)
  context     `atlas context --query QUERY --json`               (CLI bundle, intent auto)
  code_query  MCP stdio tools/call code_query, require_citations=true

Metrics (relevance-bench/relevance_metrics.py, unit-tested): precision@1/3/5/10,
MRR, recall@10, entity-first routing rate, adversarial refusal rate, plus
report-only latency, serialized bytes, truncation and test/fixture share.

Usage:
  python3 relevance-bench/relevance_bench.py --atlas BIN [--work DIR]
      [--source SLUG=PATH ...] [--corpus NAME ...] [--surface NAME ...]
      [--no-gate] [--write-gate] [--keep-stores] [--details-out FILE]
      [--results-json OUT.json] [--results-md OUT.md]

Corpora are materialized from the pinned commits in CORPORA.json into
--work/corpora (cached; verified against the frozen tree SHA) and indexed into
--work/stores/<corpus>/atlas.db, which is deleted first so every run measures
a fresh store. --source points a component at a local clone (offline); without
it the component is fetched from its upstream URL. --keep-stores keeps the
stores (default: deleted after the run, small-disk discipline).

Exit status: 0 = every gated metric held (or --no-gate); 1 = a gated metric
fell below its frozen threshold or a surface returned no JSON; 2 = the
benchmark could not run (binary, corpus fetch/tree mismatch, no GATE.json).
"""

from __future__ import annotations

import argparse
import datetime as _dt
import hashlib
import json
import os
import pathlib
import platform
import shutil
import subprocess
import sys
import time
from typing import Any

HERE = pathlib.Path(__file__).resolve().parent
REPO_ROOT = HERE.parent  # public layout: relevance-bench/ at the repository root
sys.path.insert(0, str(HERE))

import relevance_metrics as rm  # noqa: E402
import relevance_report  # noqa: E402

CORPORA_FILE = HERE / "CORPORA.json"
QUERIES_DIR = HERE / "queries"
GATE_FILE = HERE / "GATE.json"
DEFAULT_RESULTS_JSON = HERE / "RESULTS.json"
DEFAULT_RESULTS_MD = HERE / "RESULTS.md"

SURFACES = ("search", "context", "code_query")
TOP_K = 10
INDEX_TIMEOUT_S = 1800
QUERY_TIMEOUT_S = 180

# Every ambient ATLAS_* knob is stripped so a developer's shell cannot change the
# measurement; these are then set explicitly. ATLAS_HOME isolates registries and
# update state under --work; AUTO_UPDATE=0 means zero update network.
PINNED_ENV = {
    "ATLAS_AUTO_UPDATE": "0",
    "ATLAS_NO_BOOTSTRAP": "1",
    "ATLAS_NO_WATCH": "1",
    "DO_NOT_TRACK": "1",
}


# ── corpora ──────────────────────────────────────────────────────────────────


def load_corpora(path: pathlib.Path = CORPORA_FILE) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _git(args: list[str], cwd: pathlib.Path, env: dict[str, str] | None = None) -> str:
    completed = subprocess.run(
        ["git", *args],
        cwd=str(cwd),
        env={**os.environ, **(env or {})},
        capture_output=True,
        text=True,
        timeout=900,
    )
    if completed.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} failed in {cwd}: {completed.stderr.strip()[:400]}")
    return completed.stdout.strip()


def _source_for(component: dict[str, Any], sources: dict[str, str]) -> str:
    local = sources.get(component["slug"])
    if local:
        resolved = pathlib.Path(local).expanduser().resolve()
        if not (resolved / ".git").exists():
            raise RuntimeError(f"--source {component['slug']}={local}: not a git checkout")
        return resolved.as_uri()
    return component["url"]


def materialize_corpus(
    name: str, spec: dict[str, Any], corpus_root: pathlib.Path, sources: dict[str, str]
) -> dict[str, str]:
    """Check out the corpus's pinned commit(s) at corpus_root/name and verify
    the frozen tree. Returns {"path", "head", "tree"}. Re-uses a cached checkout
    whose HEAD tree already matches."""
    dest = corpus_root / name
    frozen_tree = spec.get("tree")
    if (dest / ".git").exists() and frozen_tree:
        try:
            if _git(["rev-parse", "HEAD^{tree}"], dest) == frozen_tree and not _git(
                ["status", "--porcelain", "--untracked-files=all"], dest
            ):
                return {"path": str(dest), "head": _git(["rev-parse", "HEAD"], dest), "tree": frozen_tree}
        except RuntimeError:
            pass
    if dest.exists():
        shutil.rmtree(dest)
    dest.mkdir(parents=True)
    _git(["init", "-q"], dest)
    components = spec["components"]
    for component in components:
        _git(["fetch", "-q", "--depth", "1", _source_for(component, sources), component["commit"]], dest)
        fetched = _git(["rev-parse", "FETCH_HEAD"], dest)
        if fetched != component["commit"]:
            raise RuntimeError(f"{name}: fetched {fetched}, pinned {component['commit']}")
    if len(components) == 1 and not components[0].get("prefix"):
        _git(["-c", "advice.detachedHead=false", "checkout", "-q", "--detach", components[0]["commit"]], dest)
    else:
        _git(["read-tree", "--empty"], dest)
        for component in components:
            prefix = component["prefix"].strip("/") + "/"
            _git(["read-tree", f"--prefix={prefix}", component["commit"] + "^{tree}"], dest)
        tree = _git(["write-tree"], dest)
        synthetic = spec.get("synthetic_commit") or {}
        author = synthetic.get("author", "atlas-relevance-bench <relevance-bench@atlas.invalid>")
        author_name, _, author_email = author.partition(" <")
        when = synthetic.get("date", "2026-10-29T00:00:00Z")
        env = {
            "GIT_AUTHOR_NAME": author_name,
            "GIT_AUTHOR_EMAIL": author_email.rstrip(">"),
            "GIT_AUTHOR_DATE": when,
            "GIT_COMMITTER_NAME": author_name,
            "GIT_COMMITTER_EMAIL": author_email.rstrip(">"),
            "GIT_COMMITTER_DATE": when,
        }
        commit = _git(["commit-tree", tree, "-m", synthetic.get("message", f"atlas relevance corpus {name}")], dest, env)
        _git(["update-ref", "refs/heads/relevance-corpus", commit], dest)
        _git(["symbolic-ref", "HEAD", "refs/heads/relevance-corpus"], dest)
        _git(["checkout-index", "-a", "-f"], dest)
    tree = _git(["rev-parse", "HEAD^{tree}"], dest)
    if frozen_tree and tree != frozen_tree:
        raise RuntimeError(f"{name}: materialized tree {tree} != frozen tree {frozen_tree} (CORPORA.json)")
    return {"path": str(dest), "head": _git(["rev-parse", "HEAD"], dest), "tree": tree}


# ── atlas invocation ─────────────────────────────────────────────────────────


def atlas_env(work: pathlib.Path) -> dict[str, str]:
    env = {k: v for k, v in os.environ.items() if not k.startswith("ATLAS_")}
    env.update(PINNED_ENV)
    env["ATLAS_HOME"] = str(work / "atlas-home")
    (work / "atlas-home").mkdir(parents=True, exist_ok=True)
    return env


def atlas_version(binary: str, env: dict[str, str]) -> str:
    completed = subprocess.run([binary, "version"], capture_output=True, text=True, env=env, timeout=60)
    return (completed.stdout or completed.stderr).strip()


def index_corpus(binary: str, corpus_path: str, store: pathlib.Path, env: dict[str, str]) -> dict[str, Any]:
    if store.parent.exists():
        shutil.rmtree(store.parent)
    store.parent.mkdir(parents=True)
    started = time.monotonic()
    completed = subprocess.run(
        [binary, "--db", f"sqlite://{store}", "index", corpus_path, "--unlisted", "--progress=false", "--json"],
        capture_output=True,
        text=True,
        env=env,
        timeout=INDEX_TIMEOUT_S,
    )
    seconds = round(time.monotonic() - started, 2)
    if completed.returncode != 0:
        raise RuntimeError(f"index {corpus_path} failed rc={completed.returncode}: {completed.stderr[-800:]}")
    try:
        payload = json.loads(completed.stdout)
    except json.JSONDecodeError:
        payload = {"raw": completed.stdout[-400:]}
    return {"seconds": seconds, "payload": payload}


def _run_cli(binary: str, args: list[str], env: dict[str, str]) -> tuple[dict[str, Any] | None, int, float, str]:
    started = time.monotonic()
    completed = subprocess.run([binary, *args], capture_output=True, text=True, env=env, timeout=QUERY_TIMEOUT_S)
    elapsed_ms = round((time.monotonic() - started) * 1000, 1)
    try:
        payload = json.loads(completed.stdout) if completed.stdout.strip() else None
    except json.JSONDecodeError:
        payload = None
    return payload, len(completed.stdout.encode("utf-8")), elapsed_ms, completed.stderr[-400:]


class MCPStdio:
    """Minimal newline-delimited JSON-RPC client for `atlas mcp` over stdio."""

    def __init__(self, binary: str, store: pathlib.Path, workspace: str, env: dict[str, str]) -> None:
        self.proc = subprocess.Popen(
            [binary, "--db", f"sqlite://{store}", "mcp", "--watch=false"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            bufsize=1,
            env=env,
        )
        self.next_id = 1
        root = pathlib.Path(workspace)
        self.request(
            "initialize",
            {
                "protocolVersion": "2025-06-18",
                "capabilities": {},
                "clientInfo": {"name": "atlas-relevance-bench", "version": "1"},
                "roots": [{"uri": root.as_uri(), "name": root.name}],
            },
        )
        self.notify("notifications/initialized")

    def notify(self, method: str) -> None:
        assert self.proc.stdin is not None
        self.proc.stdin.write(json.dumps({"jsonrpc": "2.0", "method": method}) + "\n")
        self.proc.stdin.flush()

    def request(self, method: str, params: dict[str, Any]) -> dict[str, Any]:
        assert self.proc.stdin is not None and self.proc.stdout is not None
        req_id = self.next_id
        self.next_id += 1
        self.proc.stdin.write(json.dumps({"jsonrpc": "2.0", "id": req_id, "method": method, "params": params}) + "\n")
        self.proc.stdin.flush()
        while True:
            line = self.proc.stdout.readline()
            if not line:
                raise RuntimeError(f"atlas mcp exited during {method}")
            message = json.loads(line)
            if message.get("id") == req_id:
                if message.get("error"):
                    raise RuntimeError(f"mcp {method}: {message['error']}")
                return message["result"]

    def close(self) -> None:
        if self.proc.poll() is None:
            self.proc.terminate()
            try:
                self.proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                self.proc.kill()


def run_surface(
    surface: str, question: str, binary: str, store: pathlib.Path, workspace: str, env: dict[str, str], mcp: MCPStdio
) -> dict[str, Any]:
    """Run one query on one surface and normalize it to rm.SurfaceResult fields."""
    db = f"sqlite://{store}"
    if surface == "search":
        payload, size, ms, err = _run_cli(
            binary, ["--db", db, "--repo", workspace, "search", question, "--limit", str(TOP_K), "--json"], env
        )
        parsed = rm.parse_search(payload)
    elif surface == "context":
        payload, size, ms, err = _run_cli(
            binary, ["--db", db, "--repo", workspace, "context", "--query", question, "--json"], env
        )
        parsed = rm.parse_context(payload)
    elif surface == "code_query":
        started = time.monotonic()
        result = mcp.request(
            "tools/call",
            {
                "name": "code_query",
                "arguments": {
                    "question": question,
                    "workspace": workspace,
                    "require_citations": True,
                    "detail": "high",
                    "format": "json",
                },
            },
        )
        ms = round((time.monotonic() - started) * 1000, 1)
        text = "".join(part.get("text", "") for part in result.get("content", []) if part.get("type") == "text")
        size = len(text.encode("utf-8"))
        try:
            payload = json.loads(text)
        except json.JSONDecodeError:
            payload = None
        err = "" if payload is not None else text[:400]
        parsed = rm.parse_code_query(payload)
    else:
        raise ValueError(surface)
    parsed["latency_ms"] = ms
    parsed["bytes"] = size
    if payload is None:
        parsed["status"] = "error"
        parsed["error"] = err
    return parsed


# ── run ──────────────────────────────────────────────────────────────────────


def load_queries(corpus: str) -> dict[str, Any]:
    return json.loads((QUERIES_DIR / f"{corpus}.json").read_text(encoding="utf-8"))


def _store_identity(index_payload: dict[str, Any], checkout: dict[str, str], store: pathlib.Path) -> dict[str, Any]:
    payload = index_payload.get("payload") or {}
    return {
        "corpus_tree": checkout["tree"],
        "corpus_head": checkout["head"],
        "db": f"<work>/stores/{store.parent.name}/{store.name}",
        "repo_id": payload.get("repo_id"),
        "snapshot_id": payload.get("snapshot_id"),
        "indexed_sha": payload.get("indexed_sha"),
        "indexed_files": payload.get("indexed_files"),
        "symbols": payload.get("symbols"),
        "edges": payload.get("edges"),
        "languages": payload.get("languages"),
        "index_seconds": index_payload.get("seconds"),
    }


def run_corpus(
    name: str,
    spec: dict[str, Any],
    binary: str,
    work: pathlib.Path,
    sources: dict[str, str],
    env: dict[str, str],
    surfaces: tuple[str, ...],
    keep_store: bool,
    log=print,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    checkout = materialize_corpus(name, spec, work / "corpora", sources)
    store = work / "stores" / name / "atlas.db"
    log(f"[relevance] {name}: indexing {checkout['path']} (tree {checkout['tree'][:12]})")
    indexed = index_corpus(binary, checkout["path"], store, env)
    identity = _store_identity(indexed, checkout, store)
    labels = load_queries(name)
    if labels.get("corpus") != name:
        raise RuntimeError(f"queries/{name}.json is labelled for corpus {labels.get('corpus')!r}")
    records: list[dict[str, Any]] = []
    mcp = MCPStdio(binary, store, checkout["path"], env) if "code_query" in surfaces else None
    try:
        for query in labels["queries"]:
            plan = [(surface, query["question"]) for surface in surfaces]
            if query["class"] == "definition" and "search" in surfaces:
                # The ticket's control: the exact entity name on the same surface.
                plan.append(("search_exact", query["entity"]))
            for surface, text in plan:
                result = run_surface(
                    "search" if surface == "search_exact" else surface, text, binary, store, checkout["path"], env, mcp
                )
                score = rm.score_query(query, result, text)
                records.append(
                    {
                        "corpus": name,
                        "query_id": query["id"],
                        "class": query["class"],
                        "surface": surface,
                        "question": text,
                        "entity": query.get("entity"),
                        "score": score,
                        "error": result.get("error"),
                    }
                )
    finally:
        if mcp is not None:
            mcp.close()
        if not keep_store and store.parent.exists():
            shutil.rmtree(store.parent)
    log(f"[relevance] {name}: {len(labels['queries'])} queries, {len(records)} surface results")
    return records, identity


def _label_counts() -> dict[str, dict[str, int]]:
    counts: dict[str, dict[str, int]] = {}
    for path in sorted(QUERIES_DIR.glob("*.json")):
        document = json.loads(path.read_text(encoding="utf-8"))
        per: dict[str, int] = {}
        for query in document["queries"]:
            per[query["class"]] = per.get(query["class"], 0) + 1
        per["total"] = len(document["queries"])
        counts[document["corpus"]] = per
    return counts


def _file_sha256(path: pathlib.Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _compact_records(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Per (query, surface) metrics plus the top 3 results, for RESULTS.json."""
    rows = []
    for record in records:
        score = record["score"]
        row = {
            "corpus": record["corpus"],
            "query_id": record["query_id"],
            "surface": record["surface"],
            "status": score["status"],
            "returned": score["returned"],
        }
        for metric in (*rm.NAMED_METRICS, *rm.ADVERSARIAL_METRICS, "query_word_top1"):
            if metric in score:
                row[metric] = round(float(score[metric]), 4)
        row["top3"] = [f"{t['name']} @ {t['path']}:{t['line']}" for t in score["top"][:3]]
        row["grades3"] = score["grades"][:3]
        rows.append(row)
    return rows


def dump_results(results: dict[str, Any]) -> str:
    """Indented JSON, except that each per-query row and gate verdict sits on
    one line, so a re-run diffs query by query."""
    rows = results["queries"]
    verdicts = results["gate"]["verdicts"]
    shell = {**results, "queries": "__QUERIES__", "gate": {**results["gate"], "verdicts": "__VERDICTS__"}}
    text = json.dumps(shell, indent=1, ensure_ascii=False)

    def block(items: list[dict[str, Any]], indent: str) -> str:
        if not items:
            return "[]"
        body = ",\n".join(indent + " " + json.dumps(item, ensure_ascii=False) for item in items)
        return "[\n" + body + "\n" + indent + "]"

    text = text.replace('"__QUERIES__"', block(rows, " "))
    text = text.replace('"__VERDICTS__"', block(verdicts, "  "))
    return text + "\n"


def gated_metric_plan(summary: dict[str, Any]) -> list[dict[str, Any]]:
    """Which aggregates the gate freezes: every primary metric of every
    (surface, class) pooled across corpora, plus per-corpus MRR / recall@10 /
    entity_first for the named classes and safe-rate for the adversarial set."""
    plan = []
    for surface, classes in summary["pooled"].items():
        if surface == "search_exact":
            continue
        for klass in classes:
            metrics = ("refused", "safe") if klass == rm.ADVERSARIAL else rm.NAMED_METRICS
            plan += [{"scope": "pooled", "surface": surface, "class": klass, "metric": m} for m in metrics]
    for corpus, surfaces in summary["by_corpus"].items():
        for surface, classes in surfaces.items():
            if surface == "search_exact":
                continue
            for klass in classes:
                metrics = ("safe",) if klass == rm.ADVERSARIAL else ("mrr", "recall@10", "entity_first")
                plan += [{"scope": corpus, "surface": surface, "class": klass, "metric": m} for m in metrics]
    return plan


GATE_MARGINS = {
    # Pooled sets hold 28-114 queries per (surface, class). build_gate widens
    # every margin to at least one query's worth (1/n), so a single query
    # flipping on a near-tie (last-ULP score differences across fresh indexes
    # survive #135's exact-tie order: RESULTS.md finding F8) cannot fail the
    # gate; two can.
    "default": 0.03,
    "refused": 0.05,
    "safe": 0.05,
}
CORPUS_MARGINS = {"default": 0.06, "safe": 0.09}


def write_gate(summary: dict[str, Any], meta: dict[str, Any], path: pathlib.Path = GATE_FILE) -> dict[str, Any]:
    plan = gated_metric_plan(summary)
    pooled = rm.build_gate(summary, [p for p in plan if p["scope"] == "pooled"], GATE_MARGINS)
    corpus = rm.build_gate(summary, [p for p in plan if p["scope"] != "pooled"], CORPUS_MARGINS)
    gate = {
        "schema_version": 1,
        "description": (
            "Frozen relevance thresholds (aziron-ai/atlas#44): min = measured develop baseline - margin, floored at 0. "
            "A gate run fails when any measured aggregate drops below its min, or when any surface "
            "returns no JSON. Margins: pooled 0.03 for precision/MRR/recall/entity-first and 0.05 for the adversarial "
            "refusal/safe rates; per corpus 0.06 (safe 0.09); every margin is widened to one query's worth (1/n) "
            "for small sets. A metric the run does not produce fails closed. Re-freeze only from a reviewed run: "
            "python3 relevance-bench/relevance_bench.py --atlas BIN --write-gate (see README.md)."
        ),
        "baseline": meta,
        "thresholds": pooled + corpus,
    }
    path.write_text(dump_gate(gate), encoding="utf-8")
    return gate


def dump_gate(gate: dict[str, Any]) -> str:
    rows = gate["thresholds"]
    text = json.dumps({**gate, "thresholds": "__ROWS__"}, indent=1)
    body = ",\n".join("  " + json.dumps(row) for row in rows)
    return text.replace('"__ROWS__"', "[\n" + body + "\n ]") + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--atlas", required=True, help="atlas binary under test")
    parser.add_argument("--work", type=pathlib.Path, default=pathlib.Path.home() / ".cache" / "atlas-relevance")
    parser.add_argument("--source", action="append", default=[], help="SLUG=PATH: use a local clone for a corpus component")
    parser.add_argument("--corpus", action="append", default=[], help="corpus to run (default: all in CORPORA.json)")
    parser.add_argument("--surface", action="append", default=[], choices=SURFACES)
    parser.add_argument("--results-json", type=pathlib.Path, default=DEFAULT_RESULTS_JSON)
    parser.add_argument("--results-md", type=pathlib.Path, default=DEFAULT_RESULTS_MD)
    parser.add_argument("--details-out", type=pathlib.Path, help="also write every (query, surface) record with its top 10")
    parser.add_argument("--no-gate", action="store_true", help="measure and report only")
    parser.add_argument("--write-gate", action="store_true", help="freeze GATE.json from this run (baseline - margin)")
    parser.add_argument("--keep-stores", action="store_true")
    args = parser.parse_args(argv)

    binary = str(pathlib.Path(args.atlas).resolve())
    if not os.access(binary, os.X_OK):
        print(f"relevance: atlas binary not executable: {binary}", file=sys.stderr)
        return 2
    work = args.work.resolve()
    work.mkdir(parents=True, exist_ok=True)
    sources = dict(s.split("=", 1) for s in args.source)
    corpora = load_corpora()["corpora"]
    selected = args.corpus or sorted(corpora)
    unknown = sorted(set(selected) - set(corpora))
    if unknown:
        parser.error(f"unknown corpus: {', '.join(unknown)}")
    surfaces = tuple(args.surface) or SURFACES
    env = atlas_env(work)
    version = atlas_version(binary, env)
    started = time.monotonic()
    records: list[dict[str, Any]] = []
    identities: dict[str, Any] = {}
    try:
        for name in selected:
            corpus_records, identity = run_corpus(name, corpora[name], binary, work, sources, env, surfaces, args.keep_stores)
            records += corpus_records
            identities[name] = identity
    except (RuntimeError, OSError, subprocess.SubprocessError) as error:
        print(f"relevance: could not run: {error}", file=sys.stderr)
        return 2
    summary = rm.summarize(records)
    meta = {
        "atlas_version": version,
        "atlas_binary_sha256": _file_sha256(pathlib.Path(binary)),
        "measured_at": _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "platform": platform.platform(),
        "corpora": selected,
        "surfaces": list(surfaces),
    }
    if args.write_gate:
        write_gate(summary, meta)
    thresholds = json.loads(GATE_FILE.read_text(encoding="utf-8"))["thresholds"] if GATE_FILE.exists() else []
    if set(selected) != set(corpora) or set(surfaces) != set(SURFACES):
        # A partial run cannot be held to whole-benchmark pooled thresholds.
        thresholds = [t for t in thresholds if t["scope"] in selected and t["surface"] in surfaces]
    verdicts = rm.evaluate_gate(summary, thresholds)
    failures = [v for v in verdicts if v["verdict"] != "pass"]
    # A surface that crashed or printed no JSON is not a relevance result: it
    # fails the gate on its own, whatever the averages say.
    surface_errors = [
        {"corpus": r["corpus"], "query_id": r["query_id"], "surface": r["surface"], "error": r["error"]}
        for r in records
        if r["score"]["status"] == "error"
    ]
    results = {
        "schema_version": 1,
        "ticket": "aziron-ai/atlas#44",
        "run": {**meta, "seconds": round(time.monotonic() - started, 1)},
        "store_identity": identities,
        "label_counts": _label_counts(),
        "query_files_sha256": {p.name: _file_sha256(p) for p in sorted(QUERIES_DIR.glob("*.json"))},
        "summary": summary,
        "gate": {
            "file": "relevance-bench/GATE.json",
            "thresholds": len(verdicts),
            "failures": len(failures),
            "surface_errors": surface_errors,
            "status": "pass" if not failures and not surface_errors else "fail",
            "verdicts": verdicts,
        },
        "queries": _compact_records(records),
    }
    args.results_json.write_text(dump_results(results), encoding="utf-8")
    if args.details_out:
        args.details_out.write_text(json.dumps(records, indent=1) + "\n", encoding="utf-8")
    args.results_md.write_text(relevance_report.render(results, records, args.results_md), encoding="utf-8")
    print(f"[relevance] wrote {args.results_json} and {args.results_md}")
    for failure in failures:
        print(
            f"[relevance] GATE {failure['verdict'].upper()}: {failure['scope']}/{failure['surface']}/{failure['class']}/"
            f"{failure['metric']} measured {failure['measured']} < min {failure['min']} (baseline {failure['baseline']})",
            file=sys.stderr,
        )
    for error in surface_errors:
        print(f"[relevance] SURFACE ERROR {error['corpus']}/{error['query_id']}/{error['surface']}: {error['error']}", file=sys.stderr)
    if args.no_gate:
        return 0
    if not thresholds:
        print("relevance: no GATE.json thresholds to hold (run --write-gate on a reviewed baseline)", file=sys.stderr)
        return 2
    passed = not failures and not surface_errors
    print(
        f"[relevance] gate {'PASS' if passed else 'FAIL'}: {len(verdicts) - len(failures)}/{len(verdicts)} thresholds hold, "
        f"{len(surface_errors)} surface error(s)"
    )
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
