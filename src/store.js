import { useEffect, useState } from "react";

export function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

export function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable or full */ }
}

export function useStored(key, fallback) {
  const [value, setValue] = useState(() => read(key, fallback));
  useEffect(() => { setValue(read(key, fallback)); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (next) => setValue((prev) => {
    const v = typeof next === "function" ? next(prev) : next;
    write(key, v);
    return v;
  });
  return [value, set];
}

export const SETTINGS = "mmoe.settings";

// Every model call carries the visitor's provider choice; with no key the server's Muse key is used.
export async function api(path, body) {
  const s = read(SETTINGS, {});
  const provider = s.provider === "custom" ? { provider: "custom", baseUrl: s.baseUrl, apiKey: s.customKey, model: s.customModel } : { apiKey: s.apiKey || undefined, model: s.model || undefined };
  const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, ...provider }) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
  return data;
}

export const providerLabel = () => {
  const s = read(SETTINGS, {});
  return s.provider === "custom" ? `${s.customModel || "custom model"}` : `Meta Muse (${s.model || "muse-spark-1.3"})`;
};
