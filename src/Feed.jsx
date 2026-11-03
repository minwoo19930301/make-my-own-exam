import { useState } from "react";
import { coveragePlan, nextTopics, readiness } from "./predict.js";
import { VARIANT_SHORT, conceptLabel, gradient, initials } from "./look.js";

function Post({ kb, topic, caption, best, onOpen }) {
  const label = conceptLabel(kb, topic.concept);
  const share = kb.stats.concepts.find((c) => c.concept === topic.concept)?.count || 0;
  return (
    <article className="post">
      <div className="post-head">
        <span className="avatar" style={{ background: gradient(kb, topic.concept) }}>{initials(label)}</span>
        <div className="who"><b>{label}</b><span>{VARIANT_SHORT[topic.variant]}</span></div>
        <span className="num">#{topic.n}</span>
      </div>
      <button type="button" className="panel" style={{ background: gradient(kb, topic.concept) }} onClick={onOpen} aria-label={`Write on topic ${topic.n}`}>
        {topic.statement}
      </button>
      <div className="post-actions">
        <button type="button" className="write-btn" onClick={onOpen}>Write</button>
        <span className="grow" />
        {best != null && <span className="score-pill">{best} / 6</span>}
      </div>
      <p className="caption"><b>{share} of {kb.stats.total}</b><span className="muted">pool topics share this concept</span></p>
      {caption && <p className="caption">{caption}</p>}
    </article>
  );
}

export function Feed({ kb, history, onOpen }) {
  const [tab, setTab] = useState("foryou");
  const [concept, setConcept] = useState("");
  const best = {};
  for (const h of history) best[h.topicId] = Math.max(best[h.topicId] ?? 0, h.score);
  const practiced = new Set(history.map((h) => kb.topics.find((t) => t.id === h.topicId)?.concept));
  const ready = readiness(kb, history);
  const avg = history.length ? (history.reduce((a, b) => a + b.score, 0) / history.length).toFixed(1) : "–";
  const picks = nextTopics(kb, history, 3);
  const plan = coveragePlan(kb);
  const all = kb.topics.filter((t) => !concept || t.concept === concept);
  const max = kb.stats.concepts[0].count;

  return (
    <>
      <section className="profile">
        <div className="profile-ring"><div><b>{avg}</b></div></div>
        <div className="counts">
          <div><b>{kb.stats.total}</b><span>topics</span></div>
          <div><b>{history.length}</b><span>essays</span></div>
          <div><b>{Math.round(ready.share * 100)}%</b><span>pool ready</span></div>
        </div>
      </section>
      <div className="bio">
        <strong>GRE Analyze an Issue</strong>
        Every official topic, scored 0-6 by Meta Muse. Your average is in the ring. "Pool ready" is the share of the pool whose concept you have already written a 4+ on.
      </div>

      <nav className="stories" aria-label="Concepts">
        {kb.stats.concepts.map((c) => {
          const label = conceptLabel(kb, c.concept);
          return (
            <button key={c.concept} type="button" className={`story ${concept === c.concept ? "on" : practiced.has(c.concept) ? "seen" : ""}`}
              onClick={() => { setConcept(concept === c.concept ? "" : c.concept); setTab("all"); }} title={label}>
              <div className="ring"><span style={{ background: gradient(kb, c.concept) }}>{initials(label)}</span></div>
              <small>{label}</small>
            </button>
          );
        })}
      </nav>

      <div className="seg" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "foryou"} className={tab === "foryou" ? "on" : ""} onClick={() => setTab("foryou")}>For you</button>
        <button type="button" role="tab" aria-selected={tab === "all"} className={tab === "all" ? "on" : ""} onClick={() => setTab("all")}>{concept ? conceptLabel(kb, concept) : `All ${kb.stats.total}`}</button>
        <button type="button" role="tab" aria-selected={tab === "pool"} className={tab === "pool" ? "on" : ""} onClick={() => setTab("pool")}>Pool</button>
      </div>

      {tab === "foryou" && (
        <>
          <p className="section-sub" style={{ paddingTop: 12 }}>
            The pool is public, so nobody can predict your exact topic. These are ranked by how often the pool returns to a concept and where you have scored lowest.
          </p>
          {picks.map((r) => <Post key={r.topic.id} kb={kb} topic={r.topic} best={best[r.topic.id]} onOpen={() => onOpen(r.topic.id)}
            caption={<><b>Why this one</b><span className="muted">{r.reasons.slice(0, 2).join(" · ")}</span></>} />)}
          <h2 className="section-title">Cover the whole pool</h2>
          <p className="section-sub">{plan.topics.length} essays, one per concept, touch {Math.round(plan.poolShare * 100)}% of the pool and all {plan.variantsCovered} task types.</p>
          {plan.topics.filter((t) => !picks.some((p) => p.topic.id === t.id)).map((t) => <Post key={t.id} kb={kb} topic={t} best={best[t.id]} onOpen={() => onOpen(t.id)} />)}
        </>
      )}

      {tab === "all" && all.map((t) => <Post key={t.id} kb={kb} topic={t} best={best[t.id]} onOpen={() => onOpen(t.id)}
        caption={t.repeatOf ? <span className="muted">Same statement as #{Number(t.repeatOf.slice(-3))}, with a different task</span> : null} />)}

      {tab === "pool" && (
        <>
          <h2 className="section-title">Where the pool's weight sits</h2>
          <p className="section-sub">{kb.stats.total} topics, {kb.stats.uniqueStatements} distinct statements, {kb.stats.concepts.length} recurring concepts.</p>
          <div className="weights">
            {kb.stats.concepts.map((c) => (
              <div className="weight" key={c.concept}><span>{conceptLabel(kb, c.concept)}</span><span className="muted">{c.count}</span><span className="track"><i style={{ width: `${(c.count / max) * 100}%` }} /></span></div>
            ))}
          </div>
          <h2 className="section-title">Six task types</h2>
          <p className="section-sub">The same statement can come with a different task. Missing the task's specific demand costs points.</p>
          <div className="weights">
            {kb.variants.map((v) => (
              <div className="weight" key={v.key}><span>{v.label}</span><span className="muted">{kb.stats.variants[v.key]}</span><span className="track"><i style={{ width: `${(kb.stats.variants[v.key] / kb.stats.total) * 100}%` }} /></span></div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
