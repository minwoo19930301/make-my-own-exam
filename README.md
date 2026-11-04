# Make My Own Exam

Turn any public exam into a practice coach. You describe the exam and paste the official links. Meta Muse builds a knowledge base from them, then serves questions and scores your answers on that exam's own rubric.

Live: https://make-my-own-exam.pages.dev

## How it works

### Step 1: build the knowledge base

You give a short description and up to 8 public links (web pages or PDFs). The app collects three things.

1. **Questions.** Every question that appears in the sources, copied exactly. Each question is tagged with a concept (a subject area the questions are about).
2. **Scoring rules.** If the sources include an official scoring guide, its levels are restated in our own words and marked "From the official guide". Otherwise a rubric is derived and marked as such.
3. **Research behind the exam.** Papers, reports and books by the test makers, or on how the exam is designed and scored. Muse suggests them from memory, so each one is looked up in [Crossref](https://www.crossref.org/). Only entries found there are marked "Confirmed" with a DOI link.

The pipeline:

- `functions/api/fetch.js` relays the link (CORS only). Text is extracted in the browser: pdf.js for PDFs, DOMParser for pages. Parsing PDFs on the client keeps the server under Workers CPU limits.
- `src/sources.js` splits long text into sections on paragraph boundaries.
- `functions/_lib/build.js` makes one outline call (name, concepts, rubric), one references call, and one question-extraction call per section, four at a time.
- The server keeps an extracted question only if its opening words really occur in that section, so a question the model invented is dropped.

The **Try the GRE example** button fills in the GRE "Analyze an Issue" task and three ETS links. A live build reads the 159-topic PDF and two scoring pages in about three minutes. It collects all 159 official topics, the 0–6 scale and its four dimensions, and six research papers, two of them confirmed. `public/data/example-gre.json` is the saved result of that same build (`node tools/save-example.mjs`). The app offers it only if a live build fails.

### Step 2: practice

- Pick a question, or let **Recommend for me** choose. **New question like this** asks Muse for a fresh question in the same style, labeled "Written by the model".
- Answer against the exam's time limit. Essay and short-answer questions are scored by Muse on the knowledge base's rubric. Multiple-choice questions with an answer key are checked locally.
- The result has a score on the exam's scale, one score per rubric dimension, a check on whether the answer does what this question asks, and 2–3 revisions. The server keeps a quoted phrase only if it really appears in your answer.
- **Insights** never claims to predict your exact question. It shows where the pool's weight sits by concept, and ranks what to practice next by concept frequency and your lowest scores.

## Model providers

- **Meta Muse (default).** OpenAI-compatible `POST https://api.meta.ai/v1/chat/completions`, `muse-spark-1.3`. With no key, the site uses a server key capped at `DAILY_LIMIT` calls per IP per day (KV `LIMITS`).
- **Any OpenAI-compatible API.** In Settings, set a base URL, key and model. The visitor's own key is used, and the server only forwards it.
- **Your own agent.** "Build it with your own agent" gives a prompt and a JSON schema. An agent with web search or MCP tools can build the knowledge base, and you paste the JSON back in. Any exam you build can be exported as the same JSON.

Keys stay in the browser (localStorage) and are sent only with the visitor's own requests.

## Calibration

`node tools/calibrate.mjs` grades the 12 scored sample essays from two ETS GRE practice tests, using the rubric the app built from the ETS links, and compares the results with the official scores. The samples are copy-restricted, so they are not in this repository. Only the agreement numbers are published.

| grader | essays | exact | within 1 | mean abs. error |
|---|---|---|---|---|
| fixed GRE rubric, first prompt | 12 | 3 | 9 | 1.08 |
| fixed GRE rubric, current prompt | 12 | 5 | 10 | 0.75 |
| rubric built from the ETS links | 12 | — | — | — |

The grader runs about one level low on the strongest essays. These are in-sample numbers: the prompt was adjusted against the same 12 essays. Repeat runs also vary by a point on some essays.

## Run it

```bash
npm install
npm test
npm run deploy
```

Set the server key with `npx wrangler pages secret put MODEL_API_KEY --project-name make-my-own-exam`.

The demo video is scripted: `node demo/record.mjs` drives the live site in Chrome, adds the title card, captions and zooms in the page, and muxes narration from `demo/audio/`.

## Notes

- Questions are quoted from the sources the user supplies, for personal study. Check each source's terms before sharing what you build.
- Exam names belong to their owners. GRE® and ETS® are registered trademarks of ETS. This project is not affiliated with or endorsed by ETS or any test maker, and it uses no Meta logos.
- Scores are practice estimates.
