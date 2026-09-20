import Image from "next/image";
import type { Locale } from "@/lib/i18n";
import type { Dictionary } from "@/dictionaries";
import { itemsInGroup, workGroupOrder, type WorkItem } from "@/lib/work";
import { AutoVideo } from "@/components/media/AutoVideo";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/motion/Reveal";

interface SelectedWorkProps {
  locale: Locale;
  dict: Dictionary["work"];
}

/* Every tile is 9:16, because every source file is. Fixing the ratio on the
   wrapper means the grid never shifts while media loads (brief §26, CLS). */
function Tile({ item, locale, index }: { item: WorkItem; locale: Locale; index: number }) {
  return (
    <Reveal delay={Math.min(index, 3) * 0.06} as="li">
      <figure className="group relative aspect-9/16 overflow-hidden rounded-lg bg-cherry-black/40">
        {item.kind === "video" ? (
          <AutoVideo
            src={item.src}
            poster={item.poster}
            width={item.width}
            height={item.height}
            label={item.alt[locale]}
            className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <Image
            src={item.src}
            alt={item.alt[locale]}
            width={item.width}
            height={item.height}
            /* Four across on desktop, two on phones — the grid below. */
            sizes="(min-width: 1024px) 25vw, 50vw"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        )}
      </figure>
    </Reveal>
  );
}

/**
 * The portfolio (brief §7), placed directly after the hero.
 *
 * In v1 the first real photograph of agency work appeared five sections
 * down; a visitor who bounced before that never saw a single frame the
 * agency had shot. This is the change the brief calls one of the most
 * important, so it sits second on the page and nothing decorative is
 * allowed in front of it.
 *
 * The four clusters run as one continuous flow rather than tabs: tabs would
 * hide three quarters of the evidence behind a click, and the whole point of
 * this section is that the work is immediately visible.
 */
export function SelectedWork({ locale, dict }: SelectedWorkProps) {
  return (
    <section id="work" tabIndex={-1} className="scroll-mt-20 bg-cherry-black py-20 text-cream-type md:py-28">
      <div className="mx-auto flex max-w-7xl flex-col gap-14 px-4 sm:px-6">
        {/* §8: the section says its one thing once. The five per-group notes
            that used to repeat "made for clients" under every row are now this
            single line. */}
        <SectionHeading kicker={dict.kicker} heading={dict.heading} sub={dict.note} tone="light" />

        {workGroupOrder.map((key) => {
          const group = dict.groups[key];
          const items = itemsInGroup(key);
          return (
            <div key={key} className="flex flex-col gap-5">
              {/* A one-word chip, not a headline with a caption: the row of
                  tiles underneath is the argument, the label only says which
                  industry it belongs to. */}
              <div className="border-t border-cream-type/15 pt-5">
                <h3 className="font-display text-sm font-bold tracking-[0.18em] text-juice-300 uppercase">
                  {group.label}
                </h3>
              </div>
              <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                {items.map((item, index) => (
                  <Tile key={item.id} item={item} locale={locale} index={index} />
                ))}
              </ul>
            </div>
          );
        })}

        {/* Stated once for the whole section: the clips are silent by
            construction, so nobody has to hunt for a mute control. */}
        <p className="text-xs text-cream-type/50">{dict.playLabel}</p>
      </div>
    </section>
  );
}
