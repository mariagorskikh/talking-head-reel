#!/usr/bin/env bash
# Transcode a PORTRAIT phone recording into the 1080x1920 30fps H.264 file
# that Remotion's OffthreadVideo can seek cheaply, keeping the audio.
#
#   prep.sh <IMG_xxxx.MOV> <outdir>          -> <outdir>/ig1080.mp4
#
# The phone writes a landscape 1920x1080 HEVC stream with a rotation=90 tag;
# ffmpeg applies the rotation before the filter graph, so the scale target is
# 1080:1920, not 1920:1080. The Apple hardware encoder does five minutes of
# 4K/1080p HEVC in about a minute.
set -euo pipefail
if [ "$#" -ne 2 ]; then echo "usage: prep.sh <talk.MOV> <outdir>" >&2; exit 2; fi
src="$1"; out="$2"
mkdir -p "$out"
echo "== source"
ffprobe -v error -show_entries format=duration -show_entries stream=codec_name,width,height,r_frame_rate -of default=nw=1 "$src" | grep -v "codec_name=unknown" || true
rot=$(ffprobe -v error -select_streams v:0 -show_entries stream_side_data=rotation -of csv=p=0 "$src" | head -1 | tr -d ',')
echo "rotation tag: ${rot:-none}"
ffmpeg -v error -y -i "$src" \
  -vf "scale=1080:1920,fps=30" \
  -c:v h264_videotoolbox -b:v 12M -pix_fmt yuv420p \
  -c:a aac -b:a 192k -movflags +faststart \
  "$out/ig1080.mp4"
echo "-> $out/ig1080.mp4"
ffprobe -v error -show_entries format=duration -show_entries stream=codec_name,width,height,r_frame_rate -of default=nw=1 "$out/ig1080.mp4" | grep -v "codec_name=unknown" || true
