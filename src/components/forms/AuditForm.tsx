"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { Locale } from "@/lib/i18n";
import type { Dictionary } from "@/dictionaries";
import { leadSchema } from "@/lib/validation";
import { CherryIcon } from "@/components/ui/icons";

type Status = "idle" | "submitting" | "success" | "error";
type FieldErrors = { igHandle?: boolean; contact?: boolean };

interface AuditFormProps {
  locale: Locale;
  dict: Dictionary["audit"]["form"];
  /** Rendered under the fields — how and where the answer arrives. */
  delivery: string;
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
export function AuditForm({ locale, dict, delivery }: AuditFormProps) {
  const [status, setStatus] = useState<Status>("idle");
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
      const data = (await response.json().catch(() => null)) as { ok?: boolean } | null;
      setStatus(response.ok && data?.ok ? "success" : "error");
    } catch {
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

      <button
        type="submit"
        disabled={status === "submitting"}
        aria-busy={status === "submitting"}
        className="inline-flex cursor-pointer items-center justify-center rounded-full bg-juice-500 px-7 py-3.5 font-display text-sm font-bold tracking-wide text-paper-50 uppercase shadow-[4px_4px_0_rgb(28_26_25)] transition-[background-color,box-shadow,translate] duration-200 hover:translate-x-[2px] hover:translate-y-[2px] hover:bg-cherry-700 hover:shadow-[2px_2px_0_rgb(28_26_25)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "submitting" ? dict.submitting : status === "error" ? dict.retry : dict.submit}
      </button>

      {status === "error" ? (
        <p role="alert" className="text-sm font-semibold text-cherry-700">
          {dict.errorText}
        </p>
      ) : null}

      {/* Brief §20: say plainly how the answer arrives. No time guarantee —
          v1 promised «розбір за 24 год», which was never a commitment the
          business had actually made. */}
      <p className="text-xs text-ink-500">{delivery}</p>
    </form>
  );
}
