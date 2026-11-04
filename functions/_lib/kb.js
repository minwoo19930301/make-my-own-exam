import kb from "../../public/data/kb.json" with { type: "json" };
import { HttpError } from "./muse.js";

export function topicById(id) {
  const topic = kb.topics.find((t) => t.id === id);
  if (!topic) throw new HttpError(404, "Unknown topic.");
  return topic;
}

// A statement outside the pool (for example a retired practice-test topic) is graded as the standard statement task.
export function topicFor(body) {
  if (body.topicId) return topicById(body.topicId);
  const statement = String(body.statement || "").trim();
  if (!statement || statement.length > 400) throw new HttpError(400, "Give a topicId or a statement of up to 400 characters.");
  const base = kb.topics.find((t) => t.variant === "statement");
  return { id: "custom", statement, variant: "statement", instructions: base.instructions };
}

export { kb };
