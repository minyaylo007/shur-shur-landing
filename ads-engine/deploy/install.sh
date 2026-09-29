#!/usr/bin/env bash
# Устанавливает ads-engine в /opt/ihor/shur-ads и ставит ПОЛЬЗОВАТЕЛЬСКИЕ юниты.
# Без root. Ничего не пишет в /etc, не трогает Caddy. Секреты не печатает.
#   bash ads-engine/deploy/install.sh          — копия кода + юниты + запуск
# Повторный запуск безопасен: env и limits.json не перезаписываются, данные не трогаются.
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT=/opt/ihor/shur-ads
UNITS="$HOME/.config/systemd/user"

umask 077
mkdir -p "$ROOT/app" "$ROOT/data" "$UNITS"
chmod 700 "$ROOT" "$ROOT/data"

# Код: только то, что нужно для работы (без тестов).
rm -rf "$ROOT/app.new"
mkdir -p "$ROOT/app.new"
cp -r "$SRC/src" "$SRC/fixtures" "$SRC/package.json" "$ROOT/app.new/"
rm -rf "$ROOT/app.old"
mv "$ROOT/app" "$ROOT/app.old"
mv "$ROOT/app.new" "$ROOT/app"

if [ ! -f "$ROOT/env" ]; then
  cp "$SRC/deploy/env.example" "$ROOT/env"
  # Секрет рождается и пишется внутри node: не попадает ни в argv, ни в вывод.
  ENV_FILE="$ROOT/env" node -e '
    const fs = require("node:fs");
    const f = process.env.ENV_FILE;
    const s = require("node:crypto").randomBytes(32).toString("hex");
    fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace(/^LEDGER_HMAC_SECRET=.*$/m, "LEDGER_HMAC_SECRET=" + s), { mode: 0o600 });
  '
  echo "env создан, LEDGER_HMAC_SECRET сгенерирован (не печатается)"
fi
chmod 600 "$ROOT/env"

if [ ! -f "$ROOT/limits.json" ]; then
  cp "$SRC/config/limits.example.json" "$ROOT/limits.json"
fi
chmod 600 "$ROOT/limits.json"

cp "$SRC/deploy/ihor-shur-ads.service" "$SRC/deploy/ihor-shur-ads-daily.service" "$SRC/deploy/ihor-shur-ads-daily.timer" "$UNITS/"
systemctl --user daemon-reload
systemctl --user enable ihor-shur-ads.service ihor-shur-ads-daily.timer
systemctl --user restart ihor-shur-ads.service
systemctl --user start ihor-shur-ads-daily.timer
systemctl --user --no-pager status ihor-shur-ads.service | head -5
