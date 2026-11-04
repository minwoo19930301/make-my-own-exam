// Records the demo on the live site and muxes narration from demo/audio/<scene>.wav.
// Usage: node demo/record.mjs [site] [--mux]   -> demo/out/gre-issue-demo.mp4
// --mux reuses the last recording and only re-mixes the audio (after swapping in new narration WAVs with the same lengths).
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";

const dir = new URL(".", import.meta.url).pathname;
const site = process.argv.slice(2).find((a) => !a.startsWith("--")) || "https://gre-issue.pages.dev";
const essay = readFileSync(`${dir}essay.txt`, "utf8").trim();
const scenes = JSON.parse(readFileSync(`${dir}narration.json`, "utf8")).map((s) => s.id);
const dur = Object.fromEntries(scenes.map((id) => [id, Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", `${dir}audio/${id}.wav`]).toString())]));
const out = `${dir}out/`;
const muxOnly = process.argv.includes("--mux");
const marks = {};
if (!muxOnly) {
rmSync(`${out}raw`, { recursive: true, force: true });
mkdirSync(`${out}raw`, { recursive: true });

const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: `${out}raw`, size: { width: 1280, height: 800 } }, colorScheme: "light" });
const t0 = Date.now();
await ctx.addInitScript(() => {
  if (sessionStorage.getItem("demo")) return;
  sessionStorage.setItem("demo", "1");
  localStorage.clear();
  localStorage.setItem("sixpoint.topic", JSON.stringify("issue-042"));
  localStorage.setItem("sixpoint.view", JSON.stringify("write"));
});
const page = await ctx.newPage();
const at = () => (Date.now() - t0) / 1000;
const sleep = (s) => page.waitForTimeout(s * 1000);
const scroll = (y) => page.evaluate((y) => window.scrollTo({ top: y, behavior: "smooth" }), y);
const scrollTo = (sel, block = "start") => page.evaluate(([s, b]) => document.querySelector(s)?.scrollIntoView({ behavior: "smooth", block: b }), [sel, block]);

await page.goto(site, { waitUntil: "networkidle" });
await page.locator(".prompt").waitFor();
await sleep(0.8);

marks.intro = at();
await sleep(dur.intro + 0.4);

marks.prompt = at();
await page.locator(".note").hover();
await sleep(dur.prompt * 0.5);
await scrollTo(".essay", "center");
await sleep(dur.prompt * 0.5 + 0.4);

marks.write = at();
await page.getByRole("button", { name: /Start 30-minute timer/ }).click();
const box = page.locator("textarea.essay");
await box.click();
const first = essay.split("\n")[0];
await box.pressSequentially(first.slice(0, 120), { delay: 18 });
await box.fill(essay);
await page.evaluate(() => { const t = document.querySelector("textarea.essay"); t.scrollTop = t.scrollHeight; });
await sleep(Math.max(0.6, dur.write - 2.2));

marks.score = at();
await page.getByRole("button", { name: "Score my essay" }).click();
await page.locator("#result").waitFor({ timeout: 120000 });
marks.resultShown = at();
await sleep(1.2);
await scrollTo("#result");
const scoreLeft = marks.score + dur.score - at();
await page.waitForTimeout(800);
await page.locator(".dim").nth(1).scrollIntoViewIfNeeded();
await scrollTo(".dim:nth-of-type(2)", "center");
if (scoreLeft > 0) await sleep(scoreLeft);
await sleep(0.4);

marks.result = at();
await page.evaluate(() => [...document.querySelectorAll(".dim")].find((d) => d.textContent.startsWith("Revise"))?.scrollIntoView({ behavior: "smooth", block: "center" }));
await sleep(dur.result + 0.8);

marks.insights = at();
await page.getByRole("button", { name: "Insights" }).click();
await sleep(dur.insights * 0.45);
await scroll(520);
await sleep(dur.insights * 0.55 + 0.4);

marks.close = at();
await scroll(0);
await sleep(dur.close + 1.5);
marks.end = at();

await ctx.close();
await browser.close();
writeFileSync(`${out}marks.json`, JSON.stringify({ marks, dur }, null, 1));
}
const raw = `${out}raw/${readdirSync(`${out}raw`)[0]}`;
if (muxOnly) Object.assign(marks, JSON.parse(readFileSync(`${out}marks.json`, "utf8")).marks);

// Cut the dead time while Muse is scoring (after the score narration has finished).
const cutFrom = marks.score + dur.score + 0.3;
const cutTo = marks.resultShown - 0.3;
const cut = cutTo > cutFrom ? cutTo - cutFrom : 0;
const lead = Math.max(0, marks.intro - 0.3); // drop the page load before the first scene
const shift = (t) => (cut && t > cutFrom ? t - cut : t) - lead;
const v = cut
  ? `[0:v]trim=${lead}:${cutFrom},setpts=PTS-STARTPTS[a];[0:v]trim=${cutTo}:${marks.end},setpts=PTS-STARTPTS[b];[a][b]concat=n=2:v=1[v]`
  : `[0:v]trim=${lead}:${marks.end},setpts=PTS-STARTPTS[v]`;
const inputs = scenes.flatMap((id) => ["-i", `${dir}audio/${id}.wav`]);
const delays = scenes.map((id, i) => `[${i + 1}:a]adelay=${Math.round(shift(marks[id]) * 1000)}:all=1[s${i}]`);
const mix = `${scenes.map((_, i) => `[s${i}]`).join("")}amix=inputs=${scenes.length}:normalize=0[aout]`;
execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", raw, ...inputs, "-filter_complex", [v, ...delays, mix].join(";"),
  "-map", "[v]", "-map", "[aout]", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-c:a", "aac", "-b:a", "160k", "-shortest", `${out}gre-issue-demo.mp4`]);
console.log({ cut: Number(cut.toFixed(1)), length: Number((marks.end - cut - lead).toFixed(1)), out: `${out}gre-issue-demo.mp4` });
