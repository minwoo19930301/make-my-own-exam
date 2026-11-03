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

export async function chat({ apiKey, model, system, user, maxTokens = 2500, fetchImpl = fetch }) {
  const r = await fetchImpl(`${MUSE_BASE}/chat/completions`, {
    method: "POST",
    signal: AbortSignal.timeout(90000),
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: MODELS.includes(model) ? model : DEFAULT_MODEL,
      max_completion_tokens: maxTokens,
      reasoning_effort: "low",
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const status = r.status === 401 || r.status === 403 ? 401 : r.status === 429 ? 429 : 502;
    throw new HttpError(status, data.error?.message || `Meta Model API error (${r.status})`);
  }
  const content = data.choices?.[0]?.message?.content;
  return Array.isArray(content) ? content.map((c) => c.text || "").join("") : String(content || "");
}

// A visitor's own key is used as-is. Without one, the server key is used under a daily cap.
export async function resolveKey(request, env, body) {
  const own = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  if (own) return { apiKey: own, shared: false };
  if (!env.MODEL_API_KEY) throw new HttpError(401, "Add your Meta Model API key in Settings.");
  const limit = Number(env.DAILY_LIMIT || 30);
  if (env.LIMITS) {
    const ip = request.headers.get("cf-connecting-ip") || "unknown";
    const key = `${new Date().toISOString().slice(0, 10)}:${ip}`;
    const used = Number((await env.LIMITS.get(key)) || 0);
    if (used >= limit) throw new HttpError(429, `Free demo limit reached (${limit}/day). Add your own Meta Model API key in Settings.`);
    await env.LIMITS.put(key, String(used + 1), { expirationTtl: 60 * 60 * 26 });
  }
  return { apiKey: env.MODEL_API_KEY, shared: true };
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
