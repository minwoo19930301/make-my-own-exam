import { json, MODELS, DEFAULT_MODEL } from "../_lib/muse.js";

export const onRequestGet = ({ env }) =>
  json({ ok: true, demoKey: Boolean(env.MODEL_API_KEY), dailyLimit: Number(env.DAILY_LIMIT || 30), models: MODELS, defaultModel: DEFAULT_MODEL, webSearch: Boolean(env.TAVILY_API_KEY) });
