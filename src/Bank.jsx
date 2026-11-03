import { useState } from "react";
import { ClickableCard } from "@astryxdesign/core/ClickableCard";
import { Selector } from "@astryxdesign/core/Selector";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { TopicTags } from "./Practice.jsx";

export function BankView({ kb, history, onPick }) {
  const [q, setQ] = useState("");
  const [concept, setConcept] = useState("");
  const [variant, setVariant] = useState("");
  const best = {};
  for (const h of history) best[h.topicId] = Math.max(best[h.topicId] ?? 0, h.score);
  const list = kb.topics.filter((t) => (!q || t.statement.toLowerCase().includes(q.toLowerCase())) && (!concept || t.concept === concept) && (!variant || t.variant === variant));
  return (
    <VStack gap={3}>
      <HStack gap={2} wrap="wrap">
        <TextInput label="Search" isLabelHidden placeholder="Search statements" value={q} onChange={setQ} />
        <Selector label="Concept" isLabelHidden placeholder="All concepts" hasClear options={kb.concepts.filter((c) => c.key !== "other").map((c) => ({ value: c.key, label: c.label }))} value={concept} onChange={(v) => setConcept(v || "")} />
        <Selector label="Task type" isLabelHidden placeholder="All task types" hasClear options={kb.variants.map((v) => ({ value: v.key, label: v.label }))} value={variant} onChange={(v) => setVariant(v || "")} />
      </HStack>
      <Text type="supporting">{list.length} of {kb.topics.length} topics</Text>
      {list.map((t) => (
        <ClickableCard key={t.id} label={`Open topic ${t.n}`} onClick={() => onPick(t.id)}>
          <VStack gap={2}>
            <TopicTags kb={kb} topic={t} />
            <Text as="p">{t.statement}</Text>
            {best[t.id] != null && <Text type="supporting">Best score {best[t.id]} / 6</Text>}
            {t.repeatOf && <Text type="supporting">Same statement as #{Number(t.repeatOf.slice(-3))}, with a different task</Text>}
          </VStack>
        </ClickableCard>
      ))}
    </VStack>
  );
}
