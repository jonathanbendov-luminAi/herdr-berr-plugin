#!/bin/sh
# Pre-renders the GIF into chafa ANSI frames (one file, frames split by form-feed).
# Usage: ./build-frames.sh [cols] [rows] [outfile]
set -e
cd "$(dirname "$0")"
COLS=${1:-74}; ROWS=${2:-16}; OUT=${3:-frames.ans}
TMP=$(mktemp -d)
ffmpeg -loglevel error -y -i powell-brrr.gif -vf "crop=498:216:0:30,fps=12,eq=brightness=0.04:saturation=1.2" "$TMP/%03d.png"
PART=$(mktemp "$OUT.XXXXXX"); : > "$PART"
for f in "$TMP"/*.png; do
  chafa --format symbols --colors full --symbols block+space --fill none \
        --stretch --size "${COLS}x${ROWS}" --work 9 --dither none --animate off "$f" \
    | sed 's/\x1b\[?25[lh]//g' >> "$PART"
  printf '\f' >> "$PART"
done
mv "$PART" "$OUT"
rm -rf "$TMP"
