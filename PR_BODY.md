# atlas.aziro.com refresh — every published number re-measured at `fc3b875`

This site's credibility was burned once by numbers measured against a stub. This
PR is the repair: every headline is re-derived from artifacts committed in this
branch, every metric carries the definition of the estimator that produced it,
and every claim that could not be re-measured is either withdrawn or shipped
with a visible `carried` label.

The headline numbers get **smaller**. That is the point.

Measured at `fc3b875` (Darwin leg) / `fc68e26` (live + agent legs), 2026-08-05,
against **graphify 0.8.49**.

---

## The claim table — every changed public number

### Headline

| # | Was published | Now published | Why it moved |
|---|---|---|---|
| 1 | **36× fewer query tokens** | **3.17× pooled**, 5.06× per-language mean, 3.66× median, worst language cpp at **1.41×** | The old figure came from a live-repo run against a build whose caller answers were a two-token placeholder. Across all 224 live answers it named **zero callers**. It measured an empty answer, not a cheap one. |
| 2 | **20× fewer query tokens** (historic) | same as above | Retired in the same copy. No literal `20×` survives in this repo at `origin/main` — it was published earlier and readers remember it, so it is retired by name rather than ignored. |
| 3 | **17× faster queries** | **4.12×** (mean of 7 per-repository ratios) | Same stub comparison. Replaced by a same-host, same-run, both-binaries-present measurement. |
| 4 | **+40% answer accuracy** | **1.60× the F1 — 0.865 vs 0.541** | A percentage change in an F1 is not a meaningful unit. The ratio and both raw values are published instead. |
| 5 | **6.4× accuracy per token** | **6.5×** | Same metric, re-derived. |
| 6 | Atlas F1 **0.757** @ 21.2 tok (37 langs) | **0.865** @ **23.9** tok | Fresh sweep, 666 real model calls. |
| 7 | Graph tool **0.539** @ 96.5 tok | **0.541** @ 96.5 tok | Fresh sweep; essentially unchanged. |
| 8 | F1 **1.000 on 28 supported languages @ 27.1 tok, 6.1× fewer** | **32 of 37 languages at a perfect 1.000** | The "28 supported / 6.1×" framing is retired; the honest statement is how many languages score 1.000. |
| 9 | **2.3× faster cold index**, **14× faster incremental**, **7.9× more call edges**, **100.2% AST coverage** | **withdrawn, not restated** | Not re-measured at this commit. A number nobody re-ran is not evidence. |
| 10 | Cross-model agreement table (haiku vs sonnet) | **withdrawn** | One model scored this refresh. There is no agreement to report, and restating July's would be inventing one. |

### The efficiency result (new headline)

| Claim | Value |
|---|---|
| `--detail high` (shipped default) F1 | **0.8649** @ **23.9** tokens |
| `--detail xhigh` (maximum) F1 | **0.8649** @ **230.1** tokens |
| Verdict | **Identical F1 at 9.6× fewer tokens.** More context bought exactly nothing. |
| vs graph tool | **1.60×** the F1 at **4.0×** fewer tokens |
| Controls (exact) | graph tool **0.541**, raw file **1.000** |
| Languages at perfect F1 | **32 of 37** |
| Model calls | **666** (37 langs × 6 sources × 3 samples, temperature 0, majority vote) |

The raw-file row is relabelled from **"ceiling"** to **"positive control"** everywhere.
It contains the answer by construction; its 1.000 checks that the judge works.
Atlas does not beat it and the page no longer implies it does.

### Agent benchmark (both harnesses, 114/114 ok)

| Metric | Was | Now |
|---|---|---|
| Atlas F1, claude | 0.882 | **0.995** |
| Atlas F1, codex | 0.881 | **0.995** |
| Atlas tokens, claude | 61,561 | 58,234 |
| Atlas tokens, codex | 27,981 | 33,471 |
| Baseline F1, claude / codex | 0.569 / 0.876 | 0.589 / 0.831 |
| Graph-tool F1, claude / codex | 0.305 / 0.410 | 0.203 / 0.379 |
| Tokens vs baseline | — | **2.32×** (claude) / **2.22×** (codex) |
| Tokens vs graph tool | — | **4.10×** (claude) / **3.92×** (codex) |
| Date label | 2026-07-10 | 2026-08-05 |

**Disclosed next to the table:** this run used **graphify 0.8.49**; the published
run used **0.9.12**. Part of the movement in the competitor column is a version
change on their side, not a change on ours.

### Live repositories (36 public repos) — and a defect found during this work

The brief's honest live figures were 6.1× median / 4.8× sum (CLI). Reproducing
them exposed that **the same defect being retracted is still present at one tenth
the scale**: on **11 of the 36** repositories the current CLI still answers with a
bare name or a name and a location (`Loader.load`, `HiArgs c@hiargs:36`) while the
graph tool answers with a paragraph. The quotient is large and means nothing.

So the **published** live figure is restricted to the 25 repositories whose answers
named a caller, and the all-36 figure ships beside it, labelled:

| Basis | Token ratio (CLI) | Latency (CLI) |
|---|---|---|
| **Published — 25 answer-bearing repos** | **4.25× median** / **3.70× pooled** | **4.78× median** |
| As-measured — all 36 repos | 6.21× median / 4.82× pooled | 4.66× median / 5.12× per-query median |
| As-measured — serve lane, all 36 | 9.34× median / 14.44× pooled | 6.84× median / 8.33× per-query median |

Excluded (named no caller): `astro, blade, byond, delphi, ejs, lua, powershell,
rust, scala, sql, terraform`. Several of their ratios are large — lua 35.8×,
rust 46.1×, terraform 38.5× — which is precisely why they are excluded.

**Scorecard thresholds (as measured, all 36):** token ≥10× = **11/36** (CLI),
17/36 (serve), 32/36 (stub). Latency ≥10× = **2/36** (CLI), 10/36 (serve),
36/36 (stub). Among the 25 answer-bearing repos, token ≥10× = **6/25**.

**Answer quality:** the stub named a caller in **0 of 224** answers. The current
CLI names one in **64**.

**Regressed vs the stub rows:** two repositories' ratios went *up*, and both are
named on the page — **byond** (17.0 → 38.25 while still naming zero callers: a
bigger multiplier for the same empty answer, hence excluded) and **r**
(91.44 → 274.33, a single-language outlier on a detector-only comparison).
Every other language's multiplier **fell**, which is the retraction working.

### Latency

| Lane | Value | Definition |
|---|---|---|
| 7-repo matrix | **4.12×** vs graph-tool CLI | mean of the 7 per-repository ratios; each timing is the median of 5 CLI runs, spawn included |
| 7-repo matrix, pooled | 4.03× | sum(graphify ms) / sum(atlas ms) |
| Live repos, CLI | **5.12×** (per-query median) / 4.78× (median over answer-bearing langs) | |
| Live repos, warm serve | 8.33× (per-query median) | serve lane — see the parity note below |
| Warm-serve `explain` | **1.6 – 14.9 ms** | per repository, mean of that repo's median explains |

### Maturity ladder

| | Was | Now |
|---|---|---|
| L5 (reference-validated) | **13** | **16** |
| Newly promoted | — | **ruby** 1.000/1.000 · **elixir** 1.000/1.000 · **swift** .9415/.9417 · **kotlin** .9395/.9022 |
| Recovered | — | **rust** .9297/.9652 · **php** .9098/1.000 (July's higher numbers for both retracted with them) |
| Held (canaries) | — | lua .966 · fortran 1.000 · zig 1.000 |
| **Retracted from L5** | dart **PASS @ .9249** | **dart → L4, honest F1 .8631** (precision .9723) |
| Honest fail, published as one | — | **scala .5533** / P .5667 |
| Site-wide fixture score | claimed 37/37 | **32/37** |

**Requalified — the false claim this PR was written to kill.** The site asserted
that `bash, blade, byond, ejs, objc, pascal, powershell, razor, ruby` each scored
*"native F1 1.000 each on the Linux saturation run"*, and drew all nine one rung
above their real level. That is **false at this commit** — the branch it came from
never merged. Re-measured, and now **derived from the run rather than asserted**:

- **fixture-perfect (4):** `bash, byond, objc, powershell` — they stay at **L2**
  badged `fixture-perfect only`. A fixture pass is a floor, not a promotion.
- **return no callers (4):** `blade, ejs, pascal, razor` — F1 **0.000**.
- **ruby** also scores 0.000 on that fixture, and that zero is **designed**: the
  fixture's callers are top-level and the binder refuses to attribute a top-level
  call to an owner it cannot prove. **Ruby's L5 cites the LSP lane against a real
  repository and never the fixture.**

---

## Builder / data fixes

1. **Platform force-label bug (`scripts/build-site-data.mjs`).**
   `(toolsLinux.platform || "Linux x86_64").replace(/\s+\S*$/, " x86_64")`
   overwrote the last token of the platform string with `x86_64` whatever the run
   reported. This leg is **aarch64** and would have been published as a machine the
   measurement never touched. The run's own artifact flagged it by name
   (`_provenance.SITE_BUILDER_BUG`). Now publishes the reported platform verbatim
   plus the host block: an arm64 container on the Darwin workstation, 4 vCPU, eco
   profile auto-selected, and why no remote Linux host was used (all four refused
   passwordless ssh; the run rules forbid guessing a password).
2. **Answer-bearing filter on the live headline** (`scripts/ingest-refresh-artifacts.mjs`) — see above.
3. **Live rows re-sourced** from the fc3b875 artifact instead of `benchmark-data.json`'s
   stub-era `liveBenchmarks`, with the retracted stub column kept visible per row.
4. **New Darwin ingest** (`scripts/ingest-refresh-artifacts.mjs`) reducing ~7 MB / 40
   files to four public artifacts, each stamping its metric **definitions** inline.
5. **BEFORE/AFTER are no longer subtractable.** Published as
   *"AFTER fresh @ `fc68e26`; BEFORE carried from `c7a3e8d` — do not pair as a delta"*,
   with the warning travelling in the payload and both files shipped.
6. **The unrebuildable graphify-Linux latency column is DROPPED, not carried.**
   *(This was the brief's explicit choice; stating the choice and the reason.)* The
   graph tool is not installed on the Linux host
   (`toolchain.graphify: "NOT INSTALLED — competitor column not reproducible on this host"`).
   Carrying it would pair a July x86_64 graphify median against an August arm64
   Atlas median and print the quotient as one run's result — the exact
   cross-binary, cross-architecture fake delta that `CALLERS_F1_BEFORE`'s own
   provenance block warns against. Atlas's absolute median is kept; the
   like-for-like lane is the Darwin matrix.
7. **The report canon is derived, not transcribed.** It is computed from the
   committed artifacts on every build, so it cannot drift from what it cites and a
   future editor cannot quietly retype it.
8. **The per-language table is pivoted from the sweep's own cells** rather than
   hand-maintained.
9. **Charts derive their own annotations.** The frontier's "same F1, N× the tokens"
   label, the detail-knob caption and the latency scatter's axis/median/size-range
   caption all derive from the data they are drawn over. A caption can no longer
   outlive its data.
10. **The ladder demotes.** A language in the matrix that fails the gate is removed
    from L5 and pushed to L4 on every build — and the test suite now fails if dart
    is ever silently re-promoted.
11. **Render bug found by the test suite:** `MaturityLadder` drew the badged
    languages from a separate array that only existed while they were lifted above
    their evidence. With them back at their real level the badge silently stopped
    rendering — the honest label would have been dropped exactly where it was needed.

---

## Disclosure list — carried, unrebuildable, regressed, unverified

**Carried (shipped labelled, makes no claim at this commit)**

- `CALLERS_F1_BEFORE.json` — carried from `c7a3e8d`; a property of a pre-saturation
  binary on other hardware. **Not a delta partner for AFTER.** Artifact tier: `carried`.
- **9 of the 20 rows** in the L5 promotion matrix carry `carried: true` from the July
  base — `csharp, r, julia, verilog, vue, astro, svelte, apex, groovy`. Listed by
  name with their statuses; none counts toward the reference-validated total.
- The **tool-landscape index-time table** (`report.field`) is a July coverage-and-setup
  argument, not re-measured. No ratio on the page is computed from it. Labelled.
- `data/benchmark-data.json` retained at artifact tier `carried` so the retracted
  numbers stay auditable rather than being deleted.

**Unrebuildable this refresh**

- **Graph-tool latency on the Linux leg** — no binary on that host. **Dropped** with a
  note (see builder fix 6).
- **Cross-model agreement** — one model ran; withdrawn.
- The Linux leg's **latency and index-time** figures are architecture-incomparable to
  the published x86_64 run and are labelled as such. F1 is architecture-independent
  and stands.
- The Linux container's atlas binary self-reports as `atlas dev (none, …)`; the tree
  was verified equal to `fc3b875` by `git write-tree` inside the container.

**Regressed / awkward, published anyway**

- **11 of 36** live repositories still name no caller — excluded from the headline and
  listed by name.
- **byond** — token ratio rose 17.0 → 38.25 while still naming zero callers.
- **r** — 91.44 → 274.33, a single-language detector-only outlier.
- **ets** — 29.67 → 8.90; its published multiplier shrank because its answer became real.
- **scala** honest-fail .5533 and **dart** retraction, both published in full.
- **kotlin's** precision clears the promotion gate by **.0022** — the thinnest margin
  in the set, stated on the page.
- **elixir's** promotion is adjudication-dependent: the same binary with corroboration
  off measures **.7437**. Both numbers are published.

**Serve-path note (one line in the methods section, as required)**

> The live-repo `serve` column was measured against the serve endpoint as it behaves at
> this commit, which still returns the reduced answer shape rather than the CLI's full
> one. **Issue #144 is filed to bring serve to CLI parity in 0.1.51.** Until it lands,
> the CLI column is the one to quote.

**Could not verify / chose not to change**

- **The brief's live medians of 6.1× / 9.2× recompute here as 6.21× / 9.34×.** The
  pooled sums reproduce **exactly** (4.82 → 4.8, 14.44 → 14.4) and every per-language
  ratio reproduces exactly, so the estimator behind the last digit of the medians could
  not be identified. Published values are the ones recomputable from the committed
  artifact, with the definition stated. Same for latency: the brief's 5.1× CLI
  reproduces exactly as the **per-query median**; its 7.9× serve figure reproduces only
  as a geometric mean over non-detector languages (7.888), so the per-query median
  (**8.33×**) is published for consistency of estimator.
- **`20×` does not exist anywhere in this repo at `origin/main`** (nor does any `36x`
  in lowercase). It is retired by name in the copy on the assumption it was published
  historically or from the old `atlas-pages` repo. Worth a second pair of eyes.
- **Stale `0.1.43` version pins** in `content/docs/installation.md` and
  `content/docs/upgrade.md` (e.g. `dpkg -i atlas_0.1.43_linux_amd64.deb`) while
  `RELEASE` is `0.1.50`. These markdown twins do not use the `RELEASE` variable that
  the JSX equivalents do. **Found, not fixed** — out of scope for a claims refresh, and
  bumping the literal only relocates the staleness. Fixing it properly means templating
  the markdown pipeline.
- The `L5PromotionPanel` idea did **not** need porting: this repo already has an
  equivalent component (`src/App.jsx`), so it was rebuilt in place rather than
  imported from the old `atlas-pages` `site/l4-to-l5` branch.

---

## Folded / superseded branches

| Branch | Disposition |
|---|---|
| `data/benchmarks-0150` @ `ef0ef2e` | **Superseded wholesale. Nothing cherry-picked.** That drop measured v0.1.50 against a different graphify, and its live rows compared against the stub. It must not ship separately. |
| `docs/profile-ladder-0148` | **Already merged to `main` as PR #143** — there was no branch left to merge. What was outstanding were its version markers, remapped here: the **profile ladder stays "since 0.1.48"** (it shipped in 0.1.48/0.1.49); **foreground-full-throttle** and **`lexical_settle: partial`** move `0.1.50 → "since 0.1.51"` (8 sites, both doc surfaces in lockstep). **Install pins untouched** — `package.json.version`, `data/site-data.json.version` and the `RELEASE` const are bot-owned and stay at 0.1.50. |

---

## Verification

| Check | Result |
|---|---|
| `node scripts/ingest-refresh-artifacts.mjs` | ok — 4 artifacts, leak check clean |
| `node scripts/build-site-data.mjs` | ok — leak check CLEAN |
| `npm ci` | ok |
| `npm run build` | ok — `assets/app.js` 536.4 kb |
| `node scripts/build-seo.mjs` | ok — index digest, 14 doc pages, robots, sitemap (15 urls), llms.txt, llms-full.txt |
| `node scripts/sanitize-public-data.mjs` | **leak check CLEAN (71 files)**, 0 scrubbed, 1 hash re-stamped |
| `npm run test:site` | **17/17 passed** |

The only repo-wide matches for `/Users/`, `damirdarasu` or `MsysTechnologies` are the
**leak-guard regexes themselves** inside `scripts/*.mjs`.

---

## Publish-day steps

1. **If 0.1.51 releases the same day, let the release bot sync versions FIRST.**
   `.github/workflows/site-data-refresh.yml` rewrites exactly three fields —
   `package.json.version`, `data/site-data.json.version`, and the `RELEASE` const in
   `src/ProductDocs.jsx`. This PR deliberately leaves all three at `0.1.50`. Merging
   before the bot runs, then letting it run, is correct; hand-bumping them in this PR
   would fight it.
2. **Then merge this PR.** Pages builds from the committed output (`index.html`,
   `assets/`, `docs/`, `llms*.txt`, `sitemap.xml`), all of which are regenerated and
   committed here — no build step runs on their side.
3. **If 0.1.51 slips**, the `since 0.1.51` paragraphs are forward-dated by design —
   exactly as the original profile-ladder branch was staged against 0.1.48 before that
   release cut. No action needed; they describe the next release.
4. **After merge, spot-check the live page** for: the retraction panel in §01, the
   *Retracted / Carried* panels in §09, `dart` absent from L5 and present in L4, and
   `Linux 6.12.54-linuxkit aarch64` (not `x86_64`) in the provenance row.
5. **Re-run `npm run test:site`** against the deployed URL if the suite is wired for
   it — the ladder test now fails if dart is ever silently re-promoted.

---

## Commits

| Commit | What |
|---|---|
| `b89fea6` | **data:** ingest the fc3b875 refresh, replacing the 0.1.50-era evidence drop |
| `c5d9514` | **builder:** stop mislabelling the host, and stop averaging in non-answers |
| `96c76e9` | **canon:** retire 36x and 17x on every surface, and say why in public |
| `e4de63f` | **ladder:** 16 reference-validated, dart retracted, and a claim requalified |
| `baa4163` | **docs:** fold the profile-ladder branch, with its version markers remapped |
| `0d6a5f4` | **build:** regenerate data, tests and the committed site output |
