# GRE Issue

Practice the GRE "Analyze an Issue" essay on the official topic pool. It scores your essay from 0 to 6 with Meta Muse, ties every comment to a sentence you actually wrote, and tells you which topic to write next.

Live: https://gre-issue.pages.dev

## What it does

the app works in three layers.

1. **Knowledge base.** ETS publishes the whole Issue pool, and every test topic comes from it. `tools/build_kb.py` parses the 159 topics into `public/data/kb.json`. It tags each topic with its task type (6 in total), its themes and a recurring concept (21), and it links topics that reuse a statement under a different task.
2. **Practice.** The GRE Issue task is a single 30-minute essay, so that is the only format here. Each topic opens with its instructions and the specific demand of its task type, then a timed editor.
3. **Prediction.** The pool is public and finite, so the app does not claim to guess your exact topic. It shows three things instead:
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

`node tools/calibrate.mjs` grades the 12 official scored sample essays from two ETS practice tests and compares the results with the official scores. The samples are copy-restricted, so they are not in this repository. Only the agreement numbers are published here.

| run | model | essays | exact | within 1 | mean abs. error |
|---|---|---|---|---|---|
| first prompt | muse-spark-1.3 | 12 | 3 | 9 | 1.08 |
| current prompt | muse-spark-1.3 | 12 | 5 | 10 | 0.75 |

Both runs are from 2026-11-04. The first prompt ran harsh at the top, scoring the official 5 and 6 essays as 3 or 4. The current prompt tells the grader that official raters are generous at the top. It still scores top essays about one level low.

Both runs grade the same 12 essays the prompt was adjusted against, so these are in-sample numbers. Repeat runs also vary: the same essay can move by a point between runs.

## UI

Three sections: Write (pick a topic, read the task demand, write against a 30-minute timer, get scored), Topics (search and filter the pool), and Insights (what to write next, pool weight by concept and task type, the smallest covering set). Components follow Facebook and Instagram web UI conventions: a gray canvas with white cards, a blue primary button with gray secondary buttons, pill chips, and light-filled inputs. Dialogs use [Astryx](https://github.com/meta/astryx), Meta's open-source React design system. The app uses no Meta logos or brand marks.

## API key

- With no key, the site uses a server key, capped at `DAILY_LIMIT` calls per day per IP. The count is kept in KV.
- A visitor can add their own Meta Model API key in Settings to lift the cap. The key stays in the browser and is sent only with that visitor's own requests.

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
npx wrangler pages secret put MODEL_API_KEY --project-name gre-issue
```

Rebuild the knowledge base from the ETS PDF:

```bash
npm run kb
```

## Attribution

Topic text is quoted from the [GRE Issue topic pool](https://www.ets.org/pdfs/gre/issue-pool.pdf) that ETS publishes for test preparation. GRE® and ETS® are registered trademarks of ETS. the app is not affiliated with or endorsed by ETS. Scores are practice estimates, not official GRE scores.
