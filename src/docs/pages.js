// One module per documentation page; ProductDocs.jsx renders DOC_COMPONENTS[slug].
import getting_started from "./getting-started.jsx";
import assistants from "./assistants.jsx";
import indexing from "./indexing.jsx";
import workbench from "./workbench.jsx";
import tour from "./tour.jsx";
import dashboard from "./dashboard.jsx";
import code_map from "./code-map.jsx";
import search_and_ask from "./search-and-ask.jsx";
import impact from "./impact.jsx";
import history from "./history.jsx";
import sources from "./sources.jsx";
import observe from "./observe.jsx";
import skills from "./skills.jsx";
import teams from "./teams.jsx";

export const DOC_COMPONENTS = {
  "getting-started": getting_started,
  "assistants": assistants,
  "indexing": indexing,
  "workbench": workbench,
  "tour": tour,
  "dashboard": dashboard,
  "code-map": code_map,
  "search-and-ask": search_and_ask,
  "impact": impact,
  "history": history,
  "sources": sources,
  "observe": observe,
  "skills": skills,
  "teams": teams,
};
