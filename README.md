# Sixpoint

Practice the GRE "Analyze an Issue" essay on the official topic pool. Sixpoint scores your essay from 0 to 6 with Meta Muse, ties every comment to a sentence you actually wrote, and tells you which topic to write next.

Live: https://sixpoint.pages.dev

## What it does

Sixpoint works in three layers.

1. **Knowledge base.** ETS publishes the whole Issue pool, and every test topic comes from it. `tools/build_kb.py` parses the 159 topics into `public/data/kb.json`. It tags each topic with its task type (6 in total), its themes and a recurring concept (21), and it links topics that reuse a statement under a different task.
2. **Practice.** Each topic has three steps:
   - **Analyze:** Muse writes multiple-choice questions on the strongest thesis, the best example, and what this task specifically asks for.
   - **Plan:** You write a thesis and a counterargument in short answers, and Muse checks them.
   - **Write:** You write the full essay against a 30-minute timer.
3. **Prediction.** The pool is public and finite, so Sixpoint does not claim to guess your exact topic. It shows three things instead:
   - where the pool's weight sits by concept and task type;
   - the smallest set of essays that covers every concept and all six task types;
   - your next topics, ranked by the concepts and task types you score lowest on, weighted by how often the pool returns to them.

## Scoring

`functions/_lib/grade.js` sends the topic, the instructions for its task type, and the essay to the Meta Model API (`muse-spark-1.3`, OpenAI-compatible `/v1/chat/completions`). Muse returns:

- a holistic score from 0 to 6;
- four dimension scores: position and task fit, reasons and examples, organization, language;
- a check on the task-specific demand: met, partly, or missed;
- revision suggestions.

The server keeps a quote only if it really appears in the essay. A comment the model cannot anchor to your own words is shown without a quote.

The 0–6 scale is our own wording, modeled on the structure of the public GRE scoring guide.

### Calibration

`tools/calibrate.mjs` grades the 12 official scored sample essays from two ETS practice tests and compares the results with the official scores. The samples are copy-restricted, so they are not in this repository. Only the agreement numbers are published here.

| model | essays | exact | within 1 | mean abs. error |
|---|---|---|---|---|
| muse-spark-1.3 | 12 | — | — | — |

## UI

The interface is built with [Astryx](https://github.com/meta/astryx), Meta's open-source React design system, using the neutral theme. The layout follows one topic at a time: pick a topic, then move through the Prompt, Multiple choice, Short answer and Essay tabs. The Topic bank and Predicted tabs pick the next topic.

## API key

- With no key, the site uses a server key, capped at `DAILY_LIMIT` calls per day per IP. The count is kept in KV.
- A visitor can add their own Meta Model API key in Settings to lift the cap. The key stays in the browser and is sent only with that visitor's own requests.
- Generated drills are cached per topic in KV.

## Run

```bash
npm test
```

```bash
echo "MODEL_API_KEY=your-key" > .dev.vars && npm run dev
```

Deploy:

```bash
npm run deploy
```

Set the server key once:

```bash
npx wrangler pages secret put MODEL_API_KEY --project-name sixpoint
```

Rebuild the knowledge base from the ETS PDF:

```bash
npm run kb
```

## Attribution

Topic text is quoted from the [GRE Issue topic pool](https://www.ets.org/pdfs/gre/issue-pool.pdf) that ETS publishes for test preparation. GRE® and ETS® are registered trademarks of ETS. Sixpoint is not affiliated with or endorsed by ETS. Scores are practice estimates, not official GRE scores.
