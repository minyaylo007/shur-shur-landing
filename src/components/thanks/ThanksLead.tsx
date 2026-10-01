"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { adsAllowed } from "@/lib/consent";
import { pixelArrive, trackMetaLead, type PixelWindow } from "@/lib/meta-pixel";
import { sessionStore, takeThanksLead } from "@/lib/thanks";

/**
 * The thank-you page's one job for the pixel (scheme of 01.10.2026): the
 * page's PageView first, then ONE Lead with `eventID` = the lead id the form
 * left in sessionStorage — and only if it left one. The id is taken out as it
 * is read, so a reload, «back» or a direct visit finds nothing: 0 Lead.
 *
 * This effect runs before ConsentLayer's (children first), so it makes the
 * arrival itself — `pixelArrive` is shared and dedups by path, ConsentLayer's
 * call that follows counts nothing. Consent is the same as for PageView: no
 * running pixel → the id is still consumed, and no Lead goes anywhere.
 */
export function ThanksLead() {
  const pathname = usePathname();
  useEffect(() => {
    const win = window as PixelWindow;
    pixelArrive(win, document, pathname, adsAllowed);
    const leadId = takeThanksLead(sessionStore());
    if (leadId) trackMetaLead(win, leadId);
  }, [pathname]);
  return null;
}
