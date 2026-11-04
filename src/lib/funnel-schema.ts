import { z } from "zod";
import { locales } from "./i18n";

/**
 * What `/api/funnel` accepts (server side of lib/funnel). STRICT: a body with
 * any other field — an IP, a user agent, an id, a query string — is refused
 * whole, so the counter cannot become a channel for personal data. The path
 * is used only to name the market and is not forwarded.
 */
const channels = ["whatsapp", "telegram", "instagram", "viber", "phone"] as const;
const placements = ["header", "hero", "contact_bar", "contact_section", "packages", "footer"] as const;
// A plain path: no query, no hash, no host — nothing a visitor typed.
const path = z.string().max(120).regex(/^\/[A-Za-z0-9/_-]*$/);
const locale = z.enum(locales);

export const funnelSchema = z.discriminatedUnion("event", [
  z.object({ event: z.enum(["visit", "form_reached"]), locale, path }).strict(),
  z
    .object({ event: z.literal("contact_click"), locale, path, channel: z.enum(channels), placement: z.enum(placements) })
    .strict(),
]);

export type FunnelInput = z.infer<typeof funnelSchema>;
