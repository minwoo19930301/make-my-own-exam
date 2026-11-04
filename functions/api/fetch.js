// Fetches a public web page or PDF for the browser, which extracts the text itself (PDFs are parsed client-side).
import { json } from "../_lib/muse.js";

const MAX = 15 * 1024 * 1024;
const OK = /^(text\/html|text\/plain|application\/pdf|application\/xhtml\+xml)/i;

export async function onRequestGet({ request }) {
  const target = new URL(request.url).searchParams.get("url") || "";
  let url;
  try { url = new URL(target); } catch { return json({ error: "Give a full http(s) link." }, 400); }
  if (!/^https?:$/.test(url.protocol)) return json({ error: "Only http and https links work." }, 400);
  let r;
  try {
    r = await fetch(url, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (compatible; MakeMyOwnExam/1.0)", accept: "text/html,application/pdf,text/plain;q=0.9,*/*;q=0.5" }, signal: AbortSignal.timeout(30000) });
  } catch {
    return json({ error: "Could not reach that link." }, 502);
  }
  if (!r.ok) return json({ error: `That link returned ${r.status}.` }, 502);
  const type = r.headers.get("content-type") || "";
  if (!OK.test(type)) return json({ error: `Unsupported content type: ${type || "unknown"}. Use a web page or a PDF.` }, 415);
  if (Number(r.headers.get("content-length") || 0) > MAX) return json({ error: "That file is over 15 MB." }, 413);
  return new Response(r.body, { headers: { "content-type": type, "x-final-url": r.url, "cache-control": "public, max-age=3600" } });
}
