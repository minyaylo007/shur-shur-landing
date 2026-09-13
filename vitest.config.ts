import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/* The suite ran configless until app modules joined it: `src/app/sitemap.ts`
   imports through the `@/*` alias from tsconfig, which vitest does not read.
   Nothing else changes — test discovery keeps vitest's defaults. */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
