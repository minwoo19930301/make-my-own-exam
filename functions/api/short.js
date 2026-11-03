import { handle, resolveKey } from "../_lib/muse.js";
import { topicById } from "../_lib/kb.js";
import { checkShort } from "../_lib/drill.js";

export const onRequestPost = handle(async (body, { request, env }) => {
  const topic = topicById(body.topicId);
  const { apiKey } = await resolveKey(request, env, body);
  return checkShort({ topic, question: body.question, lookFor: body.lookFor, answer: body.answer, apiKey, model: body.model });
});
