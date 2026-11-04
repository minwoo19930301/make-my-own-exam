// Runs the GRE example build on the live site in a headless browser and saves the result as the
// "saved example" that the app offers if a live build fails during a demo.
// Usage: node tools/save-example.mjs [site]
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const site = process.argv[2] || "https://make-my-own-exam.pages.dev";
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage();
await page.goto(site, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.getByRole("button", { name: "Try the GRE example" }).click();
await page.getByRole("button", { name: "Build knowledge base" }).click();
await page.getByRole("button", { name: "Start practicing" }).waitFor({ timeout: 15 * 60000 });
const exam = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem("mmoe.exams")))[0]);
const steps = await page.locator(".step").allInnerTexts();
await browser.close();
const { id, ...rest } = exam;
writeFileSync(new URL("../public/data/example-gre.json", import.meta.url), JSON.stringify({ ...rest, builtWith: "saved example" }, null, 1));
console.log(steps.map((s) => s.replace(/\n/g, " | ")).join("\n"));
console.log({ questions: exam.questions.length, concepts: exam.concepts.length, references: exam.references.map((r) => `${r.verified ? "OK " : "?? "}${r.title}`) });
