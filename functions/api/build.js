import { handle, HttpError, resolveKey } from "../_lib/muse.js";
import { discover, generate, outline, pick, questions, references, vet } from "../_lib/build.js";

const STAGES = { discover, pick, vet, outline, questions, references, generate };

export const onRequestPost = handle(async (body, { request, env }) => {
  const stage = STAGES[body.stage];
  if (!stage) throw new HttpError(400, "Unknown stage.");
  const key = await resolveKey(request, env, body);
  return stage({ ...body, ...key, env });
});
