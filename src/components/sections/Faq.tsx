import type { Dictionary } from "@/dictionaries";
import { SectionHeading } from "@/components/ui/SectionHeading";

/**
 * FAQ (redesign v4, brief B1.7) — the questions a foreign client asks before
 * writing: language, where we shoot, remote work, price, payment, timing.
 * Native `<details>`: works without JS, keyboard and screen readers get the
 * disclosure semantics for free.
 */
export function Faq({ dict }: { dict: Dictionary["faq"] }) {
  return (
    <section id="faq" tabIndex={-1} className="scroll-mt-20 bg-paper-100 pb-16 text-ink-900 md:pb-24">
      <div className="mx-auto flex max-w-4xl flex-col gap-8 px-4 sm:px-6">
        <SectionHeading kicker={dict.kicker} heading={dict.heading} tone="dark" />
        <div className="flex flex-col divide-y divide-cherry-900/15 border-y border-cherry-900/15">
          {dict.items.map((item) => (
            <details key={item.q} className="group py-4">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 font-display text-sm font-bold text-cherry-900 md:text-base [&::-webkit-details-marker]:hidden">
                {item.q}
                <span aria-hidden="true" className="text-xl text-juice-500 transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="pt-2 pe-8 text-sm leading-relaxed text-ink-700 md:text-base">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
