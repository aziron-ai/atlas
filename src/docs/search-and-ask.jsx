import React from "react";
import { Command, ProseSection, Bullets, Callout, Figure, Clip, RELEASE, GITHUB, WIKI } from "./ui.jsx";

export default function Page() {
  return (
    <>
      <p className="docs-lead">Search finds a symbol, a file or a phrase when you know some of its words. Ask answers a question in plain language with the lines of code that answer it, quoted and cited — and, if you turn it on, a short AI-written answer built only from those lines. Use search when you are looking for a thing; use Ask when you are looking for an explanation.</p>

      <ProseSection title="Open It">
        <p>Search lives in two places: the header box of the dashboard (<strong>Search symbols, routes…</strong>, shortcut <code>/</code>) and <code>atlas search</code> on the command line. Ask is <strong>Ask Atlas</strong> under EXPLORE, at <code>#/ask</code>.</p>
        <Figure src="assets/docs/search-and-ask/ask-page.png" alt="The Ask Atlas page before a question: the question box, corpus switch, repository picker, Synthesize with AI, the model picker, Recent questions and Suggested" caption="Ask Atlas, ready for a question. Suggested questions are templates over the repository's real hubs." />
      </ProseSection>

      <ProseSection title="Search for a Symbol">
        <p>Type at least two characters into the header box. Atlas returns the matching definitions grouped by kind, each with its file and line; <code>Enter</code> opens the selected one in the inspector (<a className="text-link" href="#docs/dashboard">The dashboard</a> shows the whole flow).</p>
        <Figure src="assets/docs/search-and-ask/omnibox-results.png" alt="Header search for ModelMatches: FUNCTION, TYPE and FIELD groups with file locations" caption="ModelMatches in the header search: the function first, then related functions, types and fields." width={480} />
        <p>Search is <strong>code-aware lexical search</strong>. In practice that means:</p>
        <Bullets>
          <li><strong>It reads code names the way you type them.</strong> Identifiers are split on camelCase, snake_case, kebab-case, dots and slashes, and every piece is indexed beside the whole name. <code>allowedmodels</code> finds the <code>ALLOWED_MODELS</code> keys; <code>user</code> finds <code>GetUserByID</code>.</li>
          <li><strong>It ranks by BM25.</strong> A result where your words are rare and concentrated — in the name, the signature, the doc comment or the path — ranks above one where they are common and scattered.</li>
          <li><strong>It forgives small typos.</strong> Trigram matching compares three-letter fragments, so <code>modlDenied</code> still finds <code>modelDenied</code>.</li>
          <li><strong>It searches paths too.</strong> <code>model_filter.go</code> or <code>providers/routing</code> name a file or folder; a path-shaped query ranks the file whose path is exactly that first.</li>
        </Bullets>
        <p>Results carry a kind: <code>function</code>, <code>method</code>, <code>method_spec</code> (an interface method), <code>type</code>, <code>field</code>, <code>constant</code>, <code>key</code> (a configuration or YAML key), and, from documentation, <code>section</code> and <code>document</code>. Filter with <code>--kind</code>, <code>--path</code> and <code>--corpus</code> on the command line.</p>
      </ProseSection>

      <ProseSection title="Ask a Question">
        <ol className="docs-list">
          <li>Open <strong>Ask Atlas</strong> and pick what may answer: <strong>code</strong>, <strong>docs</strong> (READMEs, markdown sections, synced tickets) or <strong>all</strong>.</li>
          <li>Pick the repository, or <strong>all repos — federated</strong>.</li>
          <li>Type the question — <code>how are allowed models enforced</code> — and press <strong>Ask</strong> or <code>⌘↵</code>.</li>
        </ol>
        <Clip src="assets/docs/search-and-ask/ask-question.mp4" alt="Typing a question into Ask Atlas and the best passage appearing below it" caption="Ask a question; the best passage arrives first, quoted from the file." />
        <p>The answer is the indexed text itself:</p>
        <Figure src="assets/docs/search-and-ask/ask-answer.png" alt="The answer to how are allowed models enforced: summary chip, best passage from config/config.go lines 14 to 17, and the gap box" caption="The best passage: config/config.go lines 14–17, where ALLOWED_MODELS and DISALLOWED_MODELS are declared." />
        <Bullets>
          <li>The summary chip says how many files answer and how many matches there are (<strong>6 files answer · 59 matches</strong>); the retrieval chip names the method (<strong>bm25</strong>).</li>
          <li><strong>BEST PASSAGE</strong> quotes the lines that match, highlighted, with arrows to step through the other matches in the same file. <strong>Open in Inspector</strong>, <strong>Code Map</strong>, <strong>Open file</strong> and <strong>Copy lines + citation</strong> act on it.</li>
          <li><strong>Not in this answer</strong> names any word of your question that matched nothing — here, <code>enforced</code> — so you know what the passages do not cover.</li>
          <li><strong>MORE PASSAGES</strong> lists the other files that matched, with filters by file type, comments or code lines.</li>
          <li><strong>ASK NEXT</strong> offers follow-up questions built from the matched symbols, such as <em>what calls modelDenied?</em> These are templates, not generated text.</li>
          <li><strong>copy link</strong> and <strong>export .md</strong> share the answer; <strong>Recent questions</strong> keeps what you asked in this browser.</li>
        </Bullets>
      </ProseSection>

      <ProseSection title="Read the Exact Verdict">
        <p>For questions about a symbol, the drawer at the foot of the answer — <strong>Symbol cards + full citation table</strong> — holds the exact verdict. It is composed from the index, not written by a model, and labelled as such.</p>
        <Figure src="assets/docs/search-and-ask/ask-verdict.png" alt="The drawer for What calls modelDenied: 5 callers of modelDenied across 1 file, key symbols and grounded evidence" caption="What calls modelDenied? — 5 callers across 1 file, then the key symbols and 42 citations grouped by module." />
        <p>The shape of the question decides the verdict. <em>What calls X</em>, <em>who uses X</em> and <em>what breaks if X changes</em> get a callers verdict; <em>explain X</em> or <em>what is X</em> an explain verdict; <em>is there…</em> or <em>do we have…</em> an exists verdict; anything else a digest of the context the index served. Below the verdict come the key symbols (each with <strong>Inspector</strong>, <strong>Map</strong>, <strong>Ask about</strong> and a pin), the evidence grouped by module, and the full citation table.</p>
      </ProseSection>

      <ProseSection title="Add an AI Answer">
        <p><strong>Synthesize with AI</strong> adds a short answer written by a model from the passages on the page. It is off by default and remembered per browser; the quoted passages stay the answer either way.</p>
        <ol className="docs-list">
          <li>Turn on <strong>Synthesize with AI</strong>.</li>
          <li>Check the model picker beside it. It shows the default provider and model; when more than one provider is ready it is a menu.</li>
          <li>Ask. The <strong>AI SYNTHESIS</strong> card appears above the passages.</li>
        </ol>
        <Figure src="assets/docs/search-and-ask/ask-controls.png" alt="The Ask controls: corpus switch, repository picker, Synthesize with AI, and the model picker showing Claude claude-sonnet-5 default" caption="Synthesize with AI and the model picker, beside the corpus and repository." width={780} />
        <Figure src="assets/docs/search-and-ask/ask-ai-answer.png" alt="The AI SYNTHESIS card above the best passage, with numbered citation chips and a footer naming Claude, the model, tokens and time" caption="The AI answer, written from eight passages: each [n] opens its passage; the footer names who wrote it and what it cost." />
        <Bullets>
          <li>Every claim must cite a passage. Each <code>[n]</code> chip scrolls to and highlights passage <em>n</em>.</li>
          <li>A sentence the server's check finds no valid citation for is marked <strong>unsupported</strong>; a citation to a passage that was never sent is marked as pointing at nothing.</li>
          <li>The footer states the provider, model, tokens and time — here <code>Claude (anthropic-cli) · claude-sonnet-5 · 2 in / 299 out tokens · 4667 ms</code>.</li>
          <li>If no passage matched, no model is asked.</li>
        </Bullets>
        <p>The model reads only the question and the retrieved passages with their paths. Which provider answers is set by <code>atlas llm</code>. With nothing configured, Atlas detects the <code>claude</code> and <code>codex</code> CLIs and the <code>ANTHROPIC_API_KEY</code> and <code>OPENAI_API_KEY</code> variables, and registers what is ready. The default is the one you chose with <code>atlas llm default</code>, else the first ready of <code>anthropic-cli</code>, <code>openai-cli</code>, <code>anthropic</code>, <code>openai</code>. Check it with:</p>
        <Command>{`atlas llm status
{
  "configured": true,
  "ready": true,
  "provider": "anthropic-cli",
  "transport": "cli",
  "model": "claude-sonnet-5",
  "model_source": "default",
  "rung": "cli_login",
  "rung_source": "claude login",
  …
  "egress": "the claude CLI sends the question and the retrieved passages with their paths to Anthropic under your login — nothing else leaves this machine",
  …
  "default": "anthropic-cli",
  "default_source": "detected",
  "providers": [ … ],
  …
}`}</Command>
        <p>The same providers, with a <strong>Test</strong> button for each, are under <strong>System → App integrations</strong>. Without a ready provider the toggle shows a note pointing there, and the passages answer alone.</p>
        <Callout kind="tip" label="Conversations">Ask answers one question. For a conversation that keeps context across turns and pulls in git history, tickets and pull requests, use the <a className="text-link" href="#docs/workbench">Ask Workbench</a>.</Callout>
      </ProseSection>

      <ProseSection title="Semantic Search Is Off by Default">
        <p><code>atlas semantic-search</code> ranks symbols by embedding similarity instead of words. It needs embeddings, which the index does not build unless you ask (<code>atlas index --enable-vectors</code> with <code>ATLAS_ENABLE_VECTORS=1</code>). Without them it falls back to lexical search and says so:</p>
        <Command>{`atlas semantic-search "reject a model that is not allowed" --limit 3 --format plain
semantic_search  mode lexical  degraded true  results 3
  degraded_reason  this snapshot has no embeddings — re-index with \`atlas index --enable-vectors\` to enable semantic ranking
  isToolAllowed  function  internal/mcp/filter.go:32  :: func isToolAllowed(toolName, includeList, excludeList string) bool
  FilterModels  function  providers/routing/model_filter.go:35  :: func FilterModels(models []types.Model, allowedModels, disallowedModels string) []types.Model
  ALLOWED_MODELS  key  examples/docker-compose/mcp/.env.example:4  :: ALLOWED_MODELS=`}</Command>
        <p>It is off because the lexical index already answers name and phrase lookups exactly and deterministically, with no model and nothing to download; embeddings add indexing time and storage. By default the embedder is an offline token-overlap model; set <code>ATLAS_EMBED_URL</code> to use a real embedding model. See <a className="text-link" href="#docs/indexing">Indexing and reindexing</a>.</p>
      </ProseSection>

      <ProseSection title="From the CLI">
        <p>Each lookup the dashboard makes is a command. Output is from inference-gateway, in <code>--format plain</code>.</p>
        <p><code>atlas search</code> — the omnibox. <code>--kind</code> and <code>--path</code> filter; <code>--corpus docs</code> searches documentation only:</p>
        <Command>{`atlas search "allowed models" --kind function --limit 3 --format plain
search  mode lexical  total 3
  matches  833  (page limit 3)
  truncated true  (retrieval saw fewer than the 833 matches; a larger --limit widens it, up to 20000)
  FilterModels  function  providers/routing/model_filter.go:35  :: func FilterModels(models []types.Model, allowedModels, disallowedModels string) []types.Model
  isToolAllowed  function  internal/mcp/filter.go:32  :: func isToolAllowed(toolName, includeList, excludeList string) bool
  TestChatCompletionsRouting_AllowedModelsFiltersAlias  function  tests/api_routing_test.go:206  :: func TestChatCompletionsRouting_AllowedModelsFiltersAlias(t *testing.T)

atlas search modlDenied --limit 3 --format plain
search  mode lexical  total 2
  matches  2  (page limit 3)
  modelDenied  method  api/routes.go:622  :: func (router *RouterImpl) modelDenied(model string) string
  FilterModels  function  providers/routing/model_filter.go:35  :: func FilterModels(models []types.Model, allowedModels, disallowedModels string) []types.Model`}</Command>
        <p><code>atlas symbol</code> — a definition with its callers and callees, what the inspector opens with:</p>
        <Command>{`atlas symbol modelDenied --format plain
symbol modelDenied  matches 1
  modelDenied  method  api/routes.go:622-635
    sig  func (router *RouterImpl) modelDenied(model string) string
    callers(5)  ChatCompletionsHandler, ImagesHandler, MessagesHandler, ResponsesHandler, handleImagesMultipart
    callees(6)  Error, Error, ModelMatches, ParseModelSet, Error, Error`}</Command>
        <p><code>atlas snippet</code> — the body itself, bounded:</p>
        <Command>{`atlas snippet modelDenied --format plain
snippet modelDenied  definitions 1  resolved true
── api/routes.go:622-635
sig  func (router *RouterImpl) modelDenied(model string) string
func (router *RouterImpl) modelDenied(model string) string {
	if allowed := routing.ParseModelSet(router.cfg.AllowedModels); len(allowed) > 0 {
		if !routing.ModelMatches(allowed, model) {
			router.logger.Error("model not in allowed list", nil, "model", model, "allowed_models", router.cfg.AllowedModels)
			return "Model not allowed. Please check the list of allowed models."
		}
		return ""
	}
	…
}`}</Command>
        <p><code>atlas explain</code> — a deterministic bundle: definitions, callers, callees, and the routes served from the same file:</p>
        <Command>{`atlas explain modelDenied
{
  "symbol": "modelDenied",
  "definitions": [
    { "kind": "method", "path": "api/routes.go", "line": 622, "end_line": 635,
      "signature": "func (router *RouterImpl) modelDenied(model string) string" }
  ],
  "callers": ["ChatCompletionsHandler", "ImagesHandler", "MessagesHandler", "ResponsesHandler", "handleImagesMultipart"],
  "callees": ["Error", "ModelMatches", "ParseModelSet"],
  "served_routes": [
    { "method": "GET", "path": "/health", "handler_file": "api/routes.go" },
    { "method": "POST", "path": "/chat/completions", "handler_file": "api/routes.go" },
    …
  ],
  …
}`}</Command>
        <p><code>atlas callers</code> lists the symbols that call a function; <code>atlas refs</code> adds type uses — parameters, fields, return types — which matters before a rename:</p>
        <Command>{`atlas callers modelDenied --format plain
callers modelDenied  total 5
  ChatCompletionsHandler  method  api/routes.go:637  :: func (router *RouterImpl) ChatCompletionsHandler(c *gin.Context)
  ImagesHandler  method  api/routes.go:1194  :: func (router *RouterImpl) ImagesHandler(c *gin.Context)
  MessagesHandler  method  api/routes.go:842  :: func (router *RouterImpl) MessagesHandler(c *gin.Context)
  ResponsesHandler  method  api/routes.go:1018  :: func (router *RouterImpl) ResponsesHandler(c *gin.Context)
  handleImagesMultipart  method  api/routes.go:1388  :: func (router *RouterImpl) handleImagesMultipart(c *gin.Context, target imagesMultipartTarget)

atlas refs CreateChatCompletionRequest --format plain
refs CreateChatCompletionRequest  total 44
  Middleware  method  api/middlewares/mcp.go:86  :: func (m *MCPMiddlewareImpl) Middleware() gin.HandlerFunc
  handleMCPStreamingRequest  method  api/middlewares/mcp.go:242  :: func (m *MCPMiddlewareImpl) handleMCPStreamingRequest(c *gin.Context, request *types.CreateChatCompletionRequest, result *MCPProviderModelResult) error
  …`}</Command>
        <p>All flags are in the <a className="text-link" href="#docs/cli">CLI reference</a>.</p>
      </ProseSection>

      <ProseSection title="From the API">
        <p>The page names its own sources: <code>GET /api/v1/search</code> for the omnibox and related symbols, <code>GET /api/v1/passages</code> for the quoted passages, <code>POST /api/v1/agent/code-query</code> for the verdict drawer, and <code>POST /api/v1/ask/answer</code> for the AI answer, which streams and takes a <code>provider</code> per question. See <a className="text-link" href="#docs/service">Dashboard and API</a>.</p>
      </ProseSection>

      <ProseSection title="Related">
        <Bullets>
          <li><a className="text-link" href="#docs/workbench">Ask Workbench</a> — conversations with history, tickets and pull requests.</li>
          <li><a className="text-link" href="#docs/dashboard">The dashboard</a> — the omnibox, the command palette and the inspector.</li>
          <li><a className="text-link" href="#docs/code-map">Code Map and graph</a> — see the callers and callees you found.</li>
          <li><a className="text-link" href="#docs/assistants">AI assistant setup</a> — the same lookups for assistants over MCP.</li>
          <li><a className="text-link" href="#docs/privacy">Privacy and data</a> — what leaves the machine, and when.</li>
        </Bullets>
      </ProseSection>
    </>
  );
}
