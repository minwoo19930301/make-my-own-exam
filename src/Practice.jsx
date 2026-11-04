import { useEffect, useState } from "react";
import { api, useStored } from "./store.js";
import { finalize, generateQuestion } from "./build.js";
import { nextQuestions } from "./plan.js";

const fmt = (ms) => `${String(Math.floor(ms / 60000)).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
const TYPE = { essay: "Essay", short: "Short answer", mc: "Multiple choice" };
const label = (exam, key) => exam.concepts.find((c) => c.key === key)?.label || key;

export function Practice({ exam, questionId, history, onPick, onSaveExam, onScored }) {
  const qs = exam.questions;
  const question = qs.find((q) => q.id === questionId) || nextQuestions(exam, history, 1)[0]?.question || qs[0];
  const [genBusy, setGenBusy] = useState(false);
  const [err, setErr] = useState("");
  const i = qs.findIndex((q) => q.id === question?.id);
  const step = (d) => onPick(qs[(i + d + qs.length) % qs.length].id);
  const recommend = () => {
    const r = nextQuestions(exam, [...history, { questionId: question?.id, score: 0, min: 0, max: 1 }], 1)[0];
    if (r) onPick(r.question.id);
  };
  const newOne = async () => {
    setGenBusy(true); setErr("");
    try {
      const q = await generateQuestion(exam, question?.concept || exam.concepts[0].key);
      onSaveExam(finalize({ ...exam, questions: [...qs, q] }));
      onPick(q.id);
    } catch (e) { setErr(e.message); } finally { setGenBusy(false); }
  };

  return (
    <>
      <section className="card">
        <label className="sub" htmlFor="question">{exam.name}</label>
        {qs.length > 0 && (
          <select id="question" className="select" value={question?.id} onChange={(e) => onPick(e.target.value)} style={{ marginTop: 6 }}>
            {qs.map((q) => <option key={q.id} value={q.id}>#{q.n}{q.generated ? " (new)" : ""} {q.prompt.length > 80 ? `${q.prompt.slice(0, 80)}…` : q.prompt}</option>)}
          </select>
        )}
        <div className="row" style={{ marginTop: 8 }}>
          <button type="button" className="btn btn-secondary" disabled={!qs.length} onClick={() => step(-1)}>Previous</button>
          <button type="button" className="btn btn-secondary" disabled={!qs.length} onClick={() => step(1)}>Next</button>
          <span className="grow" />
          <button type="button" className="btn btn-secondary" disabled={genBusy} onClick={newOne}>{genBusy ? "Writing…" : "New question like this"}</button>
          <button type="button" className="btn btn-soft" disabled={!qs.length} onClick={recommend}>Recommend for me</button>
        </div>
        {err && <p className="error">{err}</p>}
      </section>
      {question ? <Answer key={question.id} exam={exam} question={question} onScored={onScored} /> : <section className="card"><p className="sub">No questions yet. Use "New question like this" to write one in the exam's style.</p></section>}
    </>
  );
}

function Answer({ exam, question, onScored }) {
  const [answer, setAnswer] = useStored(`mmoe.draft.${exam.id}.${question.id}`, "");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [end, setEnd] = useState(null);
  const [now, setNow] = useState(Date.now());
  const minutes = exam.timeLimitMinutes || 30;
  useEffect(() => {
    if (!end) return undefined;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [end]);
  const words = (answer.trim().match(/\S+/g) || []).length;
  const left = end ? Math.max(0, end - now) : minutes * 60000;
  const mc = question.type === "mc";

  const score = async () => {
    setBusy(true); setErr("");
    try {
      let g;
      if (mc && question.answer) {
        const right = answer.trim().toLowerCase() === question.answer.trim().toLowerCase() || question.answer.trim().toLowerCase().startsWith(answer.trim().toLowerCase().slice(0, 2));
        g = { score: right ? 1 : 0, min: 0, max: 1, summary: right ? "Correct." : `The answer is ${question.answer}.`, dimensions: [], task: { status: right ? "met" : "missed", reason: "" }, revisions: [] };
      } else {
        g = await api("/api/grade", { exam: exam.name, question, rubric: exam.rubric, answer });
      }
      setResult(g);
      onScored({ questionId: question.id, score: g.score, min: g.min, max: g.max, dimensions: g.dimensions, task: g.task.status, at: new Date().toISOString() });
      setTimeout(() => document.getElementById("result")?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <>
      <section className="card">
        <div className="row">
          <span className="badge">{label(exam, question.concept)}</span>
          <span className="badge gray">{TYPE[question.type]}</span>
          {question.generated && <span className="badge gray">Written by the model</span>}
          <span className="grow" />
          <span className="sub">#{question.n} of {exam.questions.length}</span>
        </div>
        <p className="prompt">{question.prompt}</p>
        {question.instructions && <p className="instructions">{question.instructions}</p>}
        {question.source && <p className="sub" style={{ margin: 0 }}>From <a href={question.source} target="_blank" rel="noopener noreferrer">{question.source}</a></p>}
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Your answer</h2>
          {!mc && <span className="meta">{words} words · {fmt(left)}</span>}
        </div>
        {mc ? (
          <div className="choices" role="radiogroup" aria-label="Choices">
            {question.choices.map((c, k) => (
              <label key={k} className={`choice ${answer === c ? "on" : ""}`}><input type="radio" name="mc" checked={answer === c} onChange={() => setAnswer(c)} />{c}</label>
            ))}
          </div>
        ) : (
          <textarea className={`essay ${question.type === "short" ? "short" : ""}`} aria-label="Your answer" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Answer the question as you would on the real exam." />
        )}
        {err && <p className="error">{err}</p>}
        <div className="row" style={{ marginTop: 8 }}>
          {!mc && <button type="button" className="btn btn-secondary" onClick={() => { setEnd(Date.now() + minutes * 60000); setNow(Date.now()); }}>{end ? "Restart timer" : `Start ${minutes}-minute timer`}</button>}
          <span className="grow" />
          <button type="button" className="btn btn-primary" disabled={busy || (mc ? !answer : words < 5)} onClick={score}>{busy ? "Scoring…" : "Score my answer"}</button>
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
        <div><h2 className="card-title">Practice score {g.score} / {g.max}</h2><p style={{ margin: "4px 0 0" }}>{g.summary}</p></div>
      </div>
      {g.task.reason && (
        <div className="dim" style={{ marginTop: 12 }}>
          <div className="dim-head"><span>Answers this question</span><span className={g.task.status}>{g.task.status}</span></div>
          {g.task.reason}
        </div>
      )}
      {g.dimensions.map((d) => (
        <div className="dim" key={d.id}>
          <div className="dim-head"><span>{d.label}</span><span>{d.score ?? "–"} / {g.max}</span></div>
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
