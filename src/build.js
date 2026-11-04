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

// Step 1 of the app: find official sources (or use the links given) -> text -> outline -> questions, references.
export async function buildExam({ prompt, urls = [] }, onStep) {
  const step = (id, patch) => onStep((s) => ({ ...s, [id]: { ...(s[id] || {}), ...patch } }));
  const sources = [];
  const tried = new Set();
  const read = async (url, why) => {
    if (tried.has(url) || sources.length >= 8) return null;
    tried.add(url);
    const id = `src${tried.size}`;
    step(id, { label: `Read ${url}`, state: "run", detail: why });
    try {
      const s = await loadSource(url);
      const sig = s.text.slice(0, 3000);
      if (sources.some((x) => x.text.slice(0, 3000) === sig)) { step(id, { state: "fail", detail: "Same content as a page already read" }); return null; }
      sources.push(s);
      step(id, { state: "done", detail: `${s.kind === "pdf" ? "PDF" : "Web page"}, ${s.chars.toLocaleString()} characters${why ? ` · ${why}` : ""}` });
      return s;
    } catch (e) {
      step(id, { state: "fail", detail: e.message });
      return null;
    }
  };

  if (urls.length) {
    for (const u of urls) await read(u, "your link");
  } else {
    step("discover", { label: "Search the web for the exam's official materials", state: "run" });
    const found = await api("/api/build", { stage: "discover", prompt });
    step("discover", { state: "done", detail: `${found.candidates.length} candidate links${found.maker ? ` from ${found.maker}` : ""}${found.museSearches?.length ? ` · Muse searched: ${found.museSearches.slice(0, 4).map((q) => `"${q}"`).join(", ")}` : ""}` });
    await pool(found.candidates, 4, (c) => read(c.url, c.why));
    // Follow links on the official pages while something is still missing, at most two rounds.
    for (let round = 1; round <= 2 && sources.length < 8; round++) {
      const need = missingKinds(sources);
      if (!need.length) break;
      const links = rankLinks(sources.flatMap((s) => s.links).filter((l) => !tried.has(l.url)));
      if (!links.length) break;
      // Same-site PDFs whose name matches what is missing are opened directly, without asking the model.
      const direct = links.filter((l) => /\.pdf$/i.test(new URL(l.url).pathname) && need.some((n) => KIND_RE[n].test(l.url + " " + l.text))).slice(0, 3);
      if (direct.length) {
        await pool(direct.map((l) => l.url), 3, (u) => read(u, "PDF linked from an official page"));
        if (!missingKinds(sources).length) break;
      }
      const id = `follow${round}`;
      step(id, { label: `Follow links on the official pages (still missing: ${need.join(", ")})`, state: "run", detail: `${links.length} links found` });
      const { urls: next } = await api("/api/build", { stage: "pick", prompt, links, missing: need, read: [...tried] }).catch(() => ({ urls: [] }));
      step(id, { state: "done", detail: `${links.length} links found, ${next.length} worth opening` });
      if (!next.length) break;
      await pool(next, 3, (u) => read(u, `looking for ${need.join(", ")}`));
    }
  }
  if (!sources.length) throw new Error("Could not read any official source. Add a link yourself under \"Use my own links\".");

  step("outline", { label: "Find concepts and scoring rules", state: "run" });
  const exam = await api("/api/build", { stage: "outline", prompt, sources: sources.map(({ links, ...s }) => s) });
  step("outline", { state: "done", detail: `${exam.concepts.length} concepts, ${exam.rubric.dimensions.length} rubric dimensions` });

  step("refs", { label: "Search for research by the test makers, then check it in Crossref", state: "run" });
  const refsDone = api("/api/build", { stage: "references", examName: exam.name, description: exam.description, sourceTitles: sources.map((x) => x.title) })
    .then(async ({ references, searches }) => {
      const all = await Promise.all(references.map(verifyReference));
      step("refs", { state: "done", detail: `${all.length} works, ${all.filter((r) => r.verified).length} confirmed in Crossref${searches?.length ? ` · Muse searched ${searches.length} times` : ""}` });
      return all;
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
  return finalize({ ...exam, references, prompt, sources: sources.map(({ text, links, ...s }) => s), questions, builtAt: new Date().toISOString(), builtWith: "live" });
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
  return { ...ref, verified: false, url: ref.foundUrl || null };
}

const KIND_RE = { "official scoring guide": /scor|rubric|level/i, "scored sample answers": /sample|response|essay/i, "question pool": /pool|topic|prompt|question/i };

// What the sources read so far still lack. Checked by simple text signals; Muse decides which links to open.
function missingKinds(sources) {
  const all = sources.map((s) => s.text).join("\n");
  const need = [];
  if (!/(scoring guide|score level|holistic|scored on a|rubric|score of \d)/i.test(all)) need.push("official scoring guide");
  if (!/(sample (response|essay|answer)s?|scored sample)/i.test(all)) need.push("scored sample answers");
  if (!sources.some((s) => s.chars > 20000)) need.push("question pool");
  return need;
}

// Put likely scoring, sample and pool links first so they survive the cap.
function rankLinks(links) {
  const seen = new Set();
  const score = (l) => (/scor|rubric/i.test(l.url + l.text) ? 3 : 0) + (/sample|response/i.test(l.url + l.text) ? 2 : 0) + (/pool|topic|\.pdf/i.test(l.url + l.text) ? 1 : 0);
  return links.filter((l) => !seen.has(l.url) && seen.add(l.url)).sort((a, b) => score(b) - score(a)).slice(0, 60);
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
