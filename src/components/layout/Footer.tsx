import type { Dictionary } from "@/dictionaries";
import { site } from "@/lib/site";
import { Logo } from "@/components/ui/Logo";
import { FooterYear } from "./FooterYear";
import { CherryIcon, InstagramIcon, TelegramIcon } from "@/components/ui/icons";

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
            <a href="#services" className="cursor-pointer transition-colors hover:text-juice-300">{nav.services}</a>
            <a href="#cases" className="cursor-pointer transition-colors hover:text-juice-300">{nav.cases}</a>
            <a href="#about" className="cursor-pointer transition-colors hover:text-juice-300">{nav.about}</a>
            <a href="#team" className="cursor-pointer transition-colors hover:text-juice-300">{nav.team}</a>
            <a href="#contact" className="cursor-pointer transition-colors hover:text-juice-300">{nav.contact}</a>
          </nav>

          <div className="flex flex-col gap-2 text-sm">
            <span className="font-display text-xs font-bold tracking-[0.18em] text-juice-300 uppercase">
              {footer.socials}
            </span>
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
            <a
              href={site.socials.telegram}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex cursor-pointer items-center gap-2 transition-colors hover:text-juice-300"
            >
              <TelegramIcon className="size-4" />
              <span dir="ltr">{site.socials.telegramHandle}</span>
            </a>
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
