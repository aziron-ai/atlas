#!/usr/bin/env python3
"""Derive the mechanical labels of the relevance benchmark (aziron-ai/atlas#44).

ONE-TIME tool, not part of a benchmark run: the scorer reads the frozen labels
in relevance-bench/queries/<corpus>.json and never recomputes them. Re-run this
only to extend the set (new corpus, new QA set) and review the diff.

What it derives, per corpus component (CORPORA.json -> components[].qa_set):

  definition  "where is <E> defined?"   one relevant item: name E at ANY of the
              LSP definition paths the QA set recorded for E (`definitions`,
              file:line:col from the language server's call-hierarchy prepare,
              union over same-name definitions). Header prototypes are part of
              that set, so a surface that finds either the declaration or the
              body is credited. Acceptable: any symbol named exactly E.
  callers     "what calls <E>?"         one relevant item per LSP truth caller
              name (`truth`), matched by NAME (the QA sets record caller names,
              not locations, and Atlas's callers-F1 scorer scores names the same way).
              Each item also lists the caller's definition paths for humans:
              from `atlas symbol <E>` callers when Atlas reports that caller,
              else from `atlas symbol <caller>` definitions, else none
              (paths_source says which; matching never uses them).
              Acceptable: any symbol named exactly E (the anchor an answer
              shows first).

Paths are prefixed with the component's `prefix` (mixed corpus). Queries with a
hand-written provenance (error_handling, adversarial) are preserved verbatim.

Usage:
  python3 relevance-bench/derive_labels.py --atlas BIN --work DIR
      [--source SLUG=PATH ...] [--corpus NAME ...] [--check]

--check re-derives into memory and exits 1 if the frozen file differs (drift
report), writing nothing.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import subprocess
import sys
from typing import Any

HERE = pathlib.Path(__file__).resolve().parent
# Public layout (github.com/aziron-ai/atlas): this directory sits at the repo
# root as relevance-bench/, and the LSP-truth QA sets live in agent-bench/.
REPO_ROOT = HERE.parent
sys.path.insert(0, str(HERE))

import relevance_bench as rb  # noqa: E402

DEFINITION_TEMPLATE = "where is {entity} defined?"
CALLERS_TEMPLATE = "what calls {entity}?"


def _qa_set_path(rel: str) -> pathlib.Path:
    """Resolve a CORPORA.json `qa_set` entry. The frozen entries name the file's
    origin in the Atlas source tree (`bench/QA_SET_<lang>.json`) and stay that way,
    because the label provenance records them verbatim; in this repository the
    same files are published as `agent-bench/QA_SET_<lang>.json`."""
    for candidate in (REPO_ROOT / rel, REPO_ROOT / "agent-bench" / pathlib.PurePath(rel).name):
        if candidate.exists():
            return candidate
    raise FileNotFoundError(f"QA set {rel} not found under {REPO_ROOT} or {REPO_ROOT / 'agent-bench'}")


def _atlas_json(binary: str, args: list[str], env: dict[str, str]) -> dict[str, Any]:
    completed = subprocess.run([binary, *args], capture_output=True, text=True, env=env, timeout=600)
    if completed.returncode != 0:
        raise RuntimeError(f"atlas {' '.join(args[:6])} failed: {completed.stderr[-400:]}")
    return json.loads(completed.stdout)


def _definitions(binary: str, db: str, workspace: str, env: dict[str, str], name: str, cache: dict[str, list[str]]) -> list[str]:
    """`atlas symbol <name>` definition locations (path:line), memoized."""
    if name not in cache:
        try:
            payload = _atlas_json(binary, ["--db", db, "--repo", workspace, "symbol", name, "--json"], env)
        except (RuntimeError, json.JSONDecodeError):
            payload = {}
        cache[name] = sorted({f"{m.get('path')}:{m.get('line')}" for m in payload.get("matches") or [] if m.get("symbol") == name})
    return cache[name]


def _split(location: str) -> tuple[str, int]:
    parts = location.split(":")
    return parts[0], int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 0


def derive_component(
    corpus: str,
    component: dict[str, Any],
    binary: str,
    db: str,
    workspace: str,
    env: dict[str, str],
    definitions_cache: dict[str, list[str]],
    atlas_version: str,
) -> list[dict[str, Any]]:
    qa_path = _qa_set_path(component["qa_set"])
    qa = json.loads(qa_path.read_text(encoding="utf-8"))
    meta = qa.get("meta", {})
    prefix = (component.get("prefix") or "").strip("/")

    def rooted(path: str) -> str:
        return f"{prefix}/{path}" if prefix else path

    if meta.get("commit") and meta["commit"] != component["commit"]:
        raise RuntimeError(f"{qa_path}: QA commit {meta['commit']} != corpus commit {component['commit']}")
    queries: list[dict[str, Any]] = []
    for question in qa["questions"]:
        if question.get("qtype", "callers") != "callers":
            continue
        entity = question["symbol"]
        locations = [_split(d) for d in question.get("definitions") or []]
        def_paths = sorted({rooted(p) for p, _ in locations})
        def_lines = [f"{rooted(p)}:{line}" for p, line in locations]
        base_provenance = {
            "source": "lsp",
            "qa_set": component["qa_set"],
            "qa_id": question["id"],
            "qa_commit": meta.get("commit"),
            "lsp_truth": meta.get("truth"),
            "truth_source": question.get("truth_source"),
            # frozen provenance string: the labels were derived in the Atlas source tree
            "derived_by": "bench/relevance/derive_labels.py",
        }
        entity_item = {"names": [entity], "paths": def_paths, "locations": def_lines, "match": "name+path"}
        # Any other symbol spelled exactly like the entity (a test-local helper,
        # a TypedDict field, an overload the language server did not list) is a
        # reasonable hit for precision, never for MRR or recall.
        same_name = {"names": [entity], "paths": [], "match": "name", "why": "same-named symbol outside the LSP definition set"}
        tag = f"{prefix}:" if prefix else ""
        queries.append(
            {
                "id": f"definition::{tag}{entity}",
                "class": "definition",
                "entity": entity,
                "component": component["slug"],
                "question": DEFINITION_TEMPLATE.format(entity=entity),
                "relevant": [entity_item],
                "acceptable": [same_name],
                "provenance": {**base_provenance, "field": "definitions"},
            }
        )
        symbol = _atlas_json(binary, ["--db", db, "--repo", workspace, "symbol", entity, "--json"], env)
        atlas_callers: dict[str, set[str]] = {}
        for match in symbol.get("matches") or []:
            for caller in match.get("callers") or []:
                atlas_callers.setdefault(caller.get("symbol", ""), set()).add(f"{caller.get('path')}:{caller.get('line')}")
        relevant = []
        for caller_name in sorted(set(question["truth"])):
            if caller_name in atlas_callers:
                locations_for = sorted(atlas_callers[caller_name])
                paths_source = "atlas symbol callers"
            elif _definitions(binary, db, workspace, env, caller_name, definitions_cache):
                locations_for = _definitions(binary, db, workspace, env, caller_name, definitions_cache)
                paths_source = "atlas symbol definitions"
            else:
                locations_for = []
                paths_source = "unresolved (name-only)"
            relevant.append(
                {
                    "names": [caller_name],
                    "paths": sorted({loc.rsplit(":", 1)[0] for loc in locations_for}),
                    "paths_source": paths_source,
                    "match": "name",
                }
            )
        queries.append(
            {
                "id": f"callers::{tag}{entity}",
                "class": "callers",
                "entity": entity,
                "component": component["slug"],
                "question": CALLERS_TEMPLATE.format(entity=entity),
                "relevant": relevant,
                "acceptable": [{**same_name, "why": "the entity itself (the anchor a callers answer shows first)"}],
                "provenance": {**base_provenance, "field": "truth", "paths_from": atlas_version},
            }
        )
    return queries


def derive_corpus(
    name: str, spec: dict[str, Any], binary: str, work: pathlib.Path, sources: dict[str, str]
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    env = rb.atlas_env(work)
    checkout = rb.materialize_corpus(name, spec, work / "corpora", sources)
    store = work / "stores" / name / "atlas.db"
    rb.index_corpus(binary, checkout["path"], store, env)
    db = f"sqlite://{store}"
    version = rb.atlas_version(binary, env)
    cache: dict[str, list[str]] = {}
    queries: list[dict[str, Any]] = []
    for component in spec["components"]:
        queries += derive_component(name, component, binary, db, checkout["path"], env, cache, version)
    return queries, {"atlas": version, "tree": checkout["tree"], "head": checkout["head"]}


def dump(document: dict[str, Any]) -> str:
    """Stable, review-friendly JSON: one label item per line."""
    head = {k: v for k, v in document.items() if k != "queries"}
    lines = ["{"]
    for key, value in head.items():
        lines.append(f" {json.dumps(key)}: {json.dumps(value, ensure_ascii=False)},")
    lines.append(' "queries": [')
    queries = document.get("queries", [])
    for qi, query in enumerate(queries):
        lines.append("  {")
        keys = list(query)
        for ki, key in enumerate(keys):
            value = query[key]
            comma = "," if ki < len(keys) - 1 else ""
            if key in ("relevant", "acceptable") and value:
                lines.append(f"   {json.dumps(key)}: [")
                for ii, item in enumerate(value):
                    item_comma = "," if ii < len(value) - 1 else ""
                    lines.append(f"    {json.dumps(item, ensure_ascii=False)}{item_comma}")
                lines.append(f"   ]{comma}")
            else:
                lines.append(f"   {json.dumps(key)}: {json.dumps(value, ensure_ascii=False)}{comma}")
        lines.append("  }" + ("," if qi < len(queries) - 1 else ""))
    lines.append(" ]")
    lines.append("}")
    return "\n".join(lines) + "\n"


def merge(existing: dict[str, Any] | None, derived: list[dict[str, Any]], corpus: str, info: dict[str, Any]) -> dict[str, Any]:
    hand = [q for q in (existing or {}).get("queries", []) if q.get("provenance", {}).get("source") != "lsp"]
    document = dict(existing or {})
    document.update(
        {
            "schema_version": 1,
            "corpus": corpus,
            "frozen": (existing or {}).get("frozen") or "2026-10-29",
            "derivation": {
                "definition": "LSP `definitions` of the QA-set entity; relevant = name at any of those paths; acceptable = any symbol named exactly the entity",
                "callers": "LSP `truth` caller names, matched by name; paths from Atlas for humans; acceptable = any symbol named exactly the entity",
                "error_handling": "hand-labelled by reading the code at the pinned commit; file:line cited per item",
                "adversarial": "generic/stopword phrasings; expected refusal (code_query insufficient) or, where an acceptable list exists, a grounded answer",
                "paths_from": info["atlas"],
                "corpus_tree": info["tree"],
            },
        }
    )
    document["queries"] = derived + hand
    return document


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--atlas", required=True)
    parser.add_argument("--work", required=True, type=pathlib.Path)
    parser.add_argument("--source", action="append", default=[], help="SLUG=PATH local clone for a corpus component")
    parser.add_argument("--corpus", action="append", default=[])
    parser.add_argument("--check", action="store_true", help="re-derive and diff against the frozen files; write nothing")
    args = parser.parse_args()
    sources = dict(s.split("=", 1) for s in args.source)
    corpora = rb.load_corpora()["corpora"]
    selected = args.corpus or sorted(corpora)
    drift = False
    rb.QUERIES_DIR.mkdir(exist_ok=True)
    for name in selected:
        derived, info = derive_corpus(name, corpora[name], args.atlas, args.work.resolve(), sources)
        path = rb.QUERIES_DIR / f"{name}.json"
        existing = json.loads(path.read_text(encoding="utf-8")) if path.exists() else None
        document = merge(existing, derived, name, info)
        if args.check:
            frozen = [q for q in (existing or {}).get("queries", []) if q.get("provenance", {}).get("source") == "lsp"]
            strip = lambda qs: [{k: v for k, v in q.items() if k != "provenance"} for q in qs]  # noqa: E731
            if strip(frozen) != strip(derived):
                drift = True
                print(f"{name}: derived labels differ from the frozen file {path}")
            else:
                print(f"{name}: frozen labels reproduce ({len(derived)} derived queries)")
            continue
        path.write_text(dump(document), encoding="utf-8")
        print(f"{name}: wrote {len(document['queries'])} queries ({len(derived)} derived) -> {path}")
    return 1 if drift else 0


if __name__ == "__main__":
    raise SystemExit(main())
