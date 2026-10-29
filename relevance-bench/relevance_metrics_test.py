"""Hermetic unit tests for the relevance benchmark scorer (aziron-ai/atlas#44).

No subprocess, no atlas binary, no corpus: every metric is pinned on tiny
synthetic result lists, and the frozen label files are checked for shape.
Run standalone: `python3 relevance-bench/relevance_metrics_test.py`.
"""

from __future__ import annotations

import json
import os
import pathlib
import sys
import tempfile
import unittest

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import relevance_bench as rb  # noqa: E402
import relevance_metrics as rm  # noqa: E402
import relevance_report  # noqa: E402


def r(name, path="a.c", line=1, kind="function"):
    return {"name": name, "path": path, "line": line, "kind": kind}


DEF_LABEL = {
    "class": "definition",
    "entity": "parse",
    "relevant": [{"names": ["parse"], "paths": ["src/parse.c", "include/parse.h"], "match": "name+path"}],
    "acceptable": [{"names": ["parse"], "paths": [], "match": "name"}],
}
CALLERS_LABEL = {
    "class": "callers",
    "entity": "parse",
    "relevant": [
        {"names": ["main"], "paths": [], "match": "name"},
        {"names": ["load"], "paths": [], "match": "name"},
        {"names": ["reload"], "paths": [], "match": "name"},
    ],
    "acceptable": [{"names": ["parse"], "paths": [], "match": "name"}],
}


class MatchingTest(unittest.TestCase):
    def test_name_matches_exact_and_qualified_last_segment(self):
        self.assertTrue(rm.name_matches("send", "send"))
        self.assertTrue(rm.name_matches("Session.send", "send"))
        self.assertTrue(rm.name_matches("DBImpl::Get", "Get"))
        self.assertFalse(rm.name_matches("Close", "close"))  # case matters: different entity
        self.assertFalse(rm.name_matches("sendall", "send"))
        self.assertFalse(rm.name_matches("", "send"))

    def test_item_matches_respects_path_mode(self):
        item = {"names": ["parse"], "paths": ["./src/parse.c"], "match": "name+path"}
        self.assertTrue(rm.item_matches(r("parse", "src/parse.c"), item))
        self.assertFalse(rm.item_matches(r("parse", "tests/parse.c"), item))
        self.assertTrue(rm.item_matches(r("parse", "anywhere.c"), {"names": ["parse"], "match": "name"}))

    def test_dedupe_keeps_first_occurrence(self):
        rows = [r("a", "x.c", 1), r("a", "./x.c", 1), r("a", "x.c", 2)]
        self.assertEqual(len(rm.dedupe(rows)), 2)

    def test_relevant_beats_acceptable_for_the_same_result(self):
        graded = rm.grade([r("parse", "src/parse.c"), r("parse", "tests/t.c"), r("noise")], DEF_LABEL)
        self.assertEqual([tier for tier, _ in graded], ["relevant", "acceptable", "miss"])


class PerQueryMetricTest(unittest.TestCase):
    def test_definition_metrics(self):
        # rank 1 noise, rank 2 acceptable same-name, rank 3 the labelled definition
        results = [r("where", "pyproject.toml", 84, "key"), r("parse", "tests/t.c"), r("parse", "src/parse.c")]
        score = rm.score_query(DEF_LABEL, {"status": "ok", "results": results})
        self.assertAlmostEqual(score["p@1"], 0.0)
        self.assertAlmostEqual(score["p@3"], 2 / 3)
        # denominator is min(k, returned): 3 results returned
        self.assertAlmostEqual(score["p@10"], 2 / 3)
        self.assertAlmostEqual(score["mrr"], 1 / 3)
        self.assertAlmostEqual(score["recall@10"], 1.0)
        self.assertEqual(score["entity_first"], 0.0)
        self.assertEqual(score["refused"], 0.0)
        self.assertAlmostEqual(score["noncode_share@10"], 1 / 3)
        self.assertAlmostEqual(score["test_share@10"], 1 / 3)

    def test_callers_recall_is_capped_and_counts_distinct_items(self):
        results = [r("parse"), r("main"), r("main", "b.c"), r("load"), r("other")]
        score = rm.score_query(CALLERS_LABEL, {"status": "ok", "results": results})
        self.assertEqual(score["entity_first"], 1.0)
        self.assertAlmostEqual(score["mrr"], 0.5)  # acceptable anchor never counts for MRR
        self.assertAlmostEqual(score["recall@10"], 2 / 3)  # main (twice) + load of 3
        self.assertAlmostEqual(score["p@5"], 4 / 5)

    def test_recall_cap_for_large_truth_sets(self):
        many = {"class": "callers", "entity": "x", "relevant": [{"names": [f"c{i}"], "match": "name"} for i in range(40)]}
        results = [r(f"c{i}") for i in range(10)]
        self.assertAlmostEqual(rm.score_query(many, {"status": "ok", "results": results})["recall@10"], 1.0)

    def test_empty_answer_scores_zero_and_counts_as_refused(self):
        score = rm.score_query(DEF_LABEL, {"status": "empty", "results": []})
        for metric in ("p@1", "p@3", "p@5", "p@10", "mrr", "recall@10", "entity_first"):
            self.assertEqual(score[metric], 0.0, metric)
        self.assertEqual(score["refused"], 1.0)

    def test_only_first_ten_results_count(self):
        results = [r(f"n{i}") for i in range(10)] + [r("parse", "src/parse.c")]
        score = rm.score_query(DEF_LABEL, {"status": "ok", "results": results})
        self.assertEqual(score["mrr"], 0.0)
        self.assertEqual(score["recall@10"], 0.0)


class AdversarialTest(unittest.TestCase):
    PURE = {"class": "adversarial", "relevant": [], "acceptable": []}
    DOMAIN = {
        "class": "adversarial",
        "relevant": [],
        "acceptable": [{"names": [n], "paths": [], "match": "name"} for n in ("handleError", "logError", "ErrorCodes")],
    }

    def test_code_query_insufficient_is_a_refusal(self):
        score = rm.score_query(self.PURE, {"status": "insufficient", "results": []})
        self.assertEqual((score["refused"], score["grounded"], score["safe"], score["noise"]), (1.0, 0.0, 1.0, 0.0))

    def test_any_answer_to_a_pure_generic_query_is_noise(self):
        score = rm.score_query(self.PURE, {"status": "ok", "results": [r("main")]})
        self.assertEqual((score["refused"], score["safe"], score["noise"]), (0.0, 0.0, 1.0))

    def test_domain_query_answered_from_the_labelled_machinery_is_grounded(self):
        results = [r("handleError"), r("logError"), r("noise"), r("ErrorCodes"), r("x")]
        score = rm.score_query(self.DOMAIN, {"status": "ok", "results": results})
        self.assertEqual((score["grounded"], score["safe"], score["noise"]), (1.0, 1.0, 0.0))
        thin = rm.score_query(self.DOMAIN, {"status": "ok", "results": [r("handleError"), r("a"), r("b"), r("c")]})
        self.assertEqual(thin["noise"], 1.0)


class PollutionSignalTest(unittest.TestCase):
    def test_identifier_words(self):
        self.assertEqual(rm.identifier_words("num_401_calls"), {"num", "401", "calls"})
        self.assertEqual(rm.identifier_words("getHTTPResponse"), {"get", "http", "response"})

    def test_query_word_top1(self):
        q = "where is send defined?"
        self.assertEqual(rm.query_word_top1([r("where", "pyproject.toml")], q, "send"), 1.0)
        self.assertEqual(rm.query_word_top1([r("num_401_calls")], "what calls Open?", "Open"), 1.0)
        self.assertEqual(rm.query_word_top1([r("send")], q, "send"), 0.0)
        self.assertEqual(rm.query_word_top1([r("sendall")], q, "send"), 0.0)  # shares the entity's word
        self.assertEqual(rm.query_word_top1([r("unrelated")], q, "send"), 0.0)
        self.assertEqual(rm.query_word_top1([], q, "send"), 0.0)

    def test_query_word_top1_in_score_ignores_a_labelled_hit(self):
        label = {
            "class": "error_handling",
            "entity": "warn",
            "question": "warn error exception handling",
            "relevant": [{"names": ["callWithErrorHandling"], "match": "name"}],
            "acceptable": [],
        }
        hit = rm.score_query(label, {"status": "ok", "results": [r("callWithErrorHandling")]})
        self.assertEqual(hit["query_word_top1"], 0.0)  # on-topic phrase word, labelled relevant
        noise = rm.score_query(label, {"status": "ok", "results": [r("RequestException")]})
        self.assertEqual(noise["query_word_top1"], 1.0)  # "exception" outranks the entity, and is a miss

    def test_path_class(self):
        self.assertEqual(rm.path_class(r("x", "packages/a/__tests__/b.spec.ts")), "test")
        self.assertEqual(rm.path_class(r("x", "tests/test_requests.py")), "test")
        self.assertEqual(rm.path_class(r("x", "db/db_test.cc")), "test")
        self.assertEqual(rm.path_class(r("x", "third_party/g/x.cc")), "generated")
        self.assertEqual(rm.path_class(r("where", "pyproject.toml", kind="key")), "noncode")
        self.assertEqual(rm.path_class(r("x", ".github/workflows/ci.yml")), "noncode")
        self.assertEqual(rm.path_class(r("x", "src/models.py")), "code")


class ParserTest(unittest.TestCase):
    def test_parse_search(self):
        parsed = rm.parse_search({"results": [{"symbol": "a", "path": "x.c", "line": 3, "kind": "function"}], "truncated": True})
        self.assertEqual(parsed["status"], "ok")
        self.assertEqual(parsed["results"][0], {"name": "a", "path": "x.c", "line": 3, "kind": "function"})
        self.assertEqual(rm.parse_search({"results": []})["status"], "empty")
        self.assertEqual(rm.parse_search(None)["status"], "error")

    def test_parse_context_appends_unseen_search_hits(self):
        payload = {
            "symbols": [{"symbol": "a", "path": "x.c", "line": 1}, {"symbol": "b", "path": "y.c", "line": 2}],
            "search_hits": [{"symbol": "a", "path": "x.c", "line": 1}, {"symbol": "c", "path": "z.c", "line": 3}],
        }
        self.assertEqual([row["name"] for row in rm.parse_context(payload)["results"]], ["a", "b", "c"])

    def test_parse_code_query_ok_and_insufficient(self):
        ok = rm.parse_code_query(
            {"status": "ok", "citations": [{"symbol": "a", "path": "x.c", "start_line": 4, "kind": "function"}]}
        )
        self.assertEqual(ok["results"][0]["line"], 4)
        refused = rm.parse_code_query(
            {
                "status": "insufficient",
                "reason": "citations_below_relevance_floor",
                "low_confidence_hits": [{"symbol": "m", "path": "m.rb", "line": 1}],
            }
        )
        self.assertEqual(refused["results"], [])
        self.assertEqual(refused["reason"], "citations_below_relevance_floor")
        self.assertTrue(rm.is_refused(refused))


def _record(corpus, klass, surface, **score):
    base = {"returned": 1, "latency_ms": 10.0, "bytes": 100, "truncated": False, "top": [], "grades": []}
    for metric in rm.REPORT_METRICS:
        base.setdefault(metric, 0.0)
    base.update(score)
    return {"corpus": corpus, "class": klass, "surface": surface, "query_id": "q", "question": "q", "score": base}


class AggregateAndGateTest(unittest.TestCase):
    def setUp(self):
        named = {m: 1.0 for m in rm.NAMED_METRICS}
        self.records = [
            _record("c1", "definition", "search", **named),
            _record("c1", "definition", "search", **{**named, "mrr": 0.5, "p@1": 0.0}),
            _record("c2", "definition", "search", **{**named, "mrr": 0.0}),
            _record("c1", "adversarial", "code_query", refused=1.0, safe=1.0, grounded=0.0, noise=0.0),
            _record("c1", "adversarial", "code_query", refused=0.0, safe=0.0, grounded=0.0, noise=1.0),
        ]

    def test_summarize_pools_and_splits_by_corpus(self):
        summary = rm.summarize(self.records)
        self.assertAlmostEqual(summary["pooled"]["search"]["definition"]["mrr"], 0.5)
        self.assertEqual(summary["pooled"]["search"]["definition"]["n"], 3)
        self.assertAlmostEqual(summary["by_corpus"]["c1"]["search"]["definition"]["mrr"], 0.75)
        self.assertAlmostEqual(summary["pooled"]["code_query"]["adversarial"]["refused"], 0.5)

    def test_gate_freezes_baseline_minus_margin_and_fails_below(self):
        summary = rm.summarize(self.records)
        plan = [
            {"scope": "pooled", "surface": "search", "class": "definition", "metric": "mrr"},
            {"scope": "pooled", "surface": "code_query", "class": "adversarial", "metric": "safe"},
        ]
        thresholds = rm.build_gate(summary, plan, {"default": 0.03, "safe": 0.6})
        # n=3 widens the 0.03 margin to one query's worth (1/3 -> 0.334)
        self.assertEqual(thresholds[0]["n"], 3)
        self.assertEqual(thresholds[0]["margin"], 0.334)
        self.assertEqual(thresholds[0]["min"], 0.166)
        self.assertEqual(thresholds[1]["min"], 0.0)  # floored at zero
        self.assertTrue(all(v["verdict"] == "pass" for v in rm.evaluate_gate(summary, thresholds)))
        big = rm.summarize([_record("c1", "definition", "search", **{**{m: 1.0 for m in rm.NAMED_METRICS}})] * 100)
        self.assertEqual(rm.build_gate(big, plan[:1], {"default": 0.03})[0]["min"], 0.97)  # 1/100 < 0.03
        zero = {m: 0.0 for m in rm.NAMED_METRICS}
        # the rank-1 query losing its hit (MRR 0.5 -> 0.1667) still clears 0.166; losing everything does not
        borderline = rm.summarize([_record("c1", "definition", "search", **zero)] + self.records[1:3])
        self.assertEqual(rm.evaluate_gate(borderline, thresholds[:1])[0]["verdict"], "pass")
        regressed = rm.summarize([_record("c1", "definition", "search", **zero)] * 3)
        verdicts = rm.evaluate_gate(regressed, thresholds)
        self.assertEqual(verdicts[0]["verdict"], "fail")
        self.assertEqual(verdicts[1]["verdict"], "missing")  # a metric the run did not produce fails closed


class FrozenLabelFilesTest(unittest.TestCase):
    """The committed label files must stay well-formed and big enough."""

    def test_every_corpus_has_labelled_queries_for_every_class(self):
        corpora = rb.load_corpora()["corpora"]
        for name in corpora:
            document = rb.load_queries(name)
            self.assertEqual(document["corpus"], name)
            queries = document["queries"]
            self.assertGreaterEqual(len(queries), 40, name)
            classes = {q["class"] for q in queries}
            self.assertEqual(classes, {"definition", "callers", "error_handling", "adversarial"}, name)
            ids = [q["id"] for q in queries]
            self.assertEqual(len(ids), len(set(ids)), f"{name}: duplicate query ids")
            for query in queries:
                self.assertIn(query["provenance"]["source"], ("lsp", "hand"), query["id"])
                if query["class"] == "adversarial":
                    self.assertEqual(query["relevant"], [], query["id"])
                    continue
                self.assertTrue(query["entity"], query["id"])
                self.assertTrue(query["relevant"], query["id"])
                for item in query["relevant"] + query["acceptable"]:
                    self.assertTrue(item["names"], query["id"])
                    self.assertIn(item["match"], ("name", "name+path"), query["id"])
                    if item["match"] == "name+path":
                        self.assertTrue(item["paths"], query["id"])
                if query["class"] == "error_handling":
                    for item in query["relevant"]:
                        self.assertTrue(item.get("locations"), f"{query['id']}: hand labels cite file:line")

    def test_corpora_pin_commits_and_trees(self):
        for name, spec in rb.load_corpora()["corpora"].items():
            self.assertRegex(spec["tree"], r"^[0-9a-f]{40}$", name)
            for component in spec["components"]:
                self.assertRegex(component["commit"], r"^[0-9a-f]{40}$", name)

    def test_gate_file_thresholds_are_well_formed(self):
        if not rb.GATE_FILE.exists():
            self.skipTest("GATE.json not frozen yet")
        gate = json.loads(rb.GATE_FILE.read_text(encoding="utf-8"))
        self.assertTrue(gate["thresholds"])
        for entry in gate["thresholds"]:
            self.assertLessEqual(entry["min"], entry["baseline"])
            self.assertGreaterEqual(entry["min"], 0.0)


class ReportTest(unittest.TestCase):
    def test_findings_block_survives_a_rerender(self):
        with tempfile.TemporaryDirectory() as tmp:
            existing = pathlib.Path(tmp) / "RESULTS.md"
            existing.write_text(
                f"old numbers\n{relevance_report.FINDINGS_BEGIN}\nhand finding F1\n{relevance_report.FINDINGS_END}\n",
                encoding="utf-8",
            )
            named = {m: 1.0 for m in rm.NAMED_METRICS}
            records = [_record("c1", "definition", "search", **named)]
            results = {
                "run": {
                    "atlas_version": "atlas test",
                    "atlas_binary_sha256": "0" * 64,
                    "measured_at": "now",
                    "platform": "test",
                    "seconds": 1,
                    "surfaces": ["search"],
                },
                "store_identity": {},
                "label_counts": {"c1": {"definition": 1, "total": 1}},
                "summary": rm.summarize(records),
                "gate": {"status": "pass", "thresholds": 0, "failures": 0, "verdicts": []},
            }
            text = relevance_report.render(results, records, existing)
            self.assertIn("hand finding F1", text)
            self.assertNotIn("old numbers", text)

    def test_results_rows_are_one_per_line(self):
        results = {"queries": [{"a": 1}, {"a": 2}], "gate": {"verdicts": [{"v": 1}]}, "x": {"y": 1}}
        text = rb.dump_results(results)
        self.assertIn('  {"a": 1},\n  {"a": 2}\n', text)
        self.assertEqual(json.loads(text), results)


if __name__ == "__main__":
    unittest.main()
