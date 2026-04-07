import { motion } from "framer-motion";
import { eventConfig } from "@/config/event";
import { Link } from "@/router";
import { Badge } from "./badge";

export function Hero() {
  const { name, edition, hero, tagline, displayDate, location, dressCode, rsvpDeadline } = eventConfig;

  return (
    <section className="relative flex flex-1 flex-col overflow-hidden">
      <div className="relative mx-auto grid max-w-5xl items-center gap-10 px-6 py-16 md:grid-cols-2 md:gap-10 md:py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", bounce: 0.3, duration: 0.8 }}
        >
          <div
            className="mb-5 inline-block rounded-full px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[2.5px]"
            style={{ backgroundColor: "var(--accent-amber-subtle)", color: "var(--accent-amber)" }}
          >
            {hero.badge}
          </div>

          <h1>
            <span
              className="block text-[44px] font-extrabold leading-[1.05] tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              {name.toUpperCase().split(" ")[0]}
            </span>
            <span
              className="block text-[44px] font-extrabold leading-[1.05] tracking-tight"
              style={{ color: "var(--accent-amber)" }}
            >
              SUMMIT {edition}
            </span>
          </h1>

          <p className="mt-5 max-w-md text-base leading-relaxed" style={{ color: "var(--text-muted)" }}>
            {tagline}
            <br />
            {hero.subtitle.split("*").map((part, i) =>
              i % 2 === 1 ? (
                <em key={i} className="not-italic font-semibold" style={{ color: "var(--accent-amber)" }}>{part}</em>
              ) : (
                <span key={i}>{part}</span>
              )
            )}
          </p>

          <div className="mt-7 flex gap-3">
            <Link
              href={hero.cta.href}
              className="rounded-xl px-8 py-3.5 text-sm font-bold transition-colors hover:opacity-90"
              style={{ backgroundColor: "var(--accent-amber)", color: "#1A1A2E" }}
            >
              {hero.cta.label}
            </Link>
            <Link
              href={hero.secondaryCta.href}
              className="rounded-xl border px-8 py-3.5 text-sm font-semibold transition-colors"
              style={{ borderColor: "rgba(59, 130, 246, 0.4)", color: "var(--accent-blue)" }}
            >
              {hero.secondaryCta.label}
            </Link>
          </div>

          <div className="mt-9 grid grid-cols-2 gap-x-8 gap-y-4">
            {[
              { icon: "📅", label: "Date", value: displayDate },
              { icon: "📍", label: "Location", value: `${location.venue}, ${location.city}`, href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${location.venue}, ${location.city}`)}` },
              { icon: "👔", label: "Dress Code", value: dressCode },
              { icon: "⏰", label: "RSVP by", value: rsvpDeadline },
            ].map((item) => (
              <div
                key={item.label}
                className="border-l-2 pl-3"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--text-faded)" }}>
                  {item.icon} {item.label}
                </div>
                {"href" in item && item.href ? (
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 inline-block text-[13px] font-semibold no-underline transition-opacity hover:opacity-70"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {item.value}
                  </a>
                ) : (
                  <div className="mt-0.5 text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                    {item.value}
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.div>

        <Badge />
      </div>

      {/* Cover image with top fade */}
      <motion.div
        className="relative mt-auto w-full"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, delay: 0.6 }}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-32"
          style={{ background: "linear-gradient(to bottom, var(--base), transparent)" }}
        />
        <img
          src="/cover.png"
          alt="Serverless Summit - Come as you work"
          className="w-full"
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16"
          style={{ background: "linear-gradient(to top, var(--base), transparent)" }}
        />
      </motion.div>
    </section>
  );
}
