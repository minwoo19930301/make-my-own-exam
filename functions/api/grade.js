import { handle, resolveKey } from "../_lib/muse.js";
import { topicById } from "../_lib/kb.js";
import { gradeEssay } from "../_lib/grade.js";

export const onRequestPost = handle(async (body, { request, env }) => {
  const topic = topicById(body.topicId);
  const { apiKey } = await resolveKey(request, env, body);
  return gradeEssay({ topic, essay: body.essay, apiKey, model: body.model });
});
