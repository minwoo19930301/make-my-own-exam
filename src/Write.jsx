import { useEffect, useState } from "react";
import { api, useStored } from "./store.js";
import { TASK_DEMANDS } from "../functions/_lib/rubric.js";
import { VARIANT_SHORT, conceptLabel } from "./look.js";

const fmt = (ms) => `${String(Math.floor(ms / 60000)).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

export function Write({ kb, topic, onPick, onRecommend, onScored }) {
  const [essay, setEssay] = useStored(`sixpoint.draft.${topic.id}`, "");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [end, setEnd] = useState(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!end) return undefined;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [end]);
  const words = (essay.trim().match(/\S+/g) || []).length;
  const left = end ? Math.max(0, end - now) : 30 * 60 * 1000;
  const i = kb.topics.findIndex((t) => t.id === topic.id);
  const step = (d) => onPick(kb.topics[(i + d + kb.topics.length) % kb.topics.length].id);

  const score = async () => {
    setBusy(true);
    setErr("");
    try {
      const g = await api("/api/grade", { topicId: topic.id, essay });
      setResult(g);
      onScored({ topicId: topic.id, score: g.score, dimensions: g.dimensions, task: g.task.status, at: new Date().toISOString() });
      setTimeout(() => document.getElementById("result")?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="card">
        <label className="sub" htmlFor="topic">Topic</label>
        <select id="topic" className="select" value={topic.id} onChange={(e) => onPick(e.target.value)} style={{ marginTop: 6 }}>
          {kb.topics.map((t) => <option key={t.id} value={t.id}>#{t.n} {t.statement.length > 80 ? `${t.statement.slice(0, 80)}…` : t.statement}</option>)}
        </select>
        <div className="row" style={{ marginTop: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={() => step(-1)}>Previous</button>
          <button type="button" className="btn btn-secondary" onClick={() => step(1)}>Next</button>
          <span className="grow" />
          <button type="button" className="btn btn-soft" onClick={onRecommend}>Recommend for me</button>
        </div>
      </section>

      <section className="card">
        <div className="row">
          <span className="badge">{conceptLabel(kb, topic.concept)}</span>
          <span className="badge gray">{VARIANT_SHORT[topic.variant]}</span>
          <span className="grow" />
          <span className="sub">#{topic.n} of {kb.stats.total}</span>
        </div>
        <p className="prompt">{topic.statement}</p>
        <p className="instructions">{topic.instructions}</p>
        <div className="note"><div><b>What this task type demands</b>{TASK_DEMANDS[topic.variant]}</div></div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Your essay</h2>
          <span className="meta">{words} words · {fmt(left)}</span>
        </div>
        <textarea className="essay" aria-label="Your essay" value={essay} onChange={(e) => setEssay(e.target.value)}
          placeholder="Take a clear position. Develop it with specific reasons and examples. Answer the task's specific demand." />
        {err && <p className="error">{err}</p>}
        <div className="row" style={{ marginTop: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={() => { setEnd(Date.now() + 30 * 60 * 1000); setNow(Date.now()); }}>{end ? "Restart timer" : "Start 30-minute timer"}</button>
          <span className="grow" />
          <button type="button" className="btn btn-primary" disabled={busy || words < 30} onClick={score}>{busy ? "Scoring…" : "Score my essay"}</button>
        </div>
      </section>

      {result && <Result g={result} />}
    </>
  );
}

function Result({ g }) {
  return (
    <section className="card" id="result" aria-label="Score">
      <div className="score-head">
        <div className="score-num">{g.score}</div>
        <div><h2 className="card-title">Practice score {g.score} / 6</h2><p style={{ margin: "4px 0 0" }}>{g.summary}</p></div>
      </div>
      <div className="dim" style={{ marginTop: 12 }}>
        <div className="dim-head"><span>Task demand</span><span className={g.task.status}>{g.task.status}</span></div>
        {g.task.reason}
      </div>
      {g.dimensions.map((d) => (
        <div className="dim" key={d.id}>
          <div className="dim-head"><span>{d.label}</span><span>{d.score ?? "–"} / 6</span></div>
          {d.reason}
          {d.quote && <p className="quote">“{d.quote}”</p>}
        </div>
      ))}
      {g.revisions.map((r, i) => (
        <div className="dim" key={i}>
          <div className="dim-head"><span>Revise</span></div>
          <p className="quote">“{r.quote}”</p>
          <p style={{ margin: "8px 0 0" }}>{r.suggestion}</p>
        </div>
      ))}
    </section>
  );
}
