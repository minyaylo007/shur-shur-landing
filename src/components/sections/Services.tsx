"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { Dictionary } from "@/dictionaries";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { PaperCard } from "@/components/ui/PaperCard";
import { StickerBadge } from "@/components/ui/StickerBadge";
import { GooDrips } from "@/components/ui/GooDrips";
import { CherryIcon } from "@/components/ui/icons";

/**
 * Pinned horizontal scroll-choreography on desktop: the section pins while
 * the 7 paper cards scrub sideways like a collage moodboard.
 * Mobile / reduced motion → simple vertical stack.
 */
export function Services({ dict }: { dict: Dictionary["services"] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const track = trackRef.current;
    if (!section || !track) return;

    gsap.registerPlugin(ScrollTrigger);

    // Live media queries (gsap.matchMedia): the pin/scrub is created when the
    // viewport enters desktop widths and fully reverted when it leaves them
    // (resize/orientation across 1024px, reduced-motion flips mid-session).
    const mm = gsap.matchMedia();
    mm.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
      const getDistance = () => Math.max(0, track.scrollWidth - window.innerWidth + 96);
      /* Under dir="rtl" the flex track starts at the right edge and overflows
         leftwards, so the cards have to travel the other way: +x instead of
         -x. Read once per matchMedia context — `dir` comes from the locale and
         cannot change without a navigation. */
      const rtl = document.documentElement.dir === "rtl";

      gsap.to(track, {
        x: () => (rtl ? getDistance() : -getDistance()),
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: () => `+=${getDistance()}`,
          pin: true,
          scrub: 1,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      });

      // Cards straighten slightly as they travel — collage coming alive.
      const cards = track.querySelectorAll<HTMLElement>("[data-service-card]");
      cards.forEach((card) => {
        gsap.fromTo(
          card,
          { rotate: Number(card.dataset.rotate ?? 0) * 2 },
          {
            rotate: Number(card.dataset.rotate ?? 0),
            ease: "none",
            scrollTrigger: {
              trigger: section,
              start: "top top",
              end: () => `+=${getDistance()}`,
              scrub: 1.4,
            },
          },
        );
      });
    });

    return () => mm.revert();
  }, []);

  return (
    /* Paper "table" with crumpled cards — the first cream breath after the
       dark hero (brief §2). Text color re-established: body default is cream. */
    <section
      id="services"
      ref={sectionRef}
      className="relative scroll-mt-20 overflow-hidden bg-paper py-20 text-ink-900 md:py-24 lg:flex lg:min-h-screen lg:flex-col lg:justify-center"
    >
      {/* Juice seeping through the hero→services seam (brief §4 #3) —
          the single goo-drip spot on the page. */}
      <GooDrips />

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        <SectionHeading
          kicker={dict.kicker}
          heading={dict.heading}
          sub={dict.sub}
          tone="dark"
        />
        <p className="mt-3 hidden font-display text-[11px] font-bold tracking-[0.25em] text-ink-500 uppercase lg:block">
          <span aria-hidden="true" className="inline-block rtl:scale-x-[-1]">
            →
          </span>{" "}
          {dict.scrollNote}
        </p>
      </div>

      <div
        ref={trackRef}
        className="services-track mt-12 grid gap-8 px-4 sm:px-6 lg:flex lg:w-max lg:items-stretch lg:gap-10 lg:pe-24 lg:ps-[max(1rem,calc((100vw-80rem)/2+1.5rem))]"
      >
        {dict.items.map((service, index) => {
          const rotate = index % 2 === 0 ? -1.6 : 2;
          return (
            <div key={service.title} data-service-card data-rotate={rotate}>
              <PaperCard
                rotate={rotate}
                className="flex h-full flex-col gap-4 p-7 md:p-8 lg:w-[26rem] lg:shrink-0"
              >
                <div className="flex items-start justify-between gap-3">
                  {/* Every card carries a hot-red element (Ghia rule, brief §2):
                      the oversized index number + the juice badge. */}
                  <span className="display-type text-5xl font-black text-cherry-juice">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <StickerBadge variant="juice" rotate={index % 2 === 0 ? 3 : -3} className="shrink-0">
                    {service.badge}
                  </StickerBadge>
                </div>

                <h3 className="display-type text-2xl font-extrabold text-cherry-900 md:text-[1.7rem]">
                  {service.title}
                </h3>
                <p className="text-sm font-semibold text-cherry-700">{service.tagline}</p>

                <ul className="flex flex-col gap-2 text-[15px] leading-snug text-ink-700">
                  {service.points.map((point) => (
                    <li key={point} className="flex items-start gap-2.5">
                      <CherryIcon className="mt-0.5 size-4 shrink-0 text-cherry-700" />
                      {point}
                    </li>
                  ))}
                </ul>

                <p className="mt-auto border-t border-cherry-900/15 pt-4 text-sm text-ink-500 italic">
                  {service.outcome}
                </p>
              </PaperCard>
            </div>
          );
        })}
      </div>
    </section>
  );
}
