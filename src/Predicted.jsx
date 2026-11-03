import { ClickableCard } from "@astryxdesign/core/ClickableCard";
import { Card } from "@astryxdesign/core/Card";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { VStack } from "@astryxdesign/core/VStack";
import { coveragePlan, nextTopics, readiness, weakestDimension } from "./predict.js";
import { TopicTags, conceptLabel } from "./Practice.jsx";

const pct = (x) => `${Math.round(x * 100)}%`;

function TopicPick({ kb, topic, note, onPick }) {
  return (
    <ClickableCard label={`Open topic ${topic.n}`} onClick={() => onPick(topic.id)}>
      <VStack gap={2}>
        <TopicTags kb={kb} topic={topic} />
        <Text as="p">{topic.statement}</Text>
        {note && <Text type="supporting">{note}</Text>}
      </VStack>
    </ClickableCard>
  );
}

export function PredictedView({ kb, history, onPick }) {
  const next = nextTopics(kb, history, 3);
  const plan = coveragePlan(kb);
  const ready = readiness(kb, history);
  const weak = weakestDimension(history);
  const max = kb.stats.concepts[0].count;
  return (
    <VStack gap={5}>
      <VStack gap={2}>
        <Heading level={3}>Write these next</Heading>
        <Text type="supporting" as="p">
          The pool is public, so no one can predict your exact topic. Sixpoint ranks what to practice instead: concepts the pool keeps returning to,
          weighted toward the task types and concepts you have scored lowest on{weak ? `. Your weakest dimension so far is ${weak.label.toLowerCase()} (${weak.avg.toFixed(1)} / 6)` : ""}.
        </Text>
        {next.map((r) => <TopicPick key={r.topic.id} kb={kb} topic={r.topic} note={r.reasons.join(" · ")} onPick={onPick} />)}
      </VStack>
      <Card>
        <VStack gap={2}>
          <Heading level={4}>Pool readiness</Heading>
          <ProgressBar label="Share of the pool in concepts you have written a 4+ on" value={Math.round(ready.share * 100)} hasValueLabel />
        </VStack>
      </Card>
      <VStack gap={2}>
        <Heading level={3}>Where the pool's weight sits</Heading>
        <Text type="supporting" as="p">{kb.stats.total} topics, {kb.stats.uniqueStatements} distinct statements, {kb.stats.concepts.length} recurring concepts.</Text>
        <Card>
          <VStack gap={2}>
            {kb.stats.concepts.map((c) => (
              <ProgressBar key={c.concept} label={`${conceptLabel(kb, c.concept)} · ${c.count} topics`} value={c.count} max={max} variant="neutral" />
            ))}
          </VStack>
        </Card>
      </VStack>
      <VStack gap={2}>
        <Heading level={3}>Smallest set that covers the pool</Heading>
        <Text type="supporting" as="p">{plan.topics.length} essays, one per concept, cover {pct(plan.poolShare)} of the pool by concept and {plan.variantsCovered} of 6 task types.</Text>
        {plan.topics.map((t) => <TopicPick key={t.id} kb={kb} topic={t} onPick={onPick} />)}
      </VStack>
    </VStack>
  );
}
