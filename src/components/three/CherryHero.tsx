"use client";

import { Component, Suspense, useSyncExternalStore, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { CherryPoster } from "./CherryPoster";

/* three.js is heavy → load only on capable clients, never on the server.
   No `loading` option here: the surrounding <Suspense> shows the poster
   (with the proper alt text) while the chunk streams in. */
const CherryScene = dynamic(() => import("./CherryScene"), { ssr: false });

const QUERIES = ["(min-width: 768px)", "(prefers-reduced-motion: reduce)"] as const;

function subscribe(onChange: () => void): () => void {
  const lists = QUERIES.map((query) => window.matchMedia(query));
  lists.forEach((list) => list.addEventListener("change", onChange));
  return () => lists.forEach((list) => list.removeEventListener("change", onChange));
}

/* WebGL probe (cached): clients with WebGL blocked/unavailable must get the
   poster without ever mounting the R3F canvas. One probe canvas, one result. */
let webglAvailable: boolean | null = null;

function probeWebGL(): boolean {
  if (webglAvailable === null) {
    try {
      const canvas = document.createElement("canvas");
      webglAvailable = !!canvas.getContext("webgl2") || !!canvas.getContext("webgl");
    } catch {
      webglAvailable = false;
    }
  }
  return webglAvailable;
}

function getSnapshot(): boolean {
  return (
    window.matchMedia("(min-width: 768px)").matches &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
    probeWebGL()
  );
}

/* R3F's Canvas re-throws internal errors (fiber design) — without a boundary
   one WebGL/context failure would unmount the entire page. */
class SceneErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * Renders the interactive 3D cherry on capable desktop pointers, and the
 * static poster on mobile (<768px), reduced motion, missing WebGL, or any
 * runtime failure inside the 3D scene.
 * Server snapshot = false → SSR always emits the poster.
 */
export function CherryHero({ posterAlt }: { posterAlt: string }) {
  const show3D = useSyncExternalStore(subscribe, getSnapshot, () => false);

  if (!show3D) {
    return <CherryPoster alt={posterAlt} />;
  }

  return (
    <SceneErrorBoundary fallback={<CherryPoster alt={posterAlt} />}>
      <Suspense fallback={<CherryPoster alt={posterAlt} />}>
        <CherryScene />
      </Suspense>
    </SceneErrorBoundary>
  );
}
