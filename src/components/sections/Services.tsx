import type { Dictionary } from "@/dictionaries";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/motion/Reveal";

interface ServicesProps {
  dict: Dictionary["services"];
}

/**
 * Services (brief §15).
 *
 * v1 showed seven cards holding forty-nine equal-weight bullets, pinned
 * inside a horizontal GSAP scrub that took the scroll away from the visitor
 * on desktop — the exact behaviour brief §14 rules out. v2 groups the same
 * seven real services into four categories and leads with the tagline; the
 * bullets are all still here, one <details> away, and none were invented or
 * dropped.
 *
 * <details>/<summary> rather than a custom disclosure: it is keyboard
 * accessible and correctly announced with no JavaScript at all, it survives
 * a failed hydration, and the browser's in-page find can open it.
 */
export function Services({ dict }: ServicesProps) {
  return (
    <section
      id="services"
      tabIndex={-1}
      className="scroll-mt-20 bg-paper-50 py-20 md:py-28"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 sm:px-6">
        <SectionHeading kicker={dict.kicker} heading={dict.heading} sub={dict.sub} />

        <ul className="grid gap-4 md:grid-cols-2">
          {dict.items.map((item, index) => (
            <Reveal key={item.title} delay={Math.min(index, 3) * 0.08} as="li">
              <details className="group h-full rounded-lg border-2 border-cherry-900/15 bg-paper-100 p-6 transition-colors duration-200 open:border-cherry-900/35 hover:border-cherry-900/35 md:p-7">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
                  {/* `min-w-0`: without it this column keeps its min-content
                      width — the longest word of the title — and a flex item
                      that refuses to shrink pushes the whole card past the
                      viewport.

                      `wrap-anywhere` is the guarantee behind it. `min-w-0`
                      alone lets the column shrink, but an unbreakable word
                      then paints straight out of it and the card still runs
                      off the page (Romanian "Administrarea" did, by 1px, on a
                      320px card). `overflow-wrap: anywhere` is the one value
                      that also lowers the min-content contribution, so the
                      word breaks instead of the layout. It only ever fires
                      when the word cannot fit on its own line — at every
                      width measured below, nothing breaks. */}
                  <div className="flex min-w-0 flex-col gap-2 wrap-anywhere">
                    <h3 className="display-type text-xl font-extrabold text-cherry-900 md:text-2xl">
                      {item.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-ink-700">{item.tagline}</p>
                  </div>
                  {/* The plus/cross is a rotation, not a direction, so it
                      needs no RTL handling. The word beside it is what makes
                      the card obviously openable at a glance — so it is kept
                      at every width where it fits, and only there.

                      This block cannot shrink (`shrink-0`) and the word is
                      unbreakable, so it is a fixed ~127px claim on the card.
                      The card is at its NARROWEST at 768, not at 320: that is
                      where `md:grid-cols-2` halves it (296px of content
                      against 664px at 767). The word plus the longest title
                      word did not fit there, and the card ran off the page —
                      27px in Romanian, 11px in Ukrainian, 6px in English.

                        <640      icon only — 240px of card, too narrow
                        640—767   icon + word — one column, the roomiest card
                        768—1023  icon only — two columns, the tightest card
                        ≥1024     icon + word — two columns, but 424px wide

                      Measured at 1024: the word leaves ~281px for the title,
                      against ~220px it needs in Romanian. */}
                  <span className="mt-1 flex shrink-0 items-center gap-2 font-display text-[11px] font-bold tracking-[0.14em] text-juice-500 uppercase">
                    <span className="hidden sm:inline md:hidden lg:inline">
                      <span className="group-open:hidden">{dict.expand}</span>
                      <span className="hidden group-open:inline">{dict.collapse}</span>
                    </span>
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="size-6 transition-transform duration-200 group-open:rotate-45"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                    >
                      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                    </svg>
                  </span>
                </summary>

                <ul className="mt-5 flex flex-col gap-2 border-t border-cherry-900/12 pt-5">
                  {item.points.map((point) => (
                    <li key={point} className="flex items-start gap-2.5 text-sm text-ink-700">
                      <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-juice-500" />
                      {point}
                    </li>
                  ))}
                </ul>
              </details>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
