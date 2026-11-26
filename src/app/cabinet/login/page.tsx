import { redirect } from "next/navigation";

/* The old owner's login: there is one login now, /login (login «admin»). */
export default async function CabinetLogin({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  redirect(e && /^[a-z]{1,10}$/.test(e) ? `/login?e=${e}` : "/login");
}
