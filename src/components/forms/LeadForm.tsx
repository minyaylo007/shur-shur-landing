"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Locale } from "@/lib/i18n";
import type { Dictionary } from "@/dictionaries";
import { leadSchema } from "@/lib/validation";
import { site } from "@/lib/site";
import { Button } from "@/components/ui/Button";
import { CherryIcon, InstagramIcon, TelegramIcon } from "@/components/ui/icons";

type Status = "idle" | "submitting" | "success" | "error";

interface LeadFormProps {
  locale: Locale;
  dict: Dictionary["contact"]["form"];
}

interface FieldErrors {
  name?: string;
  contact?: string;
  message?: string;
}

export function LeadForm({ locale, dict }: LeadFormProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  // Honeypot — named "extra_field" so browser/extension autofill never
  // classifies it (an autofilled honeypot silently kills real leads).
  const [extraField, setExtraField] = useState("");
  const mountedAt = useRef<number | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const contactRef = useRef<HTMLInputElement>(null);

  // Stamp mount time after render (render must stay pure).
  useEffect(() => {
    if (mountedAt.current === null) {
      mountedAt.current = Date.now();
    }
  }, []);

  const elapsed = () => (mountedAt.current === null ? 0 : Date.now() - mountedAt.current);

  const validate = (): boolean => {
    const payload = { name, contact, message, extra_field: extraField, elapsedMs: elapsed() };
    const parsed = leadSchema.safeParse(payload);
    if (parsed.success) {
      setErrors({});
      return true;
    }

    const fieldErrors: FieldErrors = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === "name") fieldErrors.name = dict.errors.name;
      if (field === "contact") fieldErrors.contact = dict.errors.contact;
      if (field === "message") fieldErrors.message = dict.errors.message;
    }
    setErrors(fieldErrors);

    if (fieldErrors.name) nameRef.current?.focus();
    else if (fieldErrors.contact) contactRef.current?.focus();
    return false;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === "submitting") return;
    if (!validate()) return;

    setStatus("submitting");
    try {
      const response = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          contact: contact.trim(),
          message: message.trim(),
          extra_field: extraField,
          elapsedMs: elapsed(),
          locale,
        }),
        // A hung connection must land in the error state, not spin forever.
        signal: AbortSignal.timeout(15000),
      });
      const data = (await response.json().catch(() => null)) as { ok?: boolean } | null;
      setStatus(response.ok && data?.ok ? "success" : "error");
    } catch {
      setStatus("error");
    }
  };

  const resetForm = () => {
    setName("");
    setContact("");
    setMessage("");
    setExtraField("");
    setErrors({});
    mountedAt.current = Date.now();
    setStatus("idle");
  };

  if (status === "success") {
    return (
      <div role="status" className="flex flex-col items-start gap-4 p-2">
        <CherryIcon className="size-12 text-juice-500" />
        <h3 className="display-type text-2xl font-extrabold text-cherry-900">
          {dict.successTitle}
        </h3>
        <p className="text-ink-700">{dict.successText}</p>
        <button
          type="button"
          onClick={resetForm}
          className="cursor-pointer font-display text-xs font-bold tracking-wide text-cherry-700 uppercase underline underline-offset-4 hover:text-cherry-900"
        >
          {dict.successAgain}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      {/* Honeypot: visually hidden (NOT display:none — bots skip those). */}
      <div className="visually-hidden" aria-hidden="true">
        <label htmlFor="lead-extra-field">Leave this empty</label>
        <input
          id="lead-extra-field"
          name="extra_field"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={extraField}
          onChange={(e) => setExtraField(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="lead-name" className="font-display text-xs font-bold tracking-wide text-cherry-900 uppercase">
          {dict.name}
        </label>
        <input
          ref={nameRef}
          id="lead-name"
          name="name"
          type="text"
          autoComplete="name"
          placeholder={dict.namePlaceholder}
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? "lead-name-error" : undefined}
          required
          className="rounded-sm border-2 border-cherry-900/25 bg-paper-50 px-4 py-3 text-ink-900 placeholder:text-ink-500/60 focus:border-juice-500 focus:outline-none"
        />
        {errors.name ? (
          <p id="lead-name-error" role="alert" className="text-sm font-semibold text-cherry-700">
            {errors.name}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="lead-contact" className="font-display text-xs font-bold tracking-wide text-cherry-900 uppercase">
          {dict.contact}
        </label>
        <input
          ref={contactRef}
          id="lead-contact"
          name="contact"
          type="text"
          autoComplete="email"
          spellCheck={false}
          placeholder={dict.contactPlaceholder}
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          aria-invalid={errors.contact ? true : undefined}
          aria-describedby={errors.contact ? "lead-contact-error" : undefined}
          required
          className="rounded-sm border-2 border-cherry-900/25 bg-paper-50 px-4 py-3 text-ink-900 placeholder:text-ink-500/60 focus:border-juice-500 focus:outline-none"
        />
        {errors.contact ? (
          <p id="lead-contact-error" role="alert" className="text-sm font-semibold text-cherry-700">
            {errors.contact}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="lead-message" className="font-display text-xs font-bold tracking-wide text-cherry-900 uppercase">
          {dict.message}{" "}
          <span className="font-body font-normal text-ink-500 normal-case">({dict.messageOptional})</span>
        </label>
        <textarea
          id="lead-message"
          name="message"
          rows={4}
          maxLength={1000}
          placeholder={dict.messagePlaceholder}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={errors.message ? "lead-message-error" : undefined}
          className="resize-y rounded-sm border-2 border-cherry-900/25 bg-paper-50 px-4 py-3 text-ink-900 placeholder:text-ink-500/60 focus:border-juice-500 focus:outline-none"
        />
        {errors.message ? (
          <p id="lead-message-error" role="alert" className="text-sm font-semibold text-cherry-700">
            {errors.message}
          </p>
        ) : null}
      </div>

      {status === "error" ? (
        <div role="alert" className="flex flex-col gap-2 rounded-sm border-2 border-juice-500 bg-juice-500/10 p-4">
          <p className="font-display text-sm font-bold text-cherry-900 uppercase">{dict.errorTitle}</p>
          <p className="text-sm text-ink-700">{dict.errorText}</p>
          <p className="flex flex-wrap gap-4 text-sm font-semibold">
            <a
              href={site.socials.telegram}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex cursor-pointer items-center gap-1.5 text-cherry-700 underline underline-offset-4 hover:text-cherry-900"
            >
              <TelegramIcon className="size-4" />
              {/* dir="ltr": keeps the "@" in front of the handle under RTL. */}
              <span dir="ltr">{site.socials.telegramHandle}</span>
            </a>
            <a
              href={site.socials.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex cursor-pointer items-center gap-1.5 text-cherry-700 underline underline-offset-4 hover:text-cherry-900"
            >
              <InstagramIcon className="size-4" />
              <span dir="ltr">{site.socials.instagramHandle}</span>
            </a>
          </p>
        </div>
      ) : null}

      <Button type="submit" variant="cherry" disabled={status === "submitting"} aria-busy={status === "submitting"}>
        {status === "submitting" ? dict.submitting : status === "error" ? dict.retry : dict.submit}
      </Button>
    </form>
  );
}
