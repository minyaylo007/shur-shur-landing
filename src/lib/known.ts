/**
 * «Нас знають» row (brief §5): VERIFIED clients/partners from the appendix —
 * the radio segment, the featured curtain salon, the Court Style location and
 * outfit credits.
 *
 * History, because the file used to be called `posts.ts` and to be twice this
 * size. Next to this list lived `posts` — a hand-curated Instagram grid, six
 * tiles over six PNGs in `public/brand`. The section that rendered it
 * (`InstaGrid`) was removed in redesign v2 and the array was kept «as verified
 * research material». Nothing in `src/` has imported it since: it drew no
 * pixel, it held 12 MB of images alive, and three of its six tiles reached
 * `site.socials.instagram` straight past the readiness gate, so the promise in
 * `lib/site` — flip the flag, the channel disappears EVERYWHERE — was quietly
 * false for them. It is gone from the tree, not from the project:
 * `git show 5d9bc24:src/lib/posts.ts` brings back every string and URL.
 *
 * What survived is this list, which `Trust.tsx` actually renders. Display
 * names live in the dictionaries (`trust.knownBy.names`, same order), so the
 * order here is load-bearing — see the comment at `dictionaries/uk.ts`.
 */
export const knownHandles = [
  { handle: "@100fmcv", href: "https://www.instagram.com/100fmcv/" },
  { handle: "@tulpan_cv", href: "https://www.instagram.com/tulpan_cv/" },
  { handle: "@terrasa_ace", href: "https://www.instagram.com/terrasa_ace/" },
  { handle: "@irony_ua", href: "https://www.instagram.com/irony_ua/" },
] as const;
