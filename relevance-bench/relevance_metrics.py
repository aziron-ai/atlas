"""Pure, deterministic scoring for the relevance benchmark (aziron-ai/atlas#44).

No subprocess, no IO, no atlas binary: everything here takes already-parsed
surface payloads and frozen labels, so relevance-bench/relevance_metrics_test.py
can pin every metric on tiny synthetic result lists.

Label model (relevance-bench/queries/<corpus>.json, one entry per query):

  relevant:   [item, ...]   what a correct answer must contain
  acceptable: [item, ...]   reasonable but not required (counts as a hit for
                            precision, never for MRR or recall)
  item = {"names": [...], "paths": [...], "lines": [...], "match": "name"|"name+path"}

A result (name, path, line) matches an item when its name matches one of the
item's names (exact, or the last segment of a qualified name such as
`Session.send` / `DBImpl::Get`) and, for match == "name+path", its path is one
of the item's paths. Each result is credited to the first relevant item it
matches, else to the first acceptable item, else it is a miss.

Metrics over the top-k of one ranked list (results deduplicated on
(name, path, line), first occurrence wins):

  precision@k  hits in the top k / min(k, results returned); an empty answer to
               a labelled query scores 0. It measures how much of what the
               surface actually put in front of the agent was on target.
  mrr          1 / rank of the first RELEVANT result (0 when none in top 10).
  recall@10    distinct relevant items matched in the top 10 / min(10, number
               of relevant items) (capped so a 105-caller symbol is not held to
               an impossible bar).
  entity_first rank-1 result names the query's entity (named classes only).

Adversarial queries (generic phrasing, no entity) have no relevant items. A
surface's answer is:
  refused   it declined: code_query status=insufficient (the #60 relevance
            floor), or no results at all;
  grounded  it answered, and the query carries an `acceptable` list (only
            corpus-specific generic-domain phrasings such as "error handling"
            do) and at least 3 of its top 5 results are acceptable;
  noise     it answered with anything else (confident noise).
safe = refused or grounded.
"""

from __future__ import annotations

import math
import re
from typing import Any, Iterable

K_VALUES = (1, 3, 5, 10)
TOP_K = 10
GROUNDED_TOP = 5
GROUNDED_MIN_HITS = 3

NAMED_CLASSES = ("definition", "callers", "error_handling")
ADVERSARIAL = "adversarial"

_QUALIFIER = re.compile(r"::|\.|#|/")

# Path classes used for the report-only pollution shares. Kept deliberately
# simple and documented in relevance-bench/README.md.
_TEST_SEGMENTS = {
    "test",
    "tests",
    "__tests__",
    "testing",
    "testdata",
    "fixture",
    "fixtures",
    "__fixtures__",
    "__mocks__",
    "spec",
    "e2e",
    "benchmark",
    "benchmarks",
    "__benchmarks__",
    "bench",
    "example",
    "examples",
    "fuzzing",
}
_TEST_FILE = re.compile(
    r"(^test_.*\.py$)|(_test\.[a-z]+$)|(_tests\.[a-z]+$)|(\.spec\.[a-z]+$)|(\.test\.[a-z]+$)|(\.bench\.[a-z]+$)|(_bench\.[a-z]+$)"
)
_GENERATED_SEGMENTS = {"dist", "build", "vendor", "third_party", "node_modules", "generated", "graphify-out"}
_GENERATED_FILE = re.compile(r"(\.min\.js$)|(\.pb\.go$)|(_pb2\.py$)|(\.generated\.)")
_NONCODE_KINDS = {"key", "document", "section", "heading", "file", "table", "row"}
_NONCODE_EXT = {
    ".md",
    ".markdown",
    ".rst",
    ".txt",
    ".yml",
    ".yaml",
    ".toml",
    ".json",
    ".cfg",
    ".ini",
    ".html",
    ".css",
    ".pdf",
    ".lock",
}


# ── matching ─────────────────────────────────────────────────────────────────


def name_matches(result_name: str, label_name: str) -> bool:
    if not result_name or not label_name:
        return False
    if result_name == label_name:
        return True
    return _QUALIFIER.split(result_name)[-1] == label_name


def _norm_path(path: str) -> str:
    path = (path or "").replace("\\", "/")
    while path.startswith("./"):
        path = path[2:]
    return path


def item_matches(result: dict[str, Any], item: dict[str, Any]) -> bool:
    if not any(name_matches(result.get("name", ""), name) for name in item.get("names", [])):
        return False
    if item.get("match", "name+path") == "name":
        return True
    paths = {_norm_path(p) for p in item.get("paths", [])}
    return _norm_path(result.get("path", "")) in paths


def dedupe(results: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[tuple[str, str, int]] = set()
    out: list[dict[str, Any]] = []
    for result in results:
        key = (result.get("name", ""), _norm_path(result.get("path", "")), int(result.get("line") or 0))
        if key in seen:
            continue
        seen.add(key)
        out.append(result)
    return out


def grade(results: list[dict[str, Any]], label: dict[str, Any]) -> list[tuple[str, int]]:
    """Per-result ("relevant"|"acceptable"|"miss", item index) in rank order."""
    relevant = label.get("relevant", [])
    acceptable = label.get("acceptable", [])
    graded: list[tuple[str, int]] = []
    for result in results:
        tier = ("miss", -1)
        for index, item in enumerate(relevant):
            if item_matches(result, item):
                tier = ("relevant", index)
                break
        else:
            for index, item in enumerate(acceptable):
                if item_matches(result, item):
                    tier = ("acceptable", index)
                    break
        graded.append(tier)
    return graded


# ── per-query metrics ────────────────────────────────────────────────────────


def precision_at(graded: list[tuple[str, int]], k: int) -> float:
    top = graded[:k]
    if not top:
        return 0.0
    return sum(1 for tier, _ in top if tier != "miss") / len(top)


def reciprocal_rank(graded: list[tuple[str, int]], cutoff: int = TOP_K) -> float:
    for rank, (tier, _) in enumerate(graded[:cutoff], start=1):
        if tier == "relevant":
            return 1.0 / rank
    return 0.0


def recall_at(graded: list[tuple[str, int]], relevant_count: int, k: int = TOP_K) -> float:
    if relevant_count <= 0:
        return 0.0
    found = {index for tier, index in graded[:k] if tier == "relevant"}
    return len(found) / min(k, relevant_count)


def entity_first(results: list[dict[str, Any]], entity: str | None) -> float:
    if not entity or not results:
        return 0.0
    return 1.0 if name_matches(results[0].get("name", ""), entity) else 0.0


def path_class(result: dict[str, Any]) -> str:
    """'test' | 'generated' | 'noncode' | 'code' (first match wins)."""
    path = _norm_path(result.get("path", ""))
    parts = path.split("/")
    filename = parts[-1].lower() if parts else ""
    lowered = [p.lower() for p in parts[:-1]]
    if any(p in _GENERATED_SEGMENTS for p in lowered) or _GENERATED_FILE.search(filename):
        return "generated"
    if any(p in _TEST_SEGMENTS for p in lowered) or _TEST_FILE.search(filename):
        return "test"
    ext = ("." + filename.rsplit(".", 1)[-1]) if "." in filename else ""
    if (result.get("kind") or "") in _NONCODE_KINDS or ext in _NONCODE_EXT:
        return "noncode"
    return "code"


def share(results: list[dict[str, Any]], klass: str, k: int = TOP_K) -> float:
    top = results[:k]
    if not top:
        return 0.0
    return sum(1 for r in top if path_class(r) == klass) / len(top)


_WORD = re.compile(r"[A-Z]+(?![a-z])|[A-Z]?[a-z]+|[0-9]+")


def identifier_words(text: str) -> set[str]:
    """Lower-cased words of an identifier or phrase, split on case changes,
    digits and every non-alphanumeric (snake_case, kebab-case, dots, spaces)."""
    return {w.lower() for w in _WORD.findall(text or "")}


def query_word_top1(results: list[dict[str, Any]], question: str, entity: str | None) -> float:
    """1.0 when the rank-1 result is NOT the named entity and its name shares a
    word only with the query's phrasing (where/is/defined/what/calls/error/...)
    and not with the entity: the stopword/template-word pollution the ticket
    reports (e.g. a config key named `where` answering "where is X defined?").
    score_query applies it only when that rank-1 result is not a labelled hit."""
    if not results or not entity:
        return 0.0
    top = results[0].get("name", "")
    if name_matches(top, entity):
        return 0.0
    entity_words = identifier_words(entity)
    phrase_words = identifier_words(question) - entity_words
    top_words = identifier_words(top)
    if top_words & entity_words:
        return 0.0
    return 1.0 if top_words & phrase_words else 0.0


def is_refused(surface_result: dict[str, Any]) -> bool:
    status = surface_result.get("status")
    if status in ("insufficient", "empty"):
        return True
    return status == "ok" and not surface_result.get("results")


def score_query(label: dict[str, Any], surface_result: dict[str, Any], question: str | None = None) -> dict[str, Any]:
    """All metrics for one (query, surface) pair. `question` is the text that
    was actually sent (defaults to the label's question)."""
    results = dedupe(surface_result.get("results") or [])
    out: dict[str, Any] = {
        "returned": len(results),
        "status": surface_result.get("status"),
        "truncated": bool(surface_result.get("truncated")),
        "latency_ms": surface_result.get("latency_ms"),
        "bytes": surface_result.get("bytes"),
        "test_share@10": share(results, "test"),
        "generated_share@10": share(results, "generated"),
        "noncode_share@10": share(results, "noncode"),
        "top": [
            {"name": r.get("name"), "path": r.get("path"), "line": r.get("line"), "kind": r.get("kind")}
            for r in results[:TOP_K]
        ],
    }
    graded = grade(results, label)
    out["grades"] = [tier for tier, _ in graded[:TOP_K]]
    # Only a rank-1 MISS can be pollution: in "<E> error exception handling" the
    # phrase words are on topic, and a labelled hit that shares them is correct.
    out["query_word_top1"] = (
        query_word_top1(results, question or label.get("question", ""), label.get("entity"))
        if graded and graded[0][0] == "miss"
        else 0.0
    )
    if label["class"] == ADVERSARIAL:
        refused = is_refused(surface_result)
        grounded = False
        if not refused and label.get("acceptable"):
            hits = sum(1 for tier, _ in graded[:GROUNDED_TOP] if tier != "miss")
            grounded = hits >= GROUNDED_MIN_HITS
        out["refused"] = 1.0 if refused else 0.0
        out["grounded"] = 1.0 if grounded else 0.0
        out["safe"] = 1.0 if (refused or grounded) else 0.0
        out["noise"] = 0.0 if (refused or grounded) else 1.0
        return out
    for k in K_VALUES:
        out[f"p@{k}"] = precision_at(graded, k)
    out["mrr"] = reciprocal_rank(graded)
    out["recall@10"] = recall_at(graded, len(label.get("relevant", [])))
    out["entity_first"] = entity_first(results, label.get("entity"))
    out["refused"] = 1.0 if is_refused(surface_result) else 0.0
    return out


# ── surface payload parsers ──────────────────────────────────────────────────


def _row(name: Any, path: Any, line: Any, kind: Any) -> dict[str, Any]:
    try:
        line_number = int(line or 0)
    except (TypeError, ValueError):
        line_number = 0
    return {"name": str(name or ""), "path": _norm_path(str(path or "")), "line": line_number, "kind": str(kind or "")}


def parse_search(payload: dict[str, Any] | None) -> dict[str, Any]:
    if not isinstance(payload, dict):
        return {"status": "error", "results": []}
    results = [_row(r.get("symbol") or r.get("name"), r.get("path"), r.get("line"), r.get("kind")) for r in payload.get("results") or []]
    return {
        "status": "ok" if results else "empty",
        "results": results,
        "truncated": bool(payload.get("truncated")),
        "total_matches": payload.get("total_matches"),
    }


def parse_context(payload: dict[str, Any] | None) -> dict[str, Any]:
    """The bundle's symbols in emitted order (anchor first, then its graph
    neighbours and retrieval hits), then any search_hits not already listed."""
    if not isinstance(payload, dict):
        return {"status": "error", "results": []}
    rows = [_row(s.get("symbol") or s.get("name"), s.get("path"), s.get("line"), s.get("kind")) for s in payload.get("symbols") or []]
    rows += [_row(s.get("symbol") or s.get("name"), s.get("path"), s.get("line"), s.get("kind")) for s in payload.get("search_hits") or []]
    results = dedupe(rows)
    status = payload.get("status") or ("ok" if results else "empty")
    return {"status": status, "results": results, "truncated": bool(payload.get("truncated"))}


def parse_code_query(payload: dict[str, Any] | None) -> dict[str, Any]:
    if not isinstance(payload, dict):
        return {"status": "error", "results": []}
    status = payload.get("status") or "error"
    results: list[dict[str, Any]] = []
    if status == "ok":
        results = dedupe(
            _row(c.get("symbol") or c.get("name"), c.get("path"), c.get("start_line") or c.get("line"), c.get("kind"))
            for c in payload.get("citations") or []
        )
    return {
        "status": status,
        "reason": payload.get("reason"),
        "results": results,
        "truncated": bool(payload.get("truncated")),
        "low_confidence_hits": [
            _row(h.get("symbol"), h.get("path"), h.get("line"), h.get("kind")) for h in payload.get("low_confidence_hits") or []
        ],
    }


# ── aggregation ──────────────────────────────────────────────────────────────

NAMED_METRICS = ("p@1", "p@3", "p@5", "p@10", "mrr", "recall@10", "entity_first")
ADVERSARIAL_METRICS = ("refused", "safe", "grounded", "noise")
REPORT_METRICS = (
    "test_share@10",
    "generated_share@10",
    "noncode_share@10",
    "query_word_top1",
    "truncated",
    "returned",
    "bytes",
)


def _mean(values: list[float]) -> float:
    return round(sum(values) / len(values), 4) if values else 0.0


def _percentile(values: list[float], fraction: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = max(0, min(len(ordered) - 1, math.ceil(fraction * len(ordered)) - 1))
    return round(ordered[index], 1)


def aggregate(records: list[dict[str, Any]]) -> dict[str, Any]:
    """Mean of every metric over a list of per-(query, surface) records that
    share one class. Returns {"n": ..., metric: mean, ...}."""
    if not records:
        return {"n": 0}
    klass = records[0]["class"]
    metrics = ADVERSARIAL_METRICS if klass == ADVERSARIAL else NAMED_METRICS
    out: dict[str, Any] = {"n": len(records)}
    for metric in metrics:
        out[metric] = _mean([float(r["score"][metric]) for r in records])
    for metric in REPORT_METRICS:
        out[metric] = _mean([float(r["score"].get(metric) or 0) for r in records])
    latencies = [float(r["score"].get("latency_ms") or 0) for r in records]
    out["latency_p50_ms"] = _percentile(latencies, 0.5)
    out["latency_p95_ms"] = _percentile(latencies, 0.95)
    if klass != ADVERSARIAL:
        out["empty"] = _mean([1.0 if r["score"]["returned"] == 0 else 0.0 for r in records])
    return out


def summarize(records: list[dict[str, Any]]) -> dict[str, Any]:
    """{"pooled": {surface: {class: agg}}, "by_corpus": {corpus: {surface: {class: agg}}}}"""
    pooled: dict[str, dict[str, list[dict[str, Any]]]] = {}
    by_corpus: dict[str, dict[str, dict[str, list[dict[str, Any]]]]] = {}
    for record in records:
        pooled.setdefault(record["surface"], {}).setdefault(record["class"], []).append(record)
        by_corpus.setdefault(record["corpus"], {}).setdefault(record["surface"], {}).setdefault(record["class"], []).append(record)
    return {
        "pooled": {s: {c: aggregate(rs) for c, rs in sorted(cs.items())} for s, cs in sorted(pooled.items())},
        "by_corpus": {
            corpus: {s: {c: aggregate(rs) for c, rs in sorted(cs.items())} for s, cs in sorted(surfaces.items())}
            for corpus, surfaces in sorted(by_corpus.items())
        },
    }


# ── gate ─────────────────────────────────────────────────────────────────────


def _lookup(summary: dict[str, Any], scope: str, surface: str, klass: str, metric: str) -> float | None:
    tree = summary["pooled"] if scope == "pooled" else summary["by_corpus"].get(scope, {})
    value = tree.get(surface, {}).get(klass, {}).get(metric)
    return None if value is None else float(value)


def build_gate(summary: dict[str, Any], gated: list[dict[str, Any]], margins: dict[str, float]) -> list[dict[str, Any]]:
    """Freeze thresholds = measured baseline - margin (floored at 0) for every
    (scope, surface, class, metric) in `gated`. The margin is the configured
    one, widened to one query's worth (1/n) when the set is small, so a single
    query flipping on an equal-score tie cannot fail the gate but two can."""
    thresholds = []
    for entry in gated:
        value = _lookup(summary, entry["scope"], entry["surface"], entry["class"], entry["metric"])
        if value is None:
            continue
        n = _lookup(summary, entry["scope"], entry["surface"], entry["class"], "n") or 0
        margin = margins.get(entry["metric"], margins["default"])
        if n:
            margin = max(margin, math.ceil(1000.0 / n) / 1000.0)
        thresholds.append(
            {
                **entry,
                "n": int(n),
                "baseline": round(value, 4),
                "margin": round(margin, 4),
                "min": round(max(0.0, value - margin), 4),
            }
        )
    return thresholds


def evaluate_gate(summary: dict[str, Any], thresholds: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Every threshold with its measured value and verdict. A metric the run
    did not produce fails closed."""
    verdicts = []
    for entry in thresholds:
        value = _lookup(summary, entry["scope"], entry["surface"], entry["class"], entry["metric"])
        if value is None:
            verdict = "missing"
        elif value + 1e-9 < entry["min"]:
            verdict = "fail"
        else:
            verdict = "pass"
        verdicts.append({**entry, "measured": value, "verdict": verdict})
    return verdicts
