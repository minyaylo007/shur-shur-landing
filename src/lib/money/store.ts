import { randomBytes } from "node:crypto";
import { cabinetStore, StoreConflictError } from "@/lib/cabinet/store";
import { apply, bookSchema, emptyBook, type Action, type Book } from "./book";

/**
 * «Гроші» in the cabinet's private Blob store: ONE record, read whole and
 * written whole, each write conditional on the etag read (two taps at once
 * do not lose each other). The demo never comes here. Server-only.
 */

export const BOOK_KEY = "cabinet/groshi.json";

export async function readBook(): Promise<{ book: Book; etag: string | undefined }> {
  const stored = await cabinetStore().read(BOOK_KEY);
  if (!stored) return { book: emptyBook(), etag: undefined };
  const parsed = bookSchema.safeParse(JSON.parse(stored.text));
  if (!parsed.success) throw new Error("groshi book is malformed");
  return { book: parsed.data, etag: stored.etag };
}

export const newId = () => randomBytes(6).toString("base64url");

/** Read → change → write, again on a race. Errors from `change` (BookError) pass through. */
export async function updateBook(change: (book: Book) => Book): Promise<Book> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { book, etag } = await readBook();
    const next = bookSchema.parse(change(book));
    try {
      await cabinetStore().write(BOOK_KEY, JSON.stringify(next), etag);
      return next;
    } catch (error) {
      if (!(error instanceof StoreConflictError)) throw error;
    }
  }
  throw new StoreConflictError();
}

export const act = (action: Action) => updateBook((book) => apply(book, action, newId));
