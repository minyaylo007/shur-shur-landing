"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/i18n";
import { sendFunnel } from "@/lib/funnel";

/**
 * Our own funnel counter (lib/funnel): `visit` once per page load and
 * `form_reached` the first time `#contact` enters the viewport. Renders
 * nothing. Runs without consent — no personal data, no cookie, only daily sums.
 */
export function FunnelBeacon({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const reached = useRef(false);

  useEffect(() => {
    sendFunnel({ event: "visit", locale });
    // The layout stays mounted across client navigation: once per load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (reached.current || typeof IntersectionObserver === "undefined") return;
    const target = document.getElementById("contact");
    if (!target) return;
    const observer = new IntersectionObserver((entries) => {
      if (reached.current || !entries.some((e) => e.isIntersecting)) return;
      reached.current = true;
      observer.disconnect();
      sendFunnel({ event: "form_reached", locale });
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [pathname, locale]);

  return null;
}
