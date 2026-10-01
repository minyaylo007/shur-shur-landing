/* One JSON line per event on stdout (journald keeps it). Personal data never
   reaches the log: the contract says name and contact live only in Telegram
   and in the ledger database. The guard is structural — fields with these
   names are dropped whatever the caller passes — so a careless call site
   cannot leak them, and a test proves it. */

const FORBIDDEN = new Set([
  "name",
  "contact",
  "message",
  "ig_handle",
  "igHandle",
  "phone",
  "email",
  "token",
  "secret",
  "access_token",
]);

export type LogFields = Record<string, string | number | boolean | null | undefined>;

export type LogSink = (line: string) => void;

let sink: LogSink = (line) => process.stdout.write(line + "\n");

/** Tests capture the log here; production writes to stdout. */
export function setLogSink(next: LogSink): LogSink {
  const prev = sink;
  sink = next;
  return prev;
}

export function log(event: string, fields: LogFields = {}): void {
  const clean: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (FORBIDDEN.has(key)) continue;
    clean[key] = value;
  }
  sink(JSON.stringify({ at: new Date().toISOString(), event, ...clean }));
}
