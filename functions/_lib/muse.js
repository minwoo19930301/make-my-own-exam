// Meta Model API (OpenAI-compatible chat completions).
export const MUSE_BASE = "https://api.meta.ai/v1";
export const DEFAULT_MODEL = "muse-spark-1.3";
export const MODELS = ["muse-spark-1.3", "muse-spark-1.2", "muse-spark-1.1"];

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function extractJSON(text) {
  const raw = String(text || "").replace(/```(?:json)?/gi, "");
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < 0) throw new HttpError(502, "The model did not return JSON.");
  const slice = raw.slice(start, end + 1).replace(/,\s*([}\]])/g, "$1");
  try {
    return JSON.parse(slice);
  } catch {
    throw new HttpError(502, "Could not read the model response. Try again.");
  }
}

export async function chat({ apiKey, baseUrl, model, system, user, maxTokens = 2500, fetchImpl = fetch }) {
  const custom = Boolean(baseUrl);
  const r = await fetchImpl(`${custom ? baseUrl.replace(/\/+$/, "") : MUSE_BASE}/chat/completions`, {
    method: "POST",
    signal: AbortSignal.timeout(150000),
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: custom ? model : MODELS.includes(model) ? model : DEFAULT_MODEL,
      max_completion_tokens: maxTokens,
      ...(custom ? {} : { reasoning_effort: "low" }),
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const status = r.status === 401 || r.status === 403 ? 401 : r.status === 429 ? 429 : 502;
    throw new HttpError(status, data.error?.message || `${custom ? "Provider" : "Meta Model API"} error (${r.status})`);
  }
  const content = data.choices?.[0]?.message?.content;
  return Array.isArray(content) ? content.map((c) => c.text || "").join("") : String(content || "");
}

// A visitor's own key is used as-is. Without one, the server's Muse key is used under a daily cap.
// provider "custom" points at any OpenAI-compatible endpoint with the visitor's own key.
export async function resolveKey(request, env, body) {
  const own = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  if (body.provider === "custom") {
    const baseUrl = String(body.baseUrl || "").trim();
    if (!/^https:\/\/[^\s/]+/.test(baseUrl)) throw new HttpError(400, "Custom provider needs an https base URL.");
    if (!own || !body.model) throw new HttpError(400, "Custom provider needs a key and a model name.");
    return { apiKey: own, baseUrl, model: String(body.model), shared: false };
  }
  if (own) return { apiKey: own, model: body.model, shared: false };
  if (!env.MODEL_API_KEY) throw new HttpError(401, "Add your Meta Model API key in Settings.");
  const limit = Number(env.DAILY_LIMIT || 30);
  if (env.LIMITS) {
    const ip = request.headers.get("cf-connecting-ip") || "unknown";
    const key = `${new Date().toISOString().slice(0, 10)}:${ip}`;
    const used = Number((await env.LIMITS.get(key)) || 0);
    if (used >= limit) throw new HttpError(429, `Free demo limit reached (${limit}/day). Add your own key in Settings.`);
    await env.LIMITS.put(key, String(used + 1), { expirationTtl: 60 * 60 * 26 });
  }
  return { apiKey: env.MODEL_API_KEY, model: body.model, shared: true };
}

// Muse with its own web search tool (Responses API). Returns the final JSON plus the searches it ran.
export async function searchJSON({ apiKey, model, instructions, input, fetchImpl = fetch }) {
  const r = await fetchImpl(`${MUSE_BASE}/responses`, {
    method: "POST",
    signal: AbortSignal.timeout(170000),
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ model: MODELS.includes(model) ? model : DEFAULT_MODEL, reasoning: { effort: "low" }, instructions, input, tools: [{ type: "web_search" }] }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const status = r.status === 401 || r.status === 403 ? 401 : r.status === 429 ? 429 : 502;
    throw new HttpError(status, data.error?.message || `Meta Model API error (${r.status})`);
  }
  const out = data.output || [];
  const searches = out.filter((o) => o.type === "web_search_call").map((o) => o.action?.query || o.action?.url).filter(Boolean);
  const final = out.filter((o) => o.type === "message" && o.phase !== "commentary").flatMap((o) => o.content || []).map((c) => c.text || "").join("");
  return { json: extractJSON(final), searches };
}

// Ask for JSON, retrying once with a larger budget when the reply is cut off or malformed.
export async function chatJSON({ maxTokens = 3500, ...opts }) {
  for (let attempt = 0; ; attempt++) {
    const raw = await chat({ ...opts, maxTokens: attempt ? Math.round(maxTokens * 1.6) : maxTokens });
    try {
      return extractJSON(raw);
    } catch (e) {
      if (attempt || e.status !== 502) throw e;
    }
  }
}

export function json(data, status = 200) {
  return Response.json(data, { status, headers: { "cache-control": "no-store" } });
}

export function handle(fn) {
  return async (context) => {
    try {
      const body = await context.request.json().catch(() => ({}));
      return json(await fn(body, context));
    } catch (err) {
      return json({ error: err.message || "Unexpected error" }, err.status || 500);
    }
  };
}
