import { KineticHeading } from "@/components/motion/KineticHeading";
import { Reveal } from "@/components/motion/Reveal";
import { StickerBadge } from "@/components/ui/StickerBadge";

interface SectionHeadingProps {
  kicker: string;
  heading: string;
  sub?: string;
  /** Tailwind text color classes for heading/sub on dark vs light sections. */
  tone?: "light" | "dark";
  align?: "left" | "center";
}

export function SectionHeading({
  kicker,
  heading,
  sub,
  tone = "dark",
  align = "left",
}: SectionHeadingProps) {
  const headingColor = tone === "dark" ? "text-cherry-900" : "text-cream-type";
  const subColor = tone === "dark" ? "text-ink-700" : "text-cream-type/85";
  const alignment = align === "center" ? "items-center text-center" : "items-start text-start";

  return (
    <div className={`flex flex-col gap-5 ${alignment}`}>
      <Reveal>
        <StickerBadge variant={tone === "dark" ? "paper" : "juice"} rotate={-2}>
          {kicker}
        </StickerBadge>
      </Reveal>
      {/* `max-[359px]` is not a design step, it is a fit guarantee.
          KineticHeading makes every WORD an unbreakable inline-block (its
          letters are inline-blocks, so without `whitespace-nowrap` a word
          would split at an arbitrary letter), and an unbreakable word wider
          than the column cannot be wrapped, only shown or clipped. Below
          360px the clamp floor of 2.1rem was too wide for the longest word
          in two locales — Romanian "INSTAGRAMULUI" ran 68px past a 320px
          viewport and Ukrainian "БЕКСТЕЙДЖУ" 17px — so the heading, and with
          it the whole document, was wider than the screen.

          1.6rem is measured, not guessed: the Romanian word needs the type
          at 27.0px or smaller to fit 280px of column, and 25.6px puts it at
          265px. From 360px up the clamp is untouched, so every width the
          brief cares about (390 and wider) looks exactly as before.

          Whoever adds a fifth language measures it here: at 390 the Romanian
          word clears the column by only ~2px. */}
      <KineticHeading
        lines={[heading]}
        className={`text-[clamp(2.1rem,6.5vw,4.8rem)] font-extrabold max-[359px]:text-[1.6rem] ${headingColor}`}
      />
      {sub ? (
        <Reveal delay={0.15}>
          <p className={`max-w-xl text-base leading-relaxed md:text-lg ${subColor}`}>{sub}</p>
        </Reveal>
      ) : null}
    </div>
  );
}
