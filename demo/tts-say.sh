#!/bin/bash
# Placeholder narration with the macOS voice, one WAV per scene. Replace with demo/tts-elevenlabs.mjs output for the final cut.
cd "$(dirname "$0")" && mkdir -p audio
python3 -c "import json;[print(s['id']+'\t'+s['text']) for s in json.load(open('narration.json'))]" | while IFS=$'\t' read -r id text; do
  say -v Samantha -r 175 -o "audio/$id.aiff" "$text" && ffmpeg -loglevel error -y -i "audio/$id.aiff" -ar 44100 "audio/$id.wav" && rm "audio/$id.aiff"
done
