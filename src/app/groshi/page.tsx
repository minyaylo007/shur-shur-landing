import { DEMO_ACCOUNTS, DEMO_NOW, DEMO_OPERATIONS, DEMO_PLAN } from "@/lib/money/demo";
import { MoneyView } from "./money-view";

/* Stage 1: made-up data only. Stage 2 swaps the source for the monobank
   personal API; the view and the ledger stay. */
export default function Money() {
  return <MoneyView ops={DEMO_OPERATIONS} accounts={DEMO_ACCOUNTS} plan={DEMO_PLAN} now={DEMO_NOW} demo />;
}
