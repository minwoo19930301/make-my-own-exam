// Remote MCP server (streamable HTTP, stateless JSON responses) so any agent can collect, save and grade.
// Add it with: claude mcp add --transport http make-my-own-exam https://make-my-own-exam.pages.dev/mcp
import { resolveKey } from "./_lib/muse.js";
import { cleanRubric, finalizeGrade, gradeAnswer, gradeSystem } from "./_lib/grade.js";
import { EXAM_SCHEMA, getExam, putExam, putGrade } from "./_lib/exam.js";

const VERSION = "2025-06-18";
const GRADE_SCHEMA = { score: "int on the rubric scale", summary: "string", dimensions: [{ id: "rubric dimension id", score: "int", reason: "one sentence", quote: "short phrase copied exactly from the answer, or empty" }], task: { status: "met | partly | missed", reason: "string" }, revisions: [{ quote: "exact phrase from the answer", suggestion: "rewrite or addition" }] };

const TOOLS = [
  {
    name: "save_exam",
    description: `Save a practice-exam knowledge base you collected (questions copied exactly from official sources, the scoring rubric, research by the test makers, and the sources). Returns exam_id and open_url; give open_url to the user, it opens the exam in the Make My Own Exam app. Shape: ${JSON.stringify(EXAM_SCHEMA)}`,
    inputSchema: { type: "object", properties: { exam: { type: "object", description: "The knowledge base, in the shape given in the description." } }, required: ["exam"] },
  },
  {
    name: "get_exam",
    description: "Read a saved exam: its rubric, concepts and the list of question ids and prompts.",
    inputSchema: { type: "object", properties: { exam_id: { type: "string" } }, required: ["exam_id"] },
  },
  {
    name: "get_grading_guide",
    description: "Everything needed to grade one answer with your own model: the question, the exam's rubric, the rater instructions, and the JSON shape to return. Then call save_grade.",
    inputSchema: { type: "object", properties: { exam_id: { type: "string" }, question_id: { type: "string" } }, required: ["exam_id", "question_id"] },
  },
  {
    name: "save_grade",
    description: "Save a grade you produced by following get_grading_guide. Quotes that do not appear in the answer are dropped. Returns open_url, which shows the result in the app.",
    inputSchema: { type: "object", properties: { exam_id: { type: "string" }, question_id: { type: "string" }, answer: { type: "string" }, grade: { type: "object" }, graded_by: { type: "string", description: "Model or agent that graded it." } }, required: ["exam_id", "question_id", "answer", "grade"] },
  },
  {
    name: "grade_with_muse",
    description: "Grade an answer with Meta Muse on the server instead of your own model (uses the site's daily demo quota). Returns the grade and open_url.",
    inputSchema: { type: "object", properties: { exam_id: { type: "string" }, question_id: { type: "string" }, answer: { type: "string" } }, required: ["exam_id", "question_id", "answer"] },
  },
];

const origin = (request) => new URL(request.url).origin;
const text = (obj) => ({ content: [{ type: "text", text: JSON.stringify(obj, null, 1) }], structuredContent: obj });
const question = (exam, qid) => {
  const q = exam.questions.find((x) => x.id === qid);
  if (!q) throw Object.assign(new Error(`No question ${qid}. Call get_exam for the ids.`), { status: 404 });
  return q;
};

async function call(name, args, { request, env }) {
  const site = origin(request);
  if (name === "save_exam") {
    const { examId, exam } = await putExam(env, { ...args.exam, builtWith: args.exam?.builtWith || "agent via MCP" });
    return { exam_id: examId, open_url: `${site}/?exam=${examId}`, questions: exam.questions.length, concepts: exam.concepts.length };
  }
  const exam = await getExam(env, args.exam_id);
  if (name === "get_exam") {
    return { name: exam.name, description: exam.description, rubric: exam.rubric, concepts: exam.concepts.map((c) => c.label), questions: exam.questions.map((q) => ({ id: q.id, type: q.type, prompt: q.prompt.slice(0, 300) })) };
  }
  const q = question(exam, args.question_id);
  if (name === "get_grading_guide") {
    return { exam: exam.name, question: { id: q.id, type: q.type, prompt: q.prompt, instructions: q.instructions, answer_key: q.answer || undefined }, rubric: cleanRubric(exam.rubric), rater_instructions: gradeSystem(cleanRubric(exam.rubric)), return_shape: GRADE_SCHEMA };
  }
  if (name === "save_grade" || name === "grade_with_muse") {
    const answer = String(args.answer || "");
    let grade, by;
    if (name === "save_grade") {
      grade = finalizeGrade(answer, args.grade, cleanRubric(exam.rubric));
      by = String(args.graded_by || "your agent").slice(0, 80);
    } else {
      const key = await resolveKey(request, env, {});
      grade = await gradeAnswer({ exam: exam.name, question: q, rubric: exam.rubric, answer, ...key });
      by = "Meta Muse";
    }
    const gradeId = await putGrade(env, { examId: args.exam_id, questionId: q.id, answer, grade, gradedBy: by, at: new Date().toISOString() });
    return { grade, open_url: `${site}/?grade=${gradeId}` };
  }
  throw Object.assign(new Error(`Unknown tool ${name}`), { status: 400 });
}

async function rpc(msg, ctx) {
  const { id, method, params = {} } = msg;
  if (id === undefined) return null; // notification
  const ok = (result) => ({ jsonrpc: "2.0", id, result });
  if (method === "initialize") return ok({ protocolVersion: params.protocolVersion || VERSION, capabilities: { tools: {} }, serverInfo: { name: "make-my-own-exam", version: "1.0.0" }, instructions: "Collect an exam's official materials, save them with save_exam, and grade answers with get_grading_guide + save_grade (your model) or grade_with_muse." });
  if (method === "ping") return ok({});
  if (method === "tools/list") return ok({ tools: TOOLS });
  if (method === "tools/call") {
    try {
      return ok(text(await call(params.name, params.arguments || {}, ctx)));
    } catch (e) {
      return ok({ content: [{ type: "text", text: e.message || "Tool failed" }], isError: true });
    }
  }
  return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } };
}

export async function onRequestPost(ctx) {
  let body;
  try { body = await ctx.request.json(); } catch { return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 }); }
  const out = Array.isArray(body) ? (await Promise.all(body.map((m) => rpc(m, ctx)))).filter(Boolean) : await rpc(body, ctx);
  if (!out || (Array.isArray(out) && !out.length)) return new Response(null, { status: 202 });
  return Response.json(out, { headers: { "cache-control": "no-store" } });
}

export const onRequestGet = () => new Response("Make My Own Exam MCP server. POST JSON-RPC here (streamable HTTP).", { status: 405, headers: { allow: "POST" } });
