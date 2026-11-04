import { api } from "./store.js";
import { chunks, loadSource } from "./sources.js";

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

// Step 1 of the app: links -> text -> outline (concepts, rubric, references) -> questions from every chunk.
export async function buildExam({ prompt, urls }, onStep) {
  const step = (id, patch) => onStep((s) => ({ ...s, [id]: { ...(s[id] || {}), ...patch } }));
  const sources = [];
  for (const [k, url] of urls.entries()) {
    step(`src${k}`, { label: `Read ${url}`, state: "run" });
    try {
      const s = await loadSource(url);
      sources.push(s);
      step(`src${k}`, { state: "done", detail: `${s.kind === "pdf" ? "PDF" : "Web page"}, ${s.chars.toLocaleString()} characters` });
    } catch (e) {
      step(`src${k}`, { state: "fail", detail: e.message });
    }
  }
  if (!sources.length) throw new Error("None of the links could be read.");

  step("outline", { label: "Find concepts and scoring rules", state: "run" });
  const exam = await api("/api/build", { stage: "outline", prompt, sources });
  step("outline", { state: "done", detail: `${exam.concepts.length} concepts, ${exam.rubric.dimensions.length} rubric dimensions` });

  step("refs", { label: "Find research by the test makers, then check it in Crossref", state: "run" });
  const refsDone = api("/api/build", { stage: "references", examName: exam.name, description: exam.description, sourceTitles: sources.map((x) => x.title) })
    .then(async ({ references }) => {
      const checked = await Promise.all(references.map(verifyReference));
      step("refs", { state: "done", detail: `${checked.length} found, ${checked.filter((r) => r.verified).length} confirmed in Crossref` });
      return checked;
    })
    .catch((e) => { step("refs", { state: "fail", detail: e.message }); return []; });

  const parts = sources.flatMap((s) => chunks(s.text).map((chunk) => ({ chunk, url: s.url }))).slice(0, 24);
  let done = 0;
  step("questions", { label: "Collect questions", state: "run", detail: `0 of ${parts.length} sections` });
  const found = await pool(parts, 4, async (p) => {
    const r = await api("/api/build", { stage: "questions", examName: exam.name, concepts: exam.concepts, chunk: p.chunk }).catch(() => ({ questions: [], failed: true }));
    done++;
    step("questions", { detail: `${done} of ${parts.length} sections` });
    return r.questions.map((q) => ({ ...q, source: p.url }));
  });
  const seen = new Set();
  const questions = found.flat().filter((q) => { const k = norm(q.prompt + q.instructions); if (seen.has(k)) return false; seen.add(k); return true; })
    .map((q, i) => ({ ...q, id: `q${String(i + 1).padStart(3, "0")}`, n: i + 1 }));
  step("questions", { state: questions.length ? "done" : "fail", detail: questions.length ? `${questions.length} questions` : "No questions found in the sources. You can still generate new ones." });

  const references = await refsDone;
  return finalize({ ...exam, references, prompt, sources: sources.map(({ text, ...s }) => s), questions, builtAt: new Date().toISOString(), builtWith: "live" });
}

const words = (t) => new Set(String(t).toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2));
const overlap = (a, b) => { const x = words(a), y = words(b); let n = 0; for (const w of x) if (y.has(w)) n++; return n / Math.max(1, Math.max(x.size, y.size)); };

// The model recalls references from memory, so each one is looked up in Crossref's public index before it is called confirmed.
export async function verifyReference(ref) {
  try {
    const q = encodeURIComponent(`${ref.title} ${ref.authors}`.slice(0, 300));
    const r = await fetch(`https://api.crossref.org/works?query.bibliographic=${q}&rows=5&select=title,DOI,author,issued,URL,container-title`, { signal: AbortSignal.timeout(12000) });
    const items = (await r.json()).message?.items || [];
    const hit = items.map((it) => ({ it, score: overlap(ref.title, it.title?.[0] || "") })).sort((a, b) => b.score - a.score)[0];
    const surname = String(ref.authors).split(/[,\s]/)[0].toLowerCase();
    const sameAuthor = (it) => (it.author || []).some((a) => String(a.family || "").toLowerCase() === surname);
    if (hit && (hit.score >= 0.75 || (hit.score >= 0.5 && sameAuthor(hit.it)))) {
      const it = hit.it;
      return { ...ref, verified: true, url: `https://doi.org/${it.DOI}`, foundTitle: it.title?.[0], year: String(it.issued?.["date-parts"]?.[0]?.[0] || ref.year) };
    }
  } catch { /* Crossref unreachable: leave unconfirmed */ }
  return { ...ref, verified: false, url: null };
}

// Recount how often each concept appears, which drives "what to practice next".
export function finalize(exam) {
  const count = {};
  for (const q of exam.questions) count[q.concept] = (count[q.concept] || 0) + 1;
  const concepts = exam.concepts.map((c) => ({ ...c, count: count[c.key] || 0 })).sort((a, b) => b.count - a.count);
  return { ...exam, id: exam.id || `exam-${Date.now().toString(36)}`, concepts };
}

export async function generateQuestion(exam, concept) {
  const examples = exam.questions.filter((q) => q.concept === concept && !q.generated).slice(0, 3);
  const { question } = await api("/api/build", { stage: "generate", examName: exam.name, concepts: exam.concepts, concept, examples: examples.length ? examples : exam.questions.slice(0, 3) });
  return { ...question, id: `g${Date.now().toString(36)}`, n: exam.questions.length + 1 };
}

// For people who would rather build the knowledge base with their own agent (web search, MCP tools, another model).
export const AGENT_PROMPT = `Build a practice-exam knowledge base as JSON for the exam I describe below.
Use only public sources (official sites, published PDFs) and cite them.
Return one JSON object with this shape:
{
  "name": "exam name",
  "description": "one paragraph",
  "timeLimitMinutes": 30,
  "concepts": [{ "key": "kebab-case", "label": "Short label", "description": "..." }],
  "rubric": { "min": 0, "max": 6, "fromSource": true,
    "levels": [{ "score": 6, "descriptor": "..." }],
    "dimensions": [{ "id": "kebab-case", "label": "...", "ask": "question the rater asks" }], "notes": "" },
  "references": [{ "title": "...", "authors": "...", "year": "...", "kind": "paper|book|guide|report", "why": "...", "sourceUrl": "https://..." }],
  "questions": [{ "type": "essay|short|mc", "prompt": "exact question text", "instructions": "...", "choices": [], "answer": "", "concept": "concept key", "source": "https://..." }],
  "sources": [{ "url": "https://...", "title": "..." }]
}
Copy questions exactly as published. Put papers or books by the test makers, or research on how the exam is designed and scored, in references, each with a link you actually opened.
Exam: `;

export function importExam(text) {
  const raw = JSON.parse(text);
  if (!raw || !Array.isArray(raw.questions) || !Array.isArray(raw.concepts)) throw new Error("This JSON needs at least concepts and questions.");
  const keys = new Set(raw.concepts.map((c) => c.key));
  return finalize({
    ...raw,
    id: undefined,
    concepts: raw.concepts.map((c) => ({ key: String(c.key), label: String(c.label || c.key), description: String(c.description || "") })),
    questions: raw.questions.filter((q) => q?.prompt).map((q, i) => ({ type: ["essay", "short", "mc"].includes(q.type) ? q.type : "essay", prompt: String(q.prompt), instructions: String(q.instructions || ""), choices: q.choices || [], answer: String(q.answer || ""), concept: keys.has(q.concept) ? q.concept : raw.concepts[0].key, source: q.source || "", id: `q${String(i + 1).padStart(3, "0")}`, n: i + 1 })),
    references: (raw.references || []).map((r) => ({ ...r, verified: false, url: r.sourceUrl || r.url || null })),
    sources: raw.sources || [],
    builtAt: new Date().toISOString(),
    builtWith: "import",
  });
}
