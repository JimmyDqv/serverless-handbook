export const eventConfig = {
  // ──────────────────────────────────────────────
  // EVENT CONFIG - Edit this file to customize your event
  // ──────────────────────────────────────────────
  name: "Serverless Summit",
  year: 2026,
  edition: "'26",
  tagline: "Wake up, get dressed like any other Thursday. It's time for this year's most serious conference. Or well, the most elaborate party at least.",
  dressCode: "Come as you work",
  date: "2026-07-04T16:00:00",
  displayDate: "July 4, 2026",
  rsvpDeadline: "June 20, 2026",
  location: {
    city: "Stockholm",
    venue: "The Garden Venue",
    description: "Our garden",
  },
  guestCount: 50,

  nav: {
    links: [
      { label: "Home", href: "/" },
      { label: "Schedule", href: "/schedule" },
      { label: "Keynote", href: "/keynote" },
      { label: "Gallery", href: "/gallery" },
      { label: "RSVP", href: "/rsvp" },
      { label: "Admin", href: "/admin" },
    ],
    cta: { label: "RSVP NOW", href: "/rsvp" },
  },

  hero: {
    badge: "Summer Party 2026 - CONFERENCE",
    subtitle: "This year's theme is Work Conference. Dress up as the most exaggerated stereotype of *what you actually do for a living*. Think big!",
    cta: { label: "RSVP NOW", href: "/rsvp" },
    secondaryCta: { label: "SCHEDULE", href: "/schedule" },
  },

  schedule: {
    sectionLabel: "Program",
    title: "Evening Schedule",
    description: "A full evening of activities, food, quiz, and party.",
    events: [
      { time: "16:00", title: "Arrival & Mingle", description: "Welcome! Mingle, hang out, and check out each other's costumes.", color: "amber" as const },
      { time: "16:30", title: "Games & Activities", description: "Time to compete! Fun activities and challenges.", color: "blue" as const },
      { time: "18:30", title: "Dinner", description: "Food is served. Time to recharge for the evening's highlight.", color: "blue" as const },
      { time: "20:30", title: "Quiz & Dessert", description: "The evening's highlight! Test your knowledge in the big quiz. With dessert of course.", color: "amber" as const },
      { time: "21:30", title: "Party, Mingle & Snacks", description: "The party continues! Hang out, dance, and enjoy the evening.", color: "faded" as const },
    ],
  },

  keynote: {
    sectionLabel: "Keynote Session",
    title: "The Big Quiz",
    description: "Assemble your team and compete for glory (and prizes).",
    emoji: "🧠",
    speaker: "The Host",
    stage: "Main Stage",
    time: "20:30",
    tags: [
      { label: "Team Battle", color: "amber" as const },
      { label: "Prizes", color: "blue" as const },
    ],
    howItWorks: "Form teams of 4-6 people. Each round has a theme tied to a profession. How much do you really know?",
    stats: [
      { value: "Many", label: "Questions", color: "amber" as const },
      { value: "4-6", label: "Per Team", color: "blue" as const },
      { value: "🏆", label: "Prizes", color: "amber" as const },
    ],
  },

  gallery: {
    sectionLabel: "Gallery",
    title: "Featured Speakers",
    description: "Meet the people behind the event. Here's some inspiration!",
    items: [
      { emoji: "☁️", title: "Cloud Architect", description: "Lives in the cloud. Draws diagrams for fun. Thinks everything should be serverless.", image: "/gallery/placeholder.svg" },
      { emoji: "👨‍💻", title: "Software Developer", description: "Hoodie, energy drink, three screens. Says everything should be rewritten in Rust.", image: "/gallery/placeholder.svg" },
      { emoji: "🎨", title: "UX Designer", description: "All black, turtleneck, and opinions on kerning. Sketchbook in hand.", image: "/gallery/placeholder.svg" },
      { emoji: "📊", title: "Data Scientist", description: "Jupyter notebooks everywhere. Can explain anything with a scatter plot.", image: "/gallery/placeholder.svg" },
      { emoji: "🔒", title: "Security Engineer", description: "Paranoid by profession. Has opinions about your password policy.", image: "/gallery/placeholder.svg" },
      { emoji: "🚀", title: "DevOps Engineer", description: "Pipelines are life. Monitors dashboards at 3 AM. Automates everything.", image: "/gallery/placeholder.svg" },
      { emoji: "👔", title: "Product Manager", description: "Pinstripe suit, suspenders, and a gold watch. Points and delegates.", image: "/gallery/placeholder.svg" },
      { emoji: "📱", title: "Mobile Developer", description: "Carries five phones. Argues about iOS vs Android at dinner parties.", image: "/gallery/placeholder.svg" },
      { emoji: "🧪", title: "QA Engineer", description: "Found the bug you said didn't exist. Has trust issues with 'it works on my machine'.", image: "/gallery/placeholder.svg" },
    ],
  },

  rsvp: {
    sectionLabel: "Registration",
    title: "RSVP",
    description: "Let us know you're coming. RSVP by June 20.",
    infoTitle: "Event Details",
    submitLabel: "I'M COMING!",
    fields: {
      name: { label: "Name", placeholder: "Your name" },
      guests: { label: "Number of guests", placeholder: "Number of adults" },
      dietary: { label: "Dietary preferences", placeholder: "Allergies, vegetarian, etc." },
    },
  },

  footer: {
    tagline: "A totally serious annual conference. Absolutely not a party.",
  },

  mockGuest: {
    name: "Jane Doe",
    title: "Cloud Architect",
    attendeeNumber: "0001",
    emoji: "👩‍💼",
  },
} as const;

export type EventConfig = typeof eventConfig;
export type ScheduleEvent = EventConfig["schedule"]["events"][number];
export type GalleryItem = EventConfig["gallery"]["items"][number];
export type KeynoteStat = EventConfig["keynote"]["stats"][number];
