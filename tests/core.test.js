import { test } from "node:test";
import assert from "node:assert/strict";
import kb from "../public/data/kb.json" with { type: "json" };
import { finalizeGrade, gradeEssay } from "../functions/_lib/grade.js";
import { finalizeDrill } from "../functions/_lib/drill.js";
import { chat, resolveKey } from "../functions/_lib/muse.js";
import { coveragePlan, nextTopics, readiness, weakestDimension } from "../public/js/predict.js";

const essay = "I largely agree that governments should fund research, but only with oversight. ".repeat(6) +
  "For example, the Human Genome Project produced shared data that private firms would not have released.";

test("kb has the full pool with six variants", () => {
  assert.equal(kb.topics.length, 159);
  assert.equal(Object.values(kb.stats.variants).reduce((a, b) => a + b, 0), 159);
  assert.ok(kb.topics.every((t) => t.statement.length > 20 && t.instructions.startsWith("Write a response")));
  assert.ok(kb.topics.every((t) => t.concept !== "other"));
});

test("finalizeGrade drops quotes that are not in the essay and clamps scores", () => {
  const g = finalizeGrade(essay, {
    score: 7.4, summary: "ok",
    dimensions: [{ id: "position", score: 5, reason: "clear", quote: "only with oversight" }, { id: "development", score: 4, reason: "r", quote: "invented sentence" }],
    task: { status: "met", reason: "both sides" },
    revisions: [{ quote: "Human Genome Project", suggestion: "explain" }, { quote: "fake", suggestion: "x" }],
  });
  assert.equal(g.score, 6);
  assert.equal(g.dimensions.find((d) => d.id === "position").quote, "only with oversight");
  assert.equal(g.dimensions.find((d) => d.id === "development").quote, "");
  assert.equal(g.dimensions.find((d) => d.id === "language").score, null);
  assert.equal(g.revisions.length, 1);
});

test("gradeEssay calls Meta Model API with chat completions shape", async () => {
  let sent;
  const fetchImpl = async (url, init) => {
    sent = { url, body: JSON.parse(init.body), auth: init.headers.authorization };
    return new Response(JSON.stringify({ choices: [{ message: { content: '```json\n{"score":4,"summary":"s","dimensions":[],"task":{"status":"partly","reason":"r"},"revisions":[]}\n```' } }] }));
  };
  const g = await gradeEssay({ topic: kb.topics[0], essay, apiKey: "k", model: "muse-spark-1.3", fetchImpl });
  assert.equal(sent.url, "https://api.meta.ai/v1/chat/completions");
  assert.equal(sent.body.model, "muse-spark-1.3");
  assert.ok(sent.body.max_completion_tokens > 0);
  assert.equal(sent.auth, "Bearer k");
  assert.equal(g.score, 4);
  assert.equal(g.task.status, "partly");
});

test("chat maps auth errors to 401", async () => {
  const fetchImpl = async () => new Response(JSON.stringify({ error: { message: "bad key" } }), { status: 403 });
  await assert.rejects(chat({ apiKey: "x", system: "s", user: "u", fetchImpl }), (e) => e.status === 401 && /bad key/.test(e.message));
});

test("resolveKey enforces the daily demo cap", async () => {
  const mem = new Map();
  const env = { MODEL_API_KEY: "server", DAILY_LIMIT: "1", LIMITS: { get: async (k) => mem.get(k), put: async (k, v) => mem.set(k, v) } };
  const req = new Request("https://x", { headers: { "cf-connecting-ip": "1.1.1.1" } });
  assert.equal((await resolveKey(req, env, {})).shared, true);
  await assert.rejects(resolveKey(req, env, {}), (e) => e.status === 429);
  assert.equal((await resolveKey(req, env, { apiKey: "mine" })).apiKey, "mine");
  await assert.rejects(resolveKey(req, {}, {}), (e) => e.status === 401);
});

test("finalizeDrill keeps only well-formed questions", () => {
  const d = finalizeDrill({ mcq: [{ question: "q", options: ["a", "b", "c", "d"], answer: 2, why: "w" }, { question: "bad", options: ["a"], answer: 0 }], short: [{ question: "s", lookFor: "l" }] });
  assert.equal(d.mcq.length, 1);
  assert.equal(d.short.length, 1);
});

test("prediction: coverage plan, readiness and next topics", () => {
  const plan = coveragePlan(kb);
  assert.equal(plan.topics.length, kb.stats.concepts.length);
  assert.equal(plan.variantsCovered, 6);
  const first = nextTopics(kb, [], 3);
  assert.equal(first.length, 3);
  assert.equal(new Set(first.map((r) => r.topic.concept)).size, 3);
  const h = [{ topicId: first[0].topic.id, score: 5, dimensions: [{ id: "language", label: "Language", score: 2 }, { id: "position", label: "Position", score: 5 }] }];
  assert.ok(readiness(kb, h).share > 0);
  assert.equal(weakestDimension(h).id, "language");
  assert.ok(!nextTopics(kb, h, 3).some((r) => r.topic.concept === first[0].topic.concept));
});
