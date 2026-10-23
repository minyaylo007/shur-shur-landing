#!/usr/bin/env node
/* SHUR-SHUR log watcher → conductor (OWNER-RULES п.42). No model, no deps.
   Run every 15 min by ihor-shur-logwatch.timer. Each run collects signals:

     journal   ihor-shur-ads / -ads-daily / -dev: JSON lines with level
               error|fatal|warn or an event naming a failure; plain lines with
               error / warning / traceback / exception; PRIORITY 0-4; unit
               failures reported by systemd itself.
     alerts    new or changed *-alerts.txt of the ads-engine daily run.
     github    failed GitHub Actions runs of this repo (Vercel function errors
               arrive here too: the hourly "Vercel logs" workflow fails on them).
     site      four locales of shur-shur.com and the Vercel Analytics script:
               not 200 twice in a row (5 s apart) = signal.

   One line per signature goes to ~/bin/lead-say.sh shur: what, how many
   times, where the log is. A signature is sent at most once an hour; hits in
   between are counted and go out with the next message. The line never
   carries log text — only unit, event name, counter and a command to read
   the log — so lead ids, phones, names and tokens cannot leak through it.

   State: $SHUR_LOGWATCH_DIR/state.json (default /opt/ihor/shur/logwatch).
   The first run only takes a baseline: old alerts and old failed runs are
   not re-announced. --dry-run prints instead of sending and keeps no state. */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DIR = process.env.SHUR_LOGWATCH_DIR || "/opt/ihor/shur/logwatch";
const STATE = join(DIR, "state.json");
const UNITS = process.env.SHUR_LOGWATCH_UNITS?.split(",") ?? ["ihor-shur-ads.service", "ihor-shur-ads-daily.service", "ihor-shur-dev.service"];
const REPORTS = process.env.SHUR_ADS_REPORTS || "/opt/ihor/shur-ads/data/reports";
const REPO = "minyaylo007/shur-shur-landing";
const SITE = "https://shur-shur.com";
const PATHS = ["/uk", "/en", "/he", "/ro", "/_vercel/insights/script.js"];
const HOUR = 3600_000;
const DRY = process.argv.includes("--dry-run");
const SAY = join(homedir(), "bin", "lead-say.sh");

const now = Date.now();
const hash = (s) => createHash("sha256").update(s).digest("hex").slice(0, 10);
const sh = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8", maxBuffer: 64 << 20, timeout: 60_000 });

function loadState() {
  try {
    return JSON.parse(readFileSync(STATE, "utf8"));
  } catch {
    return null;
  }
}

/* sig → { text, count }; text is the message without the counter. */
const signals = new Map();
function hit(sig, text, n = 1) {
  const s = signals.get(sig) ?? { text, count: 0 };
  s.count += n;
  s.text = text;
  signals.set(sig, s);
}

/* ---------- journal ---------- */
const FAIL_EVENT = /fail|error|gave_up|foreign_chat/i;
const PLAIN_BAD = /(error|warn(?:ing)?|traceback|exception|fatal|panic)\b/i;
// A plain line becomes a class: numbers, hex ids and quoted bits vary per hit.
const norm = (s) => s.replace(/"[^"]*"|'[^']*'/g, "_").replace(/[0-9a-f]{6,}/gi, "#").replace(/\d+/g, "#").slice(0, 120);

function journal(state) {
  const args = ["--user", "-o", "json", "--no-pager", "--output-fields=MESSAGE,PRIORITY,_SYSTEMD_USER_UNIT,USER_UNIT"];
  for (const u of UNITS) args.push("-u", u);
  if (state.cursor) args.push("--after-cursor", state.cursor);
  else args.push("--since", process.env.SHUR_LOGWATCH_SINCE || "-15min"); // SINCE=-7d: manual pass over a week
  let last = state.cursor;
  for (const line of sh("journalctl", args).split("\n")) {
    if (!line.startsWith("{")) continue;
    let e;
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    last = e.__CURSOR || last;
    const unit = (e.USER_UNIT || e._SYSTEMD_USER_UNIT || "?").replace(/\.service$/, "");
    const msg = Array.isArray(e.MESSAGE) ? Buffer.from(e.MESSAGE).toString("utf8") : String(e.MESSAGE ?? "");
    const prio = Number(e.PRIORITY ?? 6);
    const where = `journalctl --user -u ${unit} --since -1h`;
    if (e.USER_UNIT) {
      // systemd's own lines about the unit (they come from init.scope): only real failures.
      if (/Failed with result|code=(exited|killed|dumped), status=(?!0\/)/.test(msg)) {
        hit(`f:${unit}`, `${unit} · юнит упал (systemd) · лог: ${where}`);
      }
      continue;
    }
    if (msg.startsWith("{")) {
      let j = null;
      try {
        j = JSON.parse(msg);
      } catch {
        // multi-line pretty JSON (the daily summary) — falls through to the plain check
      }
      if (j && typeof j === "object") {
        const ev = String(j.event ?? "?").slice(0, 60);
        const lvl = String(j.level ?? "").toLowerCase();
        if (/^(error|fatal|warn|warning)$/.test(lvl) || FAIL_EVENT.test(ev)) {
          hit(`j:${unit}:${ev}:${lvl}`, `${unit} · событие ${ev}${lvl ? ` (${lvl})` : ""} · лог: ${where}`);
        }
        continue;
      }
    }
    const m = msg.match(PLAIN_BAD);
    if (m || prio <= 4) {
      const kind = m ? m[1].toLowerCase() : `priority ${prio}`;
      const cls = hash(norm(msg));
      hit(`p:${unit}:${cls}`, `${unit} · строка «${kind}» (класс ${cls}) · лог: ${where}`);
    }
  }
  state.cursor = last;
}

/* ---------- ads-engine alerts ---------- */
function alerts(state, baseline) {
  if (!existsSync(REPORTS)) return;
  state.alerts ??= {};
  for (const f of readdirSync(REPORTS).filter((n) => n.endsWith("-alerts.txt"))) {
    const p = join(REPORTS, f);
    const body = readFileSync(p, "utf8");
    const h = hash(body);
    if (state.alerts[f] === h) continue;
    state.alerts[f] = h;
    if (baseline) continue;
    const report = p.replace(/-alerts\.txt$/, ".txt");
    // Since the fixtures fix, a fixtures run alerts only on the stop flag and data freshness — real signals.
    const fixtures = existsSync(report) && readFileSync(report, "utf8").includes("ФИКСТУРЫ");
    const n = body.split("\n").filter(Boolean).length;
    hit(`a:${f}:${h}`, `ads-engine · тревоги ежедневного отчёта${fixtures ? " (Meta на фикстурах)" : ""} · cat ${p}`, n);
  }
  const keep = Object.keys(state.alerts).sort().slice(-60);
  state.alerts = Object.fromEntries(keep.map((k) => [k, state.alerts[k]]));
}

/* ---------- GitHub Actions ---------- */
function github(state, baseline) {
  const runs = JSON.parse(
    sh("gh", ["run", "list", "-R", REPO, "--status", "failure", "-L", "30", "--json", "databaseId,workflowName,headBranch,url"]),
  );
  const seen = new Set(state.runs ?? []);
  for (const r of runs) {
    if (seen.has(r.databaseId)) continue;
    seen.add(r.databaseId);
    if (baseline) continue;
    hit(`g:${r.workflowName}:${r.headBranch}`, `GitHub Actions · «${r.workflowName}» упал на ${r.headBranch} · ${r.url}`);
  }
  state.runs = [...seen].slice(-200);
}

/* ---------- live site ---------- */
async function status(path) {
  try {
    const r = await fetch(SITE + path, { redirect: "manual", signal: AbortSignal.timeout(20_000), headers: { "user-agent": "shur-logwatch" } });
    await r.body?.cancel();
    return r.status;
  } catch (e) {
    return `сеть: ${e?.name ?? "ошибка"}`;
  }
}

async function site() {
  for (const p of PATHS) {
    if ((await status(p)) === 200) continue;
    await new Promise((r) => setTimeout(r, 5000));
    const s = await status(p);
    if (s !== 200) hit(`s:${p}:${s}`, `живой сайт · ${SITE}${p} отвечает ${s} (дважды подряд) · curl -sI ${SITE}${p}`);
  }
}

/* ---------- send with hourly dedup ---------- */
function say(line) {
  if (DRY) {
    console.log("[dry] " + line);
    return true;
  }
  try {
    execFileSync(SAY, ["shur", line], { stdio: ["ignore", "ignore", "pipe"], timeout: 30_000 });
    return true;
  } catch (e) {
    console.error(JSON.stringify({ event: "logwatch.say_failed", code: e?.status ?? null }));
    return false;
  }
}

function flush(state) {
  state.sigs ??= {};
  for (const [sig, s] of signals) {
    const st = (state.sigs[sig] ??= { last: 0, pending: 0, text: s.text });
    st.pending += s.count;
    st.text = s.text;
  }
  let sent = 0;
  for (const [sig, st] of Object.entries(state.sigs)) {
    if (st.pending > 0 && now - st.last >= HOUR) {
      if (say(`🍒 сторож журнала: ${st.text} · ×${st.pending}${st.last ? " с прошлого сообщения" : ""}`)) {
        st.last = now;
        st.pending = 0;
        sent++;
      }
    }
    if (st.pending === 0 && now - st.last > 7 * 24 * HOUR) delete state.sigs[sig];
  }
  return sent;
}

async function main() {
  mkdirSync(DIR, { recursive: true, mode: 0o700 });
  const prev = loadState();
  const baseline = prev === null;
  const state = prev ?? {};
  const failed = [];
  for (const [name, fn] of [
    ["journal", () => journal(state)],
    ["alerts", () => alerts(state, baseline)],
    ["github", () => github(state, baseline)],
  ]) {
    try {
      fn();
    } catch (e) {
      failed.push(name);
      console.error(JSON.stringify({ event: "logwatch.source_failed", source: name, error: String(e?.message ?? e).slice(0, 200) }));
    }
  }
  await site();
  // A blind watcher must not be silent: a source it cannot read is a signal too.
  for (const name of failed) hit(`w:${name}`, `сам сторож · источник «${name}» не читается · journalctl --user -u ihor-shur-logwatch --since -1h`);
  const sent = flush(state);
  if (!DRY) {
    writeFileSync(STATE + ".tmp", JSON.stringify(state), { mode: 0o600 });
    renameSync(STATE + ".tmp", STATE);
  }
  console.log(JSON.stringify({ event: "logwatch.run", baseline, signals: signals.size, sent, failed_sources: failed.length }));
}

main().catch((e) => {
  console.error(JSON.stringify({ event: "logwatch.crash", error: String(e?.message ?? e).slice(0, 200) }));
  say("🍒 сторож журнала упал сам · journalctl --user -u ihor-shur-logwatch --since -1h");
  process.exit(1);
});
