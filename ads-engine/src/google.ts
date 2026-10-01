import type { AdsReader, AccountInfo, InsightRow, BudgetRow } from "./meta/insights.ts";

/* Google Ads: interface only. The same AdsReader contract as Meta, so the
   collector, metrics and rules need no change when a real reader arrives
   (Google Ads API, GAQL over customer.search with a developer token). Until
   then it reports “not configured” instead of pretending there is no spend. */

export class GoogleAdsNotConfigured extends Error {
  constructor() {
    super("Google Ads reader is a stub: no API access configured");
  }
}

export class GoogleAdsStubReader implements AdsReader {
  readonly source = "google" as const;
  readonly mode = "stub" as const;

  async account(): Promise<AccountInfo> {
    throw new GoogleAdsNotConfigured();
  }
  async insights(): Promise<InsightRow[]> {
    throw new GoogleAdsNotConfigured();
  }
  async budgets(): Promise<BudgetRow[]> {
    throw new GoogleAdsNotConfigured();
  }
}
