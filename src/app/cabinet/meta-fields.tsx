/* Her Meta key: three write-only fields, shared by the setup page and the
   cabinet. Nothing she typed is ever sent back. The one exception is not
   hers: when the pixel id she typed is not the account's and the account
   has exactly one pixel, Meta's id for it goes into the pixel field. */

const input = "mt-1 block w-full rounded border border-ink-500 bg-white px-3 py-2 text-ink-900 placeholder:text-ink-500";

export function MetaFields({ required = false, dataset }: { required?: boolean; dataset?: string }) {
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
          defaultValue={dataset}
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
