import { NextResponse } from "next/server";
import { isSignedIn, SESSION_COOKIE } from "@/lib/cabinet/auth";
import { attemptsKey } from "@/lib/client/attempts";
import { createClient, deleteClient, isClientId, issueIngestKey, MAX_CLIENT_NAME, readClient, reissueSetup } from "@/lib/client/clients";
import { field, storeUpload } from "@/lib/client/http";
import { resultsKey } from "@/lib/client/results";

export const runtime = "nodejs";

/* The owner's cabinet manages clients here (signed-in owner only):
   create · new setup link · key for the client's bot · upload results · delete.

   A fresh setup link or bot key is shown ONCE, in the body of the answer — the
   link is never stored (only its hash is), the key is stored sealed, and
   neither travels in a redirect URL. */

function back(request: Request, c: string): NextResponse {
  return NextResponse.redirect(new URL(`/cabinet?c=${c}#clients`, request.url), 303);
}

function cookieValue(request: Request): string | undefined {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) return rest.join("=");
  }
  return undefined;
}

const escape = (text: string) => text.replace(/[&<>\u0022\u0027]/g, (ch) => `&#${ch.charCodeAt(0)};`);

function oncePage(title: string, body: string): Response {
  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title></head>
<body style="font-family:system-ui,sans-serif;max-width:40rem;margin:3rem auto;padding:0 1rem;line-height:1.5">
<h1 style="font-size:1.4rem">${escape(title)}</h1>
${body}
<p><a href="/cabinet#clients">← Вернуться в кабинет</a></p>
</body></html>`;
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow" },
  });
}

const copyBox = (text: string, rows: number) => `<p><textarea readonly rows="${rows}" style="width:100%;font:inherit" onfocus="this.select()">${escape(text)}</textarea></p>`;

function linkPage(request: Request, name: string, id: string, token: string): Response {
  const origin = new URL(request.url).origin;
  return oncePage(
    `Ссылка для клиента «${name}»`,
    `<p>Отправьте её клиенту. По ней он один раз задаст свой пароль; ссылка живёт 7 дней. <strong>Показывается только сейчас</strong> — если потеряется, выпустите новую в кабинете.</p>
${copyBox(`${origin}/client/${id}/setup?t=${token}`, 3)}
<p>Адрес кабинета клиента (для входа с паролем): ${escape(`${origin}/client/${id}`)}</p>`,
  );
}

function keyPage(request: Request, name: string, id: string, secret: string): Response {
  const origin = new URL(request.url).origin;
  return oncePage(
    `Ключ бота для клиента «${name}»`,
    `<p>Этим ключом бот клиента подписывает результаты, которые шлёт в кабинет. <strong>Показывается только сейчас</strong>; прежний ключ этого клиента больше не действует. Передайте тому, кто ведёт бота, — файлом, не в переписке.</p>
${copyBox(`SHUR_INGEST_URL=${origin}/api/client/ingest\nSHUR_CLIENT_ID=${id}\nSHUR_CLIENT_SECRET=${secret}`, 4)}
<p>Как слать — docs/client-ingest.md в репозитории сайта.</p>`,
  );
}

export async function POST(request: Request) {
  let signedIn = false;
  try {
    signedIn = await isSignedIn(cookieValue(request));
  } catch {
    return back(request, "down");
  }
  if (!signedIn) return NextResponse.redirect(new URL("/cabinet/login", request.url), 303);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return back(request, "bad");
  }
  const action = field(form, "action");
  const id = field(form, "id");

  try {
    if (action === "create") {
      const name = field(form, "name").trim();
      if (!name || name.length > MAX_CLIENT_NAME) return back(request, "name");
      const { client, token } = await createClient(name, field(form, "test") === "on");
      console.info(`[cabinet] client created, test=${client.test}`);
      return linkPage(request, client.name, client.id, token);
    }
    if (!isClientId(id)) return back(request, "bad");
    const found = await readClient(id);
    if (!found) return back(request, "gone");

    if (action === "link") {
      const token = await reissueSetup(id);
      if (!token) return back(request, "gone");
      console.info("[cabinet] client setup link reissued");
      return linkPage(request, found.client.name, id, token);
    }
    if (action === "key") {
      const issued = await issueIngestKey(id);
      if (issued === "no_client") return back(request, "gone");
      if (issued === "not_configured") return back(request, "no_secret");
      console.info("[cabinet] client bot key issued");
      return keyPage(request, found.client.name, id, issued.secret);
    }
    if (action === "upload") {
      const outcome = await storeUpload(id, form.get("file"), "admin");
      return back(request, outcome === "ok" ? "uploaded" : `file_${outcome}`);
    }
    if (action === "delete") {
      // A live subscription keeps charging at monobank whether or not the record exists.
      if (found.client.billing.status === "active") return back(request, "paying");
      await deleteClient(id, [resultsKey(id), attemptsKey(id)]);
      console.info("[cabinet] client deleted");
      return back(request, "deleted");
    }
    return back(request, "bad");
  } catch (error) {
    console.error(`[cabinet] clients ${action.slice(0, 12).replace(/[^a-z]/g, "")} failed: ${error instanceof Error ? error.name : "unknown"}`);
    return back(request, "down");
  }
}
