import { useEffect, useState } from "react";
import { Spinner } from "@astryxdesign/core/Spinner";
import { useStored } from "./store.js";
import { Feed } from "./Feed.jsx";
import { Write } from "./Write.jsx";
import { HistoryDialog, SettingsDialog } from "./Dialogs.jsx";

const useHash = () => {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const on = () => { setHash(location.hash); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return hash;
};

const Icon = ({ d }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;

export default function App() {
  const [kb, setKb] = useState(null);
  const [health, setHealth] = useState(null);
  const [history, setHistory] = useStored("sixpoint.history", []);
  const [dialog, setDialog] = useState(null);
  const hash = useHash();

  useEffect(() => {
    fetch("/data/kb.json").then((r) => r.json()).then(setKb);
    fetch("/api/health").then((r) => r.json()).then(setHealth).catch(() => setHealth({ demoKey: false, models: ["muse-spark-1.3"], defaultModel: "muse-spark-1.3" }));
  }, []);

  if (!kb) return <div className="shell" style={{ padding: 40 }}><Spinner label="Loading topics" /></div>;

  const writing = hash.startsWith("#/write/") ? kb.topics.find((t) => t.id === hash.slice(8)) : null;
  const open = (id) => { location.hash = `#/write/${id}`; };

  return (
    <>
      <header className="bar">
        {writing
          ? <a className="back" href="#/"><Icon d="M15 18l-6-6 6-6" />Topics</a>
          : <a className="wordmark" href="#/">GRE <span>Issue</span></a>}
        <div className="bar-actions">
          <button type="button" className="icon-btn" aria-label="History" onClick={() => setDialog("history")}><Icon d="M12 8v4l3 2M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" /></button>
          <button type="button" className="icon-btn" aria-label="Settings" onClick={() => setDialog("settings")}><Icon d="M4 6h16M4 12h16M4 18h16" /></button>
        </div>
      </header>
      <main className="shell">
        {writing
          ? <Write key={writing.id} kb={kb} topic={writing} onScored={(row) => setHistory((h) => [...h, row])} />
          : <Feed kb={kb} history={history} onOpen={open} />}
      </main>
      {!writing && (
        <footer className="foot">
          Topics are quoted from the <a href={kb.source.url} target="_blank" rel="noopener noreferrer">official GRE Issue topic pool</a> that ETS publishes for test preparation.
          GRE® and ETS® are registered trademarks of ETS. This app is not affiliated with or endorsed by ETS. Scores are practice estimates.
        </footer>
      )}
      <SettingsDialog isOpen={dialog === "settings"} onClose={() => setDialog(null)} health={health} />
      <HistoryDialog isOpen={dialog === "history"} onClose={() => setDialog(null)} kb={kb} history={history} onPick={(id) => { setDialog(null); open(id); }} />
    </>
  );
}
