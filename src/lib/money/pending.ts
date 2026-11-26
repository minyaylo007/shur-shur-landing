import { actionSchema, type Action } from "./book";

/**
 * What Sasha typed and the server did not take. It stays in her browser (never
 * a log, never the server) until it is saved, so nothing is typed twice:
 * one button «Зберегти ще раз», also after reloading the page.
 */

export const UNSAVED_KEY = "groshi:unsaved";

type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;

export function keepUnsaved(storage: Storage | undefined, action: Action): void {
  try {
    storage?.setItem(UNSAVED_KEY, JSON.stringify(action));
  } catch {
    /* private window, full storage: the form still holds it */
  }
}

export function readUnsaved(storage: Storage | undefined): Action | null {
  try {
    const raw = storage?.getItem(UNSAVED_KEY);
    if (!raw) return null;
    const parsed = actionSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function dropUnsaved(storage: Storage | undefined): void {
  try {
    storage?.removeItem(UNSAVED_KEY);
  } catch {
    /* nothing to do */
  }
}

/** Worth trying the same thing again: the store was busy or did not answer; her input was fine. */
export const retryable = (status: number) => status === 409 || status >= 500 || status === 0;

/** The server's answer code → what Sasha reads. A refusal says why; only a dead store says «ще раз». */
export function problemText(error: string, status: number): string {
  if (error === "unknown_project") return "Такого проекту вже немає — онови сторінку.";
  if (error === "no_project") return "Вибери, за який проект прийшли гроші.";
  if (error === "invalid" || error === "bad_request") return "Запис не пройшов перевірку: глянь суму, дату і що вибрано.";
  if (status === 409) return "Не збереглось — хтось змінив дані тієї ж миті. Введене на місці.";
  return "Не збереглось — сховище не відповіло. Введене на місці.";
}
