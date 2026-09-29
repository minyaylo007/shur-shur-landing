/* The site pins @types/node 20, which predates node:sqlite (Node ≥ 22.5).
   Raising it would touch the site's type surface for one module, so the
   ledger declares the slice of the API it uses. Delete this file when the
   root @types/node reaches 22+. */
declare module "node:sqlite" {
  type SQLValue = null | number | bigint | string | Uint8Array;
  interface StatementSync {
    run(...params: SQLValue[]): { changes: number | bigint; lastInsertRowid: number | bigint };
    get(...params: SQLValue[]): Record<string, SQLValue> | undefined;
    all(...params: SQLValue[]): Record<string, SQLValue>[];
  }
  export class DatabaseSync {
    constructor(path: string, options?: Record<string, unknown>);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
