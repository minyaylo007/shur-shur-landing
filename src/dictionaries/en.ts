import type { Dictionary } from "./uk";

/** English dictionary. Key parity with uk.ts is compiler-enforced. */
export const en: Dictionary = {
  meta: {
    title: "SHUR-SHUR — content agency from Chernivtsi",
    description:
      "We shoot, edit and promote social content: production, Reels, paid advertising, motion and AI solutions.",
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
  },
  langSwitcher: {
    label: "Site language",
    current: "Current language",
  },
  hero: {
    titleLines: ["WE MAKE", "CONTENT", "THAT SELLS"],
    subtitle: "Production, editing, social media, advertising.",
    cta: "Discuss a project",
    secondary: "See the work",
  },
  work: {
    kicker: "Portfolio",
    heading: "SELECTED WORK",
    note: "Shot and edited for clients.",
    groups: {
      beauty: { label: "BEAUTY" },
      food: { label: "FOOD" },
      fashion: { label: "FASHION" },
      interior: { label: "INTERIORS" },
      estate: { label: "REAL ESTATE" },
    },
    playLabel: "Video plays muted",
  },
  process: {
    kicker: "How it looks",
    heading: "FROM BEHIND THE SCENES TO THE FRAME",
    sub: "One shoot, two frames.",
    btsLabel: "Behind the scenes",
    resultLabel: "Result",
  },
  services: {
    kicker: "What we do",
    heading: "SERVICES",
    expand: "Details",
    collapse: "Collapse",
    items: [
      {
        title: "Content & production",
        tagline: "Shooting, editing, Reels",
        points: [
          "Photo, video, mobile-first shooting",
          "Scripts, models, locations",
          "Editing, subtitles, sound",
        ],
      },
      {
        title: "Social media",
        tagline: "The whole profile",
        points: [
          "Strategy, content plan, feed art direction",
          "Reels, stories, posts",
          "Analytics and reporting",
        ],
      },
      {
        title: "Advertising & strategy",
        tagline: "Enquiries, not impressions",
        points: [
          "Niche analysis, strategy, consulting",
          "Creatives, launch, optimisation",
          "Meta, Google, TikTok, Telegram Ads, X",
        ],
      },
      {
        title: "Motion, IT & AI",
        tagline: "Animation, websites, bots",
        points: [
          "Motion films, posters, logos",
          "Websites, landing pages, stores",
          "CRM, back office, AI agents, chatbots",
        ],
      },
    ],
  },
  trust: {
    kicker: "About",
    heading: "A TEAM FROM CHERNIVTSI",
    paragraphs: ["Eleven people in Chernivtsi. We work in Ukraine, Romania and Israel."],
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
      caption: "From Instagram, verbatim in Ukrainian.",
      items: [
        { text: "Дай Боже", source: "comment under a post" },
        { text: "Горжусь!!", source: "comment under a post" },
        {
          text: "Навчання з @lexi.brzvsk Кольорокорекція, робота зі стабілізатором, правильні налаштування камери…",
          source: "@pafos.art, a post",
        },
      ],
    },
  },
  audit: {
    kicker: "Free",
    heading: "AN INSTAGRAM REVIEW",
    sub: "We tell you what to change in the content.",
    delivery: "We reply in your messenger.",
    channelsLabel: "Or message us directly",
    form: {
      igLabel: "Instagram username",
      igPlaceholder: "@your_business",
      contactLabel: "Messenger or phone",
      contactPlaceholder: "@nickname or +380…",
      submit: "Get the review",
      submitting: "Sending…",
      successTitle: "Got it!",
      successText: "We will look at the profile and get back to you.",
      successAgain: "Send another one",
      errorTitle: "Something went wrong",
      errorText: "It did not send. Try again or message us directly:",
      retry: "Try again",
      errors: {
        igHandle: "Enter a username: 2–60 characters, @ optional",
        contact: "Enter a messenger handle or phone (3 characters or more)",
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
    open: "Discuss a project",
    close: "Close",
    label: "Ways to reach us",
    channels: {
      telegram: "Telegram",
      whatsapp: "WhatsApp",
      instagram: "Instagram Direct",
    },
  },
};
