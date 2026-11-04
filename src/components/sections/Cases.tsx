import Image from "next/image";
import type { Locale } from "@/lib/i18n";
import type { Dictionary } from "@/dictionaries";
import { cases, caseMedia, type Case } from "@/lib/cases";
import type { WorkItem } from "@/lib/work";
import { AutoVideo } from "@/components/media/AutoVideo";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/motion/Reveal";
import { AnchorLink } from "@/components/motion/SmoothScroll";

interface CasesProps {
  locale: Locale;
  dict: Dictionary["cases"];
}

function Media({ item, locale }: { item: WorkItem; locale: Locale }) {
  return (
    <figure className="relative aspect-9/16 overflow-hidden rounded-md bg-cherry-black/40">
      {item.kind === "video" ? (
        <AutoVideo
          src={item.src}
          poster={item.poster}
          width={item.width}
          height={item.height}
          label={item.alt[locale]}
          className="size-full object-cover"
        />
      ) : (
        <Image
          src={item.src}
          alt={item.alt[locale]}
          width={item.width}
          height={item.height}
          sizes="(min-width: 1024px) 11vw, 30vw"
          className="size-full object-cover"
        />
      )}
    </figure>
  );
}

/** One labelled row of a card; absent when there is nothing to say. */
function Row({ label, text }: { label: string; text: string | null }) {
  if (text === null) return null;
  return (
    <div className="flex flex-col gap-1">
      <dt className="font-display text-[11px] font-bold tracking-[0.16em] text-juice-300 uppercase">{label}</dt>
      <dd className="text-sm leading-relaxed text-cream-type/85">{text}</dd>
    </div>
  );
}

function CaseCard({ c, locale, dict, index }: { c: Case; locale: Locale; dict: Dictionary["cases"]; index: number }) {
  const text = dict.items[c.key];
  const media = caseMedia(c).slice(0, 3);
  return (
    <Reveal as="li" delay={Math.min(index, 2) * 0.06}>
      <article className="flex h-full flex-col gap-5 rounded-2xl border border-cream-type/10 bg-cherry-deep/60 p-4 sm:p-5">
        <div className={`grid gap-2 ${media.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
          {media.map((item) => (
            <Media key={item.id} item={item} locale={locale} />
          ))}
        </div>
        <div className="flex flex-col gap-1">
          {c.brand !== null ? <p className="text-sm font-semibold text-cream-type/70">{c.brand}</p> : null}
          <h3 className="font-display text-lg font-bold text-cream-type uppercase">{text.niche}</h3>
        </div>
        <dl className="flex flex-col gap-4">
          <Row label={dict.task} text={c.task?.[locale] ?? null} />
          <Row label={dict.did} text={text.did} />
          <Row label={dict.result} text={c.result?.[locale] ?? null} />
        </dl>
      </article>
    </Reveal>
  );
}

/**
 * Cases (redesign v4, brief B1.2) — the first thing under the hero.
 *
 * A case is niche + what we made + the frames themselves, taken from work
 * already on the page. Brand, task and result are drawn only when
 * lib/cases has them (today: never). The whole portfolio follows in #work.
 */
export function Cases({ locale, dict }: CasesProps) {
  return (
    /* Top padding is the hero's other half of the joint (see Hero `pb`):
       both sections are the same cherry-black. */
    <section id="cases" tabIndex={-1} className="scroll-mt-20 bg-cherry-black pt-8 pb-14 text-cream-type md:pt-10 md:pb-20">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-4 sm:px-6">
        <SectionHeading kicker={dict.kicker} heading={dict.heading} tone="light" />
        <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {cases.map((c, index) => (
            <CaseCard key={c.key} c={c} locale={locale} dict={dict} index={index} />
          ))}
        </ul>
        <AnchorLink
          hash="#work"
          className="cursor-pointer self-start text-sm font-semibold text-cream-type/75 underline decoration-cream-type/30 underline-offset-4 transition-colors hover:text-juice-300 hover:decoration-juice-300"
        >
          {dict.all}
        </AnchorLink>
      </div>
    </section>
  );
}
