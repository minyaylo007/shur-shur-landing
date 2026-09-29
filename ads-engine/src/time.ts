/* Calendar dates are strings YYYY-MM-DD in a named time zone: Meta reports days
   in the AD ACCOUNT time zone, so “yesterday” must be computed there, not on
   the server clock. */

export function dateInZone(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function addDays(date: string, days: number): string {
  const t = Date.parse(date + "T00:00:00Z") + days * 86400_000;
  return new Date(t).toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400_000);
}

export function daysInMonth(date: string): number {
  const [y, m] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
