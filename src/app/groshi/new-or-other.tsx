"use client";

/** Under the list of projects, in «Розібрати» and in «+ Внести» alike: «+ Новий проект» opens one field «Назва»;
 *  «Інше» — income for no project. `title` null — the field is closed. */
export function NewOrOther({
  title,
  onTitle,
  onOther,
  busy,
  button,
  field,
}: {
  title: string | null;
  onTitle: (title: string | null) => void;
  onOther: () => void;
  busy: boolean;
  button: string;
  field: string;
}) {
  return (
    <>
      <div className="mt-2 flex flex-wrap gap-2">
        {title === null ? (
          <button type="button" onClick={() => onTitle("")} className={button}>
            + Новий проект
          </button>
        ) : null}
        <button type="button" disabled={busy} onClick={onOther} className={button}>
          Інше
        </button>
      </div>
      {title !== null ? (
        <input autoFocus aria-label="Назва" placeholder="Назва нового проекту" value={title} maxLength={80} onChange={(e) => onTitle(e.target.value)} className={`mt-2 ${field}`} />
      ) : null}
    </>
  );
}
