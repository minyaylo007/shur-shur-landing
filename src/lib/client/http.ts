import { NextResponse } from "next/server";
import { addAttempts, attemptsFromTable } from "./attempts";
import { isClientId } from "./clients";
import { parseUpload, saveResults, type ParseError } from "./results";

/* Small shared pieces of the client-cabinet routes. */

export function back(request: Request, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, request.url), 303);
}

export const clientIp = (request: Request) => (request.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "unknown";

export const field = (form: FormData, name: string): string => {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
};

/** A client id from a form, or "" — never echoed into a URL unless it has the id shape. */
export const idField = (form: FormData): string => {
  const id = field(form, "id");
  return isClientId(id) ? id : "";
};

/**
 * Stores an uploaded .csv/.xlsx. A file with the quiz columns (test, score,
 * finished_at — docs/client-ingest.md) is added to the attempts, like the
 * bot's own pushes; any other table replaces the client's table. The log line
 * carries the counts and nothing of the content — not even the file name.
 */
export async function storeUpload(id: string, file: FormDataEntryValue | null, who: "client" | "admin"): Promise<"ok" | ParseError> {
  if (!file || typeof file === "string") return "empty";
  // Checked before the bytes are read into memory.
  if (file.size > 2 * 1024 * 1024) return "too_big";
  const parsed = parseUpload(file.name, Buffer.from(await file.arrayBuffer()));
  if (!parsed.ok) return parsed.error;
  const attempts = attemptsFromTable(parsed.table);
  if (attempts) {
    if (attempts.length === 0) return "empty";
    const { stored, duplicates } = await addAttempts(id, attempts);
    console.info(`[client] attempts uploaded by ${who}: ${stored} new, ${duplicates} repeated`);
    return "ok";
  }
  await saveResults(id, parsed.table, "upload");
  console.info(`[client] results uploaded by ${who}: ${parsed.table.rows.length} rows, ${parsed.table.columns.length} columns`);
  return "ok";
}
