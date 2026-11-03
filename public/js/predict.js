// Pool analytics and personal next-topic picks. Pure functions so they run in the browser and in node tests.
// The pool is public and finite, so "prediction" here means: where the pool's weight is, and where you are weakest.

export function coveragePlan(kb) {
  // Greedy: one topic per concept, preferring task variants not yet covered, largest concepts first.
  const seenVariants = new Set();
  const plan = [];
  for (const { concept } of kb.stats.concepts) {
    const pool = kb.topics.filter((t) => t.concept === concept && !t.repeatOf);
    const pick = pool.find((t) => !seenVariants.has(t.variant)) || pool[0];
    if (!pick) continue;
    seenVariants.add(pick.variant);
    plan.push(pick);
  }
  const covered = plan.reduce((n, t) => n + kb.topics.filter((x) => x.concept === t.concept).length, 0);
  return { topics: plan, variantsCovered: seenVariants.size, poolShare: covered / kb.topics.length };
}

export function readiness(kb, history) {
  // Share of the pool whose concept you have already written at 4+ on.
  const strong = new Set(history.filter((h) => h.score >= 4).map((h) => topicOf(kb, h.topicId)?.concept).filter(Boolean));
  const ready = kb.topics.filter((t) => strong.has(t.concept)).length;
  return { share: ready / kb.topics.length, strongConcepts: [...strong] };
}

export function weakestDimension(history) {
  const sums = {};
  for (const h of history) for (const d of h.dimensions || []) {
    if (d.score == null) continue;
    sums[d.id] ||= { id: d.id, label: d.label, total: 0, n: 0 };
    sums[d.id].total += d.score;
    sums[d.id].n += 1;
  }
  const rows = Object.values(sums).map((s) => ({ ...s, avg: s.total / s.n })).sort((a, b) => a.avg - b.avg);
  return rows[0] || null;
}

export function nextTopics(kb, history, count = 3) {
  // Rank unpracticed topics: heavy concepts you have not mastered, task variants you score lowest on, then pool weight.
  const done = new Set(history.map((h) => h.topicId));
  const conceptWeight = Object.fromEntries(kb.stats.concepts.map((c) => [c.concept, c.count]));
  const best = {};
  const variantScores = {};
  for (const h of history) {
    const t = topicOf(kb, h.topicId);
    if (!t) continue;
    best[t.concept] = Math.max(best[t.concept] ?? 0, h.score);
    (variantScores[t.variant] ||= []).push(h.score);
  }
  const variantAvg = (v) => (variantScores[v] ? variantScores[v].reduce((a, b) => a + b, 0) / variantScores[v].length : null);
  const scored = kb.topics.filter((t) => !t.repeatOf && !done.has(t.id)).map((t) => {
    const mastery = best[t.concept] ?? 0;
    const vAvg = variantAvg(t.variant);
    const reasons = [];
    let s = conceptWeight[t.concept] || 0;
    if (mastery < 4) { s += 10; reasons.push(mastery ? `you scored ${mastery} on this concept` : "concept not practiced yet"); }
    if (vAvg == null) { s += 6; reasons.push("new task type for you"); }
    else if (vAvg < 4) { s += 8; reasons.push(`your average on this task type is ${vAvg.toFixed(1)}`); }
    reasons.push(`${conceptWeight[t.concept]} of ${kb.topics.length} pool topics share this concept`);
    return { topic: t, s, reasons };
  });
  scored.sort((a, b) => b.s - a.s || a.topic.n - b.topic.n);
  // Spread picks across concepts.
  const picks = [];
  const used = new Set();
  for (const row of scored) {
    if (used.has(row.topic.concept)) continue;
    used.add(row.topic.concept);
    picks.push(row);
    if (picks.length === count) break;
  }
  return picks;
}

function topicOf(kb, id) {
  return kb.topics.find((t) => t.id === id);
}
