import { useEffect, useMemo, useState } from "react";
import { Spinner } from "@astryxdesign/core/Spinner";
import { useStored } from "./store.js";
import { nextTopics } from "./predict.js";
import { Write } from "./Write.jsx";
import { Topics } from "./Topics.jsx";
import { Insights } from "./Insights.jsx";
import { HistoryDialog, SettingsDialog } from "./Dialogs.jsx";

const TABS = [
  { value: "write", label: "Write" },
  { value: "topics", label: "Topics" },
  { value: "insights", label: "Insights" },
];

const Icon = ({ d }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;

export default function App() {
  const [kb, setKb] = useState(null);
  const [health, setHealth] = useState(null);
  const [history, setHistory] = useStored("sixpoint.history", []);
  const [topicId, setTopicId] = useStored("sixpoint.topic", "");
  const [tab, setTab] = useStored("sixpoint.view", "write");
  const [dialog, setDialog] = useState(null);

  useEffect(() => {
    fetch("/data/kb.json").then((r) => r.json()).then(setKb);
    fetch("/api/health").then((r) => r.json()).then(setHealth).catch(() => setHealth({ demoKey: false, models: ["muse-spark-1.3"], defaultModel: "muse-spark-1.3" }));
  }, []);

  const topic = useMemo(() => kb && (kb.topics.find((t) => t.id === topicId) || nextTopics(kb, history, 1)[0]?.topic || kb.topics[0]), [kb, topicId, history]);
  if (!kb || !topic) return <div className="wrap"><Spinner label="Loading topics" /></div>;

  const pick = (id) => { setTopicId(id); setTab("write"); window.scrollTo(0, 0); };
  const recommend = () => pick(nextTopics(kb, [...history, { topicId: topic.id, score: 0 }], 1)[0].topic.id);
  const view = TABS.some((t) => t.value === tab) ? tab : "write";

  return (
    <>
      <header className="topbar">
        <a className="logo" href="/" onClick={(e) => { e.preventDefault(); setTab("write"); }}>GRE Issue</a>
        <nav className="navtabs" aria-label="Sections">
          {TABS.map((t) => <button key={t.value} type="button" className={`navtab ${view === t.value ? "on" : ""}`} aria-current={view === t.value ? "page" : undefined} onClick={() => { setTab(t.value); window.scrollTo(0, 0); }}>{t.label}</button>)}
        </nav>
        <div className="topbar-end">
          <button type="button" className="round" aria-label="History" onClick={() => setDialog("history")}><Icon d="M12 8v4l3 2M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" /></button>
          <button type="button" className="round" aria-label="Settings" onClick={() => setDialog("settings")}><Icon d="M4 6h16M4 12h16M4 18h16" /></button>
        </div>
      </header>
      <main className="wrap">
        {view === "write" && <Write key={topic.id} kb={kb} topic={topic} onPick={pick} onRecommend={recommend} onScored={(row) => setHistory((h) => [...h, row])} />}
        {view === "topics" && <Topics kb={kb} history={history} onPick={pick} />}
        {view === "insights" && <Insights kb={kb} history={history} onPick={pick} />}
      </main>
      <footer className="foot">
        Topics are quoted from the <a href={kb.source.url} target="_blank" rel="noopener noreferrer">official GRE Issue topic pool</a> that ETS publishes for test preparation.
        GRE® and ETS® are registered trademarks of ETS. This app is not affiliated with or endorsed by ETS. Scores are practice estimates.
      </footer>
      <SettingsDialog isOpen={dialog === "settings"} onClose={() => setDialog(null)} health={health} />
      <HistoryDialog isOpen={dialog === "history"} onClose={() => setDialog(null)} kb={kb} history={history} onPick={(id) => { setDialog(null); pick(id); }} />
    </>
  );
}
