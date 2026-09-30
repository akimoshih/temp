#!/usr/bin/env bash
# Final encode: comp/frames/f0000-f0899.jpg + audio/mix.wav -> out/norway_30s_1080p.mp4
set -euo pipefail
cd "$(dirname "$0")/.."
FF=/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2
n=$(ls comp/frames/f*.jpg | wc -l)
[ "$n" -eq 900 ] || { echo "expected 900 frames, found $n"; exit 1; }
mkdir -p out
$FF -y -hide_banner -loglevel warning \
  -framerate 30 -i comp/frames/f%04d.jpg -i audio/mix.wav \
  -map 0:v -map 1:a \
  -c:v libx264 -preset slow -crf 18 -maxrate 16M -bufsize 32M -profile:v high -pix_fmt yuv420p -tune film \
  -x264-params keyint=60:min-keyint=30 \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
  -c:a aac -b:a 320k -ar 48000 \
  -t 30 -movflags +faststart \
  out/norway_30s_1080p.mp4
$FF -hide_banner -i out/norway_30s_1080p.mp4 2>&1 | grep -E "Duration|Stream" || true
