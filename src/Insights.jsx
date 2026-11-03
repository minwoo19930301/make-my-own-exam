import { coveragePlan, nextTopics, readiness, weakestDimension } from "./predict.js";
import { conceptLabel } from "./look.js";
import { TopicRow } from "./Topics.jsx";

export function Insights({ kb, history, onPick }) {
  const next = nextTopics(kb, history, 3);
  const plan = coveragePlan(kb);
  const ready = readiness(kb, history);
  const weak = weakestDimension(history);
  const avg = history.length ? (history.reduce((a, b) => a + b.score, 0) / history.length).toFixed(1) : "–";
  const max = kb.stats.concepts[0].count;
  return (
    <>
      <section className="card">
        <div className="row" style={{ justifyContent: "space-around", textAlign: "center" }}>
          <div><div className="card-title">{history.length}</div><span className="sub">essays</span></div>
          <div><div className="card-title">{avg}</div><span className="sub">average</span></div>
          <div><div className="card-title">{Math.round(ready.share * 100)}%</div><span className="sub">pool ready</span></div>
          <div><div className="card-title">{weak ? weak.label.split(" ")[0] : "–"}</div><span className="sub">weakest</span></div>
        </div>
      </section>

      <section className="card">
        <div className="card-head"><h2 className="card-title">Write these next</h2></div>
        <p className="sub" style={{ marginTop: 0 }}>
          The pool is public, so nobody can predict your exact topic. These are ranked by how often the pool returns to a concept and where you have scored lowest.
        </p>
        <div className="list">
          {next.map((r) => <TopicRow key={r.topic.id} kb={kb} topic={r.topic} note={r.reasons[0]} onPick={onPick} />)}
        </div>
      </section>

      <section className="card">
        <div className="card-head"><h2 className="card-title">Where the pool's weight sits</h2><span className="sub">{kb.stats.uniqueStatements} distinct statements</span></div>
        <div className="bars">
          {kb.stats.concepts.map((c) => (
            <div className="bar-row" key={c.concept}><span>{conceptLabel(kb, c.concept)}</span><span className="sub">{c.count}</span><span className="track"><i style={{ width: `${(c.count / max) * 100}%` }} /></span></div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-head"><h2 className="card-title">Six task types</h2></div>
        <div className="bars">
          {kb.variants.map((v) => (
            <div className="bar-row" key={v.key}><span>{v.label}</span><span className="sub">{kb.stats.variants[v.key]}</span><span className="track"><i style={{ width: `${(kb.stats.variants[v.key] / kb.stats.total) * 100}%` }} /></span></div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-head"><h2 className="card-title">Smallest set that covers the pool</h2></div>
        <p className="sub" style={{ marginTop: 0 }}>{plan.topics.length} essays, one per concept, touch {Math.round(plan.poolShare * 100)}% of the pool and all {plan.variantsCovered} task types.</p>
        <div className="list">{plan.topics.map((t) => <TopicRow key={t.id} kb={kb} topic={t} onPick={onPick} />)}</div>
      </section>
    </>
  );
}
