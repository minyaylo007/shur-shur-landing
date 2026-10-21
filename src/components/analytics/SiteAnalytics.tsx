"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

/* Vercel Web Analytics: cookieless page views for every visitor, independent
   of the consent banner (the Meta pixel stays behind consent — not touched
   here). Only the path leaves the browser: query string and hash are cut,
   so utm/fbclid/ad ids and anything typed into a URL never reach Vercel.
   No custom events on purpose (Hobby has none, and they would carry data). */
function stripUrl(event: BeforeSendEvent): BeforeSendEvent {
  const url = new URL(event.url);
  url.search = "";
  url.hash = "";
  return { ...event, url: url.toString() };
}

export function SiteAnalytics() {
  return <Analytics beforeSend={stripUrl} />;
}
