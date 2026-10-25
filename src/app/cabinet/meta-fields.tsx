/* Her Meta key: three write-only fields, shared by the setup page and the
   cabinet. Never pre-filled — nothing she typed is ever sent back. */

const input = "mt-1 block w-full rounded border border-ink-500 bg-white px-3 py-2";

export function MetaFields({ required = false }: { required?: boolean }) {
  return (
    <>
      <label className="block">
        <span className="text-sm text-ink-700">Ключ доступа (на экране Meta — «маркер», token; шаг 4)</span>
        <input
          type="password"
          name="meta_token"
          required={required}
          autoComplete="off"
          spellCheck={false}
          className={input}
        />
      </label>
      <label className="block">
        <span className="text-sm text-ink-700">Номер рекламного аккаунта (ID; шаг 5)</span>
        <input
          type="text"
          name="meta_account"
          required={required}
          inputMode="numeric"
          autoComplete="off"
          placeholder="act_1234567890"
          className={input}
        />
      </label>
      <label className="block">
        <span className="text-sm text-ink-700">Номер пикселя (ID; шаг 5)</span>
        <input
          type="text"
          name="meta_dataset"
          required={required}
          inputMode="numeric"
          autoComplete="off"
          className={input}
        />
      </label>
      <p className="text-xs text-ink-500">
        Ключ хранится зашифрованным, на странице не показывается ни целиком, ни частью и после переноса на сервер
        рекламы отсюда стирается.
      </p>
    </>
  );
}
