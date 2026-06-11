"use client";

import { useRef, type ReactNode } from "react";

interface MagneticProps {
  children: ReactNode;
  className?: string;
  /** Max translation in px. */
  strength?: number;
}

/** Magnetic hover: the child leans toward the cursor. Pointer-fine only. */
export function Magnetic({ children, className = "", strength = 8 }: MagneticProps) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const element = ref.current;
    if (!element) return;
    if (event.pointerType !== "mouse") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const rect = element.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    element.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
  };

  const handleLeave = () => {
    const element = ref.current;
    if (!element) return;
    element.style.transform = "translate(0, 0)";
  };

  return (
    <div
      ref={ref}
      className={`inline-block transition-transform duration-300 ease-out ${className}`}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
    >
      {children}
    </div>
  );
}
