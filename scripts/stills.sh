#!/usr/bin/env bash
# Render check frames of the vertical reel at chosen ORIGINAL-recording
# seconds and tile them five to a row, so layout and beat timing can be
# judged before the render.
#
#   stills.sh <CompositionId> <segments.json> <sec> [<sec> ...]
#
# Run from the Remotion project root. Seconds are mapped to edit frames
# through the takes in segments.json (the same mapping the composition
# uses), so a second that was cut fails loudly instead of rendering the
# wrong frame. Frames land in out/reel/f_<sec>.png, grids in
# out/reel/grid_<n>.png (five 384x683 tiles per row, two rows per grid).
set -euo pipefail
comp="$1"; segs="$2"; shift 2
mkdir -p out/reel
files=()
for t in "$@"; do
  f=$(python3 - "$segs" "$t" <<'EOF'
import json, sys
spec = json.load(open(sys.argv[1])); t = float(sys.argv[2]); fps = spec.get("fps", 30)
off = 0
for s in spec["segments"]:
    if s["a"] - 1e-6 <= t <= s["b"] + 1e-6:
        print(off + round((t - s["a"]) * fps)); break
    off += s["frames"]
else:
    sys.exit(f"{t} is not inside any take")
EOF
)
  npx remotion still src/index.ts "$comp" "out/reel/f_$t.png" --frame="$f" --log=error 2>&1 | grep -iE "error|fail" || true
  files+=("out/reel/f_$t.png")
done
i=0; n=1
while [ $i -lt ${#files[@]} ]; do
  chunk=("${files[@]:$i:10}")
  args=(); fc=""
  for k in "${!chunk[@]}"; do args+=(-i "${chunk[$k]}"); fc+="[$k]scale=384:-1,drawtext=text='$(basename "${chunk[$k]}" .png | sed 's/f_//')':fontsize=40:fontcolor=yellow:x=12:y=12:box=1:boxcolor=black@0.6[s$k];"; done
  cnt=${#chunk[@]}
  # pad to a multiple of 5 with black tiles so xstack rows are full
  pad=$(( (5 - cnt % 5) % 5 ))
  for ((p=0; p<pad; p++)); do fc+="color=black:s=384x683:d=1[s$((cnt+p))];"; done
  total=$((cnt+pad)); rows=$((total/5))
  layout=""
  for ((q=0; q<total; q++)); do
    col=$((q%5)); row=$((q/5))
    x=$((col*384)); y=$((row*683))
    layout+="${x}_${y}|"
  done
  layout=${layout%|}
  inputs=""; for ((q=0; q<total; q++)); do inputs+="[s$q]"; done
  fc+="${inputs}xstack=inputs=$total:layout=$layout"
  ffmpeg -v error -y "${args[@]}" -filter_complex "$fc" -frames:v 1 "out/reel/grid_$n.png"
  echo "out/reel/grid_$n.png  <- ${chunk[*]}"
  i=$((i+10)); n=$((n+1))
done
