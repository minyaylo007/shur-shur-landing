import type { Dictionary } from "@/dictionaries";
import { knownHandles } from "@/lib/known";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/motion/Reveal";
import { ArrowUpRightIcon } from "@/components/ui/icons";

interface TrustProps {
  dict: Dictionary["trust"];
}

/**
 * One consolidated proof block (brief §17, §18).
 *
 * v1 spent four separate sections asking to be trusted — About, Team,
 * Numbers and a Wall of Love — which is both long and, past the second one,
 * counter-productive. They are merged here into a single section: who the
 * team is, the three facts about it that the agency actually reports about
 * itself, who already knows the agency, and what people wrote about it in
 * their own words.
 *
 * What is NOT here matters as much. v1's «кейси» cards (+4 180 followers,
 * ×3.2 reach, 215 enquiries, 4.7% engagement) and the aggregate counters
 * (27 accounts, 4.2M reach, 850+ reels) were removed rather than restyled.
 * The cases were labelled in the v1 source itself as an illustrative
 * placeholder set, the counters had no source in the project, and brief §16
 * and §28 both forbid presenting unverified figures as client results. The
 * three facts that remain — team size, number of service directions,
 * countries — are self-reported and already existed in the project.
 */
export function Trust({ dict }: TrustProps) {
  return (
    <section id="about" tabIndex={-1} className="scroll-mt-20 bg-paper-100 py-20 md:py-28">
      <div className="mx-auto flex max-w-6xl flex-col gap-14 px-4 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          <div className="flex flex-col gap-7">
            <SectionHeading kicker={dict.kicker} heading={dict.heading} />
            <Reveal delay={0.12} className="flex flex-col gap-4">
              {dict.paragraphs.map((paragraph) => (
                <p key={paragraph} className="max-w-xl text-base leading-relaxed text-ink-700 md:text-lg">
                  {paragraph}
                </p>
              ))}
            </Reveal>
          </div>

          <Reveal delay={0.2}>
            <ul className="flex flex-col divide-y divide-cherry-900/12 border-y border-cherry-900/12">
              {dict.facts.map((fact) => (
                <li key={fact.label} className="flex items-baseline gap-5 py-5">
                  {/* dir="ltr": a bare numeral is bidi-neutral and would
                      otherwise reorder against the Hebrew label beside it. */}
                  <span dir="ltr" className="display-type text-4xl font-extrabold text-cherry-900 md:text-5xl">
                    {fact.value}
                  </span>
                  <span className="text-sm text-ink-700">{fact.label}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        <Reveal className="flex flex-col gap-4">
          <span className="font-display text-xs font-bold tracking-[0.2em] text-ink-500 uppercase">
            {dict.knownBy.label}
          </span>
          <ul className="flex flex-wrap gap-x-3 gap-y-2.5">
            {knownHandles.map((known, index) => (
              <li key={known.handle}>
                <a
                  href={known.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-cherry-900/20 px-4 py-2 text-sm text-ink-900 transition-colors hover:border-juice-500 hover:text-cherry-900"
                >
                  {dict.knownBy.names[index]}
                  <ArrowUpRightIcon className="size-3.5 text-juice-500" />
                </a>
              </li>
            ))}
          </ul>
        </Reveal>

        <div className="flex flex-col gap-5">
          <ul className="grid gap-4 md:grid-cols-3">
            {dict.quotes.items.map((quote, index) => (
              <Reveal key={quote.text} delay={index * 0.08} as="li">
                <figure className="flex h-full flex-col gap-3 rounded-lg border-2 border-cherry-900/15 bg-paper-50 p-6">
                  {/* dir="auto": the quotes stay in their original Ukrainian
                      on every locale, so each one picks its own direction
                      instead of inheriting the page's. */}
                  <blockquote dir="auto" className="text-base leading-relaxed text-ink-900">
                    “{quote.text}”
                  </blockquote>
                  <figcaption dir="auto" className="mt-auto text-xs text-ink-500">
                    {quote.source}
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </ul>
          <p className="text-xs text-ink-500">{dict.quotes.caption}</p>
        </div>
      </div>
    </section>
  );
}
