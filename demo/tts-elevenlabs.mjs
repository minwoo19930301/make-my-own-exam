// Final narration with ElevenLabs, one WAV per scene in demo/audio/.
// Usage: ELEVENLABS_API_KEY=... node demo/tts-elevenlabs.mjs [voiceId]
//   With no voiceId it lists the voices on the account (cloned voices first) and exits.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const key = process.env.ELEVENLABS_API_KEY;
if (!key) throw new Error("Set ELEVENLABS_API_KEY in your own terminal first.");
const dir = new URL(".", import.meta.url).pathname;
const voice = process.argv[2];
const h = { "xi-api-key": key };

if (!voice) {
  const { voices } = await (await fetch("https://api.elevenlabs.io/v1/voices", { headers: h })).json();
  for (const v of voices.sort((a, b) => (a.category === "cloned" ? -1 : 1) - (b.category === "cloned" ? -1 : 1))) console.log(`${v.voice_id}  ${v.category.padEnd(12)} ${v.name}`);
  process.exit(0);
}

mkdirSync(`${dir}audio`, { recursive: true });
for (const s of JSON.parse(readFileSync(`${dir}narration.json`, "utf8"))) {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { ...h, "content-type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify({ text: s.text, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.2 } }),
  });
  if (!r.ok) throw new Error(`${s.id}: ${r.status} ${await r.text()}`);
  writeFileSync(`${dir}audio/${s.id}.mp3`, Buffer.from(await r.arrayBuffer()));
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", `${dir}audio/${s.id}.mp3`, "-ar", "44100", `${dir}audio/${s.id}.wav`]);
  console.log(`${s.id} ok`);
}
