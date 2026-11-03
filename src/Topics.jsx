import { useState } from "react";
import { VARIANT_SHORT, conceptLabel } from "./look.js";

export function TopicRow({ kb, topic, best, note, onPick }) {
  return (
    <button type="button" className="list-row" onClick={() => onPick(topic.id)}>
      <span className="num">{topic.n}</span>
      <span className="body">
        <p>{topic.statement}</p>
        <span className="row"><span className="badge">{conceptLabel(kb, topic.concept)}</span><span className="badge gray">{VARIANT_SHORT[topic.variant]}</span>{note && <span className="sub">{note}</span>}</span>
      </span>
      {best != null && <span className="score">{best}/6</span>}
    </button>
  );
}

export function Topics({ kb, history, onPick }) {
  const [q, setQ] = useState("");
  const [concept, setConcept] = useState("");
  const [variant, setVariant] = useState("");
  const best = {};
  for (const h of history) best[h.topicId] = Math.max(best[h.topicId] ?? 0, h.score);
  const list = kb.topics.filter((t) => (!q || t.statement.toLowerCase().includes(q.toLowerCase())) && (!concept || t.concept === concept) && (!variant || t.variant === variant));
  return (
    <>
      <section className="card">
        <input className="search" type="search" placeholder="Search the 159 official topics" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search topics" />
        <hr className="divider" />
        <div className="sub" style={{ marginBottom: 8 }}>Task type</div>
        <div className="chips">
          <button type="button" className={`chip ${variant ? "" : "on"}`} onClick={() => setVariant("")}>All</button>
          {kb.variants.map((v) => <button type="button" key={v.key} className={`chip ${variant === v.key ? "on" : ""}`} onClick={() => setVariant(variant === v.key ? "" : v.key)}>{VARIANT_SHORT[v.key]}</button>)}
        </div>
        <div className="sub" style={{ margin: "12px 0 8px" }}>Concept</div>
        <select className="select" value={concept} onChange={(e) => setConcept(e.target.value)} aria-label="Concept">
          <option value="">All concepts</option>
          {kb.concepts.filter((c) => c.key !== "other").map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
      </section>
      <section className="card">
        <div className="card-head"><h2 className="card-title">Topics</h2><span className="sub">{list.length} of {kb.topics.length}</span></div>
        <div className="list">
          {list.map((t) => <TopicRow key={t.id} kb={kb} topic={t} best={best[t.id]} onPick={onPick}
            note={t.repeatOf ? `same statement as #${Number(t.repeatOf.slice(-3))}` : ""} />)}
        </div>
      </section>
    </>
  );
}
