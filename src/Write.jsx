import { useEffect, useState } from "react";
import { TextArea } from "@astryxdesign/core/TextArea";
import { api, useStored } from "./store.js";
import { TASK_DEMANDS } from "../functions/_lib/rubric.js";
import { VARIANT_SHORT, conceptLabel, gradient, initials } from "./look.js";

const fmt = (ms) => `${String(Math.floor(ms / 60000)).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

export function Write({ kb, topic, onScored }) {
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
  const label = conceptLabel(kb, topic.concept);

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
      <article className="post" style={{ borderBottom: 0 }}>
        <div className="post-head">
          <span className="avatar" style={{ background: gradient(kb, topic.concept) }}>{initials(label)}</span>
          <div className="who"><b>{label}</b><span>{VARIANT_SHORT[topic.variant]}</span></div>
          <span className="num">#{topic.n}</span>
        </div>
        <div className="panel compact" style={{ background: gradient(kb, topic.concept) }}>{topic.statement}</div>
      </article>
      <div className="writer">
        <p className="caption" style={{ padding: 0 }}>{topic.instructions}</p>
        <div className="task-note"><b>What this task type demands</b>{TASK_DEMANDS[topic.variant]}</div>
        <TextArea label="Your essay" isLabelHidden rows={16} value={essay} onChange={setEssay}
          placeholder="Take a clear position. Develop it with specific reasons and examples. Answer the task's specific demand." />
        {err && <p className="err">{err}</p>}
        {result && <Result g={result} />}
      </div>
      <div className="dock"><div>
        <span className="meta">{words} words · {fmt(left)}</span>
        <button type="button" className="ghost-btn" onClick={() => { setEnd(Date.now() + 30 * 60 * 1000); setNow(Date.now()); }}>{end ? "Restart" : "Start 30:00"}</button>
        <button type="button" className="write-btn" disabled={busy || words < 30} onClick={score}>{busy ? "Scoring…" : "Score"}</button>
      </div></div>
    </>
  );
}

function Result({ g }) {
  return (
    <section className="result" id="result" aria-label="Score">
      <div className="result-top">
        <div className="score-ring"><div>{g.score}</div></div>
        <p>{g.summary}<br /><span className="muted">Practice estimate on the 0-6 scale.</span></p>
      </div>
      <div className="result-row">
        <div className="head"><span>Task demand</span><span className={`status-${g.task.status}`}>{g.task.status}</span></div>
        {g.task.reason}
      </div>
      {g.dimensions.map((d) => (
        <div className="result-row" key={d.id}>
          <div className="head"><span>{d.label}</span><span>{d.score ?? "–"} / 6</span></div>
          {d.reason}
          {d.quote && <blockquote>“{d.quote}”</blockquote>}
        </div>
      ))}
      {g.revisions.map((r, i) => (
        <div className="result-row" key={i}>
          <div className="head"><span>Revise</span></div>
          <blockquote>“{r.quote}”</blockquote>
          <p style={{ margin: "8px 0 0" }}>{r.suggestion}</p>
        </div>
      ))}
    </section>
  );
}
