import React from "react";
import { Command, ProseSection, Bullets, Callout, Figure, Clip, RELEASE, GITHUB, WIKI } from "./ui.jsx";

export default function Page() {
  return (
    <>
      <p className="docs-lead">A skill is a runbook: the steps someone repeats to do a job — triage a timeout, restart a deployment, check a release — written down once, reviewed, and handed to every connected assistant to follow. Atlas can mine skills from the procedures it watches people repeat, or you can write one by hand; either way a skill moves through review before any agent sees it. Reach for this when your team keeps solving the same problem the same way.</p>

      <ProseSection title="Open It">
        <p>The <strong>AUTOMATE</strong> group in the dashboard rail holds three views:</p>
        <Bullets>
          <li><strong>Skill Studio</strong> (<code>#/studio</code>) — review what the miner found, edit a skill and preview the <code>SKILL.md</code> an agent will read.</li>
          <li><strong>Skills</strong> (<code>#/automations</code>) — the registry: every stored version and where it is in its lifecycle.</li>
          <li><strong>Approvals</strong> (<code>#/approvals</code>, titled <strong>Action Queue</strong>) — everything waiting for a human decision: skills submitted for trust, the actions Atlas derived from incidents, and requests from the graph.</li>
        </Bullets>
        <p>From the terminal the same work is <code>atlas skill</code> (author, test, render, distribute) and <code>atlas recall</code> (mine frequent prompts, move automations through their lifecycle, sync with an org Atlas).</p>
        <Figure src="assets/docs/skills/skill-studio.png" alt="Skill Studio with no mined trajectories, its filters for automatability and side-effect tier, and one registered candidate skill" caption="Skill Studio on the demo service: episode capture is off, so nothing is mined yet; one skill was registered by hand." />
      </ProseSection>

      <ProseSection title="Follow a Skill Through Its Lifecycle">
        <p>Every skill version is in one of five states. The <strong>Skill lifecycle</strong> strip on the Skills page counts them; click a stage to filter the registry.</p>
        <div className="docs-table-wrap"><table>
          <thead><tr><th>State</th><th>Meaning</th></tr></thead>
          <tbody>
            <tr><td><strong>candidate</strong></td><td>registered, not yet reviewed</td></tr>
            <tr><td><strong>validating</strong></td><td>submitted for trust; waiting in the Action Queue</td></tr>
            <tr><td><strong>trusted</strong></td><td>advertised to connected agents; runbooks are rendered as <code>SKILL.md</code> files</td></tr>
            <tr><td><strong>quarantined</strong></td><td>pulled from agents pending review</td></tr>
            <tr><td><strong>revoked</strong></td><td>permanently withdrawn</td></tr>
          </tbody>
        </table></div>
        <Figure src="assets/docs/skills/skills-registry.png" alt="The Skills page: lifecycle strip with one candidate, the registry list, and the selected skill's runbook steps, rendered SKILL.md and contract" caption="A candidate runbook in the registry: its steps with their side-effect tiers, the rendered SKILL.md, and its contract." />
        <p>Selecting a skill shows its <strong>Runbook steps</strong>, each tagged with a side-effect tier (<code>read</code>, <code>mutate-local</code>, <code>mutate-shared</code>, <code>destructive</code>, <code>credential</code> or <code>unknown</code>), the <strong>Rendered SKILL.md</strong>, and its <strong>Contract</strong>: params, preconditions, verify, rollback and the files whose change makes it stale. Versions are immutable — a change is a new version that goes through review again.</p>
        <p>The Command Center shows the same counts in its <strong>Skills lifecycle</strong> panel:</p>
        <Figure src="assets/docs/skills/skills-lifecycle-panel.png" alt="The Command Center's Skills lifecycle panel: candidate 0, validating 0, trusted 1, quarantined 0, revoked 0" caption="Skills lifecycle on the Command Center, read from the recall registry." width={320} />
      </ProseSection>

      <ProseSection title="Let Atlas Find Repeated Work">
        <p>Mining needs episodes: the sessions your assistants run, captured with prompts redacted. A service does not read your agents' transcripts unless you opt in, and says so when it starts:</p>
        <Command label="atlas serve">{`episode capture: off — set ATLAS_SERVE_CAPTURE=1 to opt in`}</Command>
        <p>Turn it on for a service that runs on your own machine:</p>
        <Command>{`ATLAS_SERVE_CAPTURE=1 atlas serve`}</Command>
        <Bullets>
          <li>The service then scans <code>~/.claude/projects</code> and <code>~/.codex/sessions</code> every <code>ATLAS_SERVE_CAPTURE_SEC</code> seconds (default 20) into its observability store — <code>telemetry.db</code> beside the graph, never the graph itself.</li>
          <li><code>ATLAS_SERVE_CAPTURE_PROMPT_MODE</code> decides how prompts are kept: <code>off</code> stores only a hash, <code>norm</code> (the default) stores redacted normalized text, <code>raw</code> stores redacted prompt text. Tool traces are always redacted.</li>
          <li><code>atlas privacy purge-recall --apply --yes</code> deletes what was captured. See <a className="text-link" href="#docs/privacy">Privacy</a>.</li>
        </Bullets>
        <p>For a team, <code>atlas connect</code> installs the Claude and Codex capture hooks on each machine instead (see <a className="text-link" href="#docs/teams">One Atlas for a team</a>). Once episodes arrive, repeated command sequences show up as <strong>Mined trajectories</strong> in Skill Studio — filter them by <strong>Ready to automate</strong>, kind and tier, sort by <strong>hot</strong>, <strong>ROI</strong>, <strong>frequency</strong> or <strong>newest</strong> — and on the Command Center under <strong>Ready to automate</strong>. On the demo service capture is off, so both are empty:</p>
        <Figure src="assets/docs/skills/ready-to-automate.png" alt="The Command Center's Ready to automate panel: No procedural clusters mined yet" caption="Ready to automate stays empty until episodes are captured." />
        <p>Recall also mines the questions people ask. Asking the same thing twice is enough to form a cluster:</p>
        <Command>{`$ atlas recall clusters
{"clusters":[{"id":"39da6790b3d067bc","prompt_norm":"what calls modeldenied","frequency":2,"user_count":1,
  "avg_tokens":8822,"hot_score":9691.899128981016,"success_ratio":1,"automatable":"yes","status":"open",…},
 {"id":"5a9649f09806db7b","prompt_norm":"how are allowed models enforced","frequency":2,"user_count":1,
  "avg_tokens":7806,"hot_score":8575.767427903642,"success_ratio":1,"automatable":"yes","status":"open",…}],
 "events":4}`}</Command>
        <p><code>atlas recall promote &lt;id&gt;</code> distills a cluster into a candidate automation; <code>atlas skill new &lt;slug&gt; --from-cluster &lt;id&gt;</code> prefills a runbook from a mined trajectory; <code>atlas skill suggest</code> ranks clusters by how automatable they are.</p>
      </ProseSection>

      <ProseSection title="Write a Skill">
        <p>A skill pack is a folder, <code>~/.atlas/skills/&lt;slug&gt;/</code>, holding <code>skill.yaml</code>. Scaffold one, fill it in, then lint and test it:</p>
        <Command>{`$ atlas skill new upstream-timeout-triage
scaffolded ~/.atlas/skills/upstream-timeout-triage
edit skill.yaml, then: atlas skill lint upstream-timeout-triage && atlas skill test upstream-timeout-triage`}</Command>
        <Command label="skill.yaml">{`slug: upstream-timeout-triage
title: Triage upstream provider timeouts in inference-gateway
version: 1
kind: runbook
triggers:
  - groq is timing out
  - failed to generate tokens
  - upstream provider errors on the gateway
params:
  - name: namespace
    default: inference
  - name: deployment
    default: inference-gateway
preconditions:
  - command -v git
steps:
  - run: git log --oneline -5 -- api/routes.go providers/core/provider.go
    expect: the last changes to the chat handler and the provider client
    tier: read
  - run: grep -n "request timed out" api/routes.go
    expect: the call sites that log the timeout
    tier: read
  - run: grep -n "READ_TIMEOUT\\|WRITE_TIMEOUT" config/config.go
    expect: the server timeouts the gateway runs with
    tier: read
  - run: kubectl rollout restart deployment/{deployment} -n {namespace}
    expect: a fresh rollout once the provider recovers
    tier: mutate-shared
verify: the error templates for api/routes.go stop growing in Log Streams
rollback: kubectl rollout undo deployment/{deployment} -n {namespace}
staleness:
  ttl_days: 90
  files:
    - api/routes.go
    - providers/core/provider.go`}</Command>
        <p><code>atlas skill test</code> runs the preflight checks and the <code>read</code> steps only, and prints mutating steps without running them. A step tagged <code>read</code> whose command Atlas cannot prove read-only is refused, not run.</p>
        <Command>{`$ atlas skill lint upstream-timeout-triage
ok

$ atlas skill test upstream-timeout-triage
preflight 1: command -v git
/usr/bin/git
  ✓ ok
step 1 (read): git log --oneline -5 -- api/routes.go providers/core/provider.go
0c89a51 feat(telemetry): name outbound spans with method and path (#554)
3199ad2 refactor: gate image stripping on per-model modalities (#549)
…
  ✓ ok
step 2 (read): grep -n "request timed out" api/routes.go
486:  router.logger.Error("request timed out", err, "provider", provider.GetName())
801:  router.logger.Error("request timed out", err, "provider", providerID)
…
  ✓ ok
step 3 (read): grep -n "READ_TIMEOUT\\|WRITE_TIMEOUT" config/config.go
96:  ReadTimeout        time.Duration \`env:"READ_TIMEOUT, default=30s" description:"Read timeout"\`
97:  WriteTimeout       time.Duration \`env:"WRITE_TIMEOUT, default=30s" description:"Write timeout"\`
  ✓ ok
step 4 (mutate-shared, NOT executed): kubectl rollout restart deployment/inference-gateway -n inference
preflight + read steps pass; mutating steps printed only

$ atlas skill register upstream-timeout-triage
registered upstream-timeout-triage v1 (candidate, kind runbook)`}</Command>
        <p>Open the registered skill in <strong>Skill Studio</strong> to see it the way a reviewer will: identity and triggers, params, preconditions, steps with their tiers, and a live preview of the rendered runbook. A registered version is read-only — <strong>Fork v2 to edit</strong> starts the next version. <strong>+ New blank skill</strong> starts one from scratch in the browser.</p>
        <Figure src="assets/docs/skills/skill-studio-editor.png" alt="Skill Studio showing the registered upstream-timeout-triage runbook: identity, triggers, params, preconditions and the rendered SKILL.md preview" caption="The registered runbook in Skill Studio, with the rendered SKILL.md on the right." />
      </ProseSection>

      <ProseSection title="Review and Trust a Skill">
        <ol className="docs-list numbered">
          <li>In <strong>Skills</strong>, select the candidate and click <strong>Submit for trust</strong>. Its state becomes <strong>validating</strong>.</li>
          <li>Open <strong>Approvals</strong>. The skill waits under <strong>Skill candidates for org trust</strong> with its provenance, the first steps and a <strong>HIGH-TIER STEPS</strong> warning for anything beyond <code>read</code>. <strong>Runbook</strong> opens the full rendered text.</li>
          <li>Click <strong>Approve as trusted</strong>, or <strong>Quarantine</strong> to send it back.</li>
        </ol>
        <Clip src="assets/docs/skills/submit-for-trust.mp4" alt="Submitting the v2 candidate for trust in Skills, then opening Approvals where it waits under Skill candidates for org trust" caption="Submit for trust, then review in the Action Queue." />
        <Figure src="assets/docs/skills/skill-trust-review.png" alt="The skill trust review card: validating, mutate-shared, provenance, the first three read steps, the high-tier kubectl step and the Approve as trusted button" caption="The review card shows the one step that changes something shared before you approve." />
        <Callout kind="warn" label="Where trusted skills are written">
          <p>Trusting a runbook renders it as <code>SKILL.md</code> files for the agents on the machine that runs the service, under that process's home directory. On a shared service, set <code>ATLAS_SKILLS_HOME</code> to the directory those files should go to.</p>
        </Callout>
        <p>The same steps from the terminal, rendering into your own assistants' skill folders:</p>
        <Command>{`$ atlas recall state upstream-timeout-triage trusted
{
  "slug": "upstream-timeout-triage",
  "state": "trusted"
}

$ atlas skill render upstream-timeout-triage --agent claude
rendered upstream-timeout-triage v1 → ~/.claude/skills/atlas-upstream-timeout-triage/SKILL.md
1 skill file(s) written`}</Command>
        <p>The rendered file opens with the procedure's guard rails — run the preflight first, stop on any failed step, report the outcome — then the parameters, preflight and steps.</p>
      </ProseSection>

      <ProseSection title="Decide What Waits in the Action Queue">
        <p><strong>Approvals</strong> is the one place where a person says yes or no. Besides skills it holds the actions Atlas derived from active incidents — a ticket draft, a pull request naming the cited files, an alert rule — and requests Atlas raises from missing route, coverage and freshness signals in the graph.</p>
        <Figure src="assets/docs/skills/action-queue.png" alt="The Action Queue: 17 awaiting review, an incident's ticket draft with its rationale, descriptor and blast radius, and the Approve and Reject buttons" caption="Incident actions in the Action Queue. Each card states what its executor would do; Atlas executes nothing." />
        <Bullets>
          <li>Each card shows its rationale, what the descriptor asks for, and the blast radius if someone runs it.</li>
          <li><strong>Approve</strong> records the decision and the exact descriptor (by digest) for whoever carries it out; <strong>Reject</strong> records the refusal. Decisions are stored on the service and listed under <strong>Recent approval activity</strong>.</li>
          <li>Incident actions are also listed, and can be decided, on the incident itself — see <a className="text-link" href="#docs/observe">Observe</a>.</li>
        </Bullets>
      </ProseSection>

      <ProseSection title="From the CLI">
        <Command>{`$ atlas skill list
{"skills":[{"slug":"upstream-timeout-triage","version":1,"kind":"runbook","state":"candidate",
  "title":"Triage upstream provider timeouts in inference-gateway"}]}

$ atlas recall automations
{"automations":[{"slug":"upstream-timeout-triage","version":1,"kind":"runbook","state":"candidate",
  "prompt_norm":"groq is timing out | failed to generate tokens | upstream provider errors on the gateway",…}],
 "runs":0,"test_runs":0,"tokens_saved_estimated":0,"tokens_saved_measured":0,"tokens_saved_total":0}`}</Command>
        <div className="docs-table-wrap"><table>
          <thead><tr><th>Command</th><th>Does</th></tr></thead>
          <tbody>
            <tr><td><code>atlas skill new &lt;slug&gt; [--from-cluster &lt;id&gt;]</code></td><td>Scaffold a pack, optionally prefilled from a mined trajectory.</td></tr>
            <tr><td><code>atlas skill lint</code> / <code>test</code></td><td>Validate the pack; run preflight and read steps only.</td></tr>
            <tr><td><code>atlas skill register [--trust]</code></td><td>Publish the pack into the local registry as a candidate.</td></tr>
            <tr><td><code>atlas skill render [slug…] --agent &lt;agent&gt;</code></td><td>Write trusted runbooks as <code>SKILL.md</code> files for <code>claude</code>, <code>codex</code>, <code>copilot</code> or <code>all</code>.</td></tr>
            <tr><td><code>atlas skill push</code> / <code>pull</code> / <code>fork</code></td><td>Send a skill to the org Atlas (it arrives as an org candidate), fetch org-trusted skills, or fork a read-only org skill into an editable pack.</td></tr>
            <tr><td><code>atlas skill suggest</code> / <code>graduations</code> / <code>nominate</code></td><td>Rank automatable clusters; list trusted runbooks that earned a script promotion; push one finished session straight to review.</td></tr>
            <tr><td><code>atlas recall clusters</code> / <code>promote</code></td><td>Mine frequent prompts; distill one into a candidate automation.</td></tr>
            <tr><td><code>atlas recall state &lt;slug&gt; &lt;state&gt;</code></td><td>Move an automation through candidate, validating, trusted, revoked.</td></tr>
            <tr><td><code>atlas recall push</code> / <code>pull</code></td><td>Sync trusted automations and anonymized cluster stats with the org Atlas.</td></tr>
          </tbody>
        </table></div>
        <p>See the <a className="text-link" href="#docs/cli">CLI reference</a> for every flag.</p>
      </ProseSection>

      <ProseSection title="From the API">
        <Bullets>
          <li><code>GET /api/v1/skills</code> — the registered packs the review queue reads.</li>
          <li><code>POST /api/v1/recall/automations/{"{slug}"}/state</code> — <code>{`{"state": "validating", "version": 2}`}</code> moves a version through its lifecycle.</li>
          <li><code>GET /api/v1/recall/metrics?by=skill</code> — per-skill savings from the runs ledger (recorded replays and script runs).</li>
          <li><code>POST /api/v1/dashboard/approvals/{"{id}"}</code> — decide a card in the Action Queue.</li>
        </Bullets>
        <p>State changes and decisions need the read-write token when the service enforces one. See <a className="text-link" href="#docs/service">Dashboard and HTTP API</a>.</p>
      </ProseSection>

      <ProseSection title="Related">
        <Bullets>
          <li><a className="text-link" href="#docs/observe">Observe</a> — incidents and the actions they propose.</li>
          <li><a className="text-link" href="#docs/teams">One Atlas for a team</a> — connect machines so skills sync both ways.</li>
          <li><a className="text-link" href="#docs/assistants">AI assistant setup</a> — where rendered skills are read by Claude, Codex and Copilot.</li>
          <li><a className="text-link" href="#docs/privacy">Privacy</a> — what episode capture stores and how to purge it.</li>
        </Bullets>
      </ProseSection>
    </>
  );
}
