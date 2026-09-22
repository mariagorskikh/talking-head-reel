#!/usr/bin/env bash
# Render a composition detached from the calling shell, because the Bash
# tool kills anything past ten minutes and a two-minute talking-head edit
# renders in about twenty five.
#
#   render.sh <CompositionId> <out.mp4> [concurrency=8]
#
# Run from the Remotion project root. Refuses to start if a remotion render
# is already running (a stale one competes for the same output file and
# doubles the ETA). Progress goes to out/reel/render.log; the last line
# printed here is a Monitor command that reports progress, errors and
# completion.
set -euo pipefail
comp="$1"; out="$2"; conc="${3:-8}"
mkdir -p out/reel

if pgrep -f "[r]emotion render" >/dev/null; then
  echo "a remotion render is already running:" >&2
  pgrep -fl "[r]emotion render" | cut -c1-120 >&2
  echo "kill -9 it first (kill -9 <pid>; plain kill is ignored mid-render)" >&2
  exit 1
fi

nohup npx remotion render src/index.ts "$comp" "$out" \
  --codec h264 --crf 18 --concurrency "$conc" --log=error \
  > out/reel/render.log 2>&1 < /dev/null &
disown
sleep 5
if ! pgrep -f "[r]emotion render" >/dev/null; then
  echo "render exited immediately:"; cat out/reel/render.log; exit 1
fi
echo "rendering $comp -> $out (log: out/reel/render.log)"
cat <<EOF

Monitor with (every 90 s; exits on done or error):
cd $(pwd); while true; do sleep 90; last=\$(tr '\\r' '\\n' < out/reel/render.log | grep -E "Rendered [0-9]+/" | tail -1); err=\$(tr '\\r' '\\n' < out/reel/render.log | grep -iE "error|fail" | head -2); if [ -n "\$err" ]; then echo "ERROR: \$err"; exit 1; fi; if ! pgrep -f "[r]emotion render" >/dev/null; then if [ -f "$out" ]; then echo "DONE \$(ls -la "$out")"; exit 0; else echo "EXITED without output: \$last"; exit 1; fi; fi; echo "progress: \$last"; done
EOF
