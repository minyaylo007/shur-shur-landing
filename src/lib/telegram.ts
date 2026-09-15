/**
 * Telegram Bot API delivery for lead-form submissions.
 * Server-only: never import from client components.
 */

/** Escape user input for Telegram `parse_mode: "HTML"` (& first, then < >). */
export function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export interface LeadMessage {
  /** Request type (cycle 4). Omitted = classic "lead" (back-compat). */
  kind?: "lead" | "audit";
  name?: string;
  contact?: string;
  message?: string;
  /** Instagram nickname for audit requests (leading @ optional). */
  igHandle?: string;
  locale: string;
}

export function formatLeadMessage(lead: LeadMessage): string {
  const lines: string[] = [];

  if (lead.kind === "audit") {
    // Normalize to exactly one @ — the schema accepts both forms.
    const handle = (lead.igHandle ?? "").replace(/^@/, "");
    lines.push(`🔍 <b>Запит на аудит IG:</b> @${escapeHtml(handle)}`, "");
  } else {
    lines.push("🍒 <b>Нова заявка з сайту SHUR-SHUR</b>", "");
  }

  // For "lead" requests the schema guarantees name + contact, so the classic
  // message stays byte-identical; audit requests simply skip absent fields.
  if (lead.name !== undefined) {
    lines.push(`<b>Імʼя:</b> ${escapeHtml(lead.name)}`);
  }
  if (lead.contact !== undefined) {
    lines.push(`<b>Контакт:</b> ${escapeHtml(lead.contact)}`);
  }
  if (lead.message && lead.message.trim() !== "") {
    lines.push(`<b>Повідомлення:</b> ${escapeHtml(lead.message)}`);
  }
  lines.push("", `<i>Мова сторінки: ${escapeHtml(lead.locale)}</i>`);
  return lines.join("\n");
}

/**
 * The bot was never wired up in this environment — a different thing from
 * Telegram being down, and the only one of the two an operator can fix. Both
 * used to reach the log as «delivery failed», so an environment with no
 * credentials at all read like an outage. Carries the NAMES of the missing
 * variables and nothing else: no value, no prefix, no length.
 */
export class TelegramNotConfiguredError extends Error {
  readonly missing: readonly string[];

  constructor(missing: readonly string[]) {
    super(`Telegram bot is not configured: missing ${missing.join(", ")}`);
    this.name = "TelegramNotConfiguredError";
    this.missing = missing;
  }
}

export async function sendLeadToTelegram(lead: LeadMessage): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  const missing = [
    token ? null : "TELEGRAM_BOT_TOKEN",
    chatId ? null : "TELEGRAM_CHAT_ID",
  ].filter((name): name is string => name !== null);
  if (missing.length > 0) {
    throw new TelegramNotConfiguredError(missing);
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: formatLeadMessage(lead),
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    // Never log the token; status + Telegram error description only.
    const detail = await response.text().catch(() => "");
    throw new Error(`Telegram sendMessage failed: ${response.status} ${detail.slice(0, 200)}`);
  }

  const data = (await response.json().catch(() => null)) as { ok?: boolean } | null;
  if (!data?.ok) {
    throw new Error("Telegram sendMessage returned ok=false");
  }
}
