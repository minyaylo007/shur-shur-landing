import type { Dictionary } from "@/dictionaries";
import { messengers, site } from "@/lib/site";
import { isChannelReady } from "@/lib/channels";
import { Logo } from "@/components/ui/Logo";
import { FooterYear } from "./FooterYear";
import { CherryIcon, InstagramIcon, PhoneIcon, TelegramIcon } from "@/components/ui/icons";

interface FooterProps {
  nav: Dictionary["nav"];
  footer: Dictionary["footer"];
}

/* Build-time year = server-rendered initial; FooterYear updates it client-side. */
const buildYear = new Date().getFullYear();

export function Footer({ nav, footer }: FooterProps) {
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
            {/* Readiness is per account, so the same flag that gates the DM
                deep-link gates the profile link: if the account is not real,
                neither row may render. This block used to read site.socials.*
                directly and shipped a dead t.me link past the flag. */}
            {isChannelReady("instagram") ? (
              <a
                href={site.socials.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex cursor-pointer items-center gap-2 transition-colors hover:text-juice-300"
              >
                <InstagramIcon className="size-4" />
                {/* dir="ltr": keeps the "@" in front of the handle under RTL. */}
                <span dir="ltr">{site.socials.instagramHandle}</span>
              </a>
            ) : null}
            {isChannelReady("telegram") ? (
              <a
                href={messengers.telegram.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex cursor-pointer items-center gap-2 transition-colors hover:text-juice-300"
              >
                <TelegramIcon className="size-4" />
                <span dir="ltr">{site.socials.telegramHandle}</span>
              </a>
            ) : null}
          </div>

          {/* Brief §19: contacts repeated at the bottom, phone included. v1
              had the number only inside wa.me/viber deep-links, so a visitor
              who wanted to simply call had nothing to click. */}
          <div className="flex flex-col gap-2 text-sm">
            <span className="font-display text-xs font-bold tracking-[0.18em] text-juice-300 uppercase">
              {footer.contacts}
            </span>
            <a
              href={site.phone.tel}
              className="inline-flex cursor-pointer items-center gap-2 transition-colors hover:text-juice-300"
            >
              <PhoneIcon className="size-4" />
              {/* dir="ltr": without it the leading "+" is re-ordered in Hebrew. */}
              <span dir="ltr">{site.phone.display}</span>
            </a>
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
