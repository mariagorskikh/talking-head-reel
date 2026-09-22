#!/usr/bin/env bash
# Low-memory, low-disk render for a Mac that is swapping: the composition is
# rendered muted in frame-range chunks with two browser tabs, the audio is
# rendered on its own (no frames), and ffmpeg joins them. Peak scratch is
# one chunk of JPEG frames instead of the whole reel, and two headless
# Chromes instead of eight, which is what pushes swap onto a nearly full
# disk (the symptom is ENOSPC in /var/folders/.../react-motion-render*).
#
#   render-chunked.sh <CompositionId> <out.mp4> [chunk-frames=420] [concurrency=2] [segments.json=src/talk/reel-segments.json]
#
# Run from the Remotion project root; detached like render.sh, log in
# out/reel/render.log, chunks in out/reel/chunks/. The frame count comes
# from totalFrames in segments.json (what cut.py wrote). Refuses to start a
# chunk with under 300 MB free.
set -euo pipefail
comp="$1"; out="$2"; chunk="${3:-420}"; conc="${4:-2}"; segs="${5:-src/talk/reel-segments.json}"
mkdir -p out/reel/chunks
if pgrep -f "[r]emotion render" >/dev/null; then echo "a remotion render is already running; kill -9 it first" >&2; exit 1; fi
total=$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['totalFrames'])" "$segs")
cat > out/reel/chunked.sh <<EOF
set -e
cd "$(pwd)"
rm -f out/reel/chunks/*
n=0; a=0
while [ \$a -lt $total ]; do
  b=\$(( a + $chunk - 1 )); [ \$b -ge $total ] && b=\$(( $total - 1 ))
  free=\$(df -k / | tail -1 | awk '{print \$4}')
  if [ "\$free" -lt 300000 ]; then echo "ERROR: only \$((free/1024)) MB free before chunk \$n"; exit 1; fi
  echo "chunk \$n: frames \$a-\$b (free \$((free/1024)) MB)"
  npx remotion render src/index.ts "$comp" "out/reel/chunks/c_\$(printf %02d \$n).mp4" --frames=\$a-\$b --codec h264 --crf 18 --concurrency $conc --jpeg-quality 65 --muted --log=error
  echo "file 'chunks/c_\$(printf %02d \$n).mp4'" >> out/reel/chunks.txt
  n=\$((n+1)); a=\$((b+1))
done
echo "audio"
npx remotion render src/index.ts "$comp" out/reel/chunks/audio.aac --codec aac --log=error
echo "join"
ffmpeg -v error -y -f concat -safe 0 -i out/reel/chunks.txt -i out/reel/chunks/audio.aac -c:v copy -c:a aac -b:a 192k -movflags +faststart -shortest "$out"
echo "DONE \$(ls -la "$out")"
EOF
rm -f out/reel/chunks.txt
nohup bash out/reel/chunked.sh > out/reel/render.log 2>&1 < /dev/null &
disown
sleep 3
echo "chunked render of $comp ($total frames, $chunk per chunk, concurrency $conc) -> $out; log: out/reel/render.log"
