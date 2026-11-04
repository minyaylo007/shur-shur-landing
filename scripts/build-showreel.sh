#!/usr/bin/env bash
# Шоурил первого экрана (redesign v4, бриф B1.1): 8 уже опубликованных клипов
# из public/work/video по ~1,6 с, без звука, 720×1280, 24 к/с — ~13 с.
# Новых съёмок здесь нет: только монтаж того, что уже на сайте.
#
#   bash scripts/build-showreel.sh            # пишет public/work/video/showreel.mp4
#                                             # и public/work/poster/showreel.webp
#
# Вес держится на уровне прежнего hero-street.mp4 (~840 КБ): CRF подобран так,
# чтобы файл не превысил 900 КБ. Порядок клипов — открывается улицей Черновцов
# (тот же кадр, что был героем), дальше по отраслям.
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=public/work/video
OUT=public/work/video/showreel.mp4
POSTER=public/work/poster/showreel.webp
CLIPS=(hero-street reel-kitchen reel-bride bts-crew reel-baklava reel-atelier reel-massage bts-cosmetics)
CUT=1.6   # секунд с клипа
SKIP=0.4  # пропуск первых долей секунды (смазанный старт)
CRF=${CRF:-36}

# hero-street.mp4 left public/ with v4 (nothing references it); it is read
# back from the last commit that had it, into a temp file.
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
if [ ! -f "$SRC/hero-street.mp4" ]; then
  git show 95f343a:public/work/video/hero-street.mp4 > "$TMP/hero-street.mp4"
fi
clip() { if [ -f "$SRC/$1.mp4" ]; then echo "$SRC/$1.mp4"; else echo "$TMP/$1.mp4"; fi; }

inputs=()
filters=""
for i in "${!CLIPS[@]}"; do
  inputs+=(-ss "$SKIP" -t "$CUT" -i "$(clip "${CLIPS[$i]}")")
  filters+="[$i:v]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,fps=24,setsar=1,format=yuv420p[v$i];"
done
concat=""
for i in "${!CLIPS[@]}"; do concat+="[v$i]"; done
filters+="${concat}concat=n=${#CLIPS[@]}:v=1:a=0[out]"

ffmpeg -hide_banner -loglevel error -y "${inputs[@]}" -filter_complex "$filters" -map '[out]' \
  -an -c:v libx264 -preset slow -crf "$CRF" -profile:v high -pix_fmt yuv420p -movflags +faststart "$OUT"
ffmpeg -hide_banner -loglevel error -y -i "$OUT" -frames:v 1 -c:v libwebp -quality 72 "$POSTER"
ls -l "$OUT" "$POSTER"
