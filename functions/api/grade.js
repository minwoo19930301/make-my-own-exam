import { handle, resolveKey } from "../_lib/muse.js";
import { gradeAnswer } from "../_lib/grade.js";

export const onRequestPost = handle(async (body, { request, env }) => {
  const key = await resolveKey(request, env, body);
  return gradeAnswer({ ...body, ...key });
});
