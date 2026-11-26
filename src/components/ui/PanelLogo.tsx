import Image from "next/image";
import { site } from "@/lib/site";

/**
 * The real SHUR-SHUR logo (mascot + wordmark, beige) for the dark cherry
 * panels of the login and the cabinets. Source: the brand's own PNG
 * (logo-beige-wide.png from Sasha's Drive), transparent margins cropped,
 * 120 px tall WebP — sharp at 3x on a phone (32 px) and 2x+ on a desktop
 * (40 px). Served as is: the file is already small.
 */
export function PanelLogo() {
  return (
    <a href={site.siteUrl} className="inline-flex shrink-0" aria-label="SHUR-SHUR">
      <Image
        src="/brand/logo-panel.webp"
        alt="SHUR-SHUR"
        width={515}
        height={120}
        priority
        unoptimized
        className="h-8 w-auto sm:h-10"
      />
    </a>
  );
}
