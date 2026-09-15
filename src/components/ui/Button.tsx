import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from "react";

const variants = {
  juice:
    "bg-juice-500 text-paper-50 hover:bg-cherry-700 shadow-[4px_4px_0_rgb(28_26_25)] hover:shadow-[2px_2px_0_rgb(28_26_25)] hover:translate-x-[2px] hover:translate-y-[2px]",
  cherry:
    "bg-cherry-900 text-paper-50 hover:bg-cherry-700 shadow-[4px_4px_0_rgb(214_32_47)] hover:shadow-[2px_2px_0_rgb(214_32_47)] hover:translate-x-[2px] hover:translate-y-[2px]",
  paper:
    "bg-paper-50 text-cherry-900 hover:bg-paper-200 shadow-[4px_4px_0_rgb(38_3_8)] hover:shadow-[2px_2px_0_rgb(38_3_8)] hover:translate-x-[2px] hover:translate-y-[2px]",
  ghost:
    "bg-transparent text-current border-2 border-current hover:bg-paper-50/10",
} as const;

/* Cycle-2 brand physics: squash & stretch. Hover = gentle stretch, press
   (incl. touch :active) = hard squish. Tailwind v4 scale/translate utilities
   emit the individual CSS `scale` and `translate` properties → they compose
   with the variant translate offsets and never fight gsap transforms
   (Magnetic/Splat wrappers animate their OWN elements). Reduced motion: the
   global transition-duration kill-switch makes the states instant. */
const base =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-full px-7 py-3.5 font-display text-sm font-bold tracking-wide uppercase transition-[background-color,box-shadow,color,translate,scale] duration-200 hover:scale-x-[1.04] hover:scale-y-[0.96] active:scale-x-[1.08] active:scale-y-[0.88] disabled:cursor-not-allowed disabled:opacity-60";

type Variant = keyof typeof variants;

/** The button look as a class string — for links that are not <ButtonLink>,
    e.g. the tracked contact anchors in components/conversion. */
export function buttonClass(variant: Variant = "juice", className = ""): string {
  return `${base} ${variants[variant]} ${className}`;
}

export function Button({
  variant = "juice",
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; children: ReactNode }) {
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "juice",
  className = "",
  children,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: Variant; children: ReactNode }) {
  return (
    <a className={`${base} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </a>
  );
}
