import { NextResponse } from "next/server";
import { z } from "zod";
import { CURRENCIES } from "@/lib/money/book";
import { readSignedBody, storeFailure } from "@/lib/cabinet/signed";
import { newId, updateBook } from "@/lib/money/store";

export const runtime = "nodejs";

/* ace-main → site, once: Sasha's projects from a private file
   (ops/groshi/seed-projects.mjs). Signed with CABINET_HMAC_SECRET. A project
   is matched by name: a second run updates sums and pauses, adds nothing
   twice, and never touches payers, the plan or typed-in payments. The answer
   carries counts only. */

const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const seedSchema = z.object({
  projects: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        amount: z.number().int().min(0).max(100_000_000_00),
        currency: z.enum(CURRENCIES),
        pausedFrom: month.optional(),
        pausedUntil: month.optional(),
      }),
    )
    .min(1)
    .max(200),
});

export async function POST(request: Request) {
  const signed = await readSignedBody(request, "groshi-seed");
  if (!signed.ok) return signed.response;
  const parsed = seedSchema.safeParse(signed.body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "bad_projects" }, { status: 400 });

  let added = 0;
  let updated = 0;
  try {
    const book = await updateBook((book) => {
      added = updated = 0;
      const projects = [...book.projects];
      for (const p of parsed.data.projects) {
        const i = projects.findIndex((x) => x.name.toLowerCase() === p.name.toLowerCase());
        if (i >= 0) {
          projects[i] = { id: projects[i].id, ...p };
          updated++;
        } else {
          projects.push({ id: newId(), ...p });
          added++;
        }
      }
      return { ...book, projects };
    });
    console.info(`[groshi] seed: ${added} added, ${updated} updated`);
    return NextResponse.json({ ok: true, added, updated, total: book.projects.length });
  } catch (error) {
    return storeFailure("groshi-seed", error);
  }
}
