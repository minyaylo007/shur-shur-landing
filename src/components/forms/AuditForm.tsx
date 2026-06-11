"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { Locale } from "@/lib/i18n";
import type { Dictionary } from "@/dictionaries";
import { leadSchema } from "@/lib/validation";
import { CherryIcon } from "@/components/ui/icons";

type Status = "idle" | "submitting" | "success" | "error";

interface AuditFormProps {
  locale: Locale;
  dict: Dictionary["hero"]["audit"];
}

/**
 * One-field free Instagram-audit form (brief §7.3) living inside the hero
 * paper card. It EXTENDS the existing lead pipeline (kind="audit" on
 * /api/lead) — honeypot, elapsedMs and the shared rate limit all apply, so
 * this is a thin sibling of LeadForm, not a second backend.
 */
export function AuditForm({ locale, dict }: AuditFormProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [igHandle, setIgHandle] = useState("");
  const [fieldError, setFieldError] = useState(false);
  // Honeypot — same neutral name as LeadForm so autofill never touches it.
  const [extraField, setExtraField] = useState("");
  const mountedAt = useRef<number | null>(null);
  // First focus/input on the handle field. The hero form mounts at page
  // load, so a mount-based clock punished visitors who read first and type
  // fast — interaction time is the honest "time to fill" signal (REM-FIX-C4).
  const firstTouchAt = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();

  // Stamp mount time after render (render must stay pure).
  useEffect(() => {
    if (mountedAt.current === null) {
      mountedAt.current = Date.now();
    }
  }, []);

  const markTouched = () => {
    if (firstTouchAt.current === null) {
      firstTouchAt.current = Date.now();
    }
  };

  // Count from the first interaction; mount time is the fallback when the
  // field was never touched (e.g. submit fired programmatically).
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
      extra_field: extraField,
      elapsedMs: elapsed(),
      locale,
    };
    const parsed = leadSchema.safeParse(payload);
    if (!parsed.success) {
      setFieldError(true);
      inputRef.current?.focus();
      return;
    }

    setFieldError(false);
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
        <div className="flex flex-col gap-0.5">
          <p className="display-type text-base font-extrabold text-cherry-900">{dict.successTitle}</p>
          <p className="text-sm text-ink-700">{dict.successText}</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-2.5">
      {/* Honeypot: visually hidden (NOT display:none — bots skip those). */}
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

      <p className="display-type text-sm font-extrabold text-cherry-900">{dict.title}</p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex-1">
          <label htmlFor={`${id}-handle`} className="sr-only">
            {dict.label}
          </label>
          <input
            ref={inputRef}
            id={`${id}-handle`}
            name="igHandle"
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder={dict.placeholder}
            value={igHandle}
            onFocus={markTouched}
            onChange={(e) => {
              markTouched(); // covers autofill/scripted input without focus
              setIgHandle(e.target.value);
            }}
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError ? `${id}-handle-error` : undefined}
            required
            className="w-full rounded-sm border-2 border-cherry-900/25 bg-paper-50 px-3.5 py-2.5 text-sm text-ink-900 placeholder:text-ink-500/60 focus:border-juice-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={status === "submitting"}
          aria-busy={status === "submitting"}
          className="inline-flex cursor-pointer items-center justify-center rounded-sm bg-juice-500 px-5 py-2.5 font-display text-xs font-bold tracking-wide text-paper-50 uppercase shadow-[3px_3px_0_rgb(28_26_25)] transition-[background-color,box-shadow,translate] duration-200 hover:translate-x-[1px] hover:translate-y-[1px] hover:bg-cherry-700 hover:shadow-[2px_2px_0_rgb(28_26_25)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "submitting" ? dict.submitting : status === "error" ? dict.retry : dict.submit}
        </button>
      </div>

      {fieldError ? (
        <p id={`${id}-handle-error`} role="alert" className="text-xs font-semibold text-cherry-700">
          {dict.errorHandle}
        </p>
      ) : null}
      {status === "error" ? (
        <p role="alert" className="text-xs font-semibold text-cherry-700">
          {dict.errorText}
        </p>
      ) : null}

      <p className="text-xs text-ink-500">{dict.note}</p>
    </form>
  );
}
