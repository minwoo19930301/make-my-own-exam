import { useEffect, useRef, useState } from "react";
import { Card } from "@astryxdesign/core/Card";
import { Button } from "@astryxdesign/core/Button";
import { Badge } from "@astryxdesign/core/Badge";
import { Banner } from "@astryxdesign/core/Banner";
import { Blockquote } from "@astryxdesign/core/Blockquote";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { RadioList, RadioListItem } from "@astryxdesign/core/RadioList";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Divider } from "@astryxdesign/core/Divider";
import { api, read, useStored, write } from "./store.js";
import { TASK_DEMANDS } from "../functions/_lib/rubric.js";

export const conceptLabel = (kb, k) => kb.concepts.find((c) => c.key === k)?.label || k;
export const variantLabel = (kb, k) => kb.variants.find((v) => v.key === k)?.label || k;

export function TopicTags({ kb, topic }) {
  return (
    <HStack gap={1} wrap="wrap">
      <Badge label={`#${topic.n}`} />
      <Badge variant="blue" label={conceptLabel(kb, topic.concept)} />
      <Badge variant="purple" label={topic.variant} />
    </HStack>
  );
}

function BottomBar({ children }) {
  return <div className="bottom-bar"><HStack gap={2} vAlign="center" hAlign="between">{children}</HStack></div>;
}

export function PromptView({ kb, topic, setTab, onPrev, onNext }) {
  const siblings = kb.topics.filter((t) => t.id !== topic.id && (t.repeatOf || t.id) === (topic.repeatOf || topic.id));
  return (
    <VStack gap={4}>
      <Card>
        <VStack gap={3}>
          <TopicTags kb={kb} topic={topic} />
          <p className="prompt-text">{topic.statement}</p>
          <Text type="supporting" as="p">{topic.instructions}</Text>
        </VStack>
      </Card>
      <Banner status="info" title="What this task type demands" description={TASK_DEMANDS[topic.variant]} collapsible={false} />
      {siblings.length > 0 && (
        <Card variant="muted">
          <VStack gap={1}>
            <Text type="label">The same statement also appears with a different task</Text>
            {siblings.map((s) => <Text key={s.id} type="supporting">#{s.n} · {variantLabel(kb, s.variant)}</Text>)}
          </VStack>
        </Card>
      )}
      <BottomBar>
        <HStack gap={2}><Button label="Previous topic" variant="ghost" onClick={onPrev} /><Button label="Next topic" variant="ghost" onClick={onNext} /></HStack>
        <Button label="Start with multiple choice" variant="primary" onClick={() => setTab("mcq")} />
      </BottomBar>
    </VStack>
  );
}

// Drills are generated once per topic and kept in the browser.
function useDrill(topic) {
  const key = `sixpoint.drill.${topic.id}`;
  const [drill, setDrill] = useState(() => read(key, null));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const load = async (fresh = false) => {
    setLoading(true);
    setError("");
    try {
      const d = await api("/api/drill", { topicId: topic.id, fresh });
      write(key, d);
      setDrill(d);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { if (!drill) load(); }, [topic.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return { drill, error, loading, reload: () => load(true) };
}

function DrillState({ loading, error, reload }) {
  if (loading) return <Card><Spinner label="Muse is writing questions for this topic…" /></Card>;
  if (error) return <Banner status="error" title="Could not load questions" description={error} endContent={<Button label="Try again" size="sm" onClick={reload} />} />;
  return null;
}

export function McqView({ kb, topic, setTab }) {
  const { drill, error, loading, reload } = useDrill(topic);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState({});
  const [checked, setChecked] = useState({});
  if (!drill) return <DrillState loading={loading} error={error} reload={reload} />;
  const q = drill.mcq[i];
  const done = checked[i];
  const right = Number(picked[i]) === q.answer;
  const last = i === drill.mcq.length - 1;
  return (
    <VStack gap={4}>
      <HStack hAlign="between" vAlign="center">
        <Text type="supporting">Question {i + 1} / {drill.mcq.length}</Text>
        <Button label="New questions" size="sm" variant="ghost" onClick={() => { setPicked({}); setChecked({}); setI(0); reload(); }} />
      </HStack>
      <Card>
        <VStack gap={3}>
          <Text type="supporting">{topic.statement}</Text>
          <Heading level={3}>{q.question}</Heading>
          <RadioList label="Answer choices" isLabelHidden value={picked[i] ?? ""} onChange={(v) => !done && setPicked({ ...picked, [i]: v })}>
            {q.options.map((o, j) => (
              <div key={j} className={done ? (j === q.answer ? "option-right" : String(j) === picked[i] ? "option-wrong" : "") : ""}>
                <RadioListItem value={String(j)} label={o} />
              </div>
            ))}
          </RadioList>
          {done && <Banner status={right ? "success" : "warning"} title={right ? "Correct" : `Answer: ${String.fromCharCode(65 + q.answer)}`} description={q.why} collapsible={false} />}
        </VStack>
      </Card>
      <BottomBar>
        <HStack gap={2}>
          <Button label="Previous" variant="ghost" isDisabled={i === 0} onClick={() => setI(i - 1)} />
          <Button label="Next" variant="ghost" isDisabled={last} onClick={() => setI(i + 1)} />
        </HStack>
        {done
          ? <Button label={last ? "Go to short answer" : "Next question"} variant="primary" onClick={() => (last ? setTab("short") : setI(i + 1))} />
          : <Button label="Check" variant="primary" isDisabled={picked[i] == null} onClick={() => setChecked({ ...checked, [i]: true })} />}
      </BottomBar>
    </VStack>
  );
}

export function ShortView({ topic, setTab }) {
  const { drill, error, loading, reload } = useDrill(topic);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useStored(`sixpoint.short.${topic.id}`, {});
  const [results, setResults] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!drill) return <DrillState loading={loading} error={error} reload={reload} />;
  const q = drill.short[i];
  const r = results[i];
  const last = i === drill.short.length - 1;
  const check = async () => {
    setBusy(true);
    setErr("");
    try {
      const res = await api("/api/short", { topicId: topic.id, question: q.question, lookFor: q.lookFor, answer: answers[i] || "" });
      setResults({ ...results, [i]: res });
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <VStack gap={4}>
      <Text type="supporting">Question {i + 1} / {drill.short.length}</Text>
      <Card>
        <VStack gap={3}>
          <Text type="supporting">{topic.statement}</Text>
          <Heading level={3}>{q.question}</Heading>
          <TextArea label="Your answer" isLabelHidden placeholder="1-3 sentences" value={answers[i] || ""} onChange={(v) => setAnswers({ ...answers, [i]: v })} rows={4} />
          {err && <Banner status="error" title="Could not check" description={err} collapsible={false} />}
          {r && (
            <VStack gap={2}>
              <HStack gap={2} vAlign="center"><Badge variant={r.score === 2 ? "green" : r.score === 1 ? "yellow" : "red"} label={`${r.score} / 2`} /><Text>{r.feedback}</Text></HStack>
              <Blockquote cite="Model answer">{r.better}</Blockquote>
            </VStack>
          )}
        </VStack>
      </Card>
      <BottomBar>
        <HStack gap={2}>
          <Button label="Previous" variant="ghost" isDisabled={i === 0} onClick={() => setI(i - 1)} />
          <Button label="Next" variant="ghost" isDisabled={last} onClick={() => setI(i + 1)} />
        </HStack>
        {r
          ? <Button label={last ? "Write the essay" : "Next question"} variant="primary" onClick={() => (last ? setTab("essay") : setI(i + 1))} />
          : <Button label="Check with Muse" variant="primary" isLoading={busy} isDisabled={!(answers[i] || "").trim()} onClick={check} />}
      </BottomBar>
    </VStack>
  );
}

const fmt = (ms) => `${String(Math.floor(ms / 60000)).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

export function EssayView({ kb, topic, onScored }) {
  const [essay, setEssay] = useStored(`sixpoint.draft.${topic.id}`, "");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [end, setEnd] = useState(null);
  const [now, setNow] = useState(Date.now());
  const tick = useRef();
  useEffect(() => {
    if (!end) return undefined;
    tick.current = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(tick.current);
  }, [end]);
  const words = (essay.trim().match(/\S+/g) || []).length;
  const left = end ? Math.max(0, end - now) : 30 * 60 * 1000;
  const score = async () => {
    setBusy(true);
    setErr("");
    try {
      const g = await api("/api/grade", { topicId: topic.id, essay });
      setResult(g);
      onScored({ topicId: topic.id, score: g.score, dimensions: g.dimensions, task: g.task.status, at: new Date().toISOString() });
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <VStack gap={4}>
      <Card>
        <VStack gap={3}>
          <TopicTags kb={kb} topic={topic} />
          <p className="prompt-text">{topic.statement}</p>
          <Text type="supporting" as="p">{topic.instructions}</Text>
          <div className="essay-box">
            <TextArea label="Your essay" isLabelHidden placeholder="Take a clear position, develop it with specific reasons and examples, and answer the task's specific demand." value={essay} onChange={setEssay} rows={16} />
          </div>
          <HStack hAlign="between"><Text type="supporting">{words} words</Text><Text type="supporting"><span className="timer">{fmt(left)}</span></Text></HStack>
          {err && <Banner status="error" title="Could not score" description={err} collapsible={false} />}
        </VStack>
      </Card>
      {result && <ResultCard result={result} />}
      <BottomBar>
        <Button label={end ? "Restart 30-minute timer" : "Start 30-minute timer"} variant="ghost" onClick={() => { setEnd(Date.now() + 30 * 60 * 1000); setNow(Date.now()); }} />
        <Button label="Score with Muse" variant="primary" isLoading={busy} isDisabled={words < 30} onClick={score} />
      </BottomBar>
    </VStack>
  );
}

const TASK_STATUS = { met: "success", partly: "warning", missed: "error" };

function ResultCard({ result: g }) {
  return (
    <Card>
      <VStack gap={3}>
        <HStack gap={2} vAlign="end"><Heading type="display-2">{g.score}</Heading><Text type="supporting">/ 6 practice estimate</Text></HStack>
        <Text as="p">{g.summary}</Text>
        <Banner status={TASK_STATUS[g.task.status]} title={`Task demand ${g.task.status}`} description={g.task.reason} collapsible={false} />
        {g.dimensions.map((d) => (
          <VStack key={d.id} gap={1}>
            <Divider />
            <HStack hAlign="between"><Text weight="semibold">{d.label}</Text><Badge label={`${d.score ?? "–"} / 6`} /></HStack>
            <Text as="p">{d.reason}</Text>
            {d.quote && <Blockquote>{d.quote}</Blockquote>}
          </VStack>
        ))}
        {g.revisions.length > 0 && (
          <VStack gap={2}>
            <Divider />
            <Heading level={4}>Revise these lines</Heading>
            {g.revisions.map((r, i) => (
              <VStack key={i} gap={1}><Blockquote>{r.quote}</Blockquote><Text as="p">→ {r.suggestion}</Text></VStack>
            ))}
          </VStack>
        )}
      </VStack>
    </Card>
  );
}
