import type { Dictionary } from "@/dictionaries";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/motion/Reveal";

interface TrustProps {
  dict: Dictionary["trust"];
}

/**
 * One consolidated proof block (brief §17, §18).
 *
 * v1 spent four separate sections asking to be trusted — About, Team,
 * Numbers and a Wall of Love — which is both long and, past the second one,
 * counter-productive. v2 merged them into this one section; the owner's
 * cleanup pass of 23.09.2026 then cut it down again to what it is now: who
 * the team is, and the three facts about it the agency reports about itself.
 *
 * What is NOT here matters as much.
 *
 *  - v1's «кейси» cards (+4 180 followers, ×3.2 reach, 215 enquiries, 4.7%
 *    engagement) and the aggregate counters (27 accounts, 4.2M reach, 850+
 *    reels) were removed in v2 rather than restyled. The cases were labelled
 *    in the v1 source itself as an illustrative placeholder set, the counters
 *    had no source in the project, and brief §16 and §28 both forbid
 *    presenting unverified figures as client results.
 *  - The «Нас знають» row (four verified Instagram accounts: @100fmcv,
 *    @tulpan_cv, @terrasa_ace, @irony_ua) and the three verbatim Instagram
 *    quotes were removed on the owner's instruction, 23.09.2026. Not hidden —
 *    the row's data module `src/lib/known.ts` and the `trust.knownBy` /
 *    `trust.quotes` keys are gone from all four dictionaries, so nothing
 *    renders an empty wrapper and nothing keeps dead strings alive.
 *    `git show 59af98c:src/lib/known.ts` brings back every handle and URL,
 *    and the same commit holds the quotes.
 *
 * The three facts that remain — team size, number of service directions,
 * countries — are self-reported and already existed in the project.
 */
export function Trust({ dict }: TrustProps) {
  return (
    <section id="about" tabIndex={-1} className="scroll-mt-20 bg-paper-100 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
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
      </div>
    </section>
  );
}
