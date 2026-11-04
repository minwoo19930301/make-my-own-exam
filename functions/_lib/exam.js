// Server-side store for exams and grades that agents create through the MCP server or the share API.
// Saved in KV for 30 days; the app imports them from ?exam=ID or ?grade=ID links.
import { HttpError } from "./muse.js";

const TTL = 60 * 60 * 24 * 30;
const cap = (s, n) => String(s ?? "").slice(0, n);
const id = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);

export const EXAM_SCHEMA = {
  name: "string", description: "string", timeLimitMinutes: "number or null",
  concepts: [{ key: "kebab-case", label: "string", description: "string" }],
  rubric: { min: 0, max: 6, fromSource: "boolean", levels: [{ score: 6, descriptor: "string" }], dimensions: [{ id: "kebab-case", label: "string", ask: "string" }], notes: "string" },
  questions: [{ type: "essay | short | mc", prompt: "exact text", instructions: "string", choices: ["for mc"], answer: "answer key if published", concept: "concept key", source: "https://..." }],
  references: [{ title: "string", authors: "string", year: "string", kind: "paper | book | report | guide", venue: "string", why: "string", url: "https://..." }],
  sources: [{ url: "https://...", title: "string" }],
};

export function normalizeExam(raw) {
  if (!raw || typeof raw !== "object") throw new HttpError(400, "exam must be an object.");
  const concepts = (raw.concepts || []).slice(0, 40).map((c) => ({ key: cap(c.key || c.label, 60).toLowerCase().replace(/[^a-z0-9]+/g, "-") || "general", label: cap(c.label || c.key, 80), description: cap(c.description, 300) }));
  if (!concepts.length) concepts.push({ key: "general", label: "General", description: "" });
  const keys = new Set(concepts.map((c) => c.key));
  const questions = (raw.questions || []).filter((q) => q?.prompt).slice(0, 2000).map((q, i) => {
    const type = ["essay", "short", "mc"].includes(q.type) ? q.type : "essay";
    return { id: `q${String(i + 1).padStart(3, "0")}`, n: i + 1, type, prompt: cap(q.prompt, 3000), instructions: cap(q.instructions, 1500), choices: (q.choices || []).slice(0, 8).map((c) => cap(c, 400)), answer: cap(q.answer, 400), concept: keys.has(q.concept) ? q.concept : concepts[0].key, source: cap(q.source, 500) };
  });
  if (!questions.length) throw new HttpError(400, "exam.questions needs at least one question with a prompt.");
  const r = raw.rubric || {};
  const min = Number.isFinite(+r.min) ? Math.round(+r.min) : 0;
  const max = Number.isFinite(+r.max) && +r.max > min ? Math.round(+r.max) : min + 6;
  return {
    name: cap(raw.name, 120) || "My exam", description: cap(raw.description, 800),
    timeLimitMinutes: Number.isFinite(+raw.timeLimitMinutes) && +raw.timeLimitMinutes > 0 ? Math.round(+raw.timeLimitMinutes) : null,
    concepts, questions,
    rubric: {
      min, max, fromSource: Boolean(r.fromSource), notes: cap(r.notes, 800),
      levels: (r.levels || []).slice(0, 20).map((l) => ({ score: Math.round(+l.score), descriptor: cap(l.descriptor, 400) })).filter((l) => Number.isFinite(l.score)),
      dimensions: (r.dimensions || []).slice(0, 6).map((d) => ({ id: cap(d.id || d.label, 40).toLowerCase().replace(/[^a-z0-9]+/g, "-"), label: cap(d.label, 60), ask: cap(d.ask, 300) })),
    },
    references: (raw.references || []).slice(0, 20).map((x) => ({ title: cap(x.title, 300), authors: cap(x.authors, 200), year: cap(x.year, 10), kind: cap(x.kind, 20), venue: cap(x.venue, 200), why: cap(x.why, 300), url: /^https?:\/\//.test(x.url || "") ? cap(x.url, 500) : null, verified: false })),
    sources: (raw.sources || []).slice(0, 20).map((s) => ({ url: cap(s.url, 500), title: cap(s.title, 200), kind: cap(s.kind, 10) })),
    builtWith: cap(raw.builtWith, 40) || "agent",
    builtAt: new Date().toISOString(),
  };
}

function kv(env) {
  if (!env.LIMITS) throw new HttpError(500, "Storage is not configured.");
  return env.LIMITS;
}

export async function putExam(env, raw) {
  const exam = normalizeExam(raw);
  const examId = id();
  await kv(env).put(`exam:${examId}`, JSON.stringify(exam), { expirationTtl: TTL });
  return { examId, exam };
}

export async function getExam(env, examId) {
  const v = await kv(env).get(`exam:${cap(examId, 40)}`);
  if (!v) throw new HttpError(404, "No exam with that id (links last 30 days).");
  return JSON.parse(v);
}

export async function putGrade(env, row) {
  const gradeId = id();
  await kv(env).put(`grade:${gradeId}`, JSON.stringify(row), { expirationTtl: TTL });
  return gradeId;
}

export async function getGrade(env, gradeId) {
  const v = await kv(env).get(`grade:${cap(gradeId, 40)}`);
  if (!v) throw new HttpError(404, "No grade with that id.");
  return JSON.parse(v);
}
