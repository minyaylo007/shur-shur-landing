import type { Dictionary } from "@/dictionaries";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/motion/Reveal";

/**
 * «Як працюємо з вашим містом» (redesign v4, brief B1.4): four steps, each
 * locale in its own market's terms — Chernivtsi for uk, the 90 km to Suceava
 * for ro, shooting days on visit dates for he, remote work for en. Only what
 * the brief states as fact; nothing about crews in cities where there are
 * none (A4: «снимаем в Тель-Авиве как местные» — неправда).
 */
export function HowWeWork({ dict }: { dict: Dictionary["how"] }) {
  return (
    <section id="how" tabIndex={-1} className="scroll-mt-20 bg-paper-100 py-16 text-ink-900 md:py-24">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-4 sm:px-6">
        <SectionHeading kicker={dict.kicker} heading={dict.heading} tone="dark" />
        <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {dict.steps.map((step, index) => (
            <Reveal as="li" key={step.title} delay={index * 0.06}>
              <div className="flex h-full flex-col gap-3 border-t-2 border-cherry-900/20 pt-5">
                <span className="font-display text-3xl font-extrabold text-juice-500" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="font-display text-base font-bold text-cherry-900 uppercase">{step.title}</h3>
                <p className="text-sm leading-relaxed text-ink-700">{step.text}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
