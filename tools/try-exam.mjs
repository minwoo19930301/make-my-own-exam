// Builds one exam on the live site in a headless browser, from a one-line description only.
// Usage: node tools/try-exam.mjs "<exam description>" <out.json> [site]
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const [prompt, out, site = "https://make-my-own-exam.pages.dev"] = process.argv.slice(2);
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage();
await page.goto(site, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.locator("textarea.area").fill(prompt);
await page.getByRole("button", { name: "Build knowledge base" }).click();
const done = await Promise.race([
  page.getByRole("button", { name: "Start practicing" }).waitFor({ timeout: 15 * 60000 }).then(() => true),
  page.locator(".error").waitFor({ timeout: 15 * 60000 }).then(() => false),
]);
const steps = await page.locator(".step").allInnerTexts();
const exam = done ? await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem("mmoe.exams")))[0]) : null;
await browser.close();
if (exam) { const { id, ...rest } = exam; writeFileSync(out, JSON.stringify({ ...rest, builtWith: "saved example" }, null, 1)); }
console.log(steps.map((s) => s.replace(/\n/g, " | ")).join("\n"));
console.log(exam ? { name: exam.name, questions: exam.questions.length, types: [...new Set(exam.questions.map((q) => q.type))], concepts: exam.concepts.length, rubric: `${exam.rubric.min}-${exam.rubric.max} fromSource=${exam.rubric.fromSource}`, refs: exam.references.length, confirmed: exam.references.filter((r) => r.verified).length } : "FAILED");
