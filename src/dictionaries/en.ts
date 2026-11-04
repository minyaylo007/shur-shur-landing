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
    cases: "Cases",
    packages: "Packages",
    how: "How we work",
    contact: "Contact",
    cta: "Discuss a project",
    callLabel: "Call us",
    menuLabel: "Page navigation",
    skipToContent: "Skip to content",
  },
  langSwitcher: {
    label: "Site language",
    current: "Current language",
  },
  hero: {
    titleLines: ["CONTENT", "THAT SELLS,", "WHEREVER YOU ARE"],
    subtitle:
      "Social media, editing and ads for small businesses — run remotely by a production team from Chernivtsi, Ukraine.",
    cta: "Discuss a project",
    secondary: "See the cases",
    direct: "Message us on Direct",
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
    heading: "ONE TEAM, MANY PLACES",
    paragraphs: [
      "Part of the team is in Chernivtsi, part works remotely from other cities and countries. We take on projects from different markets, wherever you are.",
    ],
    facts: [
      { value: "11", label: "people on the team" },
      { value: "7", label: "service directions" },
      { value: "3", label: "countries we have worked in" },
    ],
  },
  /* v4 B1.2: niche + what we made, from the portfolio's own alt texts.
     Brand, task and result are slots in lib/cases — empty, not drawn. */
  cases: {
    kicker: "Cases",
    heading: "WHAT WE MADE FOR CLIENTS",
    did: "What we made",
    task: "Task",
    result: "Result",
    all: "All work",
    items: {
      bridal: {
        niche: "Bridal brand",
        did: "A salon image film, a dress being made in close-up, a black-and-white atelier shoot",
      },
      restaurant: {
        niche: "Italian restaurant",
        did: "Kitchen Reels, stories for the seasonal terrace menu, pasta and wine served",
      },
      bodycare: {
        niche: "Body-care brand",
        did: "A product shoot of a balm in water — from behind the scenes to the finished frame",
      },
      leisure: {
        niche: "Leisure complex",
        did: "Stories inviting guests to book a cottage, with a calendar of open dates",
      },
      wellness: {
        niche: "Wellness studio",
        did: "Reels of a massage treatment and stories inviting bookings",
      },
    },
  },
  /* v4 B1.3: the bullets are services.items[0..2]; the «від» price lives
     in lib/business and is drawn only when it exists. */
  packages: {
    kicker: "Packages",
    heading: "WHERE TO START",
    from: "from",
    ask: "Ask the price",
    names: {
      shoot: "Shooting day",
      social: "Social media · month",
      ads: "Advertising · month",
    },
    extra: "Also: motion, websites, bots and AI — scoped to the task.",
  },
  /* v4 B1.4: four steps in the market's own terms. Facts from the brief
     (A4/B2) — every line awaits the owner's confirmation in the PR. */
  how: {
    kicker: "How we work",
    heading: "WITH YOUR CITY",
    steps: [
      {
        title: "You write to us",
        text: "We reply in English, in the messenger you prefer.",
      },
      {
        title: "We shoot",
        text: "Not in our city? You film on your phone to our script, and we do the editing.",
      },
      {
        title: "We run and launch",
        text: "Social media and ads, managed remotely — wherever you are.",
      },
      {
        title: "Payment and timing",
        text: "Payment terms and deadlines are agreed in writing before we start.",
      },
    ],
  },
  /* v4 B1.5–B1.6: headings only — the section renders when lib/business
     has people / reviews, and not at all before. */
  team: {
    kicker: "Team",
    heading: "WHO YOU WORK WITH",
  },
  reviews: {
    kicker: "Reviews",
    heading: "WHAT CLIENTS SAY",
  },
  /* v4 B1.7: conservative answers; rights to the material is a question
     for the owner, not answered here. */
  faq: {
    kicker: "Questions",
    heading: "FAQ",
    items: [
      {
        q: "What language do you work in?",
        a: "English, Ukrainian, Romanian and Hebrew — write in whichever suits you.",
      },
      {
        q: "Where do you shoot?",
        a: "In Chernivtsi, on site. Elsewhere — shooting trips by arrangement, or you film on your phone to our script.",
      },
      {
        q: "Can we work fully remotely?",
        a: "Yes. Social media, editing your footage, ads, motion, websites and bots need no meeting.",
      },
      {
        q: "How much does it cost?",
        a: "It depends on the scope. Tell us what you need and we will name the price in the messenger.",
      },
      {
        q: "How do I pay from abroad?",
        a: "The payment method and paperwork are agreed before we start, for your country.",
      },
      {
        q: "When will I see results?",
        a: "Timing depends on the task. We name it before we start and put it in writing.",
      },
    ],
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
      retry: "Try again",
      failures: {
        rate_limited: {
          title: "We already have your request",
          text: "You sent several in a row — all of them reached us. The form will take a new one in about 10 minutes. If it is urgent, message or call us directly:",
        },
        invalid_json: {
          title: "The request arrived damaged",
          text: "The data was lost on the way — that happens on a shaky connection. Try again, and if it repeats, message us directly:",
        },
        invalid_input: {
          title: "Check what is in the fields",
          text: "The username is 2–60 Latin characters, digits, dots and underscores, @ optional. The contact is a Telegram handle or a phone number, 3 characters or more. Fix it and send again.",
        },
        delivery_failed: {
          title: "Your request did not reach us",
          text: "The link to our messenger is down right now, and another attempt will most likely end the same way. The fastest way to us is to write or call:",
        },
        network: {
          title: "The connection dropped",
          text: "The request never left: the network went away or no answer came within 15 seconds. Check the connection and try again.",
        },
        unknown: {
          title: "Something went wrong",
          text: "The server answered with an error we did not expect. Try again, and if it repeats, message us directly:",
        },
      },
      errors: {
        igHandle: "Enter a username: 2–60 characters, @ optional",
        contact: "Enter a messenger handle or phone (3 characters or more)",
      },
    },
  },
  footer: {
    tagline: "Content agency from Chernivtsi",
    email: "Email",
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
      viber: "Viber",
      instagram: "Instagram Direct",
    },
  },
  consent: {
    label: "Cookie consent",
    text: "We use only what the site needs to work. With your permission, also Meta advertising cookies — to see which ads bring in requests.",
    necessary: "Only necessary",
    allowAds: "Allow advertising cookies",
    settings: "Cookie settings",
  },
  thanks: {
    metaTitle: "Request received — SHUR-SHUR",
    home: "Back to the main page",
  },
  notFound: {
    metaTitle: "Page not found — SHUR-SHUR",
    heading: "NO SUCH PAGE",
    text: "The address may have a typo, or the page is gone. Everything we do is gathered on the main page.",
    home: "Back to the site",
    chooseLanguage: "Choose a language",
  },
};
