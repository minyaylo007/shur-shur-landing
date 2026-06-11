import type { Dictionary } from "@/dictionaries";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { PaperCard } from "@/components/ui/PaperCard";
import { Reveal } from "@/components/motion/Reveal";
import { SafetyPinIcon } from "@/components/ui/icons";

export function Team({ dict }: { dict: Dictionary["team"] }) {
  return (
    /* Second cream "breath" (brief §2): a slightly darker paper table so the
       pinned polaroid cards still read as objects on a surface. */
    <section id="team" className="relative scroll-mt-20 overflow-hidden bg-paper-200 py-20 text-ink-900 md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading kicker={dict.kicker} heading={dict.heading} sub={dict.sub} tone="dark" />

        <ul className="mt-14 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {dict.roles.map((role, index) => (
            <Reveal key={role.title} as="li" delay={(index % 4) * 0.1}>
              <PaperCard
                rotate={index % 3 === 0 ? -1.5 : index % 3 === 1 ? 1.8 : -0.6}
                tape={false}
                className="relative h-full p-6"
              >
                <SafetyPinIcon
                  aria-hidden="true"
                  className="absolute -top-3 left-6 h-5 w-10 -rotate-12 text-ink-500"
                />
                <h3 className="display-type text-lg font-extrabold text-cherry-900">
                  {role.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-700">{role.desc}</p>
              </PaperCard>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
