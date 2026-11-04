import { handle, resolveKey } from "../_lib/muse.js";
import { topicFor } from "../_lib/kb.js";
import { gradeEssay } from "../_lib/grade.js";

export const onRequestPost = handle(async (body, { request, env }) => {
  const topic = topicFor(body);
  const { apiKey } = await resolveKey(request, env, body);
  return gradeEssay({ topic, essay: body.essay, apiKey, model: body.model });
});
