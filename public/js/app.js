import { coveragePlan, nextTopics, readiness, weakestDimension } from "./predict.js";

const $app = document.getElementById("app");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pct = (x) => `${Math.round(x * 100)}%`;

const store = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
  },
};
const history = () => store.get("sixpoint.history", []);
const settings = () => store.get("sixpoint.settings", { apiKey: "", model: "" });

let KB;
let HEALTH = { demoKey: false, models: ["muse-spark-1.3"], defaultModel: "muse-spark-1.3", dailyLimit: 30 };

async function api(path, body) {
  const { apiKey, model } = settings();
  const r = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...body, apiKey: apiKey || undefined, model: model || undefined }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
  return data;
}

const variantLabel = (k) => KB.variants.find((v) => v.key === k)?.label || k;
const conceptLabel = (k) => KB.concepts.find((c) => c.key === k)?.label || k;
const shortStatement = (t, n = 150) => (t.statement.length > n ? `${t.statement.slice(0, n)}…` : t.statement);

function topicCard(t, extra = "") {
  return `<a class="card topic" href="#/t/${t.id}">
    <div class="chips"><span class="chip">#${t.n}</span><span class="chip">${esc(conceptLabel(t.concept))}</span><span class="chip warn">${esc(t.variant)}</span></div>
    <p>${esc(shortStatement(t))}</p>${extra}</a>`;
}

function bars(rows, total) {
  const max = Math.max(...rows.map((r) => r.count));
  return `<div class="bars">${rows.map((r) => `<div class="bar"><span>${esc(r.label)}</span>
    <span class="track"><span class="fill" style="width:${(r.count / max) * 100}%"></span></span>
    <span class="num">${r.count} · ${pct(r.count / total)}</span></div>`).join("")}</div>`;
}

function viewInsights() {
  const s = KB.stats;
  const plan = coveragePlan(KB);
  const h = history();
  const next = nextTopics(KB, h, 3);
  const top5 = s.concepts.slice(0, 5).reduce((n, c) => n + c.count, 0);
  $app.innerHTML = `
    <h1>Write toward a 6.</h1>
    <p class="lead">Every GRE Issue essay is drawn from one public pool. Sixpoint turns that pool into a knowledge base,
      shows where its weight sits, and coaches you through drills, timed writing and 0-6 feedback scored by Meta Muse.</p>
    <div class="grid">
      <div class="card stat"><b>${s.total}</b>topics in the official pool</div>
      <div class="card stat"><b>${s.uniqueStatements}</b>distinct statements (${s.total - s.uniqueStatements} reappear with a new task)</div>
      <div class="card stat"><b>${s.concepts.length}</b>recurring concepts</div>
      <div class="card stat"><b>${pct(top5 / s.total)}</b>of the pool sits in the top 5 concepts</div>
    </div>
    <div class="card">
      <h2>Your next three topics</h2>
      <p class="muted small">${h.length ? "Picked from your weakest task types and concepts, weighted by how often the pool returns to them." : "No essays yet, so these follow pool weight. Each scored essay sharpens the picks."}</p>
      ${next.map((r) => topicCard(r.topic, `<p class="muted small">${esc(r.reasons.join(" · "))}</p>`)).join("")}
    </div>
    <div class="card">
      <h2>Concepts the pool keeps returning to</h2>
      ${bars(s.concepts.map((c) => ({ label: conceptLabel(c.concept), count: c.count })), s.total)}
    </div>
    <div class="card">
      <h2>Six task types</h2>
      <p class="muted small">The same statement can come with a different task. Missing the task-specific demand is one of the fastest ways to lose a point.</p>
      ${bars(KB.variants.map((v) => ({ label: v.label, count: s.variants[v.key] })), s.total)}
    </div>
    <div class="card">
      <h2>Minimum coverage plan</h2>
      <p class="muted small">${plan.topics.length} essays, one per concept, together cover ${pct(plan.poolShare)} of the pool by concept and ${plan.variantsCovered} of 6 task types.</p>
      ${plan.topics.map((t) => topicCard(t)).join("")}
    </div>`;
}

function viewTopics(params) {
  const q = (params.get("q") || "").toLowerCase();
  const concept = params.get("concept") || "";
  const variant = params.get("variant") || "";
  const done = new Map(history().map((h) => [h.topicId, h.score]));
  const list = KB.topics.filter((t) => (!q || t.statement.toLowerCase().includes(q)) && (!concept || t.concept === concept) && (!variant || t.variant === variant));
  $app.innerHTML = `
    <h1>Topic pool</h1>
    <p class="muted">${list.length} of ${KB.topics.length} topics</p>
    <form class="filters" id="filters">
      <input name="q" placeholder="Search statements" value="${esc(q)}">
      <select name="concept"><option value="">All concepts</option>${KB.concepts.map((c) => `<option value="${c.key}" ${c.key === concept ? "selected" : ""}>${esc(c.label)}</option>`).join("")}</select>
      <select name="variant"><option value="">All task types</option>${KB.variants.map((v) => `<option value="${v.key}" ${v.key === variant ? "selected" : ""}>${esc(v.key)}</option>`).join("")}</select>
    </form>
    ${list.map((t) => topicCard(t, done.has(t.id) ? `<span class="chip">best score ${done.get(t.id)}</span>` : t.repeatOf ? `<span class="muted small">Same statement as #${Number(t.repeatOf.slice(-3))}, different task</span>` : "")).join("")}`;
  const form = document.getElementById("filters");
  const apply = () => { location.hash = `#/topics?${new URLSearchParams(new FormData(form))}`; };
  form.addEventListener("change", apply);
  form.addEventListener("submit", (e) => { e.preventDefault(); apply(); });
}

function viewTopic(id) {
  const t = KB.topics.find((x) => x.id === id);
  if (!t) { $app.innerHTML = `<p>Unknown topic.</p>`; return; }
  const draftKey = `sixpoint.draft.${t.id}`;
  let step = "analyze";
  let drill = null;
  $app.innerHTML = `
    <a href="#/topics" class="small">← All topics</a>
    <div class="card">
      <div class="chips"><span class="chip">#${t.n}</span><span class="chip">${esc(conceptLabel(t.concept))}</span><span class="chip warn">${esc(variantLabel(t.variant))}</span></div>
      <p class="prompt">${esc(t.statement)}</p>
      <p class="instr">${esc(t.instructions)}</p>
    </div>
    <div class="steps" role="tablist">
      <button data-step="analyze">1 · Analyze the prompt</button>
      <button data-step="plan">2 · Plan your thesis</button>
      <button data-step="write">3 · Write (30 min)</button>
    </div>
    <div id="step"></div>`;
  const $step = document.getElementById("step");
  const tabs = [...$app.querySelectorAll("[data-step]")];
  tabs.forEach((b) => b.addEventListener("click", () => { step = b.dataset.step; render(); }));

  async function loadDrill() {
    if (drill) return drill;
    $step.innerHTML = `<div class="card muted">Muse is writing drills for this topic…</div>`;
    drill = await api("/api/drill", { topicId: t.id });
    return drill;
  }

  async function render() {
    tabs.forEach((b) => b.classList.toggle("on", b.dataset.step === step));
    if (step === "write") return renderWrite();
    try {
      const d = await loadDrill();
      if (step === "analyze") renderMcq(d); else renderShort(d);
    } catch (err) {
      $step.innerHTML = `<div class="card err">${esc(err.message)}</div>`;
    }
  }

  function renderMcq(d) {
    $step.innerHTML = d.mcq.map((q, i) => `<div class="card" data-q="${i}">
      <h3>${i + 1}. ${esc(q.question)}</h3>
      ${q.options.map((o, j) => `<button class="opt" data-j="${j}">${String.fromCharCode(65 + j)}. ${esc(o)}</button>`).join("")}
      <p class="why muted small" hidden>${esc(q.why)}</p></div>`).join("") + `<button class="primary" id="to-plan">Next: plan your thesis →</button>`;
    $step.querySelectorAll("[data-q]").forEach((card) => {
      const q = d.mcq[Number(card.dataset.q)];
      card.querySelectorAll(".opt").forEach((btn) => btn.addEventListener("click", () => {
        card.querySelectorAll(".opt").forEach((b) => { b.classList.remove("right", "wrong"); });
        btn.classList.add(Number(btn.dataset.j) === q.answer ? "right" : "wrong");
        card.querySelectorAll(".opt")[q.answer].classList.add("right");
        card.querySelector(".why").hidden = false;
      }));
    });
    document.getElementById("to-plan").onclick = () => { step = "plan"; render(); };
  }

  function renderShort(d) {
    $step.innerHTML = d.short.map((q, i) => `<div class="card" data-s="${i}">
      <h3>${esc(q.question)}</h3>
      <textarea class="short" placeholder="1-3 sentences"></textarea>
      <div class="row"><button class="check">Check with Muse</button></div>
      <div class="out"></div></div>`).join("") + `<button class="primary" id="to-write">Next: write the essay →</button>`;
    $step.querySelectorAll("[data-s]").forEach((card) => {
      const q = d.short[Number(card.dataset.s)];
      const btn = card.querySelector(".check");
      btn.onclick = async () => {
        btn.disabled = true;
        const out = card.querySelector(".out");
        out.innerHTML = `<p class="muted small">Checking…</p>`;
        try {
          const r = await api("/api/short", { topicId: t.id, question: q.question, lookFor: q.lookFor, answer: card.querySelector("textarea").value });
          out.innerHTML = `<p><b>${r.score}/2</b> ${esc(r.feedback)}</p><blockquote>${esc(r.better)}</blockquote>`;
        } catch (err) {
          out.innerHTML = `<p class="err">${esc(err.message)}</p>`;
        } finally { btn.disabled = false; }
      };
    });
    document.getElementById("to-write").onclick = () => { step = "write"; render(); };
  }

  function renderWrite() {
    $step.innerHTML = `<div class="card">
      <textarea id="essay" placeholder="Write your response here. Aim for a clear position, 3-4 developed paragraphs and an answer to the task's specific demand."></textarea>
      <div class="meta"><span id="wc">0 words</span><span id="timer">30:00</span></div>
      <div class="row" style="margin-top:10px"><button id="start" class="ghost">Start 30-minute timer</button><button id="grade" class="primary">Score my essay</button></div>
    </div><div id="result"></div>`;
    const $essay = document.getElementById("essay");
    $essay.value = store.get(draftKey, "");
    const wc = () => { document.getElementById("wc").textContent = `${($essay.value.trim().match(/\S+/g) || []).length} words`; };
    wc();
    $essay.addEventListener("input", () => { wc(); store.set(draftKey, $essay.value); });
    let timer;
    document.getElementById("start").onclick = (e) => {
      clearInterval(timer);
      const end = Date.now() + 30 * 60 * 1000;
      e.target.textContent = "Restart timer";
      timer = setInterval(() => {
        const left = Math.max(0, end - Date.now());
        document.getElementById("timer").textContent = `${String(Math.floor(left / 60000)).padStart(2, "0")}:${String(Math.floor(left / 1000) % 60).padStart(2, "0")}`;
        if (!left) clearInterval(timer);
      }, 500);
    };
    const btn = document.getElementById("grade");
    btn.onclick = async () => {
      btn.disabled = true;
      const $r = document.getElementById("result");
      $r.innerHTML = `<div class="card muted">Muse is reading your essay…</div>`;
      try {
        const g = await api("/api/grade", { topicId: t.id, essay: $essay.value });
        const h = history();
        h.push({ topicId: t.id, score: g.score, dimensions: g.dimensions, task: g.task.status, at: new Date().toISOString() });
        store.set("sixpoint.history", h);
        $r.innerHTML = resultCard(g);
      } catch (err) {
        $r.innerHTML = `<div class="card err">${esc(err.message)}</div>`;
      } finally { btn.disabled = false; }
    };
  }

  render();
}

function resultCard(g) {
  return `<div class="card">
    <div class="score"><b>${g.score}</b><span class="muted">/ 6 practice estimate</span></div>
    <p>${esc(g.summary)}</p>
    <p class="status-${g.task.status}"><b>Task demand ${esc(g.task.status)}.</b> ${esc(g.task.reason)}</p>
    ${g.dimensions.map((d) => `<div class="dim"><h3>${esc(d.label)} · ${d.score ?? "–"}/6</h3><p>${esc(d.reason)}</p>${d.quote ? `<blockquote>${esc(d.quote)}</blockquote>` : ""}</div>`).join("")}
    ${g.revisions.length ? `<h3 style="margin-top:12px">Revise these lines</h3>${g.revisions.map((r) => `<blockquote>${esc(r.quote)}</blockquote><p class="small">→ ${esc(r.suggestion)}</p>`).join("")}` : ""}
  </div>`;
}

function viewProgress() {
  const h = history();
  const r = readiness(KB, h);
  const weak = weakestDimension(h);
  const avg = h.length ? h.reduce((a, b) => a + b.score, 0) / h.length : 0;
  $app.innerHTML = `
    <h1>Progress</h1>
    <div class="grid">
      <div class="card stat"><b>${h.length}</b>essays scored</div>
      <div class="card stat"><b>${h.length ? avg.toFixed(1) : "–"}</b>average score</div>
      <div class="card stat"><b>${pct(r.share)}</b>of the pool is in concepts you have written a 4+ on</div>
      <div class="card stat"><b>${weak ? esc(weak.label) : "–"}</b>${weak ? `weakest dimension (avg ${weak.avg.toFixed(1)})` : "weakest dimension"}</div>
    </div>
    <div class="card">
      <h2>History</h2>
      ${h.length ? `<table><tr><th>Date</th><th>Topic</th><th>Score</th><th>Task</th></tr>${h.slice().reverse().map((x) => {
        const t = KB.topics.find((k) => k.id === x.topicId);
        return `<tr><td>${esc(x.at.slice(0, 10))}</td><td><a href="#/t/${x.topicId}">${esc(t ? shortStatement(t, 80) : x.topicId)}</a></td><td>${x.score}</td><td class="status-${esc(x.task)}">${esc(x.task)}</td></tr>`;
      }).join("")}</table>` : `<p class="muted">No essays yet. <a href="#/">Pick a topic</a>.</p>`}
      <p class="muted small">History lives only in this browser.</p>
    </div>`;
}

function route() {
  const [path, query] = (location.hash.slice(1) || "/").split("?");
  const params = new URLSearchParams(query || "");
  document.querySelectorAll("nav a").forEach((a) => a.classList.toggle("on", a.getAttribute("href") === `#${path}`));
  if (path.startsWith("/t/")) viewTopic(path.slice(3));
  else if (path === "/topics") viewTopics(params);
  else if (path === "/progress") viewProgress();
  else viewInsights();
  window.scrollTo(0, 0);
}

function setupSettings() {
  const dlg = document.getElementById("settings");
  const key = document.getElementById("api-key");
  const model = document.getElementById("model");
  document.getElementById("settings-btn").onclick = () => {
    const s = settings();
    key.value = s.apiKey || "";
    model.innerHTML = HEALTH.models.map((m) => `<option ${m === (s.model || HEALTH.defaultModel) ? "selected" : ""}>${m}</option>`).join("");
    document.getElementById("demo-status").textContent = HEALTH.demoKey
      ? `Free demo: up to ${HEALTH.dailyLimit} Muse calls per day without a key.`
      : "No demo key on this server. Add your own key to use Muse.";
    dlg.showModal();
  };
  dlg.addEventListener("close", () => {
    if (dlg.returnValue === "save") store.set("sixpoint.settings", { apiKey: key.value.trim(), model: model.value });
  });
}

async function boot() {
  [KB] = await Promise.all([
    fetch("/data/kb.json").then((r) => r.json()),
    fetch("/api/health").then((r) => r.json()).then((h) => { HEALTH = h; }).catch(() => {}),
  ]);
  setupSettings();
  window.addEventListener("hashchange", route);
  route();
}

boot();
