import { gaps, type PrivacyCopy } from "./types";

export const privacyEn: PrivacyCopy = {
  meta: {
    title: "Privacy and cookie policy — SHUR-SHUR",
    description: "What SHUR-SHUR does with the data you send through the site, who receives it, for how long, and your rights.",
  },
  heading: "Privacy and cookie policy",
  updated: "Version of 29.09.2026",
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
        "Advertising identifiers (Meta and Google click ids, the _fbp and _fbc cookies) — ONLY if you pressed «Allow advertising cookies» (art. 6(1)(a) — consent).",
        "Your IP address — to limit the number of requests from one address (spam protection) and in the hosting provider's technical logs (art. 6(1)(f) — security).",
      ],
    },
    {
      heading: "Cookies and storage in your browser",
      paragraphs: [
        "Strictly necessary, no consent needed: your cookie choice (localStorage, until you change it); the source of your visit (sessionStorage, deleted when you close the tab); your language choice, if you switched it (a cookie and localStorage, 12 months).",
        "Advertising, only after «Allow advertising cookies»: the Meta Pixel and its cookies _fbp and _fbc (up to 90 days). Without your consent the pixel is not loaded at all. You can withdraw consent at any time with the «Cookie settings» link at the bottom of every page.",
      ],
    },
    {
      heading: "Who receives the data",
      paragraphs: [],
      items: [
        "Vercel Inc. (USA) — hosts the site and processes the request on its way to us.",
        "Telegram — the messenger in which our team receives your request.",
        "Hetzner Online GmbH (EU) — hosts our own server with the log of requests.",
        "Meta Platforms Ireland Ltd. — only with your consent to advertising cookies: pixel events and, for a request, only a one-way hash of your contact, never its text.",
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
        "Meta advertising cookies: up to 90 days, and only with your consent.",
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
