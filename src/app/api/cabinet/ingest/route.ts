import { NextResponse } from "next/server";
import { parseSnapshot } from "@/lib/cabinet/snapshot";
import { readSignedBody, storeFailure } from "@/lib/cabinet/signed";
import { cabinetStore, SNAPSHOT_KEY } from "@/lib/cabinet/store";

export const runtime = "nodejs";

/* ads-engine → site: the cabinet snapshot (lib/cabinet/snapshot). Signed with
   CABINET_HMAC_SECRET; anything unsigned is refused before it is parsed. A
   snapshot with an unknown field or a contact-looking string is refused whole
   — the previous one stays. 200 = stored. */

export async function POST(request: Request) {
  const signed = await readSignedBody(request, "ingest");
  if (!signed.ok) return signed.response;

  const parsed = parseSnapshot(signed.body);
  if (!parsed.ok) {
    console.error(`[cabinet] ingest refused: ${parsed.error} at ${(parsed.where ?? []).slice(0, 5).join(", ")}`);
    return NextResponse.json({ ok: false, error: parsed.error, where: parsed.where }, { status: 400 });
  }

  try {
    await cabinetStore().write(SNAPSHOT_KEY, JSON.stringify(parsed.snapshot));
  } catch (error) {
    return storeFailure("ingest", error);
  }
  console.info(
    `[cabinet] snapshot stored: ${parsed.snapshot.ads.days.length} ad rows, test_data=${parsed.snapshot.test_data}`,
  );
  return NextResponse.json({ ok: true });
}
