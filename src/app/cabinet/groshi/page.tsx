import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MoneyView } from "@/app/groshi/money-view";
import { isSignedIn, SESSION_COOKIE } from "@/lib/cabinet/auth";
import { loadBank } from "@/lib/money/mono";
import { readBook } from "@/lib/money/store";

/* Sasha's own «Гроші»: her projects, plan and remembered payers from Blob,
   the statement from monobank (cached) or, without a key, only what she typed
   in. No session → the cabinet's login. */

/** The moment of this request (the page is rendered per request, never cached). */
const nowSeconds = () => Math.floor(Date.now() / 1000);

export default async function CabinetMoney() {
  const jar = await cookies();
  if (!(await isSignedIn(jar.get(SESSION_COOKIE)?.value))) redirect("/cabinet/login");

  const [{ book }, bank] = await Promise.all([readBook(), loadBank()]);
  const now = nowSeconds();
  if (bank.status === "off") return <MoneyView initial={book} bankOps={[]} bankAccounts={[]} now={now} bank="off" />;
  return <MoneyView initial={book} bankOps={bank.ops} bankAccounts={bank.accounts} now={now} bank={bank.status} />;
}
