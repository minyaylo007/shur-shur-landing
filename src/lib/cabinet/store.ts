import { BlobPreconditionFailedError, get, put } from "@vercel/blob";

/**
 * Where the cabinet keeps its two documents: the stats snapshot and the auth
 * state (password hash, session key, the pending setup link). Vercel Blob,
 * PRIVATE store — nothing here has a public URL. Server-only.
 *
 * Writes can be conditional on the etag the caller read (`ifMatch`): that is
 * what makes the setup link single-use when two requests race for it.
 *
 * Tests swap the backend for an in-memory one with `useMemoryStore()`.
 */

export const SNAPSHOT_KEY = "cabinet/snapshot.json";
export const AUTH_KEY = "cabinet/auth.json";

export interface Stored {
  text: string;
  etag: string;
}

export class StoreConflictError extends Error {
  constructor() {
    super("store conflict");
    this.name = "StoreConflictError";
  }
}

export interface CabinetStore {
  read(key: string): Promise<Stored | null>;
  /** Throws StoreConflictError when `ifMatch` is given and the etag moved. */
  write(key: string, text: string, ifMatch?: string): Promise<void>;
}

const blobStore: CabinetStore = {
  async read(key) {
    const result = await get(key, { access: "private", useCache: false });
    if (!result || result.statusCode !== 200) return null;
    const text = await new Response(result.stream).text();
    return { text, etag: result.blob.etag };
  },
  async write(key, text, ifMatch) {
    try {
      await put(key, text, {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
        cacheControlMaxAge: 60,
        ...(ifMatch ? { ifMatch } : {}),
      });
    } catch (error) {
      if (error instanceof BlobPreconditionFailedError) throw new StoreConflictError();
      throw error;
    }
  },
};

let override: CabinetStore | null = null;

export function cabinetStore(): CabinetStore {
  return override ?? blobStore;
}

/** Tests only: an in-memory store with the same etag semantics. */
export function useMemoryStore(): Map<string, Stored> {
  const data = new Map<string, Stored>();
  let n = 0;
  override = {
    async read(key) {
      return data.get(key) ?? null;
    },
    async write(key, text, ifMatch) {
      const current = data.get(key);
      if (ifMatch !== undefined && current?.etag !== ifMatch) throw new StoreConflictError();
      data.set(key, { text, etag: `e${++n}` });
    },
  };
  return data;
}
