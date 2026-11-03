import { useEffect, useMemo, useState } from "react";
import { TopNav } from "@astryxdesign/core/TopNav";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Selector } from "@astryxdesign/core/Selector";
import { TabList, Tab } from "@astryxdesign/core/TabList";
import { Text } from "@astryxdesign/core/Text";
import { Heading } from "@astryxdesign/core/Heading";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Link } from "@astryxdesign/core/Link";
import { useStored } from "./store.js";
import { nextTopics } from "./predict.js";
import { PromptView, McqView, ShortView, EssayView } from "./Practice.jsx";
import { BankView } from "./Bank.jsx";
import { PredictedView } from "./Predicted.jsx";
import { HistoryDialog, SettingsDialog } from "./Dialogs.jsx";

const TABS = [
  { value: "prompt", label: "Prompt" },
  { value: "mcq", label: "Multiple choice" },
  { value: "short", label: "Short answer" },
  { value: "essay", label: "Essay" },
  { value: "bank", label: "Topic bank" },
  { value: "predicted", label: "Predicted" },
];

export default function App() {
  const [kb, setKb] = useState(null);
  const [health, setHealth] = useState(null);
  const [topicId, setTopicId] = useStored("sixpoint.topic", "");
  const [tab, setTab] = useStored("sixpoint.tab", "prompt");
  const [history, setHistory] = useStored("sixpoint.history", []);
  const [dialog, setDialog] = useState(null);

  useEffect(() => {
    fetch("/data/kb.json").then((r) => r.json()).then(setKb);
    fetch("/api/health").then((r) => r.json()).then(setHealth).catch(() => setHealth({ demoKey: false, models: ["muse-spark-1.3"], defaultModel: "muse-spark-1.3" }));
  }, []);

  const topic = useMemo(() => {
    if (!kb) return null;
    return kb.topics.find((t) => t.id === topicId) || nextTopics(kb, history, 1)[0]?.topic || kb.topics[0];
  }, [kb, topicId, history]);

  if (!kb || !topic) return <div className="page"><Spinner label="Loading topics" /></div>;

  const options = kb.topics.map((t) => ({ value: t.id, label: `#${t.n} ${t.statement.length > 90 ? `${t.statement.slice(0, 90)}…` : t.statement}` }));
  const choose = (id, nextTab) => { setTopicId(id); if (nextTab) setTab(nextTab); window.scrollTo(0, 0); };
  const step = (d) => {
    const i = kb.topics.findIndex((t) => t.id === topic.id);
    choose(kb.topics[(i + d + kb.topics.length) % kb.topics.length].id);
  };
  const recommend = () => choose(nextTopics(kb, history.filter((h) => h.topicId !== topic.id).concat({ topicId: topic.id, score: 0 }), 1)[0].topic.id, "prompt");
  const addResult = (row) => setHistory((h) => [...h, row]);

  const shared = { kb, topic, history, onNext: () => step(1), onPrev: () => step(-1), setTab };

  return (
    <>
      <TopNav
        heading={<Heading level={4}>Sixpoint</Heading>}
        endContent={<HStack gap={1}>
          <Button label="History" variant="ghost" size="sm" onClick={() => setDialog("history")} />
          <Button label="Settings" variant="ghost" size="sm" onClick={() => setDialog("settings")} />
        </HStack>}
      />
      <div className="page">
        <VStack gap={4}>
          <Card>
            <VStack gap={2}>
              <Text type="label">GRE Analytical Writing · Analyze an Issue</Text>
              <Selector label="Topic" isLabelHidden hasSearch searchPlaceholder="Search the 159 official topics" options={options} value={topic.id} onChange={(v) => v && choose(v)} />
              <HStack gap={2} vAlign="center" wrap="wrap">
                <Text type="supporting">{kb.stats.total} official topics · Muse writes the drills and scores the essay.</Text>
                <Button label="Recommend a topic for me" size="sm" variant="secondary" onClick={recommend} />
              </HStack>
            </VStack>
          </Card>
          <TabList value={tab} onChange={setTab} hasDivider>
            {TABS.map((t) => <Tab key={t.value} value={t.value} label={t.label} />)}
          </TabList>
          <div className="column">
            {tab === "prompt" && <PromptView {...shared} />}
            {tab === "mcq" && <McqView key={topic.id} {...shared} />}
            {tab === "short" && <ShortView key={topic.id} {...shared} />}
            {tab === "essay" && <EssayView key={topic.id} {...shared} onScored={addResult} />}
            {tab === "bank" && <BankView {...shared} onPick={(id) => choose(id, "prompt")} />}
            {tab === "predicted" && <PredictedView {...shared} onPick={(id) => choose(id, "prompt")} />}
          </div>
        </VStack>
      </div>
      <div className="foot">
        <Text type="supporting">
          Topics are quoted from the <Link href={kb.source.url} isExternalLink>official GRE Issue topic pool</Link> that ETS publishes for test preparation.
          GRE® and ETS® are registered trademarks of ETS. Sixpoint is not affiliated with or endorsed by ETS. Scores are practice estimates.
        </Text>
      </div>
      <SettingsDialog isOpen={dialog === "settings"} onClose={() => setDialog(null)} health={health} />
      <HistoryDialog isOpen={dialog === "history"} onClose={() => setDialog(null)} kb={kb} history={history} onPick={(id) => { setDialog(null); choose(id, "essay"); }} />
    </>
  );
}
