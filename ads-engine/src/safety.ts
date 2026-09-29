import { existsSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";

/* Emergency stop: a plain file in the data directory. A file survives a
   crash, a restart and a broken database, and anyone with a shell can create
   it (`touch …/STOP`) without the service running. While it exists the rules
   engine executes nothing and approves nothing. */

export function stopFile(dataDir: string): string {
  return join(dataDir, "STOP");
}

export function isStopped(dataDir: string): { stopped: boolean; reason: string | null } {
  const f = stopFile(dataDir);
  if (!existsSync(f)) return { stopped: false, reason: null };
  const reason = readFileSync(f, "utf8").trim();
  return { stopped: true, reason: reason || "без причины" };
}

export function setStop(dataDir: string, reason: string, by: string): void {
  writeFileSync(stopFile(dataDir), `${new Date().toISOString()} ${by}: ${reason}\n`, { mode: 0o600 });
}

export function clearStop(dataDir: string): boolean {
  const f = stopFile(dataDir);
  if (!existsSync(f)) return false;
  rmSync(f);
  return true;
}
