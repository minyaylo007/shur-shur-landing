"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { Locale } from "@/lib/i18n";
import type { Dictionary } from "@/dictionaries";
import { leadSchema } from "@/lib/validation";
import { site } from "@/lib/site";
import { localeChannels } from "@/lib/channels";
import { failureOf, LEAD_FAILURES, type LeadFailure } from "@/lib/lead-failure";
import { CHANNEL_ICONS, CherryIcon, PhoneIcon } from "@/components/ui/icons";

type Status = "idle" | "submitting" | "success" | "error";
type FieldErrors = { igHandle?: boolean; contact?: boolean };

interface AuditFormProps {
  locale: Locale;
  dict: Dictionary["audit"]["form"];
  /** Rendered under the fields — how and where the answer arrives. */
  delivery: string;
  /** Names of the messengers, for the channels offered when sending fails. */
  channelLabels: Dictionary["contactBar"]["channels"];
  /** Accessible name for the phone link — the visible label is the number. */
  callLabel: string;
}

/**
 * Free Instagram audit, two fields (brief §20).
 *
 * v1 asked only for the handle, which meant a submission arrived with no way
 * to answer it: the agency could see the profile but had no channel to send
 * the review to. A Telegram handle or a phone number is now required — that
 * is the point of the second field, not friction for its own sake.
 *
 * It still rides the existing /api/lead pipeline with kind="audit", so the
 * honeypot, the elapsedMs floor and the shared rate limit all continue to
 * apply; only the schema gained one required field.
 */
export function AuditForm({
  locale,
  dict,
  delivery,
  channelLabels,
  callLabel,
}: AuditFormProps) {
  const [status, setStatus] = useState<Status>("idle");
  /* WHICH failure — set together with status === "error" and never read
     outside it. The server tells four different stories (429, two 400s, 502)
     and the form used to retell all of them as one. */
  const [failure, setFailure] = useState<LeadFailure>("unknown");
  const [igHandle, setIgHandle] = useState("");
  const [contact, setContact] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  // Honeypot — deliberately meaningless name so autofill never touches it.
  const [extraField, setExtraField] = useState("");
  const mountedAt = useRef<number | null>(null);
  // Time from the FIRST interaction, not from mount: the form is on the page
  // long before anyone reaches it, and a mount-based clock would let a bot
  // simply wait while punishing nobody.
  const firstTouchAt = useRef<number | null>(null);
  const igRef = useRef<HTMLInputElement>(null);
  const contactRef = useRef<HTMLInputElement>(null);
  const id = useId();

  useEffect(() => {
    if (mountedAt.current === null) mountedAt.current = Date.now();
  }, []);

  const markTouched = () => {
    if (firstTouchAt.current === null) firstTouchAt.current = Date.now();
  };

  /* Editing anything means the previous verdict is stale — and for the two
     states that hide or demote the send button (429, 400) it is the way the
     button comes back. */
  const clearFailure = () => {
    if (status === "error") setStatus("idle");
  };

  const elapsed = () => {
    const start = firstTouchAt.current ?? mountedAt.current;
    return start === null ? 0 : Date.now() - start;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === "submitting") return;

    const payload = {
      kind: "audit" as const,
      igHandle: igHandle.trim(),
      contact: contact.trim(),
      extra_field: extraField,
      elapsedMs: elapsed(),
      locale,
    };
    const parsed = leadSchema.safeParse(payload);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      const errors: FieldErrors = {
        igHandle: flat.igHandle !== undefined,
        contact: flat.contact !== undefined,
      };
      setFieldErrors(errors);
      (errors.igHandle ? igRef : contactRef).current?.focus();
      return;
    }

    setFieldErrors({});
    setStatus("submitting");
    try {
      const response = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        // A hung connection must land in the error state, not spin forever.
        signal: AbortSignal.timeout(15000),
      });
      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: unknown }
        | null;
      if (response.ok && data?.ok) {
        setStatus("success");
        return;
      }
      // The body names the cause; the status code is the fallback when there
      // is no body at all. Both are read — `ok` alone cannot tell «we already
      // have your five requests» from «Telegram did not take it».
      const kind = failureOf(response.status, data?.error);
      setFailure(kind);
      setStatus("error");
      if (LEAD_FAILURES[kind].focusField) {
        // The fix is in the form, so the cursor goes back into it. No field
        // is marked invalid: the route does not say WHICH one it rejected,
        // and painting both red would be a guess dressed up as a fact.
        igRef.current?.focus();
      }
    } catch {
      // Nothing was answered at all: offline, DNS, or the 15s timeout above.
      // The only failure where «try again» is honest advice.
      setFailure("network");
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div role="status" className="flex items-start gap-3">
        <CherryIcon className="size-8 shrink-0 text-juice-500" />
        <div className="flex flex-col gap-1">
          <p className="display-type text-lg font-extrabold text-cherry-900">{dict.successTitle}</p>
          <p className="text-sm text-ink-700">{dict.successText}</p>
          <button
            type="button"
            onClick={() => {
              setStatus("idle");
              setIgHandle("");
              setContact("");
              firstTouchAt.current = null;
            }}
            className="mt-2 cursor-pointer text-start text-sm font-semibold text-juice-500 underline underline-offset-4 hover:text-cherry-700"
          >
            {dict.successAgain}
          </button>
        </div>
      </div>
    );
  }

  const fieldClass =
    "w-full rounded-sm border-2 border-cherry-900/25 bg-paper-50 px-3.5 py-3 text-sm text-ink-900 placeholder:text-ink-500/60 focus:border-juice-500 focus:outline-none";

  const chipClass =
    "inline-flex cursor-pointer items-center gap-2 rounded-full border-2 border-cherry-900/15 bg-paper-100 px-3.5 py-2 text-sm font-semibold text-cherry-900 transition-colors duration-200 hover:border-juice-500 hover:bg-paper-200";

  // Same readiness gate and same locale order as the contact bar: a channel
  // that is not launch-ready must not be offered to someone whose request has
  // just failed — that would be the second dead end in a row. An empty list
  // is a normal outcome of the gate, not a bug: the phone below is rendered
  // separately and is always real, so the way out never disappears.
  const fallbackChannels = localeChannels(locale);

  // What THIS failure is allowed to say and offer. `null` in every other
  // state, so idle/submitting behave exactly as they always did.
  const behaviour = status === "error" ? LEAD_FAILURES[failure] : null;
  const failureCopy = status === "error" ? dict.failures[failure] : null;

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {/* Honeypot: visually hidden, NOT display:none — bots skip those. */}
      <div className="visually-hidden" aria-hidden="true">
        <label htmlFor={`${id}-extra-field`}>Leave this empty</label>
        <input
          id={`${id}-extra-field`}
          name="extra_field"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={extraField}
          onChange={(e) => setExtraField(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-handle`} className="text-sm font-semibold text-ink-900">
          {dict.igLabel}
        </label>
        <input
          ref={igRef}
          id={`${id}-handle`}
          name="igHandle"
          type="text"
          /* An @handle is always Latin: typed into an RTL field it would be
             laid out from the right and drag its "@" to the far end. */
          dir="ltr"
          autoComplete="off"
          spellCheck={false}
          placeholder={dict.igPlaceholder}
          value={igHandle}
          onFocus={markTouched}
          onChange={(e) => {
            markTouched(); // covers autofill and scripted input without focus
            clearFailure();
            setIgHandle(e.target.value);
          }}
          aria-invalid={fieldErrors.igHandle ? true : undefined}
          aria-describedby={fieldErrors.igHandle ? `${id}-handle-error` : undefined}
          required
          className={fieldClass}
        />
        {fieldErrors.igHandle ? (
          <p id={`${id}-handle-error`} role="alert" className="text-xs font-semibold text-cherry-700">
            {dict.errors.igHandle}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-contact`} className="text-sm font-semibold text-ink-900">
          {dict.contactLabel}
        </label>
        <input
          ref={contactRef}
          id={`${id}-contact`}
          name="contact"
          type="text"
          /* Both accepted forms — @nickname and +380… — are Latin/digits. */
          dir="ltr"
          autoComplete="tel"
          spellCheck={false}
          placeholder={dict.contactPlaceholder}
          value={contact}
          onFocus={markTouched}
          onChange={(e) => {
            markTouched();
            clearFailure();
            setContact(e.target.value);
          }}
          aria-invalid={fieldErrors.contact ? true : undefined}
          aria-describedby={fieldErrors.contact ? `${id}-contact-error` : undefined}
          required
          className={fieldClass}
        />
        {fieldErrors.contact ? (
          <p id={`${id}-contact-error`} role="alert" className="text-xs font-semibold text-cherry-700">
            {dict.errors.contact}
          </p>
        ) : null}
      </div>

      {/*
        The big button, and what it is allowed to promise. It used to read
        «try again» after ANY failure — including the two where trying again
        cannot work: after a 429 the next ten minutes are refused whatever the
        visitor does, and after a rejected payload the same payload is
        rejected again. So two states take the button away (`none`) or move it
        below the channels as a quiet link (`secondary`), and the state whose
        fix is an edit keeps the ordinary «send» label. Touching a field puts
        the form back to idle, which is how the button returns.
      */}
      {behaviour === null || behaviour.retry === "primary" || behaviour.retry === "edit" ? (
        <button
          type="submit"
          disabled={status === "submitting"}
          aria-busy={status === "submitting"}
          className="inline-flex cursor-pointer items-center justify-center rounded-full bg-juice-500 px-7 py-3.5 font-display text-sm font-bold tracking-wide text-paper-50 uppercase shadow-[4px_4px_0_rgb(28_26_25)] transition-[background-color,box-shadow,translate] duration-200 hover:translate-x-[2px] hover:translate-y-[2px] hover:bg-cherry-700 hover:shadow-[2px_2px_0_rgb(28_26_25)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "submitting"
            ? dict.submitting
            : behaviour?.retry === "primary"
              ? dict.retry
              : dict.submit}
        </button>
      ) : null}

      {/*
        One failure, one story. The route answers four different things — the
        rate limit (429), a body that did not parse and a body the schema
        rejected (both 400), and Telegram refusing the lead (502) — and until
        15.09.2026 the form retold all four as «Не надіслалося. Спробуйте ще
        раз…». For two of them that sentence was false: after a 429 the
        previous requests DID arrive, and after a rejected payload «try again»
        is a loop with no exit. So the copy comes from the failure itself
        (lib/lead-failure + the four dictionaries), and so does the way out.

        The channels are offered where they are genuinely the way out, and the
        phone goes first: it is the shortest path and the one contact that
        cannot be a stale deep-link. The messengers after it come through the
        same readiness gate as everywhere else, so nothing dead is offered to
        someone who has just been failed once. The fields keep their values in
        every state — only success clears them.
      */}
      {behaviour !== null && failureCopy !== null ? (
        <div
          role="alert"
          className="flex flex-col gap-2.5 rounded-md border-2 border-cherry-700/30 bg-paper-50 p-4"
        >
          <p className="display-type text-base font-extrabold text-cherry-900">
            {failureCopy.title}
          </p>
          <p className="text-sm font-semibold text-cherry-700">{failureCopy.text}</p>
          {behaviour.channels ? (
            <ul className="flex flex-wrap gap-2">
              <li>
                <a href={site.phone.tel} aria-label={callLabel} className={chipClass}>
                  <PhoneIcon className="size-4 shrink-0 text-juice-500" />
                  {/* Bidi-neutral number: without the pin the "+" jumps to the
                      far end of the line in Hebrew. */}
                  <span dir="ltr">{site.phone.display}</span>
                </a>
              </li>
              {fallbackChannels.map(({ key, href }) => {
                const Icon = CHANNEL_ICONS[key];
                return (
                  <li key={key}>
                    <a href={href} target="_blank" rel="noopener noreferrer" className={chipClass}>
                      <Icon className="size-4 shrink-0 text-juice-500" />
                      {channelLabels[key]}
                    </a>
                  </li>
                );
              })}
            </ul>
          ) : null}
          {/* 502 only: retrying MIGHT work, so the option stays — but under
              the channels and at the weight of a link, because the channel is
              the answer that works now. */}
          {behaviour.retry === "secondary" ? (
            <button
              type="submit"
              className="cursor-pointer text-start text-sm font-semibold text-juice-500 underline underline-offset-4 hover:text-cherry-700"
            >
              {dict.retry}
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Brief §20: say plainly how the answer arrives. No time guarantee —
          v1 promised «розбір за 24 год», which was never a commitment the
          business had actually made. */}
      <p className="text-xs text-ink-500">{delivery}</p>
    </form>
  );
}
