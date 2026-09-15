import type { Dictionary } from "./uk";

/** English dictionary. Key parity with uk.ts is compiler-enforced. */
export const en: Dictionary = {
  meta: {
    title: "SHUR-SHUR — content agency from Chernivtsi",
    description:
      "We shoot, edit and promote social content: production, Reels, paid advertising, motion and AI solutions. A team of 11 in Chernivtsi, Ukraine.",
    ogAlt: "SHUR-SHUR — content agency from Chernivtsi.",
  },
  nav: {
    work: "Work",
    services: "Services",
    about: "About",
    contact: "Contact",
    cta: "Discuss a project",
    menuLabel: "Page navigation",
    skipToContent: "Skip to content",
    callLabel: "Call us",
  },
  langSwitcher: {
    label: "Site language",
    uk: "Укр",
    en: "Eng",
    he: "עב",
    ro: "Rom",
  },
  hero: {
    badge: "Content agency • Chernivtsi",
    titleLines: ["WE MAKE", "CONTENT", "THAT SELLS"],
    subtitle:
      "Full cycle: production, editing, social media management and paid advertising. Ukraine, Romania, Israel.",
    cta: "Discuss a project",
    contactLabel: "Or reach us directly:",
    scrollHint: "See our work",
  },
  work: {
    kicker: "Portfolio",
    heading: "SELECTED WORK",
    sub: "Shot, edited and published by the SHUR-SHUR team.",
    groups: {
      beauty: { label: "BEAUTY & PRODUCT", note: "Studio shoots for cosmetics and skincare" },
      food: { label: "FOOD & HOSPITALITY", note: "Coffee shops, restaurants, bakeries" },
      bridal: { label: "FASHION & BRIDAL", note: "Shoots on location" },
      stories: { label: "STORIES & REELS", note: "Finished creatives we made for clients" },
    },
    playLabel: "Video plays without sound",
  },
  process: {
    kicker: "How it looks",
    heading: "FROM BEHIND THE SCENES TO THE FRAME",
    sub: "One cosmetics shoot: first the studio process, then the finished frame for the client.",
    btsLabel: "Behind the scenes",
    resultLabel: "Result",
  },
  services: {
    kicker: "What we do",
    heading: "SERVICES",
    sub: "Four directions. Expand any of them for the detail.",
    expand: "Details",
    collapse: "Collapse",
    items: [
      {
        title: "Content & production",
        tagline: "Shooting, editing and finished Reels — from idea to publication",
        points: [
          "Professional photo and video production",
          "Mobile-first shooting",
          "Scripts for Reels and TikTok",
          "Model and location casting",
          "Editing, subtitles, sound design",
          "Adapted for every platform",
        ],
      },
      {
        title: "Social media management",
        tagline: "The whole profile: strategy, content plan, daily stories",
        points: [
          "Content strategy",
          "Reels, stories and posts",
          "Content calendar",
          "Feed art direction",
          "Analytics and reporting",
        ],
      },
      {
        title: "Advertising & strategy",
        tagline: "Enquiries and sales, not just impressions",
        points: [
          "Niche and competitor analysis",
          "Advertising strategy",
          "Campaign creatives",
          "Launch and optimisation",
          "Meta, Google, TikTok, Telegram Ads, X",
          "Marketing consulting and a growth plan",
        ],
      },
      {
        title: "Motion, IT & AI",
        tagline: "Animation, websites and automation for your business",
        points: [
          "Animated posters and ad films",
          "Logo animation, motion creatives",
          "Websites, landing pages, online stores",
          "CRM and back-office systems",
          "AI agents, chatbots, integrations",
        ],
      },
    ],
  },
  trust: {
    kicker: "About",
    heading: "A TEAM FROM CHERNIVTSI",
    paragraphs: [
      "SHUR-SHUR is a team of 11 people who live on content: we shoot, edit, animate, run ads and build AI solutions. Every direction has its own specialist.",
      "We work with businesses across Ukraine and are moving into international markets — our clients already include projects in Romania and Israel.",
    ],
    facts: [
      { value: "11", label: "people on the team" },
      { value: "7", label: "service directions" },
      { value: "3", label: "countries we work in" },
    ],
    knownBy: {
      label: "Known by:",
      names: [
        "Bukovynska Khvylia radio",
        "Tulpan textile showroom",
        "ACE tennis club",
        "IRONY clothing brand",
      ],
    },
    quotes: {
      /* The quotes stay in the original Ukrainian on every locale: they are
         verbatim real comments, and translating them would fabricate words
         nobody wrote. The caption explains that in the reader's language. */
      caption: "Verbatim comments and posts about us on Instagram, in the original Ukrainian.",
      items: [
        { text: "Дай Боже", source: "comment under our introduction post" },
        { text: "Горжусь!!", source: "comment under our introduction post" },
        {
          text: "Навчання з @lexi.brzvsk Кольорокорекція, робота зі стабілізатором, правильні налаштування камери…",
          source: "@pafos.art — a post about training with our team",
        },
      ],
    },
  },
  audit: {
    kicker: "Free",
    heading: "AN INSTAGRAM REVIEW",
    sub: "We will look at your profile and tell you what to change so the content brings enquiries.",
    delivery: "We will reply on Telegram or call you — whichever suits you.",
    channelsLabel: "Or message us directly",
    cityLine: "Chernivtsi, Ukraine",
    form: {
      igLabel: "Instagram username",
      igPlaceholder: "@your_business",
      contactLabel: "Telegram or phone number",
      contactPlaceholder: "@nickname or +380…",
      submit: "Get the review",
      submitting: "Sending…",
      successTitle: "Got it!",
      successText: "We will look at the profile and get back to you on the contact you left.",
      successAgain: "Send another one",
      errorTitle: "Something went wrong",
      errorText: "It did not send. Try again or message us directly:",
      retry: "Try again",
      errors: {
        igHandle: "Enter a username: 2–60 characters, @ optional",
        contact: "Enter a Telegram handle or phone (3 characters or more)",
      },
    },
  },
  footer: {
    tagline: "Content agency from Chernivtsi",
    nav: "Navigation",
    socials: "Social",
    contacts: "Contacts",
    city: "Chernivtsi, Ukraine",
    rights: "All rights reserved",
    madeIn: "Made with cherries in Chernivtsi",
  },
  contactBar: {
    open: "Get in touch",
    close: "Close",
    label: "Ways to reach us",
    channels: {
      telegram: "Telegram",
      whatsapp: "WhatsApp",
      viber: "Viber",
      instagram: "Instagram Direct",
    },
  },
  notFound: {
    metaTitle: "Page not found — SHUR-SHUR",
    heading: "NO SUCH PAGE",
    text: "The address may have a typo, or the page is gone. Everything we do is gathered on the main page.",
    home: "Back to the site",
    chooseLanguage: "Choose a language",
  },
};
