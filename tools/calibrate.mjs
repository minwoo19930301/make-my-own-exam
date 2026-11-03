// Compare Sixpoint scores with the official ETS sample scores.
// The samples are copy-restricted, so they stay in private/ (gitignored); only the agreement numbers are published.
// Usage: MODEL_API_KEY=... node tools/calibrate.mjs [model]
import { readFileSync, writeFileSync } from "node:fs";
import kb from "../public/data/kb.json" with { type: "json" };
import { gradeEssay } from "../functions/_lib/grade.js";

const apiKey = process.env.MODEL_API_KEY;
if (!apiKey) throw new Error("Set MODEL_API_KEY");
const model = process.argv[2] || "muse-spark-1.3";
const samples = JSON.parse(readFileSync(new URL("../private/ets-samples.json", import.meta.url)));
const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, "");

const rows = [];
for (const s of samples) {
  const topic = kb.topics.find((t) => norm(t.statement) === norm(s.statement) && t.variant === "statement") ||
    kb.topics.find((t) => norm(t.statement) === norm(s.statement));
  // Some practice-test topics are retired from the current pool; grade them with the standard statement task.
  const task = topic || { statement: s.statement, variant: "statement", instructions: kb.topics.find((t) => t.variant === "statement").instructions };
  const g = await gradeEssay({ topic: task, essay: s.essay, apiKey, model });
  rows.push({ source: s.source, official: s.score, sixpoint: g.score, task: g.task.status });
  console.log(`${s.source} official ${s.score} -> sixpoint ${g.score}`);
}
const exact = rows.filter((r) => r.official === r.sixpoint).length;
const adjacent = rows.filter((r) => Math.abs(r.official - r.sixpoint) <= 1).length;
const mae = rows.reduce((a, r) => a + Math.abs(r.official - r.sixpoint), 0) / rows.length;
const summary = { model, n: rows.length, exact, adjacent, mae: Number(mae.toFixed(2)), at: new Date().toISOString() };
writeFileSync(new URL("../private/calibration.json", import.meta.url), JSON.stringify({ summary, rows }, null, 1));
console.log(summary);
