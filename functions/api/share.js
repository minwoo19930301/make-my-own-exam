// The app's side of shared links: POST an exam to get an id; GET ?exam=ID or ?grade=ID to import.
import { handle, json } from "../_lib/muse.js";
import { getExam, getGrade, putExam } from "../_lib/exam.js";

export const onRequestPost = handle(async (body, { env }) => {
  const { examId } = await putExam(env, body.exam);
  return { examId };
});

export async function onRequestGet({ request, env }) {
  const q = new URL(request.url).searchParams;
  try {
    if (q.get("exam")) return json({ exam: await getExam(env, q.get("exam")) });
    if (q.get("grade")) {
      const g = await getGrade(env, q.get("grade"));
      return json({ ...g, exam: await getExam(env, g.examId).catch(() => null) });
    }
    return json({ error: "Give ?exam= or ?grade=." }, 400);
  } catch (e) {
    return json({ error: e.message }, e.status || 500);
  }
}
