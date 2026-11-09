import React from "react";
import { Command, ProseSection, Bullets, Callout, Figure, Clip, RELEASE, GITHUB, WIKI } from "./ui.jsx";

export default function Page() {
  return (
        <>
          <p className="docs-lead">The Ask Workbench is a conversation about your codebase, held inside the Atlas dashboard. You ask in plain language; Atlas gathers the evidence — code passages from its index, git history, and the tickets, pull requests and findings of the sources you connected — plus what it computed itself (routes tables, usage counts, definitions, last changes); a model you choose writes the answer, citing that evidence line by line. Every citation opens the record it came from, and every thread is kept by the server so you can come back to it.</p>
          <p>The Workbench needs a running service (<a className="text-link" href="#docs/service">Dashboard and HTTP API</a>) and an AI provider (<a className="text-link" href="#docs/assistants">AI assistant setup</a>). Without a provider it still answers, with Atlas's own deterministic verdict and facts.</p>
          <ProseSection title="Open It">
            <Command>{`atlas serve`}</Command>
            <p>Open the dashboard (<code>http://127.0.0.1:3099/dashboard</code>) and choose <strong>Ask Workbench</strong>. The composer takes a question; the chips beneath it pick the repository, the sources to consult (Git, GitHub, Jira, Confluence, Pulse — the ones your service has connected), and the model.</p>
            <p>A first question starts a thread. Every later question in the same composer continues it: the server keeps the turns, and the model reads the earlier ones as context. The rail on the left lists your threads; <code>#/workbench?thread=&lt;id&gt;</code> reopens one without re-asking anything.</p>
            <Clip src="assets/docs/workbench/ask-a-question.mp4" alt="Typing a question into the Ask Workbench composer, sending it, and the answer streaming in as a routes table" caption="Asking on inference-gateway: the Atlas and Git lanes answer first (11 and 3 items), then Claude (claude-sonnet-5) writes. This turn took 7.2 s from plan to done." />
          </ProseSection>
          <ProseSection title="What Happens in a Turn">
            <ol className="docs-list">
              <li><strong>Plan.</strong> Atlas reads the question, resolves its scope (a repository, a file, a symbol, a ticket or a pull request) and plans which sources to ask.</li>
              <li><strong>Gather.</strong> The sources run in parallel: the index returns the passages and definitions that match, git blames the lines the question points at, GitHub, Jira, Confluence and Pulse return their records. When the question asks who changed something or which of two things is actually used, Atlas pre-fetches the blame and the callers so the model has them from the start.</li>
              <li><strong>Compute.</strong> Atlas builds its exact verdict and facts — the routes table, the usage summary, the definitions, the last change — and hands them to the model as labelled evidence (<code>S1</code>…<code>S5</code>) beside the passages (<code>A…</code>), commits (<code>G…</code>), tickets (<code>J…</code>), pages (<code>C…</code>) and findings (<code>P…</code>).</li>
              <li><strong>Answer.</strong> The model writes the answer in whatever shape the question calls for — a sentence, a list, a table, a walk-through — citing the labels inline. A multi-part question is answered part by part.</li>
              <li><strong>Ask for more.</strong> When the evidence does not cover something Atlas could fetch, the model asks for it (a symbol's whole body, a file, a search, the callers of a function, a git blame, a ticket) and Atlas resolves the request in well under a second. If the model answered first and then asked, it revises the answer once as a patch: only the sections the new evidence changes are rewritten, and they are marked. By default a turn makes at most three model calls and one revision; what the model would still like to fetch is offered as a follow-up suggestion instead.</li>
            </ol>
            <p>The whole turn streams, so you watch the sources answer, the model write, and the revision land.</p>
            <Figure src="assets/docs/workbench/side-run.png" alt="The Run tab of the side panel: Planned, Atlas gathered 17 items, Exact verdict, Claude answered, Checked, Done" caption="The Run tab tells the same turn back: planned at 48 ms, 17 items gathered, the exact verdict at 288 ms, Claude answered in 6.4 s, all 5 statements checked, done at 7.2 s." />
          </ProseSection>
          <ProseSection title="Reading an Answer">
            <Figure src="assets/docs/workbench/finished-answer.png" alt="A finished Workbench answer: a table of 10 routes with method, path and handler, each handler cited with a chip from A1 to A10" caption="A finished answer. The table lists the 10 routes main.main registers; each handler carries its citation chip (A1–A10) and the count cites the computed routes table (S1)." />
            <Bullets>
              <li><strong>Citations</strong> are chips (<code>A3</code>, <code>G1</code>, <code>J2</code>). Click one for the evidence: the passage with its path and lines, the commit, the ticket. Ticket keys, pull request numbers and commit hashes in the prose are links to Jira or GitHub when the turn holds that record; file paths and symbols link to the Code Map.</li>
              <li><strong>How Atlas got here</strong> (below the answer) opens the deterministic trail: the exact facts with their source tags, the plan, the routes table, every evidence item.</li>
              <li><strong>The trust cue</strong> in the footer counts the statements that cite evidence and flags the ones that do not; <strong>Check</strong> opens the graded view.</li>
              <li><strong>Copy</strong>, <strong>Link</strong> and <strong>Re-ask</strong> sit in the footer. Copy gives the answer as Markdown with its sources; Link is a permalink to the turn at its snapshot; Re-ask runs the same question again at that snapshot as a new turn.</li>
              <li><strong>Follow up</strong> chips under the last turn are the model's suggested next questions; the composer continues the thread.</li>
            </Bullets>
            <Figure src="assets/docs/workbench/citation-popover.png" alt="The popover of citation A5: POST /chat/completions, handler ChatCompletionsHandler, registered at cmd/gateway/main.go:316, with Open in Code Map, Inspector, Pin and Copy" caption="Clicking A5 opens its evidence: POST /chat/completions, served by ChatCompletionsHandler (api/routes.go) and registered at cmd/gateway/main.go:316, at snapshot 5249675." />
            <Figure src="assets/docs/workbench/how-atlas-got-here.png" alt="How Atlas got here, expanded below the answer: What Atlas found, a list of facts tagged real, then the routes table grouped by router" caption="How Atlas got here, opened: the scope, intent and snapshot, the facts Atlas found (each tagged real and cited), then the routes table grouped by router." />
            <Figure src="assets/docs/workbench/follow-up.png" alt="The end of a turn: source lanes, the model chip, 7.2 s, How Atlas got here, All 5 statements cite evidence, Copy, Link, Re-ask, and three Follow up suggestions" caption="The end of the turn: the source lanes, the model chip and time, How Atlas got here, the trust cue (All 5 statements cite evidence), Copy · Link · Re-ask, and the Follow up suggestions." />
          </ProseSection>
          <ProseSection title="The Side Panel">
            <p>The panel on the right follows the selected turn and names it ("Turn 2 of 3 · 10:24 · 3 rounds · revised once · 48 s"), with ‹ › to move between turns.</p>
            <Bullets>
              <li><strong>Evidence</strong> lists everything the turn gathered, by source.</li>
              <li><strong>Inspector</strong> shows one item in full; pin a chip to keep it there.</li>
              <li><strong>Run</strong> tells the turn as a timeline — planned, gathered, answered, asked, fetched, revised, checked, done — with the time each step took. The <strong>Conversation</strong> scope shows where the time went across every turn.</li>
              <li><strong>Tokens</strong> shows what the turn cost: the prompt the model read (input, including the prompt cache), its output, the time, and the budget; per model call inside the turn, and totals across the conversation with one row per question.</li>
            </Bullets>
            <Figure src="assets/docs/workbench/side-evidence.png" alt="The Evidence tab: the CODE lane with A1 to A10 routes, A11 main.main, S1 Routes table and S4 Last change" caption="Evidence, by lane: ten routes (A1–A10), the registrar main.main (A11) and the facts Atlas computed (S1, S4…)." width={340} />
            <Figure src="assets/docs/workbench/side-tokens.png" alt="The Tokens tab: about 2,394 tokens of evidence, 6,482 model input and 547 output tokens, the model, and the hourly budget" caption="Tokens for the same turn: about 2,394 tokens of evidence, 6,482 input and 547 output tokens as the provider reported them, and 1 of 30 model turns used this hour." />
          </ProseSection>
          <ProseSection title="Threads, Ownership and Sharing">
            <p>Threads live in the service's database, not in the browser. On a laptop's own Atlas every thread belongs to you. A shared service (one that identifies its callers through a Jira OAuth session or a gateway identity header) keeps each thread private to its owner unless the owner shares it with the tenant; an operator token sees all of them, a read-only token sees shared ones. Rename, share and delete from the thread's header.</p>
            <Figure src="assets/docs/workbench/thread-rail.png" alt="The thread rail open over the answer: Threads, + New, and one thread from today with its turn count and verdict" caption="☰ Threads opens the rail: each thread with its age, turn count and verdict. ✎ renames, × deletes, + New starts another thread." />
          </ProseSection>
          <ProseSection title="Use It from the API">
            <p>The Workbench is an HTTP route like every other dashboard feature, so a script or another tool can ask the same questions:</p>
            <Command>{`# ask, streaming the turn as server-sent events (thread_id continues a thread)\ncurl -N -X POST http://127.0.0.1:3099/api/v1/ask/workbench \\\n  -H 'content-type: application/json' \\\n  -d '{"question":"what are the auth routes, and who last changed the login one?"}'\n\n# the threads the server keeps\ncurl http://127.0.0.1:3099/api/v1/ask/workbench/threads\ncurl http://127.0.0.1:3099/api/v1/ask/workbench/threads/<id>`}</Command>
            <p>The stream's frames — <code>thread</code>, <code>plan</code>, <code>agent.*</code>, <code>merge</code>, <code>verify</code>, <code>meta</code>, <code>delta</code>, <code>more</code>, <code>usage</code>, <code>patch</code>, <code>done</code> — are described in <code>openapi.json</code> on the running service. A thread is read with <code>{"GET …/threads/{id}"}</code>, renamed with <code>PATCH</code>, deleted with <code>DELETE</code>; <code>DELETE …/threads</code> removes all of the caller's threads. Reads need the read-only token or better where a token is set; writes need the read-write token.</p>
          </ProseSection>
          <ProseSection title="Choosing the Model">
            <p>The Workbench uses the same providers as the Ask page's AI answers: a <code>claude</code> or <code>codex</code> CLI that is installed and logged in is detected automatically, and an API key can be stored with <code>atlas llm set</code>. <code>atlas llm status</code> shows what is configured and which models the provider offers; the composer's model menu lists those models. On the Claude CLI, a call that only decides what Atlas should fetch runs at low reasoning effort; the answer runs at the CLI's default unless <code>ATLAS_WORKBENCH_ANSWER_EFFORT</code> says otherwise.</p>
          </ProseSection>
          <ProseSection title="What Leaves the Machine">
            <p>Only when a model is configured and a question is asked: the question, the labelled evidence the turn gathered (passages, never whole files; records from the connected sources), the earlier turns of the thread as context, and the instructions. Nothing is sent when no provider is configured, and nothing is sent for the exact verdict. See <a className="text-link" href="#docs/privacy">Privacy and Data Handling</a>.</p>
          </ProseSection>
          <ProseSection title="Limits and Settings">
            <div className="docs-table-wrap"><table><thead><tr><th>Setting</th><th>Default</th><th>What it bounds</th></tr></thead><tbody>
              <tr><td><code>ATLAS_WORKBENCH_MODEL_ROUNDS</code></td><td><code>3</code></td><td>Model calls one answer may make (an answer, plus rounds of asking Atlas for more)</td></tr>
              <tr><td><code>ATLAS_WORKBENCH_MODEL_REVISIONS</code></td><td><code>1</code></td><td>Times an answer may be written again after the model asked for more</td></tr>
              <tr><td><code>ATLAS_WORKBENCH_MAX_EVIDENCE_TOKENS</code></td><td><code>24000</code></td><td>Evidence a prompt may carry; past it the prompt is trimmed and the trimmed items are listed</td></tr>
              <tr><td><code>ATLAS_WORKBENCH_ANSWER_MAX_TOKENS</code></td><td><code>4000</code></td><td>The longest reply, on the API providers</td></tr>
              <tr><td><code>ATLAS_WORKBENCH_ASK_EFFORT</code> / <code>ATLAS_WORKBENCH_ANSWER_EFFORT</code></td><td><code>low</code> / the CLI's own</td><td>Reasoning effort of an asking call and of an answering call on the Claude CLI</td></tr>
              <tr><td><code>ATLAS_WORKBENCH_HISTORY_TURNS</code> / <code>ATLAS_WORKBENCH_HISTORY_RUNES</code></td><td><code>6</code> / <code>4000</code></td><td>How much of the thread the model reads as context</td></tr>
              <tr><td><code>ATLAS_WORKBENCH_MODEL_TURNS_PER_HOUR</code></td><td><code>30</code></td><td>Model turns per token per hour; past it a turn answers with the exact verdict only</td></tr>
              <tr><td><code>ATLAS_WORKBENCH_TURNS_PER_HOUR</code></td><td><code>240</code></td><td>Turns per token per hour; past it the route answers <code>429</code> with <code>retry_after</code></td></tr>
              <tr><td><code>ATLAS_WORKBENCH_MODEL_FORMAT</code></td><td><code>answer</code></td><td><code>chat</code> switches back to the earlier two-part explanation format</td></tr>
            </tbody></table></div>
            <p><code>atlas config list</code> prints every setting with its current value; see <a className="text-link" href="#docs/configuration">Configuration</a> for precedence.</p>
          </ProseSection>
          <ProseSection title="When It Does Not Answer">
            <Bullets>
              <li><strong>"Exact only" and no model chip</strong>: no provider is configured or detected. <code>atlas llm status</code> says why; <code>atlas llm detect --apply</code> registers a logged-in CLI.</li>
              <li><strong><code>llm_auth_failed</code> although the CLI is logged in</strong>: the service could not probe the CLI in time — typically a VPN or endpoint-security agent slowing every process launch on the host. Ask again without the tunnel, or store an API key so no subprocess is needed.</li>
              <li><strong>"The model is off for this question"</strong>: the hourly model budget for your token is spent; the exact verdict still answers.</li>
              <li><strong>A thread answers 404</strong>: it is not yours to see on a shared service, or it was deleted.</li>
            </Bullets>
            <p>See <a className="text-link" href="#docs/troubleshooting">Troubleshooting</a> for service-level problems.</p>
          </ProseSection>
        </>
  );
}
