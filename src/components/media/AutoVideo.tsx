"use client";

import { useEffect, useRef } from "react";

interface AutoVideoProps {
  src: string;
  poster: string;
  /** Intrinsic size — set on the element so the box never reflows (CLS). */
  width: number;
  height: number;
  /** Describes the footage; the element is exposed as an image to AT. */
  label: string;
  /** Hero only: start loading and playing immediately. */
  eager?: boolean;
  className?: string;
}

/**
 * Silent looping clip (brief §13/§14).
 *
 * Every file is encoded with no audio track at all, so there is nothing to
 * unmute. Playback is driven by an IntersectionObserver: a clip that is not
 * on screen is paused and — unless it is the hero — has not been downloaded
 * either, because `preload="none"` means the poster is all the browser
 * fetches until we ask for more.
 *
 * Reduced motion is honoured by simply never calling play(). The element
 * keeps rendering its poster frame, so the layout and the content are
 * identical; only the movement is gone. Doing it this way (rather than
 * swapping in an <img>) also avoids a hydration mismatch, since the server
 * cannot know the visitor's motion preference.
 */
export function AutoVideo({
  src,
  poster,
  width,
  height,
  label,
  eager = false,
  className = "",
}: AutoVideoProps) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motionQuery.matches) return;

    // play() rejects when the element is detached mid-scroll or when the
    // browser declines autoplay; neither is worth surfacing.
    const play = () => void element.play().catch(() => {});

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (element.preload === "none") element.preload = "auto";
            play();
          } else {
            element.pause();
          }
        }
      },
      { threshold: 0.25 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      width={width}
      height={height}
      muted
      loop
      playsInline
      autoPlay={eager}
      preload={eager ? "metadata" : "none"}
      /* A silent looping clip behaves like a moving photograph: `img` with a
         label is what actually reads well, rather than a media player the
         visitor is invited to operate. */
      role="img"
      aria-label={label}
      className={className}
    />
  );
}
