import type { Dictionary } from "@/dictionaries";
import { CountUp } from "@/components/motion/CountUp";
import { Reveal } from "@/components/motion/Reveal";
import { JuiceDrop } from "@/components/ui/icons";

/**
 * Dark statement strip (brief §2 "Numbers" row + §5 pattern 6+11): four giant
 * cream count-up figures on cherry-deep under the global film grain. Extends
 * the photographic Cases chapter into a flat "RED-poster" beat before the
 * paper sections breathe again.
 */
export function Numbers({ dict }: { dict: Dictionary["numbers"] }) {
  return (
    <section className="relative overflow-hidden bg-cherry-deep py-16 text-cream-type md:py-24">
      <h2 className="sr-only">{dict.heading}</h2>

      {/* Single hot-red object on the dark field (Ghia rule, brief §2). */}
      <JuiceDrop
        aria-hidden="true"
        className="pointer-events-none absolute top-8 right-[6%] hidden h-10 w-auto rotate-12 text-cherry-juice lg:block"
      />

      <div className="mx-auto grid w-full max-w-7xl grid-cols-2 gap-x-6 gap-y-12 px-4 sm:px-6 lg:grid-cols-4">
        {dict.items.map((item, index) => (
          <Reveal
            key={item.label}
            delay={(index % 4) * 0.08}
            className="flex flex-col items-center gap-3 text-center"
          >
            {/* Statement typography: 80px+ display digits on desktop. */}
            <span className="display-type text-[clamp(3.2rem,9vw,6.5rem)] leading-none font-black text-cream-type">
              <CountUp value={item.value} decimals={item.decimals} />
              {item.suffix ? (
                /* 0.35em keeps «4.2 млн» on one line in the lg column; the
                   separator is a plain breaking space on purpose — graceful
                   wrap beats overflow (REM-FIX-C3; was an invisible U+202F
                   no-break space that forced overflow). */
                <span className="text-[0.35em]">
                  {item.suffix.length > 1 ? " " : ""}
                  {item.suffix}
                </span>
              ) : null}
            </span>
            <span className="max-w-48 text-sm leading-snug text-cream-type/70 md:text-base">
              {item.label}
            </span>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
