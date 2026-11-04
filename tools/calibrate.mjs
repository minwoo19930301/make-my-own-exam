// Compare GRE Issue scores with the official ETS sample scores.
// The samples are copy-restricted, so they stay in private/ (gitignored); only the agreement numbers are published.
// Usage: node tools/calibrate.mjs [site] [model]   (default site https://gre-issue.pages.dev, uses its demo key)
import { readFileSync, writeFileSync } from "node:fs";
import kb from "../public/data/kb.json" with { type: "json" };

const site = process.argv[2] || "https://gre-issue.pages.dev";
const model = process.argv[3] || "muse-spark-1.3";
const samples = JSON.parse(readFileSync(new URL("../private/ets-samples.json", import.meta.url)));
const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, "");

const grade = async (s) => {
  const topic = kb.topics.find((t) => norm(t.statement) === norm(s.statement) && t.variant === "statement") ||
    kb.topics.find((t) => norm(t.statement) === norm(s.statement));
  const body = { essay: s.essay, model, ...(topic ? { topicId: topic.id } : { statement: s.statement }) };
  const r = await fetch(`${site}/api/grade`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const g = await r.json();
  if (!r.ok) throw new Error(`${r.status} ${g.error || JSON.stringify(g)}`);
  return g;
};

const rows = [];
for (const s of samples) {
  const g = await grade(s);
  rows.push({ source: s.source, official: s.score, app: g.score, task: g.task.status });
  console.log(`${s.source} official ${s.score} -> app ${g.score}`);
}
const exact = rows.filter((r) => r.official === r.app).length;
const adjacent = rows.filter((r) => Math.abs(r.official - r.app) <= 1).length;
const mae = rows.reduce((a, r) => a + Math.abs(r.official - r.app), 0) / rows.length;
const summary = { model, n: rows.length, exact, adjacent, mae: Number(mae.toFixed(2)), at: new Date().toISOString() };
writeFileSync(new URL("../private/calibration.json", import.meta.url), JSON.stringify({ summary, rows }, null, 1));
console.log(summary);
