// Живая проверка сайта одной командой: `npm run check:live` (~1–2 мин).
// Без локальной сборки: Playwright ходит на https://shur-shur.com (или SHUR_LIVE_URL).
//
// Что проверяется — то, где цена ошибки закон или деньги:
//   1. Согласие: без выбора и при «лише необхідне» — ни одного запроса к Meta,
//      включая перезагрузку. При «дозволити» — ровно один PageView с id пикселя;
//      смена языка +1, якорь +0, перезагрузка снова 1; никаких других событий.
//   2. «Спасибо»: форма → /uk/thanks без query, ровно один Lead с eventID = lead_id;
//      перезагрузка, «назад/вперёд» и прямой заход — 0 Lead. noindex на месте.
//   3. Контакт: клик по WhatsApp и по телефону — ровно один Contact, параметр только канал.
//
// Что НЕ уходит наружу: /api/lead замокан (в Telegram и журнал ничего не падает),
// пиксельный /tr отдаётся пустой картинкой, всё не-Meta и не-сайт — abort.
// fbevents.js и конфиг пикселя берутся из локальных копий, если есть папка
// SHUR_PIXEL_FIXTURES (по умолчанию /opt/ihor/shur/tmp/pixel), иначе — с CDN Meta.
//
// Playwright: playwright-core ищется как модуль, затем по SHUR_PLAYWRIGHT_CORE
// (по умолчанию — копия в ~/work/shur-tools); браузеры — PLAYWRIGHT_BROWSERS_PATH
// (package.json подставляет ~/.cache/ms-playwright).
//
// Банер согласия показывается только зоне EU — сервер ace-main стоит в Финляндии,
// из другой страны сценарий 1 честно падает с «банер не найден».
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const load = createRequire(import.meta.url);
function loadPlaywright() {
  for (const spec of ["playwright-core", process.env.SHUR_PLAYWRIGHT_CORE, path.join(process.env.HOME || "", "work/shur-tools/node_modules/playwright-core")]) {
    if (!spec) continue;
    try { return load(spec); } catch { /* next */ }
  }
  throw new Error("playwright-core не найден: npm i -D playwright-core или SHUR_PLAYWRIGHT_CORE=<путь>");
}
const { chromium } = loadPlaywright();

const BASE = (process.env.SHUR_LIVE_URL || "https://shur-shur.com").replace(/\/$/, "");
const HOST = new URL(BASE).hostname;
const PIXEL = "1133465872469034";
const LEAD = "0b8e2f4c-1d2e-4f3a-9b8c-7d6e5f4a3b2c";
// Пиксель Meta сам отбрасывает ботов (HeadlessChrome в UA): без обычного UA он молчит.
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const FIXTURES = process.env.SHUR_PIXEL_FIXTURES || "/opt/ihor/shur/tmp/pixel";
const fixture = (name) => { try { return fs.readFileSync(path.join(FIXTURES, name)); } catch { return null; } };
const FBEVENTS = fixture("fbevents.js");
const CONFIG = fixture("config.js");
const GIF = Buffer.from("R0lGODlhAQABAAAAACw=", "base64");
const isMeta = (u) => /(^|\.)facebook\.(com|net)$/.test(new URL(u).hostname);

function fbParams(req) {
  const params = new URLSearchParams(new URL(req.url()).search);
  const body = req.postData();
  if (!body) return params;
  if (body.includes("Content-Disposition: form-data")) for (const m of body.matchAll(/name="([^"]+)"\r\n\r\n([^\r]*)/g)) params.append(m[1], m[2]);
  else if (!body.startsWith("{")) for (const [k, v] of new URLSearchParams(body)) params.append(k, v);
  return params;
}

async function newPage(browser, log, { consent = false } = {}) {
  const context = await browser.newContext({ userAgent: UA });
  await context.route("**/*", async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    if (u.hostname === HOST && u.pathname === "/api/lead") {
      log.push({ url: "api/lead", api: true });
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, lead_id: LEAD }) });
    }
    if (u.hostname === HOST) return route.continue();
    if (isMeta(req.url())) {
      const p = fbParams(req);
      log.push({ url: `${u.hostname}${u.pathname}`, ev: p.get("ev"), id: p.get("id"), eid: p.get("eid"), dl: p.get("dl"), cd: [...p].filter(([k]) => k.startsWith("cd[")) });
      if (u.pathname === "/en_US/fbevents.js") return FBEVENTS ? route.fulfill({ body: FBEVENTS, contentType: "application/javascript" }) : route.continue();
      if (u.pathname.startsWith("/signals/config/")) return CONFIG ? route.fulfill({ body: CONFIG, contentType: "application/javascript" }) : route.continue();
      if (u.pathname === "/tr" || u.pathname === "/tr/") return route.fulfill({ body: GIF, contentType: "image/gif" });
      return route.fulfill({ status: 204, body: "" });
    }
    log.push({ url: `${u.hostname}${u.pathname}`, external: true });
    return route.abort();
  });
  if (consent) await context.addInitScript(() => { try { if (!localStorage.getItem("shur.consent.v1")) localStorage.setItem("shur.consent.v1", JSON.stringify({ ads: true, at: new Date().toISOString() })); } catch {} });
  const page = await context.newPage();
  return { context, page };
}

const settle = (page) => page.waitForTimeout(3500);
const evs = (log, name) => log.filter((r) => r.ev === name);
const summary = (log) => ({
  metaRequests: log.filter((r) => !r.external && !r.api).length,
  fbevents: log.filter((r) => r.url && r.url.endsWith("fbevents.js")).length,
  pageViews: evs(log, "PageView").map((r) => r.id),
  leads: evs(log, "Lead").map((r) => ({ eid: r.eid, dl: r.dl })),
  contacts: evs(log, "Contact").map((r) => r.cd),
  // SubscribedButtonClick — автособытие самого пикселя («отслеживать клики по кнопкам»
  // в Events Manager, не в нашем коде); считается отдельно и проверку не валит.
  otherEvents: [...new Set(log.filter((r) => r.ev && !["PageView", "Lead", "Contact", "SubscribedButtonClick"].includes(r.ev)).map((r) => r.ev))],
  autoClicks: evs(log, "SubscribedButtonClick").length,
  apiLead: log.filter((r) => r.api).length,
  externalBlocked: [...new Set(log.filter((r) => r.external).map((r) => r.url))],
});

let failed = 0;
function check(name, ok, detail) {
  if (!ok) failed++;
  console.log(`${ok ? "OK  " : "FAIL"} ${name}\n     ${JSON.stringify(detail)}`);
}
const necessary = (page) => page.getByRole("button", { name: "Лише необхідне" });
const allow = (page) => page.getByRole("button", { name: "Дозволити рекламні cookie" });

async function consentScenarios(browser) {
  { // без выбора
    const log = [];
    const { context, page } = await newPage(browser, log);
    await page.goto(`${BASE}/uk`, { waitUntil: "networkidle" });
    await necessary(page).waitFor({ timeout: 10000 });
    await settle(page);
    check("согласие · без выбора: 0 запросов к Meta", summary(log).metaRequests === 0, summary(log));
    await context.close();
  }
  { // лише необхідне + перезагрузка
    const log = [];
    const { context, page } = await newPage(browser, log);
    await page.goto(`${BASE}/uk`, { waitUntil: "networkidle" });
    await necessary(page).click();
    await settle(page);
    await page.reload({ waitUntil: "networkidle" });
    await settle(page);
    check("согласие · «лише необхідне» + перезагрузка: 0 запросов к Meta", summary(log).metaRequests === 0, summary(log));
    await context.close();
  }
  { // дозволити → язык → якорь → перезагрузка
    const log = [];
    const { context, page } = await newPage(browser, log);
    await page.goto(`${BASE}/uk`, { waitUntil: "networkidle" });
    await allow(page).click();
    await settle(page);
    let s = summary(log);
    check("согласие · «дозволити»: fbevents.js + ровно 1 PageView с id пикселя", s.fbevents === 1 && s.pageViews.length === 1 && s.pageViews[0] === PIXEL, s);
    const before = s.pageViews.length;
    await page.getByRole("button", { name: /мова|language/i }).first().click();
    await page.locator('a[role="option"][lang="en"]').click();
    await page.waitForURL(`${BASE}/en`);
    await settle(page);
    s = summary(log);
    check("согласие · смена языка uk→en: +1 PageView, скрипт не перегружен", s.pageViews.length === before + 1 && s.fbevents === 1, s);
    const beforeAnchor = s.pageViews.length;
    await page.locator('footer a[href="#work"]').click();
    await settle(page);
    s = summary(log);
    check("согласие · якорь #work: +0 PageView, никаких других событий", s.pageViews.length === beforeAnchor && s.otherEvents.length === 0, s);
    log.length = 0;
    await page.reload({ waitUntil: "networkidle" });
    await settle(page);
    s = summary(log);
    check("согласие · перезагрузка: 1 PageView, не 2", s.pageViews.length === 1 && s.fbevents === 1, s);
    await context.close();
  }
}

async function thanksScenarios(browser) {
  {
    const log = [];
    const { context, page } = await newPage(browser, log, { consent: true });
    await page.goto(`${BASE}/uk`, { waitUntil: "networkidle" });
    await settle(page);
    log.length = 0;
    await page.getByLabel("Нікнейм в Instagram").fill("shur.test");
    await page.getByLabel("Месенджер або телефон").fill("@shurtest");
    await page.waitForTimeout(1500);
    await page.getByRole("button", { name: "Отримати розбір" }).click();
    await page.waitForURL(`${BASE}/uk/thanks`, { timeout: 15000 });
    await settle(page);
    const url = page.url();
    const stored = await page.evaluate(() => sessionStorage.getItem("shur.thanks.lead"));
    const robots = await page.locator('meta[name="robots"]').getAttribute("content");
    const s = summary(log);
    check(
      "спасибо · форма → /uk/thanks без query, ровно 1 Lead с eventID = lead_id, sessionStorage очищен, noindex",
      url === `${BASE}/uk/thanks` && s.apiLead === 1 && s.leads.length === 1 && s.leads[0].eid === LEAD && !s.leads[0].dl.includes("?") && stored === null && /noindex/.test(robots || ""),
      { url, stored, robots, ...s },
    );
    log.length = 0;
    await page.reload({ waitUntil: "networkidle" });
    await settle(page);
    check("спасибо · перезагрузка → 0 Lead", summary(log).leads.length === 0, summary(log));
    log.length = 0;
    await page.goBack({ waitUntil: "networkidle" });
    await page.goForward({ waitUntil: "networkidle" });
    await settle(page);
    check("спасибо · «назад» → «вперёд» → 0 Lead", summary(log).leads.length === 0, summary(log));
    await context.close();
  }
  {
    const log = [];
    const { context, page } = await newPage(browser, log, { consent: true });
    await page.goto(`${BASE}/uk/thanks`, { waitUntil: "networkidle" });
    await settle(page);
    const s = summary(log);
    check("спасибо · прямой заход → 0 Lead, 1 PageView", s.leads.length === 0 && s.pageViews.length === 1, s);
    await context.close();
  }
  for (const [channel, selector] of [["whatsapp", 'a[href^="https://wa.me/"]'], ["phone", 'a[href^="tel:"]']]) {
    const log = [];
    const { context, page } = await newPage(browser, log, { consent: true });
    await page.goto(`${BASE}/uk`, { waitUntil: "networkidle" });
    await settle(page);
    log.length = 0;
    const link = page.locator(selector).first();
    const href = await link.getAttribute("href");
    await link.click({ noWaitAfter: true }).catch(() => {});
    await settle(page);
    const s = summary(log);
    check(`контакт · клик ${channel} → ровно 1 Contact, параметр только канал`, s.contacts.length === 1 && JSON.stringify(s.contacts[0]) === JSON.stringify([["cd[content_category]", channel]]), { href, ...s });
    await context.close();
  }
}

(async () => {
  console.log(`живая проверка ${BASE} · fixtures: ${FBEVENTS && CONFIG ? FIXTURES : "CDN Meta"}`);
  const browser = await chromium.launch({ args: ["--disable-blink-features=AutomationControlled"] });
  try {
    for (const run of [consentScenarios, thanksScenarios]) {
      try { await run(browser); } catch (e) { failed++; console.log(`FAIL ${run.name}: ${e.message.split("\n")[0]}`); }
    }
  } finally {
    await browser.close();
  }
  console.log(failed ? `\n${failed} FAILED` : "\nALL OK");
  process.exit(failed ? 1 : 0);
})();
