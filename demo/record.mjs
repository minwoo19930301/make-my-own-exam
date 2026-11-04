// Records the demo on the live site with a title card, captions and zooms drawn in the page,
// then muxes narration from demo/audio/<scene>.wav (see tts-say.sh / tts-elevenlabs.mjs).
// Usage: node demo/record.mjs [site] [--mux]   -> demo/out/make-my-own-exam-demo.mp4
// --mux reuses the last recording and only re-times the audio (after swapping in new narration WAVs).
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";

const dir = new URL(".", import.meta.url).pathname;
const site = process.argv.slice(2).find((a) => !a.startsWith("--")) || "https://make-my-own-exam.pages.dev";
const muxOnly = process.argv.includes("--mux");
const essay = readFileSync(`${dir}essay.txt`, "utf8").trim();
const narration = JSON.parse(readFileSync(`${dir}narration.json`, "utf8"));
const scenes = narration.map((s) => s.id);
const caption = Object.fromEntries(narration.map((s) => [s.id, s.caption]));
const probe = (f) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString());
const dur = Object.fromEntries(scenes.map((id) => [id, probe(`${dir}audio/${id}.wav`)]));
const out = `${dir}out/`;
const TITLE = 3.2;
let marks = {};

if (!muxOnly) {
  rmSync(`${out}raw`, { recursive: true, force: true });
  mkdirSync(`${out}raw`, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", headless: false }) // headless Chrome screencasts only 713 of 800 rows;
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, recordVideo: { dir: `${out}raw`, size: { width: 1280, height: 800 } }, colorScheme: "light" });
  const t0 = Date.now();
  // Start clean, with the other exams built earlier by tools/try-exam.mjs already in the list.
  const others = readdirSync(new URL("../public/data/examples/", import.meta.url)).filter((f) => f.endsWith(".json"))
    .map((f, i) => ({ ...JSON.parse(readFileSync(new URL(`../public/data/examples/${f}`, import.meta.url), "utf8")), id: `example-${f.replace(".json", "")}`, builtAt: `2026-11-04T0${i}:00:00.000Z`, builtWith: "live" }));
  await ctx.addInitScript((seed) => {
    if (sessionStorage.getItem("demo")) return;
    sessionStorage.setItem("demo", "1");
    localStorage.clear();
    localStorage.setItem("mmoe.exams", JSON.stringify(Object.fromEntries(seed.map((e) => [e.id, e]))));
  }, others);
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);
  const at = () => (Date.now() - t0) / 1000;
  const sleep = (s) => page.waitForTimeout(Math.max(0, s) * 1000);
  const scrollTo = (sel, block = "start") => page.evaluate(([s, b]) => document.querySelector(s)?.scrollIntoView({ behavior: "smooth", block: b }), [sel, block]);

  // Overlay layer: title card, lower-third captions, and zoom on the main column.
  const overlay = () => page.evaluate(() => {
    if (document.getElementById("demo-css")) return;
    const css = document.createElement("style");
    css.id = "demo-css";
    css.textContent = `
      main.wrap { transition: transform 1s cubic-bezier(.2,.7,.2,1); }
      #demo-cap { position: fixed; left: 50%; bottom: 36px; transform: translate(-50%, 20px); opacity: 0; transition: all .45s ease;
        background: rgba(5,5,5,.86); color: #fff; font: 600 22px/1.2 system-ui, sans-serif; padding: 12px 22px; border-radius: 999px; z-index: 9999; white-space: nowrap; }
      #demo-cap.on { opacity: 1; transform: translate(-50%, 0); }
      #demo-title { position: fixed; inset: 0; z-index: 10000; display: grid; place-content: center; text-align: center; background: #fff; transition: opacity .7s ease; }
      #demo-title h1 { margin: 0; font: 800 72px/1.05 system-ui, sans-serif; color: #1877f2; letter-spacing: -1.5px; animation: pop 1.1s cubic-bezier(.2,.7,.2,1) both; }
      #demo-title p { margin: 18px 0 0; font: 500 26px/1.3 system-ui, sans-serif; color: #444; animation: pop 1.1s .35s cubic-bezier(.2,.7,.2,1) both; }
      @keyframes pop { from { opacity: 0; transform: scale(.86) translateY(14px); } }`;
    document.head.append(css);
    const cap = Object.assign(document.createElement("div"), { id: "demo-cap" });
    document.body.append(cap);
  });
  const say = (text) => page.evaluate((t) => { const c = document.getElementById("demo-cap"); c.classList.remove("on"); setTimeout(() => { c.textContent = t; c.classList.add("on"); }, 250); }, text);
  const zoom = (sel, scale = 1.35) => page.evaluate(([s, k]) => {
    const m = document.querySelector("main.wrap"), el = document.querySelector(s);
    if (!el) return;
    const mr = m.getBoundingClientRect(), er = el.getBoundingClientRect();
    m.style.transformOrigin = `${er.left - mr.left + er.width / 2}px ${er.top - mr.top + er.height / 2}px`;
    m.style.transform = `scale(${k})`;
  }, [sel, scale]);
  const unzoom = () => page.evaluate(() => { document.querySelector("main.wrap").style.transform = ""; });

  await page.goto(site, { waitUntil: "networkidle" });
  await overlay();
  await page.evaluate(() => {
    const t = document.createElement("div");
    t.id = "demo-title";
    t.innerHTML = "<div><h1>Make My Own Exam</h1><p>Any public exam, turned into a practice coach · powered by Meta Muse</p></div>";
    document.body.append(t);
  });
  marks.title = at(); console.log("scene title", marks.title.toFixed(1));
  await sleep(TITLE - 0.7);
  await page.evaluate(() => { const t = document.getElementById("demo-title"); t.style.opacity = 0; setTimeout(() => t.remove(), 800); });
  await sleep(0.7);

  marks.intro = at(); console.log("scene intro", marks.intro.toFixed(1));
  await say(caption.intro);
  await zoom(".hero", 1.25);
  await sleep(dur.intro * 0.4);
  await unzoom();
  await sleep(0.5);
  await page.getByRole("button", { name: "Try the GRE example" }).click();
  await zoom("textarea.area", 1.35);
  await sleep(dur.intro * 0.6 - 0.2);

  marks.build = at(); console.log("scene build", marks.build.toFixed(1));
  await say(caption.build);
  await sleep(0.8);
  await unzoom();
  await sleep(0.6);
  await page.getByRole("button", { name: "Build knowledge base" }).click();
  marks.buildClick = at(); console.log("scene buildClick", marks.buildClick.toFixed(1));
  await sleep(1.2);
  await scrollTo(".steps", "start");
  await page.getByRole("button", { name: "Start practicing" }).waitFor({ timeout: 15 * 60000 });
  marks.buildDone = at(); console.log("scene buildDone", marks.buildDone.toFixed(1));
  const built = await page.evaluate(() => JSON.parse(localStorage.getItem("mmoe.exams"))[JSON.parse(localStorage.getItem("mmoe.current"))]);
  if (built.questions.length < 100 || !built.questions.some((q) => q.prompt.includes("human mind will always be superior"))) {
    await browser.close();
    throw new Error(`Live build found only ${built.questions.length} questions or missed the demo topic; record again.`);
  }
  await sleep(0.8);

  marks.kb = at(); console.log("scene kb", marks.kb.toFixed(1));
  await say(caption.kb);
  await page.evaluate(() => [...document.querySelectorAll(".card")].find((c) => c.textContent.includes("Start practicing"))?.scrollIntoView({ behavior: "smooth", block: "start" }));
  await sleep(1.2);
  await zoom(".stats", 1.35);
  await sleep(dur.kb * 0.3);
  await unzoom();
  await page.evaluate(() => [...document.querySelectorAll(".card")].find((c) => c.textContent.startsWith("3 · Research"))?.scrollIntoView({ behavior: "smooth", block: "start" }));
  await sleep(1);
  // Zoom on the first confirmed reference so the Crossref badge is in view.
  await page.evaluate(() => { const c = [...document.querySelectorAll(".card")].find((x) => x.textContent.startsWith("3 · Research")); const row = [...c.querySelectorAll(".list-row")].find((r) => r.textContent.includes("Confirmed")) || c; row.id = "demo-refs"; });
  await zoom("#demo-refs", 1.45);
  await sleep(dur.kb * 0.7 - 2.2);
  await unzoom();
  await sleep(0.4);

  marks.others = at(); console.log("scene others", marks.others.toFixed(1));
  await say(caption.others);
  await page.evaluate(() => { const c = [...document.querySelectorAll(".card")].find((x) => x.textContent.startsWith("Your exams")); c.id = "demo-exams"; c.scrollIntoView({ behavior: "smooth", block: "center" }); });
  await sleep(1);
  await zoom("#demo-exams", 1.35);
  await sleep(dur.others - 0.6);
  await unzoom();
  await sleep(0.3);

  marks.write = at(); console.log("scene write", marks.write.toFixed(1));
  await say(caption.write);
  await page.getByRole("button", { name: "Start practicing" }).click();
  await page.locator(".prompt").waitFor();
  // Show the same topic the demo essay was written for.
  await page.locator("#question").selectOption({ label: (await page.locator("#question option").allInnerTexts()).find((t) => t.includes("human mind will always be superior")) });
  await sleep(0.6);
  await zoom(".prompt", 1.3);
  await sleep(1.4);
  await unzoom();
  await page.getByRole("button", { name: /Start \d+-minute timer/ }).click();
  const box = page.locator("textarea.essay");
  await box.click();
  await box.pressSequentially(essay.slice(0, 110), { delay: 16 });
  await box.fill(essay);
  await page.evaluate(() => { const t = document.querySelector("textarea.essay"); t.scrollTop = t.scrollHeight; });
  await sleep(Math.max(0.6, dur.write - 3.6));

  marks.score = at(); console.log("scene score", marks.score.toFixed(1));
  await say(caption.score);
  await page.getByRole("button", { name: "Score my answer" }).click();
  await page.locator("#result").waitFor({ timeout: 120000 });
  marks.resultShown = at(); console.log("scene resultShown", marks.resultShown.toFixed(1));
  await sleep(0.6);
  await scrollTo("#result");
  await sleep(1);
  await zoom(".score-head", 1.4);
  await sleep(1.8);
  await unzoom();
  await scrollTo(".dim:nth-of-type(2)", "center");
  // In the cut video the result appears 1.2 s after the click, so let the score narration finish over it.
  const left = dur.score - 1.2 - (at() - marks.resultShown);
  if (left > 0) await sleep(left);
  await sleep(0.3);

  marks.result = at(); console.log("scene result", marks.result.toFixed(1));
  await say(caption.result);
  await page.evaluate(() => { const d = [...document.querySelectorAll(".dim")].find((x) => x.textContent.startsWith("Revise")); if (d) { d.id = "demo-rev"; d.scrollIntoView({ behavior: "smooth", block: "center" }); } });
  await sleep(0.8);
  await zoom("#demo-rev", 1.3);
  await sleep(dur.result + 0.6);
  await unzoom();

  marks.insights = at(); console.log("scene insights", marks.insights.toFixed(1));
  await say(caption.insights);
  await page.getByRole("button", { name: "Insights" }).click();
  await sleep(dur.insights * 0.45);
  await page.evaluate(() => window.scrollTo({ top: 420, behavior: "smooth" }));
  await sleep(dur.insights * 0.55 + 0.3);

  marks.civics = at(); console.log("scene civics");
  await say(caption.civics);
  const openExam = async (word) => {
    await page.getByRole("button", { name: "Build", exact: true }).click();
    await sleep(0.4);
    await page.evaluate((w) => { const row = [...document.querySelectorAll(".list-row.static")].find((r) => r.textContent.includes(w)); [...row.querySelectorAll("button")].find((b) => /Switch|Open/.test(b.textContent)).click(); }, word);
    await sleep(0.6);
  };
  await openExam("Citizenship");
  await page.getByRole("button", { name: "Start practicing" }).click();
  await page.locator("#question").selectOption({ label: (await page.locator("#question option").allInnerTexts()).find((t) => t.includes("supreme law of the land")) });
  await sleep(0.5);
  await zoom(".prompt", 1.4);
  await page.locator("textarea.essay").pressSequentially("The Constitution is the supreme law.", { delay: 40 });
  await sleep(0.6);
  await unzoom();
  marks.civicsClick = at();
  await page.getByRole("button", { name: "Score my answer" }).click();
  await page.locator("#result").waitFor({ timeout: 120000 });
  marks.civicsShown = at();
  await sleep(0.5);
  await scrollTo("#result");
  await sleep(0.9);
  await zoom("#result", 1.15);
  await sleep(Math.max(2.5, dur.civics - 1.2 - (at() - marks.civicsShown) - (marks.civicsClick - marks.civics)));
  await unzoom();
  await sleep(0.3);

  marks.ielts = at(); console.log("scene ielts");
  await say(caption.ielts);
  await openExam("IELTS");
  await page.evaluate(() => { const c = [...document.querySelectorAll(".card")].find((x) => x.textContent.startsWith("2 · Scoring rules")); c.id = "demo-rubric"; c.scrollIntoView({ behavior: "smooth", block: "start" }); });
  await sleep(1);
  await zoom("#demo-rubric", 1.2);
  await sleep(dur.ielts - 1.4);
  await unzoom();
  await sleep(0.3);

  marks.agent = at(); console.log("scene agent", marks.agent.toFixed(1));
  await say(caption.agent);
  await page.getByRole("button", { name: "Build", exact: true }).click();
  await sleep(0.4);
  await page.evaluate(() => { const c = [...document.querySelectorAll(".card")].find((x) => x.textContent.startsWith("Or collect it with your own agent")); c.id = "demo-agent"; c.querySelector("button").click(); });
  await sleep(0.4);
  await scrollTo("#demo-agent", "start");
  await sleep(0.9);
  await zoom("#demo-agent .code", 1.3);
  await sleep(dur.agent - 1.4);
  await unzoom();
  await sleep(0.3);

  marks.agentResult = at(); console.log("scene agentResult");
  // Real results from a Claude Code agent that used the MCP server (links last 30 days).
  await page.goto(`${site}/?exam=ed0070ffc6f1`, { waitUntil: "networkidle" });
  await overlay();
  await say(caption.agentResult);
  await page.locator(".stats").waitFor();
  await sleep(0.6);
  await zoom(".stats", 1.35);
  await sleep(dur.agentResult * 0.45);
  await unzoom();
  await page.goto(`${site}/?grade=b1af819b541f`, { waitUntil: "networkidle" });
  await overlay();
  await page.evaluate((t) => { const c = document.getElementById("demo-cap"); c.textContent = t; c.classList.add("on"); }, caption.agentResult);
  await page.locator("#result").waitFor();
  await scrollTo("#result");
  await sleep(0.8);
  await zoom(".score-head", 1.4);
  await sleep(dur.agentResult * 0.55 - 1);
  await unzoom();
  await sleep(0.3);

  marks.close = at(); console.log("scene close", marks.close.toFixed(1));
  await say(caption.close);
  await page.locator(".round[aria-label=Settings]").click();
  await sleep(1.4);
  await page.locator("#provider").selectOption("custom");
  await sleep(dur.close * 0.35 - 1);
  await page.keyboard.press("Escape");
  await sleep(dur.close * 0.35);
  await page.evaluate(() => {
    const t = document.createElement("div");
    t.id = "demo-title";
    t.innerHTML = "<div><h1>Make My Own Exam</h1><p>make-my-own-exam.pages.dev</p></div>";
    document.body.append(t);
  });
  await sleep(dur.close * 0.65 + 1.5);
  marks.end = at(); console.log("scene end", marks.end.toFixed(1));

  await ctx.close();
  await browser.close();
  writeFileSync(`${out}marks.json`, JSON.stringify({ marks, dur }, null, 1));
} else {
  marks = JSON.parse(readFileSync(`${out}marks.json`, "utf8")).marks;
}

// Video timeline: drop page load, fast-forward the live build to fit its narration, cut the scoring wait.
const raw = `${out}raw/${readdirSync(`${out}raw`)[0]}`;
// The video file starts a little after our clock does. Find the title card's first frame (a hard cut to white)
// and shift every mark onto the video's own clock.
// Sample one background pixel 20 times a second: the app's canvas is gray (242), the title card is white.
const px = execFileSync("ffmpeg", ["-loglevel", "error", "-t", "12", "-i", raw, "-vf", "fps=20,crop=4:4:60:400,scale=1:1", "-f", "rawvideo", "-pix_fmt", "gray", "-"]);
let seenGray = false, offset = marks.title;
for (let i = 0; i < px.length; i++) { if (px[i] < 248) seenGray = true; else if (seenGray) { offset = i / 20; break; } }
const shiftBy = offset - marks.title;
marks = Object.fromEntries(Object.entries(marks).map(([k, v]) => [k, v + shiftBy]));
const lead = Math.max(0, marks.title - 0.1);
const fastFrom = marks.buildClick + 1.5;
const buildShown = Math.max(2, marks.build + dur.build + 0.6 - fastFrom);
const fastSpeed = Math.max(1, (marks.buildDone - fastFrom) / buildShown);
// Cut the waits while Muse scores (the GRE essay and the civics answer).
const cuts = [[marks.score + 1.2, marks.resultShown - 0.2], [marks.civicsClick + 1.0, marks.civicsShown - 0.2]].filter(([a, b]) => b > a);
const segs = [{ a: lead, b: fastFrom, s: 1 }, { a: fastFrom, b: marks.buildDone, s: fastSpeed }];
let from = marks.buildDone;
for (const [a, b] of cuts) { segs.push({ a: from, b: a, s: 1 }); from = b; }
segs.push({ a: from, b: marks.end, s: 1 });
const cutFrom = cuts[0]?.[0] || 0, cutTo = cuts[0]?.[1] || 0;
const map = (t) => { let acc = 0; for (const g of segs) { if (t < g.a) return acc; if (t <= g.b) return acc + (t - g.a) / g.s; acc += (g.b - g.a) / g.s; } return acc; };
const vf = segs.map((g, i) => `[0:v]trim=${g.a}:${g.b},setpts=(PTS-STARTPTS)/${g.s}[v${i}]`).join(";") + `;${segs.map((_, i) => `[v${i}]`).join("")}concat=n=${segs.length}:v=1[v]`;
const inputs = scenes.flatMap((id) => ["-i", `${dir}audio/${id}.wav`]);
// The score narration starts at the click, so it is placed before the cut and plays over the result.
const delays = scenes.map((id, i) => `[${i + 1}:a]adelay=${Math.round(map(marks[id]) * 1000)}:all=1[s${i}]`);
const mix = `${scenes.map((_, i) => `[s${i}]`).join("")}amix=inputs=${scenes.length}:normalize=0[aout]`;
const file = `${out}make-my-own-exam-demo.mp4`;
execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", raw, ...inputs, "-filter_complex", [vf, ...delays, mix].join(";"),
  "-map", "[v]", "-map", "[aout]", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-r", "30", "-c:a", "aac", "-b:a", "160k", file]);
console.log({ clockShift: Number(shiftBy.toFixed(2)), length: Number(probe(file).toFixed(1)), buildSpeedup: Number(fastSpeed.toFixed(1)), scoringCut: Number(cuts.reduce((x, [a, b]) => x + b - a, 0).toFixed(1)), file });
