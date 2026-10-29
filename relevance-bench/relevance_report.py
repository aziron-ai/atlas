"""Render relevance-bench/RESULTS.md from a relevance run (aziron-ai/atlas#44).

Everything between the FINDINGS markers of an existing RESULTS.md is carried
over verbatim, so the hand-written findings survive a re-run while every
number and auto-extracted example around them is regenerated.
"""

from __future__ import annotations

import pathlib
from typing import Any

import relevance_metrics as rm

FINDINGS_BEGIN = "<!-- findings:begin (hand-written; preserved across re-runs) -->"
FINDINGS_END = "<!-- findings:end -->"
SURFACE_ORDER = ("search", "search_exact", "context", "code_query")
CLASS_ORDER = ("definition", "callers", "error_handling", "adversarial")
EXAMPLES_PER_BUCKET = 6


def _f(value: Any, digits: int = 3) -> str:
    if value is None:
        return "–"
    if isinstance(value, float):
        return f"{value:.{digits}f}"
    return str(value)


def _preserved_findings(path: pathlib.Path) -> str:
    if path.exists():
        text = path.read_text(encoding="utf-8")
        if FINDINGS_BEGIN in text and FINDINGS_END in text:
            return text[text.index(FINDINGS_BEGIN) : text.index(FINDINGS_END) + len(FINDINGS_END)]
    return f"{FINDINGS_BEGIN}\n_No findings written yet._\n{FINDINGS_END}"


def _named_table(pooled: dict[str, Any], klass: str) -> list[str]:
    lines = [
        "| surface | n | P@1 | P@3 | P@5 | P@10 | MRR | R@10 | entity-first | empty | query-word top-1 | test@10 | non-code@10 | p50 ms | p95 ms | mean bytes | truncated |",
        "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for surface in SURFACE_ORDER:
        agg = pooled.get(surface, {}).get(klass)
        if not agg:
            continue
        label = "search (bare entity name — control)" if surface == "search_exact" else surface
        lines.append(
            f"| {label} | {agg['n']} | {_f(agg['p@1'])} | {_f(agg['p@3'])} | {_f(agg['p@5'])} | {_f(agg['p@10'])} | "
            f"{_f(agg['mrr'])} | {_f(agg['recall@10'])} | {_f(agg['entity_first'])} | {_f(agg.get('empty'))} | "
            f"{_f(agg['query_word_top1'])} | {_f(agg['test_share@10'])} | {_f(agg['noncode_share@10'])} | "
            f"{_f(agg['latency_p50_ms'], 0)} | {_f(agg['latency_p95_ms'], 0)} | {_f(agg['bytes'], 0)} | {_f(agg['truncated'], 2)} |"
        )
    return lines


def _adversarial_table(pooled: dict[str, Any]) -> list[str]:
    lines = [
        "| surface | n | refused | grounded | safe (refused or grounded) | confident noise | mean results | mean bytes |",
        "|---|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for surface in SURFACE_ORDER:
        agg = pooled.get(surface, {}).get(rm.ADVERSARIAL)
        if not agg:
            continue
        lines.append(
            f"| {surface} | {agg['n']} | {_f(agg['refused'])} | {_f(agg['grounded'])} | {_f(agg['safe'])} | "
            f"{_f(agg['noise'])} | {_f(agg['returned'], 1)} | {_f(agg['bytes'], 0)} |"
        )
    return lines


def _per_corpus_table(by_corpus: dict[str, Any]) -> list[str]:
    lines = [
        "| corpus | surface | definition MRR / R@10 / EF | callers MRR / R@10 / EF | error_handling MRR / R@10 / EF | adversarial safe |",
        "|---|---|---|---|---|---:|",
    ]
    for corpus, surfaces in by_corpus.items():
        for surface in SURFACE_ORDER:
            classes = surfaces.get(surface)
            if not classes:
                continue
            cells = []
            for klass in ("definition", "callers", "error_handling"):
                agg = classes.get(klass)
                cells.append(
                    f"{_f(agg['mrr'], 2)} / {_f(agg['recall@10'], 2)} / {_f(agg['entity_first'], 2)}" if agg else "–"
                )
            adversarial = classes.get(rm.ADVERSARIAL)
            cells.append(_f(adversarial["safe"], 2) if adversarial else "–")
            lines.append(f"| {corpus} | {surface} | " + " | ".join(cells) + " |")
    return lines


def _top(record: dict[str, Any], n: int = 3) -> str:
    rows = record["score"]["top"][:n]
    if not rows:
        return "_(nothing returned)_"
    return "; ".join(f"`{r['name']}` {r['path']}:{r['line']}" for r in rows)


def _examples(records: list[dict[str, Any]]) -> list[str]:
    """Deterministic pollution examples straight from the run. Identical
    answers on several surfaces collapse into one bullet; corpora are
    interleaved so one corpus cannot fill a bucket."""
    titles = {
        "query_word": "query-word top-1 (a stopword/template word outranks the named entity)",
        "noncode": "non-code fact (config key, workflow YAML, Makefile target, markdown) ranked first",
        "test_first": "test/fixture/benchmark symbol ranked first while a labelled definition exists outside tests",
        "exact_gap": "bare-name search ranks the entity first but the natural-language query does not",
        "noise": "adversarial query answered with confident noise",
    }
    exact_first = {
        (r["corpus"], r["query_id"])
        for r in records
        if r["surface"] == "search_exact" and r["score"].get("entity_first") == 1.0
    }
    grouped: dict[str, dict[tuple[str, str, str], list[str]]] = {key: {} for key in titles}

    def add(bucket: str, record: dict[str, Any], text: str) -> None:
        grouped[bucket].setdefault((record["corpus"], record["question"], text), []).append(record["surface"])

    for record in records:
        score = record["score"]
        top = score["top"][:1]
        if record["class"] == rm.ADVERSARIAL:
            if score.get("noise") == 1.0:
                add("noise", record, f"status `{score['status']}`, {score['returned']} results: " + _top(record))
            continue
        if record["surface"] == "search_exact":
            continue
        if score.get("query_word_top1") == 1.0:
            add("query_word", record, _top(record))
        if top and rm.path_class(top[0]) == "noncode":
            add("noncode", record, _top(record))
        if top and record["class"] == "definition" and score["grades"][:1] != ["relevant"] and rm.path_class(top[0]) == "test":
            add("test_first", record, _top(record))
        if (
            record["class"] == "definition"
            and record["surface"] == "search"
            and score.get("entity_first") == 0.0
            and (record["corpus"], record["query_id"]) in exact_first
        ):
            add("exact_gap", record, _top(record))
    lines: list[str] = []
    for bucket, title in titles.items():
        entries = grouped[bucket]
        by_corpus: dict[str, list[tuple[tuple[str, str, str], list[str]]]] = {}
        for key, surfaces in entries.items():
            by_corpus.setdefault(key[0], []).append((key, surfaces))
        interleaved = []
        while any(by_corpus.values()):
            for corpus in sorted(by_corpus):
                if by_corpus[corpus]:
                    interleaved.append(by_corpus[corpus].pop(0))
        # Show distinct questions first, so one phrasing cannot fill the bucket.
        seen_questions: set[str] = set()
        fresh, repeats = [], []
        for entry in interleaved:
            (fresh if entry[0][1] not in seen_questions else repeats).append(entry)
            seen_questions.add(entry[0][1])
        ordered = fresh + repeats
        surface_hits = sum(len(s) for s in entries.values())
        lines.append(f"**{title}** — {len(entries)} distinct answer(s), {surface_hits} surface result(s)")
        lines.append("")
        for (corpus, question, text), surfaces in ordered[:EXAMPLES_PER_BUCKET]:
            lines.append(f"- **{corpus}** “{question}” [{', '.join(surfaces)}] → {text}")
        if len(ordered) > EXAMPLES_PER_BUCKET:
            lines.append(f"- … {len(ordered) - EXAMPLES_PER_BUCKET} more: see the `top3` rows in RESULTS.json")
        lines.append("")
    return lines


def render(results: dict[str, Any], records: list[dict[str, Any]], existing: pathlib.Path) -> str:
    run = results["run"]
    summary = results["summary"]
    gate = results["gate"]
    lines = [
        "# Natural-language retrieval relevance — results",
        "",
        "Generated by `relevance-bench/relevance_bench.py` (aziron-ai/atlas#44). Numbers, tables and the",
        "auto-extracted examples are regenerated on every run; the **Findings** section is hand-written and",
        "carried over. How to read and re-run this: [README.md](README.md).",
        "",
        f"- Atlas: `{run['atlas_version']}` (binary sha256 `{run['atlas_binary_sha256'][:16]}…`)",
        f"- Measured: {run['measured_at']} on `{run['platform']}`, {run['seconds']} s wall",
        f"- Surfaces: {', '.join(run['surfaces'])} (+ `search_exact`, the bare-entity-name control on definition queries)",
        f"- Gate: **{gate['status'].upper()}** — {gate['thresholds'] - gate['failures']}/{gate['thresholds']} frozen thresholds hold ([GATE.json](GATE.json))",
        "",
        "## Corpora and store identity",
        "",
        "| corpus | tree | HEAD | files | symbols | edges | index s | repo_id / snapshot_id |",
        "|---|---|---|---:|---:|---:|---:|---|",
    ]
    for corpus, ident in results["store_identity"].items():
        lines.append(
            f"| {corpus} | `{ident['corpus_tree'][:12]}` | `{ident['corpus_head'][:12]}` | {ident['indexed_files']} | "
            f"{ident['symbols']} | {ident['edges']} | {ident['index_seconds']} | `{ident['repo_id']}` / `{ident['snapshot_id']}` |"
        )
    lines += [
        "",
        "Stores are fresh (deleted and re-indexed every run), so repo/snapshot ids differ run to run; the corpus",
        "tree SHA is the stable identity and the run refuses a checkout whose tree differs from CORPORA.json.",
        "",
        "## Labelled queries",
        "",
        "| corpus | definition | callers | error_handling | adversarial | total |",
        "|---|---:|---:|---:|---:|---:|",
    ]
    for corpus, counts in results["label_counts"].items():
        lines.append(
            f"| {corpus} | {counts.get('definition', 0)} | {counts.get('callers', 0)} | {counts.get('error_handling', 0)} | "
            f"{counts.get('adversarial', 0)} | {counts.get('total', 0)} |"
        )
    lines += ["", "## Pooled metrics (all corpora)", ""]
    for klass in ("definition", "callers", "error_handling"):
        lines += [f"### {klass}", ""] + _named_table(summary["pooled"], klass) + [""]
    lines += ["### adversarial (generic / stopword phrasings)", ""] + _adversarial_table(summary["pooled"]) + [""]
    lines += [
        "Metric definitions are in [README.md](README.md#metrics). P@k is over what the surface returned",
        "(denominator min(k, returned)); MRR and R@10 count only `relevant` labels, P@k also credits `acceptable`.",
        "",
        "## Per corpus",
        "",
    ]
    lines += _per_corpus_table(summary["by_corpus"]) + [""]
    failing = [v for v in gate["verdicts"] if v["verdict"] != "pass"]
    lines += ["## Gate", ""]
    if failing:
        lines += ["| scope | surface | class | metric | measured | min | baseline |", "|---|---|---|---|---:|---:|---:|"]
        for v in failing:
            lines.append(
                f"| {v['scope']} | {v['surface']} | {v['class']} | {v['metric']} | {_f(v['measured'])} | {_f(v['min'])} | {_f(v['baseline'])} |"
            )
    else:
        lines.append(f"All {gate['thresholds']} thresholds in GATE.json hold.")
    errors = gate.get("surface_errors") or []
    if errors:
        lines += ["", f"**{len(errors)} surface error(s)** (no JSON / crashed) — each fails the gate:", ""]
        lines += [f"- {e['corpus']} `{e['surface']}` {e['query_id']}: {e['error']}" for e in errors[:20]]
    lines += ["", "## Pollution examples (auto-extracted from this run)", ""] + _examples(records)
    lines += ["## Findings", "", _preserved_findings(existing), ""]
    return "\n".join(lines)
