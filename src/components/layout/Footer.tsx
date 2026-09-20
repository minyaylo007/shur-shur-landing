import type { Locale } from "@/lib/i18n";
import type { Dictionary } from "@/dictionaries";
import { site } from "@/lib/site";
import { readyChannel } from "@/lib/channels";
import { ContactLink } from "@/components/conversion/ContactLink";
import { Logo } from "@/components/ui/Logo";
import { FooterYear } from "./FooterYear";
import { CHANNEL_ICONS, CherryIcon, PhoneIcon } from "@/components/ui/icons";

interface FooterProps {
  locale: Locale;
  nav: Dictionary["nav"];
  footer: Dictionary["footer"];
}

/* Build-time year = server-rendered initial; FooterYear updates it client-side. */
const buildYear = new Date().getFullYear();

export function Footer({ locale, nav, footer }: FooterProps) {
  // Readiness is per account, so the same gate that decides whether the DM
  // deep-link may be drawn decides whether the @name may be printed: if the
  // account is not real, neither exists. This column used to read
  // `site.socials.*` directly and shipped a dead t.me link past the flag.
  const accounts = (["instagram", "telegram"] as const)
    .map(readyChannel)
    .flatMap((channel) =>
      channel && channel.handle !== null
        ? [{ key: channel.key, href: channel.profile ?? channel.href, handle: channel.handle }]
        : [],
    );

  return (
    <footer className="bg-cherry-black text-paper-100">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xs">
            <Logo className="text-2xl text-paper-50" />
            <p className="mt-3 text-sm text-paper-200/80">{footer.tagline}</p>
          </div>

          <nav aria-label={footer.nav} className="flex flex-col gap-2 text-sm">
            <span className="font-display text-xs font-bold tracking-[0.18em] text-juice-300 uppercase">
              {footer.nav}
            </span>
            {/* Same four destinations as the header — one IA, stated twice. */}
            <a href="#work" className="cursor-pointer transition-colors hover:text-juice-300">{nav.work}</a>
            <a href="#services" className="cursor-pointer transition-colors hover:text-juice-300">{nav.services}</a>
            <a href="#about" className="cursor-pointer transition-colors hover:text-juice-300">{nav.about}</a>
            <a href="#contact" className="cursor-pointer transition-colors hover:text-juice-300">{nav.contact}</a>
          </nav>

          <div className="flex flex-col gap-2 text-sm">
            <span className="font-display text-xs font-bold tracking-[0.18em] text-juice-300 uppercase">
              {footer.socials}
            </span>
            {accounts.map(({ key, href, handle }) => {
              const Icon = CHANNEL_ICONS[key];
              return (
                <ContactLink
                  key={key}
                  href={href}
                  channel={key}
                  locale={locale}
                  placement="footer"
                  className="inline-flex min-h-11 cursor-pointer items-center gap-2 transition-colors hover:text-juice-300"
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {/* dir="ltr": keeps the "@" in front of the handle under RTL. */}
                  <span dir="ltr">{handle}</span>
                </ContactLink>
              );
            })}
          </div>

          {/* Brief §19 and v3 §4: contacts repeated at the bottom, phone
              included — and this is the ONLY place on the page where the
              number appears as a plain contact detail. It is no longer a
              conversion path (not in the header, not on the first screen, not
              in the sticky control), but a business that hides its number
              entirely reads as unreachable, so it stays here, once. `tel:` is
              still a real link: a visitor who wants to call should not have to
              retype digits. */}
          <div className="flex flex-col gap-2 text-sm">
            <span className="font-display text-xs font-bold tracking-[0.18em] text-juice-300 uppercase">
              {footer.contacts}
            </span>
            <ContactLink
              href={site.phone.tel}
              channel="phone"
              locale={locale}
              placement="footer"
              target={undefined}
              rel={undefined}
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 transition-colors hover:text-juice-300"
            >
              <PhoneIcon className="size-4" aria-hidden="true" />
              {/* dir="ltr": without it the leading "+" is re-ordered in Hebrew. */}
              <span dir="ltr">{site.phone.display}</span>
            </ContactLink>
            <p className="text-paper-200/70">{footer.city}</p>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-paper-50/10 pt-6 text-xs text-paper-200/60 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © <FooterYear initial={buildYear} /> {site.name}. {footer.rights}.
          </p>
          <p className="inline-flex items-center gap-1.5">
            {footer.madeIn}
            <CherryIcon className="size-4 text-juice-300" />
          </p>
        </div>
      </div>
    </footer>
  );
}
