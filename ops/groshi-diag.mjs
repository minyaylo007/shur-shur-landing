// Temporary, read-only: etag shapes and book counts. No sums, no names (public repo).
import { get, head, list } from "@vercel/blob";
const KEY = "cabinet/groshi.json";
const shape = (e) => (e == null ? "none" : `${e.startsWith("W/") ? "weak " : ""}${e.includes('"') ? "quoted " : ""}len${e.length}`);
const g1 = await get(KEY, { access: "private", useCache: false });
const text = await new Response(g1.stream).text();
const g2 = await get(KEY, { access: "private", useCache: false });
await new Response(g2.stream).text();
const h = await head(KEY);
console.log("get etag:", shape(g1.blob.etag), "| head etag:", shape(h.etag), "| get==head:", g1.blob.etag === h.etag, "| get==get:", g1.blob.etag === g2.blob.etag);
console.log("equal without W/ and quotes:", g1.blob.etag.replace(/^W\//, "").replaceAll('"', "") === h.etag.replace(/^W\//, "").replaceAll('"', ""));
console.log("content-encoding:", g1.headers.get("content-encoding"), "| size:", text.length, "| head size:", h.size, "| uploadedAt:", h.uploadedAt.toISOString(), "| cache-control:", g1.headers.get("cache-control"));
const b = JSON.parse(text);
console.log("projects:", b.projects.length, "plan:", b.plan.length, "rules:", Object.keys(b.rules).length, "payers:", Object.keys(b.payers).length, "entries:", b.entries.length);
const byDate = {};
for (const e of b.entries) byDate[e.date] = (byDate[e.date] ?? 0) + 1;
console.log("entries by date:", JSON.stringify(byDate));
const l = await list({ prefix: "cabinet/" });
console.log("blobs:", l.blobs.map((x) => `${x.pathname} ${x.uploadedAt.toISOString()}`).join("; "));
