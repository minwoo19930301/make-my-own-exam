import { nextQuestions, weakestDimension } from "./plan.js";

export function Insights({ exam, history, onPick }) {
  const next = nextQuestions(exam, history, 3);
  const weak = weakestDimension(history);
  const avg = history.length ? `${Math.round((history.reduce((a, h) => a + (h.score - h.min) / Math.max(1, h.max - h.min), 0) / history.length) * 100)}%` : "–";
  const practiced = new Set(history.map((h) => exam.questions.find((q) => q.id === h.questionId)?.concept).filter(Boolean));
  const withQ = exam.concepts.filter((c) => c.count);
  const covered = withQ.filter((c) => practiced.has(c.key)).reduce((a, c) => a + c.count, 0) / Math.max(1, exam.questions.length);
  const max = withQ[0]?.count || 1;
  return (
    <>
      <section className="card">
        <div className="stats">
          <div><b>{history.length}</b><span className="sub">answers</span></div>
          <div><b>{avg}</b><span className="sub">average</span></div>
          <div><b>{Math.round(covered * 100)}%</b><span className="sub">of pool practiced</span></div>
          <div><b>{weak ? weak.label.split(" ")[0] : "–"}</b><span className="sub">weakest</span></div>
        </div>
      </section>

      <section className="card">
        <div className="card-head"><h2 className="card-title">Practice these next</h2></div>
        <p className="sub" style={{ marginTop: 0 }}>Nobody can predict your exact question. These are ranked by how often the sources return to a concept and where you have scored lowest.</p>
        <div className="list">
          {next.map((r) => (
            <button type="button" className="list-row" key={r.question.id} onClick={() => onPick(r.question.id)}>
              <span className="num">{r.question.n}</span>
              <span className="body"><p>{r.question.prompt}</p><span className="sub">{r.reason}</span></span>
            </button>
          ))}
          {!next.length && <p className="sub">Nothing left to recommend.</p>}
        </div>
      </section>

      <section className="card">
        <div className="card-head"><h2 className="card-title">Where the pool's weight sits</h2><span className="sub">{exam.questions.length} questions</span></div>
        <div className="bars">
          {withQ.map((c) => (
            <div className="bar-row" key={c.key}><span>{c.label}{practiced.has(c.key) ? " ✓" : ""}</span><span className="sub">{c.count}</span><span className="track"><i style={{ width: `${(c.count / max) * 100}%` }} /></span></div>
          ))}
        </div>
      </section>
    </>
  );
}
