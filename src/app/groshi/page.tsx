import { DEMO_ACCOUNTS, DEMO_BOOK, DEMO_NOW, DEMO_OPERATIONS } from "@/lib/money/demo";
import { MoneyView } from "./money-view";

/* The public demo: made-up data, open by link, saves nothing (every tap lives
   in the page's memory). Sasha's own page is /cabinet/groshi — the same
   screen over her Blob record and her bank. */
export default function Money() {
  return <MoneyView initial={DEMO_BOOK} bankOps={DEMO_OPERATIONS} bankAccounts={DEMO_ACCOUNTS} now={DEMO_NOW} demo />;
}
