#!/bin/sh
# Renders a GIF into frames for strip.mjs. Writes atomically, so concurrent builds are safe.
# Usage: build-frames.sh <gif> <crop|""> <fps> <cols> <rows> <format: chafa|rgb|png> <out>
#   chafa: one file, chafa ANSI frames separated by form-feed
#   rgb:   one file, raw rgb24 frames at cols x (rows*2) pixels (half-block renderer)
#   png:   a directory of PNG frames (Kitty graphics renderer)
set -e
GIF=$1; CROP=$2; FPS=$3; COLS=$4; ROWS=$5; FMT=$6; OUT=$7
VF="fps=$FPS"
[ -n "$CROP" ] && VF="crop=$CROP,$VF"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

case "$FMT" in
  chafa)
    ffmpeg -loglevel error -y -i "$GIF" -vf "$VF,eq=brightness=0.04:saturation=1.2" "$TMP/%04d.png"
    PART=$(mktemp "$OUT.XXXXXX")
    for f in "$TMP"/*.png; do
      chafa --format symbols --colors full --symbols block+space --fill none \
            --stretch --size "${COLS}x${ROWS}" --work 9 --dither none --animate off "$f" >> "$PART"
      printf '\f' >> "$PART"
    done
    mv "$PART" "$OUT" ;;
  rgb)
    PART=$(mktemp "$OUT.XXXXXX")
    ffmpeg -loglevel error -y -i "$GIF" \
      -vf "$VF,scale=${COLS}:$((ROWS * 2)):flags=area,eq=brightness=0.06:saturation=1.3:gamma=1.15" \
      -f rawvideo -pix_fmt rgb24 "$PART"
    mv "$PART" "$OUT" ;;
  png)
    ffmpeg -loglevel error -y -i "$GIF" -vf "$VF,scale=320:-2:flags=lanczos,format=rgb24" \
      -compression_level 100 "$TMP/%04d.png"
    rm -rf "$OUT.part" && mv "$TMP" "$OUT.part" && mkdir -p "$TMP" && rm -rf "$OUT" && mv "$OUT.part" "$OUT" ;;
  *) echo "unknown format $FMT" >&2; exit 2 ;;
esac
