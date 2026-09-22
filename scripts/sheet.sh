#!/usr/bin/env bash
# Timestamped contact sheet of a video, for indexing what is on screen when.
#
#   sheet.sh <video> [seconds-per-tile=4] [out.png]
#
# Each tile carries its timestamp in the corner. Use 10 s tiles for the
# talking head (you only need to see where the speaker sits and where the hands go)
# and 4 s tiles for a screen recording (you need every screen change).
set -euo pipefail
v="$1"; step="${2:-4}"; out="${3:-${1%.*}_sheet.png}"
dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$v")
n=$(python3 -c "import math; print(math.ceil($dur/$step))")
cols=5
rows=$(python3 -c "import math; print(math.ceil($n/$cols))")
ffmpeg -v error -y -i "$v" \
  -vf "fps=1/$step,drawtext=text='%{pts\:hms}':fontsize=48:fontcolor=yellow:x=16:y=16:box=1:boxcolor=black@0.6,scale=640:-1,tile=${cols}x${rows}" \
  -frames:v 1 "$out"
echo "$out  ($n tiles, $step s each)"
