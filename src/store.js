import { useEffect, useState } from "react";

export function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

export function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
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

export async function api(path, body) {
  const { apiKey, model } = read("sixpoint.settings", {});
  const r = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...body, apiKey: apiKey || undefined, model: model || undefined }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
  return data;
}
