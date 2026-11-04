// Copy-paste prompts for people who would rather use their own agent (Claude Code, Codex, Cursor...) than Muse.
// The agent installs two MCP servers: Chrome DevTools (driving Chrome Canary) to browse, and this app's own MCP server to save and grade.
export const MCP_URL = `${location.origin}/mcp`;

const install = () => `First, add these MCP servers if you don't have them (Claude Code commands shown; other agents take the same command or URL in their MCP settings):
- Chrome DevTools, driving Chrome Canary so it stays apart from my everyday browser:
  claude mcp add chrome-devtools -- npx -y chrome-devtools-mcp@latest --channel=canary
- Make My Own Exam:
  claude mcp add --transport http make-my-own-exam ${MCP_URL}
Restart if needed so the tools load.`;

export const collectPrompt = (exam) => `${install()}

Then build a practice exam for: ${exam || "<describe the exam>"}

1. Collect. With the Chrome DevTools tools, search for and open the test maker's official materials: the question or topic pool, the official scoring guide, scored sample answers, and the official overview. Open every page and PDF you use. Skip prep companies, forums and unofficial copies.
2. Analyze. Copy every question exactly as published. Group them into 8-20 concepts (the subjects the questions are about, not skills). Restate the official scoring guide's levels in your own words, with 3-5 rubric dimensions. Find papers, reports or books by the test makers or on how the exam is designed and scored, and only list ones you actually opened.
3. Save. Call the make-my-own-exam tool save_exam with that knowledge base (its description gives the JSON shape). Then give me the open_url it returns.`;

export const gradePrompt = (examId, question, answer) => `${install()}

Then grade my answer:
1. Call get_grading_guide with exam_id "${examId}" and question_id "${question.id}".
2. Grade the answer below yourself, following rater_instructions exactly, and return the return_shape JSON.
3. Call save_grade with the same ids, my answer, your grade, and graded_by set to your model name. Give me the open_url.
(If you would rather let Meta Muse grade it, call grade_with_muse instead.)

Question: ${question.prompt}

My answer:
${answer}`;
