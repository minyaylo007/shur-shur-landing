import Image from "next/image";
import type { Locale } from "@/lib/i18n";
import { posts } from "@/lib/posts";
import { Reveal } from "@/components/motion/Reveal";
import { ArrowUpRightIcon } from "@/components/ui/icons";

/**
 * Instagram Approach A grid (brief §6): six curated tiles from /public/brand,
 * each a real link — three verified posts/reels, three profile deep-links.
 * Hover (hover-capable devices only): maroon overlay + masking-tape frame +
 * arrow. The image alt doubles as the accessible link name; everything else
 * in the tile is decorative.
 */
export function InstaGrid({ locale, label }: { locale: Locale; label: string }) {
  return (
    <ul aria-label={label} className="grid w-full grid-cols-2 gap-4 sm:grid-cols-3 md:gap-5">
      {posts.map((post, index) => (
        <Reveal as="li" key={`${post.href}-${post.image}`} delay={(index % 3) * 0.08}>
          <a
            href={post.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative block aspect-square cursor-pointer overflow-hidden rounded-sm shadow-[0_14px_30px_-16px_rgb(0_0_0/0.6)]"
          >
            <Image
              src={post.image}
              alt={post.alt[locale]}
              fill
              sizes="(min-width: 1024px) 330px, (min-width: 640px) 33vw, 50vw"
              className="object-cover transition-[scale] duration-500 group-hover:scale-105"
            />
            {/* Maroon hover overlay (brief §6: art-directed, not a widget). */}
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-cherry-deep/70 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            />
            {/* Masking-tape frame corners appear with the overlay. */}
            <span
              aria-hidden="true"
              className="tape absolute -top-2 -left-4 h-5 w-18 rotate-[-35deg] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            />
            <span
              aria-hidden="true"
              className="tape absolute -right-4 -bottom-2 h-5 w-18 rotate-[-35deg] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            />
            <ArrowUpRightIcon
              aria-hidden="true"
              className="absolute top-1/2 left-1/2 size-9 -translate-x-1/2 -translate-y-1/2 text-cream-type opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            />
          </a>
        </Reveal>
      ))}
    </ul>
  );
}
