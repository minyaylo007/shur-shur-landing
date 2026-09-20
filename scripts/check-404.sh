#!/usr/bin/env bash
# Проверка несуществующих адресов на ЖИВОМ сервере: код ответа и язык страницы.
#
# Зачем скрипт, а не только vitest: код ответа нельзя проверить, не сделав
# запрос. Страница, которая выглядит правильно, но отвечает 200, — это сайт,
# выброшенный из поиска, и глазами это не видно. `npm test` идёт до сборки,
# поэтому HTTP-проверка живёт отдельно и запускается после `npm run build`
# (CI: шаг «404 на несуществующих адресах»).
#
#   scripts/check-404.sh http://127.0.0.1:3000
#
# Печатает таблицу и падает, если хоть одна строка разошлась с ожиданием.
set -uo pipefail

base="${1:-http://127.0.0.1:3000}"
base="${base%/}"
fail=0

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

note() { echo "  ✗ $*"; fail=1; }

# Язык документа: атрибут lang у <html>. Именно его не было у штатной
# страницы Next — «404: This page could not be found» без единого признака,
# на каком языке говорят с человеком.
attr() { sed -n "s/.*<html[^>]*$1=\"\([a-zA-Z-]*\)\".*/\1/p" "$2" | head -n1; }

printf '| Адрес | Код | lang | Ссылка на живую страницу |\n'
printf '|---|---|---|---|\n'

# want_code want_lang path
check() {
  local want_code="$1" want_lang="$2" path="$3"
  local body="$tmp/body" head="$tmp/head" code lang dir link robots
  code=$(curl -sS -o "$body" -D "$head" -w '%{http_code}' --max-time 30 "$base$path" || echo 000)
  lang=$(attr lang "$body"); dir=$(attr dir "$body")
  link="—"

  if [ "$want_code" = "404" ]; then
    # Выход со страницы: ссылки на адреса, которые реально существуют.
    link=""
    for loc in uk en he ro; do
      grep -qF "href=\"/$loc\"" "$body" && link="$link /$loc"
    done
    link="${link# }"
    [ -n "$link" ] || { link="—"; note "$path: на странице нет ни одной ссылки на живую страницу сайта"; }
    # Главный выход — на языке самой страницы, иначе это второй тупик.
    [ -z "$lang" ] || grep -qF "href=\"/$lang\"" "$body" \
      || note "$path: страница на языке '$lang', а ссылки на /$lang нет"
    [ -n "$lang" ] || note "$path: у <html> нет lang — человеку не сказали, на каком языке с ним говорят"
    grep -qiF "This page could not be found" "$body" && note "$path: это штатная страница Next, а не наша"
    # Ровно один noindex: дубль означает, что мы печатаем своё поверх чужого.
    robots=$(grep -o 'name="robots"' "$body" | wc -l)
    [ "$robots" = "1" ] || note "$path: meta robots встречается $robots раз(а), ждали 1"
  fi

  [ "$code" = "$want_code" ] || note "$path: ждали код $want_code, получили $code"
  [ -z "$want_lang" ] || [ "$lang" = "$want_lang" ] || note "$path: ждали lang=$want_lang, получили '${lang:-—}'"
  [ "$lang" != "he" ] || [ "$dir" = "rtl" ] || note "$path: иврит без dir=rtl"

  printf '| `%s` | %s | %s | %s |\n' "$path" "$code" "${lang:-—}" "$link"
}

# 1. Язык в адресе есть, страницы нет → страница на этом языке.
check 404 uk /uk/tsiny
check 404 en /en/contact
check 404 he /he/xxx
check 404 ro /ro/preturi
# 2. Языка в адресе нет или он чужой → корневая двуязычная страница.
check 404 uk /fr
check 404 uk /ukk
check 404 uk /qwerty
# 3. Контроль: рабочие адреса не должны стать 404.
check 200 uk /uk
check 200 he /he
check 308 "" /

if [ "$fail" -ne 0 ]; then
  echo "Проверка не прошла: несуществующий адрес отвечает не тем (подробности выше)"
  exit 1
fi
echo "Проверка прошла: несуществующие адреса — 404 со своим языком и ссылкой на живую страницу; рабочие — 200; апекс — 308"
