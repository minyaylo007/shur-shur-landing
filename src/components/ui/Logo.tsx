import { site } from "@/lib/site";

/**
 * Interim typographic logotype (real logo files live on the client's Drive).
 * Lowercase typewriter style per the brand's Instagram post artwork.
 */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-logo font-bold lowercase tracking-tight whitespace-nowrap select-none ${className}`}
    >
      {site.logotype}
      <span aria-hidden="true" className="ms-1 inline-block size-2 rounded-full bg-juice-500 align-middle" />
    </span>
  );
}
