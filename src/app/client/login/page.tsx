import { redirect } from "next/navigation";

/* The old client login: there is one login now, /login. */
export default async function ClientLoginMoved({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  redirect(e && /^[a-z]{1,10}$/.test(e) ? `/login?e=${e}` : "/login");
}
