import Image from "next/image";
import type { Locale } from "@/lib/i18n";
import type { Dictionary } from "@/dictionaries";
import { business } from "@/lib/business";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/motion/Reveal";

/**
 * Team and reviews (redesign v4, brief B1.5–B1.6) — two slots. Each section
 * exists only when lib/business has real people / verbatim quotes with
 * permission; with empty arrays both return `null` and the page simply does
 * not have them. No stock faces, no «Олена, власниця кав’ярні».
 */
export function Team({ locale, dict }: { locale: Locale; dict: Dictionary["team"] }) {
  if (business.team.length === 0) return null;
  return (
    <section id="team" className="scroll-mt-20 bg-paper-50 py-16 text-ink-900 md:py-24">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-4 sm:px-6">
        <SectionHeading kicker={dict.kicker} heading={dict.heading} tone="dark" />
        <ul className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-5">
          {business.team.map((person, index) => (
            <Reveal as="li" key={person.name} delay={Math.min(index, 3) * 0.06}>
              <figure className="flex flex-col gap-3">
                <Image
                  src={person.photo}
                  alt={person.name}
                  width={800}
                  height={1000}
                  sizes="(min-width: 1024px) 20vw, 50vw"
                  className="aspect-4/5 w-full rounded-xl object-cover"
                />
                <figcaption>
                  <p className="font-display text-sm font-bold text-cherry-900">{person.name}</p>
                  <p className="text-sm text-ink-700">{person.role[locale]}</p>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Reviews({ dict }: { dict: Dictionary["reviews"] }) {
  if (business.reviews.length === 0) return null;
  return (
    <section id="reviews" className="scroll-mt-20 bg-paper-100 py-16 text-ink-900 md:py-24">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-4 sm:px-6">
        <SectionHeading kicker={dict.kicker} heading={dict.heading} tone="dark" />
        <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {business.reviews.map((review, index) => (
            <Reveal as="li" key={review.author} delay={Math.min(index, 2) * 0.06}>
              <figure className="flex h-full flex-col gap-4 rounded-2xl bg-paper-50 p-6">
                <blockquote className="text-base leading-relaxed text-ink-900">«{review.quote}»</blockquote>
                <figcaption className="mt-auto text-sm text-ink-700">
                  <span className="font-semibold text-cherry-900">{review.author}</span> · {review.business}
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
