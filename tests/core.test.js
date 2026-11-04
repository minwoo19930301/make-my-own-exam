import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_RUBRIC, finalizeGrade, gradeAnswer } from "../functions/_lib/grade.js";
import { outline, questions } from "../functions/_lib/build.js";
import { chat, resolveKey } from "../functions/_lib/muse.js";
import { chunks } from "../src/sources.js";
import { nextQuestions, weakestDimension } from "../src/plan.js";

const essay = "I largely agree that governments should fund research, but only with oversight. ".repeat(6) +
  "For example, the Human Genome Project produced shared data that private firms would not have released.";
const reply = (obj) => async (url, init) => { reply.sent = { url, body: JSON.parse(init.body), auth: init.headers.authorization }; return new Response(JSON.stringify({ choices: [{ message: { content: "```json\n" + JSON.stringify(obj) + "\n```" } }] })); };

test("finalizeGrade drops quotes that are not in the answer and clamps to the rubric scale", () => {
  const g = finalizeGrade(essay, {
    score: 7.4, summary: "ok",
    dimensions: [{ id: "task", score: 5, reason: "clear", quote: "only with oversight" }, { id: "support", score: 4, reason: "r", quote: "invented sentence" }],
    task: { status: "met", reason: "both sides" },
    revisions: [{ quote: "Human Genome Project", suggestion: "explain" }, { quote: "fake", suggestion: "x" }],
  }, DEFAULT_RUBRIC);
  assert.equal(g.score, 6);
  assert.equal(g.dimensions.find((d) => d.id === "task").quote, "only with oversight");
  assert.equal(g.dimensions.find((d) => d.id === "support").quote, "");
  assert.equal(g.dimensions.find((d) => d.id === "language").score, null);
  assert.equal(g.revisions.length, 1);
});

test("gradeAnswer uses the exam's own rubric and calls Muse with chat completions", async () => {
  const rubric = { min: 1, max: 4, levels: [{ score: 4, descriptor: "a" }, { score: 1, descriptor: "b" }], dimensions: [{ id: "thesis", label: "Thesis", ask: "?" }] };
  const g = await gradeAnswer({ exam: "X", question: { prompt: "Q?" }, rubric, answer: essay, apiKey: "k", model: "muse-spark-1.3", fetchImpl: reply({ score: 9, summary: "s", dimensions: [{ id: "thesis", score: 3, reason: "r", quote: "" }], task: { status: "partly", reason: "r" }, revisions: [] }) });
  assert.equal(reply.sent.url, "https://api.meta.ai/v1/chat/completions");
  assert.equal(reply.sent.auth, "Bearer k");
  assert.match(reply.sent.body.messages[0].content, /integer from 1 to 4/);
  assert.equal(g.score, 4);
  assert.equal(g.max, 4);
  assert.deepEqual(g.dimensions.map((d) => d.id), ["thesis"]);
});

test("custom provider goes to its own base URL without Muse-only fields", async () => {
  await chat({ apiKey: "k", baseUrl: "https://api.example.com/v1/", model: "m1", system: "s", user: "u", fetchImpl: reply({}) });
  assert.equal(reply.sent.url, "https://api.example.com/v1/chat/completions");
  assert.equal(reply.sent.body.model, "m1");
  assert.equal(reply.sent.body.reasoning_effort, undefined);
});

test("question extraction keeps only questions that appear in the excerpt", async () => {
  const chunk = "Issue 1. The best ideas arise from a passionate interest in commonplace things.\nWrite a response in which you discuss...";
  const r = await questions({ examName: "GRE", concepts: [{ key: "ideas", label: "Ideas" }], chunk, apiKey: "k", fetchImpl: reply({ questions: [
    { type: "essay", prompt: "The best ideas arise from a passionate interest in commonplace things.", instructions: "Write a response", concept: "ideas" },
    { type: "essay", prompt: "A made-up question that is nowhere in the text at all.", concept: "nope" },
  ] }) });
  assert.equal(r.questions.length, 1);
  assert.equal(r.questions[0].concept, "ideas");
});

test("outline normalizes concept keys and the rubric scale", async () => {
  const o = await outline({ prompt: "GRE", sources: [{ url: "https://ets.org/a.pdf", title: "A", text: "x" }], apiKey: "k", fetchImpl: reply({ name: "GRE", concepts: [{ key: "Ideas & Things", label: "Ideas" }], rubric: { min: 0, max: 6, levels: [{ score: 6, descriptor: "x" }], dimensions: [{ id: "a", label: "A", ask: "?" }] } }) });
  assert.equal(o.concepts[0].key, "ideas-things");
  assert.equal(o.rubric.max, 6);
});

test("chat maps auth errors to 401", async () => {
  const fetchImpl = async () => new Response(JSON.stringify({ error: { message: "bad key" } }), { status: 403 });
  await assert.rejects(chat({ apiKey: "x", system: "s", user: "u", fetchImpl }), (e) => e.status === 401 && /bad key/.test(e.message));
});

test("resolveKey enforces the daily demo cap and validates custom providers", async () => {
  const mem = new Map();
  const env = { MODEL_API_KEY: "server", DAILY_LIMIT: "1", LIMITS: { get: async (k) => mem.get(k), put: async (k, v) => mem.set(k, v) } };
  const req = new Request("https://x", { headers: { "cf-connecting-ip": "1.1.1.1" } });
  assert.equal((await resolveKey(req, env, {})).shared, true);
  await assert.rejects(resolveKey(req, env, {}), (e) => e.status === 429);
  assert.equal((await resolveKey(req, env, { apiKey: "mine" })).apiKey, "mine");
  await assert.rejects(resolveKey(req, {}, {}), (e) => e.status === 401);
  await assert.rejects(resolveKey(req, env, { provider: "custom", baseUrl: "http://x", apiKey: "k", model: "m" }), (e) => e.status === 400);
  assert.equal((await resolveKey(req, env, { provider: "custom", baseUrl: "https://x/v1", apiKey: "k", model: "m" })).baseUrl, "https://x/v1");
});

test("chunks split long text on paragraph boundaries", () => {
  const text = Array.from({ length: 50 }, (_, i) => `${i + 1}. ${"word ".repeat(100)}`).join("\n\n");
  const c = chunks(text, 3000);
  assert.ok(c.length > 5);
  assert.ok(c.every((x) => x.length <= 4500));
  assert.equal(c.join("\n\n").replace(/\s/g, "").length, text.replace(/\s/g, "").length);
});

test("plan ranks by pool weight and weak concepts", () => {
  const exam = { concepts: [{ key: "a", count: 3 }, { key: "b", count: 1 }], questions: [{ id: "1", concept: "a" }, { id: "2", concept: "a" }, { id: "3", concept: "a" }, { id: "4", concept: "b" }] };
  assert.equal(nextQuestions(exam, [], 1)[0].question.concept, "a");
  const h = [{ questionId: "1", score: 6, min: 0, max: 6, dimensions: [{ id: "x", label: "X", score: 2 }, { id: "y", label: "Y", score: 6 }] }];
  assert.equal(nextQuestions(exam, [...h, { questionId: "2", score: 6, min: 0, max: 6 }], 1)[0].question.concept, "b");
  assert.equal(weakestDimension(h).id, "x");
});
