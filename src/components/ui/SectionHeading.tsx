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
  const alignment = align === "center" ? "items-center text-center" : "items-start text-left";

  return (
    <div className={`flex flex-col gap-5 ${alignment}`}>
      <Reveal>
        <StickerBadge variant={tone === "dark" ? "paper" : "juice"} rotate={-2}>
          {kicker}
        </StickerBadge>
      </Reveal>
      <KineticHeading
        lines={[heading]}
        className={`text-[clamp(2.1rem,6.5vw,4.8rem)] font-extrabold ${headingColor}`}
      />
      {sub ? (
        <Reveal delay={0.15}>
          <p className={`max-w-xl text-base leading-relaxed md:text-lg ${subColor}`}>{sub}</p>
        </Reveal>
      ) : null}
    </div>
  );
}
