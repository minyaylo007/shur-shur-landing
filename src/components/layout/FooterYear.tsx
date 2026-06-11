"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const getYear = () => new Date().getFullYear();

/**
 * © year that survives long-lived static builds: the server snapshot is the
 * build-time year, the client snapshot is the visitor's current year.
 * useSyncExternalStore keeps the divergence hydration-safe — same pattern as
 * the media-query gates elsewhere in the project.
 */
export function FooterYear({ initial }: { initial: number }) {
  const year = useSyncExternalStore(subscribe, getYear, () => initial);
  return <>{year}</>;
}
