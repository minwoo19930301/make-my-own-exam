import { handle, resolveKey } from "../_lib/muse.js";
import { topicById } from "../_lib/kb.js";
import { makeDrill } from "../_lib/drill.js";

// Drills depend only on the topic, so one generated set is shared through KV when it is bound.
export const onRequestPost = handle(async (body, { request, env }) => {
  const topic = topicById(body.topicId);
  const cacheKey = `drill:v1:${topic.id}`;
  if (env.LIMITS && !body.fresh) {
    const hit = await env.LIMITS.get(cacheKey, "json");
    if (hit) return { ...hit, cached: true };
  }
  const { apiKey } = await resolveKey(request, env, body);
  const drill = await makeDrill({ topic, apiKey, model: body.model });
  if (env.LIMITS) await env.LIMITS.put(cacheKey, JSON.stringify(drill));
  return drill;
});
