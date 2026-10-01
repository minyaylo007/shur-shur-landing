import { gaps, type PrivacyCopy } from "./types";

export const privacyEn: PrivacyCopy = {
  meta: {
    title: "Privacy and cookie policy — SHUR-SHUR",
    description: "What SHUR-SHUR does with the data you send through the site, who receives it, for how long, and your rights.",
  },
  heading: "Privacy and cookie policy",
  updated: "Version of 01.10.2026",
  sections: [
    {
      heading: "Who is responsible for your data",
      paragraphs: [
        `Controller: ${gaps.controller}, ${gaps.registration}, ${gaps.address}. Contact for any question about your data: ${gaps.email}.`,
        `Representative in the European Union (GDPR art. 27): ${gaps.euRepresentative}.`,
      ],
    },
    {
      heading: "What we collect and why",
      paragraphs: [],
      items: [
        "The request form: your Instagram username and your contact (a messenger or a phone number), plus the page language. We use them to answer your request and to discuss the work you asked about (GDPR art. 6(1)(b) — steps at your request before a contract).",
        "Where you came from: campaign tags from the link (utm_*), the page you first opened and the site that sent you (its domain only). They travel with the request so we know which campaign brought it (art. 6(1)(f) — our legitimate interest in measuring our advertising).",
        "Advertising identifiers (Meta and Google click ids, the _fbp and _fbc cookies) — only while advertising cookies are on: in the EU/EEA, the United Kingdom and Switzerland only after «Allow advertising cookies» (art. 6(1)(a) — consent); in other countries until you refuse them (see the Meta Pixel section).",
        "Your IP address — to limit the number of requests from one address (spam protection) and in the hosting provider's technical logs (art. 6(1)(f) — security).",
      ],
    },
    {
      heading: "Cookies and storage in your browser",
      paragraphs: [
        "Strictly necessary, no consent needed: the consent zone — the shur_zone cookie with the value eu or other (24 hours; the zone only, no country and no identifier of any kind); your cookie choice (localStorage, until you change it); the source of your visit (sessionStorage, deleted when you close the tab); a technical request id for the thank-you page (sessionStorage, deleted as soon as the page has read it, and kept no longer than 10 minutes); your language choice, if you switched it (a cookie and localStorage, 12 months).",
        "Advertising: the Meta Pixel and its cookies _fbp and _fbc (up to 90 days). When they are switched on depends on your consent zone — see the next section. You can refuse or withdraw consent at any time with the «Cookie settings» link at the bottom of every page.",
      ],
    },
    {
      heading: "Meta Pixel: when it runs and what Meta receives",
      paragraphs: [
        "Your consent zone is determined by the hosting provider (Vercel) from the IP address of your request: only the country is taken from it, and your browser keeps nothing but the zone — eu or other (the shur_zone cookie). If the country cannot be determined, the eu zone applies.",
        "The eu zone — the countries of the EU and the European Economic Area, the United Kingdom and Switzerland: the Meta Pixel is not loaded at all until you press «Allow advertising cookies» in the banner (GDPR art. 6(1)(a) — consent).",
        "The other zone — all other countries: the Meta Pixel is switched on at once. You can refuse at any time: «Cookie settings» at the bottom of every page → «Only necessary»; from that moment the pixel sends nothing.",
        "What Meta receives while the pixel runs. The form data — username, contact, message text — is never passed to Meta, and the address of the thank-you page does not contain it either.",
      ],
      items: [
        "Page view (PageView) — one for each page you open, with no extra data.",
        "Automatic button-click events — the text of the site's button you pressed (our text, not anything you typed).",
        "Contact — when you tap a messenger or the phone: the name of the channel only.",
        "Lead — on the thank-you page after a sent request, once: with a technical request id, so that Meta counts it without duplicates.",
        "With every event — the pixel's usual technical data: the page address, browser data, the IP address, the _fbp and _fbc cookies.",
      ],
    },
    {
      heading: "Who receives the data",
      paragraphs: [],
      items: [
        "Vercel Inc. (USA) — hosts the site and processes the request on its way to us.",
        "Telegram — the messenger in which our team receives your request.",
        "Hetzner Online GmbH (EU) — hosts our own server with the log of requests.",
        "Meta Platforms Ireland Ltd. — only while advertising cookies are on: the pixel events listed above. Meta does not receive the form data.",
      ],
    },
    {
      heading: "Transfers outside the European Economic Area",
      paragraphs: [
        `Our team works from Ukraine, and some of the providers above are outside the EEA. Transfers to Ukraine: ${gaps.transferBasis}. Vercel relies on the EU-US Data Privacy Framework and the European Commission's standard contractual clauses.`,
      ],
    },
    {
      heading: "How long we keep it",
      paragraphs: [],
      items: [
        `Requests: ${gaps.leadRetention}.`,
        "IP address in the request limiter: up to 10 minutes, in memory only.",
        "Source of the visit in your browser: until you close the tab.",
        "Your cookie choice: until you change it or clear the browser.",
        "The consent zone (shur_zone cookie): 24 hours.",
        "The request id for the thank-you page: until that page opens, no longer than 10 minutes.",
        "Meta advertising cookies: up to 90 days; in the EU/EEA, the United Kingdom and Switzerland only with your consent.",
      ],
    },
    {
      heading: "Your rights",
      paragraphs: [
        `You may ask for access to your data, its correction or erasure, restriction of processing, a copy in a portable format, and you may object to processing based on our legitimate interest. Consent can be withdrawn at any time; this does not affect what was done before. For Israel: the right to review and to correct information about you (Privacy Protection Law 5741-1981, sections 13–14). Write to ${gaps.email}.`,
        "We make no automated decisions about you, do not sell data and do not send advertising messages you did not ask for.",
      ],
    },
    {
      heading: "Where to complain",
      paragraphs: [],
      items: [
        "Romania — ANSPDCP, the National Supervisory Authority for Personal Data Processing: www.dataprotection.ro.",
        "Israel — the Privacy Protection Authority: www.gov.il/en/departments/the_privacy_protection_authority.",
        "Ukraine — the Ukrainian Parliament Commissioner for Human Rights: ombudsman.gov.ua.",
        "Or the data protection authority of the EU country where you live or work.",
      ],
    },
  ],
  back: "Back to the site",
};
