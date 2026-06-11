"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { CherryIcon, JuiceDrop, PaperClipIcon, SafetyPinIcon } from "@/components/ui/icons";

type DecorKind = "cherry" | "drop" | "clip" | "pin" | "scrap";

interface LayerItem {
  kind: DecorKind;
  /** z-depth, 0.2 (far) … 1 (near). Drives drift distance, mouse strength. */
  depth: number;
  /** Absolute positioning classes inside the container. */
  pos: string;
  size: string;
  color: string;
  /** Static tilt in degrees (CSS `rotate` property — survives reduced motion). */
  rotate: number;
  /** Idle float cycle duration; negative delay desyncs the loops. */
  floatDur: number;
  floatDelay: number;
  /** Responsive visibility — fewer layers on small screens (brief gate). */
  hide?: string;
}

/* Brief §4 effect #2 (Wow L / Effort S): 5–8 cut-out glossy cherries, paper
   scraps and clips on different z-depths. Pure DOM/GSAP, zero WebGL. */
const HERO_ITEMS: LayerItem[] = [
  { kind: "cherry", depth: 1, pos: "top-[15%] right-[4%]", size: "h-16 w-auto", color: "text-cherry-juice", rotate: 14, floatDur: 7, floatDelay: -1 },
  { kind: "drop", depth: 0.85, pos: "top-[36%] left-[46%]", size: "h-9 w-auto", color: "text-juice-400", rotate: -10, floatDur: 6, floatDelay: -3, hide: "hidden md:block" },
  { kind: "clip", depth: 0.55, pos: "top-[11%] right-[24%]", size: "h-20 w-10", color: "text-cream-type/45", rotate: 24, floatDur: 9, floatDelay: -5, hide: "hidden lg:block" },
  { kind: "cherry", depth: 0.7, pos: "bottom-[24%] left-[2%]", size: "h-10 w-auto", color: "text-juice-500", rotate: -18, floatDur: 8, floatDelay: -2, hide: "hidden md:block" },
  { kind: "pin", depth: 0.45, pos: "bottom-[12%] right-[30%]", size: "h-6 w-12", color: "text-cream-type/40", rotate: -8, floatDur: 10, floatDelay: -6, hide: "hidden lg:block" },
  { kind: "scrap", depth: 0.6, pos: "top-[56%] right-[11%]", size: "h-8 w-14", color: "", rotate: 9, floatDur: 9, floatDelay: -4, hide: "hidden lg:block" },
  { kind: "cherry", depth: 0.3, pos: "top-[26%] left-[30%]", size: "h-7 w-auto", color: "text-juice-400/50", rotate: 26, floatDur: 11, floatDelay: -7, hide: "hidden md:block" },
  { kind: "drop", depth: 0.22, pos: "bottom-[34%] right-[44%]", size: "h-5 w-auto", color: "text-juice-300/40", rotate: -14, floatDur: 12, floatDelay: -8, hide: "hidden lg:block" },
];

/* Lighter set for one section transition (Team → Socials dark chapter). */
const SECTION_ITEMS: LayerItem[] = [
  { kind: "cherry", depth: 0.9, pos: "top-[2%] left-[7%]", size: "h-12 w-auto", color: "text-cherry-juice", rotate: -12, floatDur: 8, floatDelay: -2 },
  { kind: "drop", depth: 0.6, pos: "top-[12%] right-[9%]", size: "h-8 w-auto", color: "text-juice-400", rotate: 12, floatDur: 7, floatDelay: -4, hide: "hidden md:block" },
  { kind: "scrap", depth: 0.5, pos: "top-[7%] right-[31%]", size: "h-7 w-12", color: "", rotate: -6, floatDur: 10, floatDelay: -5, hide: "hidden lg:block" },
  { kind: "cherry", depth: 0.3, pos: "top-[42%] left-[15%]", size: "h-6 w-auto", color: "text-juice-400/45", rotate: 20, floatDur: 11, floatDelay: -7, hide: "hidden md:block" },
  { kind: "pin", depth: 0.4, pos: "bottom-[10%] left-[5%]", size: "h-5 w-10", color: "text-cream-type/40", rotate: 10, floatDur: 9, floatDelay: -3, hide: "hidden lg:block" },
];

function DecorShape({ kind, className }: { kind: DecorKind; className: string }) {
  switch (kind) {
    case "cherry":
      return <CherryIcon className={className} />;
    case "drop":
      return <JuiceDrop className={className} />;
    case "clip":
      return <PaperClipIcon className={className} />;
    case "pin":
      return <SafetyPinIcon className={className} />;
    case "scrap":
      return <span className={`paper-texture torn-edge block ${className}`} />;
  }
}

interface FloatingCherriesProps {
  variant?: "hero" | "section";
  className?: string;
}

/**
 * Depth-parallax collage layer (brief §4 #2). Transform partitioning so the
 * three motion systems never fight over one element:
 * - OUTER div  → ScrollTrigger scrub drift (gsap y);
 * - MIDDLE div → mousemove parallax (gsap quickTo x/y);
 * - INNER span → infinite CSS float cycle + static CSS `rotate`.
 * Gates: scrub/mouse only under "(prefers-reduced-motion: no-preference)",
 * mouse additionally desktop + "(pointer: fine)"; CSS float dies via the
 * global reduced-motion block; far layers blur + most layers hide on mobile.
 * Pure decoration: aria-hidden + pointer-events-none, no content depends on it.
 */
export function FloatingCherries({ variant = "hero", className = "" }: FloatingCherriesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const items = variant === "hero" ? HERO_ITEMS : SECTION_ITEMS;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    gsap.registerPlugin(ScrollTrigger);

    const layers = Array.from(container.querySelectorAll<HTMLElement>("[data-depth]"));
    const mm = gsap.matchMedia();

    // Scroll-scrub drift — near layers travel further than far ones.
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      layers.forEach((layer) => {
        const depth = Number(layer.dataset.depth ?? 0.5);
        gsap.fromTo(
          layer,
          { y: -110 * depth },
          {
            y: 110 * depth,
            ease: "none",
            scrollTrigger: {
              trigger: container,
              start: "top bottom",
              end: "bottom top",
              scrub: 1,
              // The section variant sits BELOW the Services pin. When the
              // 1024px matchMedia rebuilds the pin mid-session, its trigger is
              // re-created AFTER these scrubs, breaking document-order refresh
              // (cycle-2 review MED) — force these to refresh last so they see
              // the final pin offsets.
              refreshPriority: variant === "section" ? -1 : 0,
            },
          },
        );
      });
    });

    // Mouse parallax — fine pointers on desktop only.
    mm.add(
      "(prefers-reduced-motion: no-preference) and (min-width: 1024px) and (pointer: fine)",
      () => {
        const setters = layers.flatMap((layer) => {
          const mouse = layer.querySelector<HTMLElement>("[data-mouse]");
          if (!mouse) return [];
          const depth = Number(layer.dataset.depth ?? 0.5);
          return [
            {
              depth,
              x: gsap.quickTo(mouse, "x", { duration: 0.9, ease: "power3.out" }),
              y: gsap.quickTo(mouse, "y", { duration: 0.9, ease: "power3.out" }),
            },
          ];
        });

        const onMove = (event: MouseEvent) => {
          const nx = (event.clientX / window.innerWidth) * 2 - 1;
          const ny = (event.clientY / window.innerHeight) * 2 - 1;
          setters.forEach((s) => {
            s.x(nx * 30 * s.depth);
            s.y(ny * 18 * s.depth);
          });
        };

        window.addEventListener("mousemove", onMove, { passive: true });
        return () => window.removeEventListener("mousemove", onMove);
      },
    );

    return () => mm.revert();
  }, [variant]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {items.map((item, index) => (
        <div
          key={index}
          data-depth={item.depth}
          className={`absolute ${item.pos} ${item.hide ?? ""} ${item.depth < 0.4 ? "blur-[2px]" : ""}`}
        >
          <div data-mouse="">
            <span
              className="animate-float-slow block"
              style={{
                animationDuration: `${item.floatDur}s`,
                animationDelay: `${item.floatDelay}s`,
                rotate: `${item.rotate}deg`,
              }}
            >
              <DecorShape kind={item.kind} className={`${item.size} ${item.color}`} />
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
