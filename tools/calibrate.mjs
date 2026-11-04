// Compare scores with the official ETS sample scores, grading on the rubric the app built from the ETS links.
// The samples are copy-restricted, so they stay in private/ (gitignored); only the agreement numbers are published.
// Usage: node tools/calibrate.mjs [site] [model]
import { readFileSync, writeFileSync } from "node:fs";

const site = process.argv[2] || "https://make-my-own-exam.pages.dev";
const model = process.argv[3] || "muse-spark-1.3";
const exam = JSON.parse(readFileSync(new URL("../public/data/example-gre.json", import.meta.url)));
const samples = JSON.parse(readFileSync(new URL("../private/ets-samples.json", import.meta.url)));
const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, "");
const statementTask = exam.questions.find((q) => /statement might or might not hold true/.test(q.instructions));

const rows = [];
for (const s of samples) {
  // Practice-test topics retired from the pool are graded with the standard statement instructions.
  const q = exam.questions.find((x) => norm(x.prompt) === norm(s.statement) && x.instructions === statementTask.instructions) ||
    exam.questions.find((x) => norm(x.prompt) === norm(s.statement)) || { prompt: s.statement, instructions: statementTask.instructions };
  const r = await fetch(`${site}/api/grade`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ exam: exam.name, question: q, rubric: exam.rubric, answer: s.essay, model }) });
  const g = await r.json();
  if (!r.ok) throw new Error(`${r.status} ${g.error}`);
  rows.push({ source: s.source, official: s.score, app: g.score, task: g.task.status });
  console.log(`${s.source} official ${s.score} -> app ${g.score}`);
}
const exact = rows.filter((r) => r.official === r.app).length;
const adjacent = rows.filter((r) => Math.abs(r.official - r.app) <= 1).length;
const mae = rows.reduce((a, r) => a + Math.abs(r.official - r.app), 0) / rows.length;
const summary = { model, n: rows.length, exact, adjacent, mae: Number(mae.toFixed(2)), at: new Date().toISOString() };
writeFileSync(new URL("../private/calibration.json", import.meta.url), JSON.stringify({ summary, rows }, null, 1));
console.log(summary);
