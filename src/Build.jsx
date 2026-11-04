import { useState } from "react";
import { AGENT_PROMPT, buildExam, finalize, importExam } from "./build.js";
import { providerLabel } from "./store.js";

export const GRE_EXAMPLE = "GRE Analytical Writing, the \"Analyze an Issue\" essay. I want to practice timed essays scored on the official 0-6 scale.";

const STATE = { run: "Working", done: "Done", fail: "Skipped" };

export function Build({ exams, exam, onSave, onOpen, onRemove, onPractice, health }) {
  const [prompt, setPrompt] = useState("");
  const [urls, setUrls] = useState([""]);
  const [ownLinks, setOwnLinks] = useState(false);
  const [steps, setSteps] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [agentOpen, setAgentOpen] = useState(false);
  const [paste, setPaste] = useState("");
  const list = Object.values(exams).sort((a, b) => String(b.builtAt).localeCompare(String(a.builtAt)));
  const clean = urls.map((u) => u.trim()).filter(Boolean);

  const run = async () => {
    setBusy(true); setErr(""); setSteps({});
    try {
      onSave(await buildExam({ prompt, urls: ownLinks ? clean : [] }, setSteps));
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  const loadSaved = async () => {
    setErr("");
    try {
      const e = await fetch("/data/example-gre.json").then((r) => r.json());
      onSave(finalize({ ...e, id: "example-gre", builtWith: "saved example" }));
    } catch { setErr("The saved example is not available."); }
  };
  const doImport = () => {
    setErr("");
    try { onSave(importExam(paste)); setPaste(""); setAgentOpen(false); } catch (e) { setErr(`Could not import: ${e.message}`); }
  };

  return (
    <>
      <section className="card hero">
        <h1 className="hero-title">Turn any public exam into a practice coach</h1>
        <p className="sub" style={{ margin: "6px 0 0" }}>
          1. Name the exam. Muse finds the official materials, then collects the questions, the scoring rules, and research by the test makers.
          2. Practice: it serves questions and scores your answers on that exam's own rubric.
        </p>
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Describe the exam</h2>
          <button type="button" className="btn btn-soft" disabled={busy} onClick={() => { setPrompt(GRE_EXAMPLE); setOwnLinks(false); }}>Try the GRE example</button>
        </div>
        <textarea className="field area" aria-label="Describe the exam" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Name the exam and what you want to practice. For example: GRE Analyze an Issue essays, scored 0-6. Or: AP World History long essay question." />
        {ownLinks && (
          <>
            <div className="sub" style={{ margin: "12px 0 6px" }}>Your links: official question pools, scoring guides, sample tests (web pages or PDFs)</div>
            <div className="links">
              {urls.map((u, i) => (
                <div className="row" key={i}>
                  <input className="field grow" type="url" inputMode="url" aria-label={`Link ${i + 1}`} placeholder="https://..." value={u} onChange={(e) => setUrls(urls.map((x, k) => (k === i ? e.target.value : x)))} />
                  {urls.length > 1 && <button type="button" className="btn btn-secondary" aria-label={`Remove link ${i + 1}`} onClick={() => setUrls(urls.filter((_, k) => k !== i))}>Remove</button>}
                </div>
              ))}
            </div>
          </>
        )}
        <div className="row" style={{ marginTop: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={() => setOwnLinks(!ownLinks)}>{ownLinks ? "Find sources for me" : "Use my own links"}</button>
          {ownLinks && <button type="button" className="btn btn-secondary" disabled={urls.length >= 8} onClick={() => setUrls([...urls, ""])}>Add link</button>}
          <span className="grow" />
          <span className="sub">Uses {providerLabel()}</span>
          <button type="button" className="btn btn-primary" disabled={busy || !prompt.trim() || (ownLinks && !clean.length)} onClick={run}>{busy ? "Building…" : "Build knowledge base"}</button>
        </div>
        {!health?.demoKey && <p className="sub">Add a Meta Model API key in Settings to build.</p>}
        {err && <p className="error">{err}</p>}
      </section>

      {Object.keys(steps).length > 0 && (
        <section className="card" aria-live="polite">
          <h2 className="card-title">Progress</h2>
          <div className="steps">
            {Object.entries(steps).map(([id, s]) => (
              <div className={`step ${s.state}`} key={id}>
                <span className="dot" aria-hidden="true" />
                <div><b>{s.label}</b><div className="sub">{STATE[s.state]}{s.detail ? ` · ${s.detail}` : ""}</div></div>
              </div>
            ))}
          </div>
          {busy && <p className="sub">Finding and reading the sources takes a few minutes. Keep this tab open.</p>}
          {err && <button type="button" className="btn btn-secondary" onClick={loadSaved}>Load the saved GRE result instead</button>}
        </section>
      )}

      {exam && <ExamSummary exam={exam} onPractice={onPractice} />}

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Build it with your own agent</h2>
          <button type="button" className="btn btn-secondary" onClick={() => setAgentOpen(!agentOpen)}>{agentOpen ? "Hide" : "Show"}</button>
        </div>
        <p className="sub" style={{ marginTop: 0 }}>Prefer an agent with web search or MCP tools? Give it this prompt, then paste the JSON it returns.</p>
        {agentOpen && (
          <>
            <pre className="code">{AGENT_PROMPT}{prompt || "<describe the exam>"}</pre>
            <div className="row">
              <button type="button" className="btn btn-secondary" onClick={() => navigator.clipboard?.writeText(AGENT_PROMPT + (prompt || ""))}>Copy prompt</button>
            </div>
            <textarea className="field area" aria-label="Paste knowledge base JSON" placeholder="Paste the JSON here" value={paste} onChange={(e) => setPaste(e.target.value)} style={{ marginTop: 8 }} />
            <div className="row" style={{ marginTop: 8 }}>
              <span className="grow" />
              <button type="button" className="btn btn-primary" disabled={!paste.trim()} onClick={doImport}>Import</button>
            </div>
          </>
        )}
      </section>

      {list.length > 0 && (
        <section className="card">
          <h2 className="card-title">Your exams</h2>
          <div className="list">
            {list.map((e) => (
              <div className={`list-row static ${exam?.id === e.id ? "on" : ""}`} key={e.id}>
                <span className="body"><p>{e.name}</p><span className="sub">{e.questions.length} questions · {e.concepts.length} concepts · {e.builtWith}</span></span>
                <button type="button" className="btn btn-secondary" onClick={() => onOpen(e.id)}>{exam?.id === e.id ? "Open" : "Switch"}</button>
                <button type="button" className="btn btn-secondary" onClick={() => {
                  const blob = new Blob([JSON.stringify(e, null, 1)], { type: "application/json" });
                  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `${e.id}.json` });
                  a.click(); URL.revokeObjectURL(a.href);
                }}>Export</button>
                <button type="button" className="btn btn-ghost" onClick={() => onRemove(e.id)}>Delete</button>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function ExamSummary({ exam, onPractice }) {
  const r = exam.rubric;
  return (
    <>
      <section className="card">
        <div className="card-head">
          <h2 className="card-title">{exam.name}</h2>
          <button type="button" className="btn btn-primary" disabled={!exam.questions.length && !exam.concepts.length} onClick={onPractice}>Start practicing</button>
        </div>
        <p style={{ marginTop: 0 }}>{exam.description}</p>
        <div className="stats">
          <div><b>{exam.questions.length}</b><span className="sub">questions</span></div>
          <div><b>{exam.concepts.length}</b><span className="sub">concepts</span></div>
          <div><b>{r.min}–{r.max}</b><span className="sub">score scale</span></div>
          <div><b>{exam.timeLimitMinutes ? `${exam.timeLimitMinutes} min` : "–"}</b><span className="sub">per answer</span></div>
        </div>
      </section>

      <section className="card">
        <div className="card-head"><h2 className="card-title">1 · Questions</h2><span className="sub">copied from the sources</span></div>
        <div className="bars">
          {exam.concepts.filter((c) => c.count).slice(0, 10).map((c) => (
            <div className="bar-row" key={c.key}><span>{c.label}</span><span className="sub">{c.count}</span><span className="track"><i style={{ width: `${(c.count / exam.concepts[0].count) * 100}%` }} /></span></div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-head"><h2 className="card-title">2 · Scoring rules</h2><span className={`badge ${r.fromSource ? "" : "gray"}`}>{r.fromSource ? "From the official guide, in our words" : "Derived, no official guide found"}</span></div>
        <div className="levels">
          {r.levels.map((l) => <div key={l.score} className="level"><b>{l.score}</b><span>{l.descriptor}</span></div>)}
        </div>
        <div className="sub" style={{ margin: "10px 0 4px" }}>Scored on</div>
        <div className="chips">{r.dimensions.map((d) => <span className="chip static" key={d.id} title={d.ask}>{d.label}</span>)}</div>
      </section>

      <section className="card">
        <div className="card-head"><h2 className="card-title">3 · Research behind the exam</h2></div>
        <p className="sub" style={{ marginTop: 0 }}>Papers and books by the test makers, or on how the exam is designed and scored. Muse finds them with web search, and each one is then looked up in Crossref. "Confirmed" entries have a matching DOI there.</p>
        <div className="list">
          {(exam.references || []).map((x, i) => (
            <div className="list-row static" key={i}>
              <span className="body">
                <p>{x.title}</p>
                <span className="sub">{[x.authors, x.year, x.venue || x.kind].filter(Boolean).join(" · ")}</span>
                <span className="sub">{x.why}</span>
              </span>
              {x.verified
                ? <a className="badge" href={x.url} target="_blank" rel="noopener noreferrer">Confirmed · DOI</a>
                : <a className="badge gray" href={x.url || `https://scholar.google.com/scholar?q=${encodeURIComponent(`${x.title} ${x.authors}`)}`} target="_blank" rel="noopener noreferrer">{x.url ? "Found by search · not in Crossref" : "Not confirmed · search"}</a>}
            </div>
          ))}
          {!(exam.references || []).length && <p className="sub">None found.</p>}
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">Sources</h2>
        <div className="list">
          {exam.sources.map((s) => <a className="list-row" key={s.url} href={s.url} target="_blank" rel="noopener noreferrer"><span className="body"><p>{s.title}</p><span className="sub">{s.url}</span></span></a>)}
        </div>
      </section>
    </>
  );
}
