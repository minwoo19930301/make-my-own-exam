import { useEffect, useState } from "react";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { read, SETTINGS, write } from "./store.js";

export function SettingsDialog({ isOpen, onClose, health }) {
  const [s, setS] = useState({});
  useEffect(() => {
    if (isOpen) setS({ provider: "muse", model: health?.defaultModel || "muse-spark-1.3", ...read(SETTINGS, {}) });
  }, [isOpen, health]);
  const set = (k) => (e) => setS({ ...s, [k]: e.target.value });
  const save = () => { write(SETTINGS, { ...s, apiKey: (s.apiKey || "").trim(), customKey: (s.customKey || "").trim() }); onClose(); };
  const custom = s.provider === "custom";
  return (
    <Dialog isOpen={isOpen} onOpenChange={(o) => !o && onClose()} width={480} purpose="form">
      <DialogHeader title="Settings" onOpenChange={(o) => !o && onClose()} />
      <div style={{ display: "grid", gap: 10, padding: "12px 16px 16px" }}>
        <label className="sub" htmlFor="provider">Model provider</label>
        <select id="provider" className="select" value={s.provider || "muse"} onChange={set("provider")}>
          <option value="muse">Meta Muse (default)</option>
          <option value="custom">Another OpenAI-compatible API</option>
        </select>
        {!custom && (
          <>
            <p className="sub" style={{ margin: 0 }}>{health?.demoKey ? `Without a key you get ${health.dailyLimit} free model calls a day.` : "Add your key to build and score."}</p>
            <label className="sub" htmlFor="key">Meta Model API key (optional)</label>
            <input id="key" className="field" type="password" autoComplete="off" value={s.apiKey || ""} onChange={set("apiKey")} />
            <label className="sub" htmlFor="model">Model</label>
            <select id="model" className="select" value={s.model || ""} onChange={set("model")}>
              {(health?.models || ["muse-spark-1.3"]).map((m) => <option key={m}>{m}</option>)}
            </select>
          </>
        )}
        {custom && (
          <>
            <label className="sub" htmlFor="base">Base URL (ends before /chat/completions)</label>
            <input id="base" className="field" type="url" placeholder="https://api.example.com/v1" value={s.baseUrl || ""} onChange={set("baseUrl")} />
            <label className="sub" htmlFor="ckey">API key</label>
            <input id="ckey" className="field" type="password" autoComplete="off" value={s.customKey || ""} onChange={set("customKey")} />
            <label className="sub" htmlFor="cmodel">Model name</label>
            <input id="cmodel" className="field" value={s.customModel || ""} onChange={set("customModel")} />
          </>
        )}
        <p className="sub" style={{ margin: 0 }}>Keys stay in this browser and are sent only with your own requests.</p>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={save}>Save</button>
        </div>
      </div>
    </Dialog>
  );
}

export function HistoryDialog({ isOpen, onClose, exams, history, onPick }) {
  const rows = history.slice().reverse();
  return (
    <Dialog isOpen={isOpen} onOpenChange={(o) => !o && onClose()} width={560}>
      <DialogHeader title="History" onOpenChange={(o) => !o && onClose()} />
      <div style={{ padding: "8px 8px 16px" }}>
        {!rows.length && <p className="sub" style={{ padding: "0 8px" }}>No scored answers yet.</p>}
        <div className="list">
          {rows.map((h, i) => {
            const e = exams[h.examId];
            const q = e?.questions.find((x) => x.id === h.questionId);
            return q ? (
              <button type="button" className="list-row" key={i} onClick={() => onPick(h.examId, q.id)}>
                <span className="body"><p>{q.prompt}</p><span className="sub">{e.name} · {h.at.slice(0, 10)}</span></span>
                <span className="score">{h.score}/{h.max}</span>
              </button>
            ) : null;
          })}
        </div>
        <p className="sub" style={{ padding: "0 8px" }}>History lives only in this browser.</p>
      </div>
    </Dialog>
  );
}
