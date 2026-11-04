// Turns public links into plain text in the browser. The server only relays the bytes (CORS); PDFs are parsed here.
// pdf.js is large, so it loads only when a PDF link is read.
async function pdfLib() {
  const [pdfjs, worker] = await Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url")]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs;
}

const tidy = (s) => s.replace(/ /g, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

async function pdfText(buf) {
  const pdfjs = await pdfLib();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  const title = (await doc.getMetadata().catch(() => null))?.info?.Title || "";
  const pages = [];
  for (let i = 1; i <= Math.min(doc.numPages, 300); i++) {
    const c = await (await doc.getPage(i)).getTextContent();
    let line = "";
    const out = [];
    for (const it of c.items) {
      line += it.str;
      if (it.hasEOL) { out.push(line); line = ""; } else if (!it.str.endsWith(" ")) line += " ";
    }
    out.push(line);
    pages.push(out.join("\n"));
  }
  return { title, text: tidy(pages.join("\n\n")), pages: doc.numPages };
}

function htmlText(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script,style,noscript,svg,nav,footer,header,form,iframe,[aria-hidden=true]").forEach((n) => n.remove());
  const root = doc.querySelector("main,article,[role=main]") || doc.body;
  const blocks = [...root.querySelectorAll("h1,h2,h3,h4,p,li,td,th,blockquote,pre,dd,dt")].map((n) => n.textContent.trim()).filter(Boolean);
  return { title: doc.title.trim(), text: tidy(blocks.length > 5 ? blocks.join("\n") : root.textContent) };
}

export async function loadSource(url) {
  const r = await fetch(`/api/fetch?url=${encodeURIComponent(url)}`);
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `Could not load ${url}`);
  const type = r.headers.get("content-type") || "";
  const got = type.includes("pdf") ? { kind: "pdf", ...(await pdfText(await r.arrayBuffer())) } : { kind: "web", ...htmlText(await r.text()) };
  if (got.text.length < 200) throw new Error(`Found almost no text at ${url}. If it is a scanned PDF or a page built by scripts, try another link.`);
  return { url, title: got.title || url, kind: got.kind, text: got.text, chars: got.text.length };
}

// Splits on paragraph boundaries so a question is rarely cut in half.
export function chunks(text, size = 12000) {
  const out = [];
  let cur = "";
  for (const para of text.split(/\n{2,}|\n(?=\s*\d{1,3}[.)]\s)/)) {
    if (cur && cur.length + para.length > size) { out.push(cur); cur = ""; }
    cur += (cur ? "\n\n" : "") + para;
    while (cur.length > size * 1.5) { out.push(cur.slice(0, size)); cur = cur.slice(size); }
  }
  if (cur.trim()) out.push(cur);
  return out;
}
