import kb from "../../public/data/kb.json" with { type: "json" };
import { HttpError } from "./muse.js";

export function topicById(id) {
  const topic = kb.topics.find((t) => t.id === id);
  if (!topic) throw new HttpError(404, "Unknown topic.");
  return topic;
}

export { kb };
