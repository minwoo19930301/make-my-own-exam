import { useEffect, useState } from "react";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Button } from "@astryxdesign/core/Button";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Selector } from "@astryxdesign/core/Selector";
import { Text } from "@astryxdesign/core/Text";
import { ClickableCard } from "@astryxdesign/core/ClickableCard";
import { HStack } from "@astryxdesign/core/HStack";
import { VStack } from "@astryxdesign/core/VStack";
import { Badge } from "@astryxdesign/core/Badge";
import { read, write } from "./store.js";

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
      <DialogHeader title="Settings" />
      <VStack gap={3}>
        <Text type="supporting" as="p">
          Sixpoint calls the Meta Model API. {health?.demoKey ? `Without a key you get ${health.dailyLimit} free calls a day.` : "Add your key to use Muse."} Your key stays in this browser and is sent only with your own requests.
        </Text>
        <TextInput label="Meta Model API key" type="password" value={apiKey} onChange={setApiKey} isOptional={Boolean(health?.demoKey)} />
        <Selector label="Model" options={health?.models || ["muse-spark-1.3"]} value={model} onChange={(v) => v && setModel(v)} />
        <HStack gap={2} hAlign="end"><Button label="Close" variant="ghost" onClick={onClose} /><Button label="Save" variant="primary" onClick={save} /></HStack>
      </VStack>
    </Dialog>
  );
}

export function HistoryDialog({ isOpen, onClose, kb, history, onPick }) {
  const rows = history.slice().reverse();
  return (
    <Dialog isOpen={isOpen} onOpenChange={(o) => !o && onClose()} width={560}>
      <DialogHeader title="History" />
      <VStack gap={2}>
        {!rows.length && <Text type="supporting">No scored essays yet.</Text>}
        {rows.map((h, i) => {
          const t = kb.topics.find((x) => x.id === h.topicId);
          return (
            <ClickableCard key={i} label={`Open topic ${t?.n}`} onClick={() => onPick(h.topicId)}>
              <HStack gap={2} vAlign="center" hAlign="between">
                <VStack gap={0.5}>
                  <Text maxLines={1}>#{t?.n} {t?.statement}</Text>
                  <Text type="supporting">{h.at.slice(0, 10)} · task {h.task}</Text>
                </VStack>
                <Badge label={`${h.score} / 6`} />
              </HStack>
            </ClickableCard>
          );
        })}
        <Text type="supporting">History lives only in this browser.</Text>
      </VStack>
    </Dialog>
  );
}
