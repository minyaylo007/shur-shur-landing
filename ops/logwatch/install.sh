#!/usr/bin/env bash
# Ставит сторожа журнала SHUR-SHUR: скрипт в /opt/ihor/shur/logwatch, пользовательские юниты.
# Без root, ничего не пишет в /etc. Повторный запуск безопасен: state.json не трогается.
#   bash ops/logwatch/install.sh
# Откат: systemctl --user disable --now ihor-shur-logwatch.timer
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT=/opt/ihor/shur/logwatch
UNITS="$HOME/.config/systemd/user"

umask 077
mkdir -p "$ROOT" "$UNITS"
chmod 700 "$ROOT"
cp "$SRC/logwatch.mjs" "$ROOT/logwatch.mjs.new"
mv "$ROOT/logwatch.mjs.new" "$ROOT/logwatch.mjs"

cp "$SRC/ihor-shur-logwatch.service" "$SRC/ihor-shur-logwatch.timer" "$UNITS/"
systemctl --user daemon-reload
systemctl --user enable --now ihor-shur-logwatch.timer
systemctl --user --no-pager list-timers ihor-shur-logwatch.timer
