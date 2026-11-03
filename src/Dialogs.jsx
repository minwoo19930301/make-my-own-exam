import { useEffect, useState } from "react";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { read, write } from "./store.js";
import { TopicRow } from "./Topics.jsx";

export function SettingsDialog({ isOpen, onClose, health }) {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  useEffect(() => {
    if (!isOpen) return;
    const s = read("sixpoint.settings", {});
    setApiKey(s.apiKey || "");
    setModel(s.model || health?.defaultModel || "muse-spark-1.3");
  }, [isOpen, health]);
  const save = () => { write("sixpoint.settings", { apiKey: apiKey.trim(), model }); onClose(); };
  return (
    <Dialog isOpen={isOpen} onOpenChange={(o) => !o && onClose()} width={460} purpose="form">
      <DialogHeader title="Settings" onOpenChange={(o) => !o && onClose()} />
      <div style={{ display: "grid", gap: 12, padding: "12px 16px 16px" }}>
        <p className="sub" style={{ margin: 0 }}>
          Scoring uses the Meta Model API. {health?.demoKey ? `Without a key you get ${health.dailyLimit} free scores a day.` : "Add your key to score essays."} Your key stays in this browser and is sent only with your own requests.
        </p>
        <label className="sub" htmlFor="key">Meta Model API key</label>
        <input id="key" className="field" type="password" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
        <label className="sub" htmlFor="model">Model</label>
        <select id="model" className="select" value={model} onChange={(e) => setModel(e.target.value)}>
          {(health?.models || ["muse-spark-1.3"]).map((m) => <option key={m}>{m}</option>)}
        </select>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={save}>Save</button>
        </div>
      </div>
    </Dialog>
  );
}

export function HistoryDialog({ isOpen, onClose, kb, history, onPick }) {
  const rows = history.slice().reverse();
  return (
    <Dialog isOpen={isOpen} onOpenChange={(o) => !o && onClose()} width={560}>
      <DialogHeader title="History" onOpenChange={(o) => !o && onClose()} />
      <div style={{ padding: "8px 8px 16px" }}>
        {!rows.length && <p className="sub" style={{ padding: "0 8px" }}>No scored essays yet.</p>}
        <div className="list">
          {rows.map((h, i) => {
            const t = kb.topics.find((x) => x.id === h.topicId);
            return t ? <TopicRow key={i} kb={kb} topic={t} best={h.score} note={`${h.at.slice(0, 10)} · task ${h.task}`} onPick={onPick} /> : null;
          })}
        </div>
        <p className="sub" style={{ padding: "0 8px" }}>History lives only in this browser.</p>
      </div>
    </Dialog>
  );
}
