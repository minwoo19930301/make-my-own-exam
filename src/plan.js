// What to practice next. The pool is public, so this never predicts an exact question:
// it weighs how often the sources return to a concept against how you have scored on it.
const share = (g) => (g.max > g.min ? (g.score - g.min) / (g.max - g.min) : 0);

export function mastery(exam, history) {
  const by = {};
  for (const h of history) {
    const q = exam.questions.find((x) => x.id === h.questionId);
    if (!q) continue;
    (by[q.concept] ||= []).push(share(h));
  }
  return Object.fromEntries(Object.entries(by).map(([k, v]) => [k, v.reduce((a, b) => a + b, 0) / v.length]));
}

export function nextQuestions(exam, history, count = 3) {
  const total = exam.questions.length || 1;
  const m = mastery(exam, history);
  const done = new Set(history.map((h) => h.questionId));
  const ranked = exam.concepts.filter((c) => c.count > 0).map((c) => {
    const weight = c.count / total;
    const gap = m[c.key] == null ? 1 : 1 - m[c.key];
    return { concept: c, need: weight * (0.35 + gap), reason: m[c.key] == null ? `${Math.round(weight * 100)}% of the pool, not practiced yet` : `${Math.round(weight * 100)}% of the pool, you average ${Math.round(m[c.key] * 100)}%` };
  }).sort((a, b) => b.need - a.need);
  const out = [];
  for (const r of ranked) {
    const q = exam.questions.find((x) => x.concept === r.concept.key && !done.has(x.id) && !out.some((o) => o.question.id === x.id));
    if (q) out.push({ question: q, reason: r.reason });
    if (out.length >= count) break;
  }
  return out;
}

export function weakestDimension(history) {
  const sum = {};
  for (const h of history) for (const d of h.dimensions || []) {
    if (d.score == null) continue;
    (sum[d.id] ||= { id: d.id, label: d.label, total: 0, n: 0 });
    sum[d.id].total += (d.score - h.min) / Math.max(1, h.max - h.min);
    sum[d.id].n++;
  }
  return Object.values(sum).map((d) => ({ ...d, avg: d.total / d.n })).sort((a, b) => a.avg - b.avg)[0] || null;
}
