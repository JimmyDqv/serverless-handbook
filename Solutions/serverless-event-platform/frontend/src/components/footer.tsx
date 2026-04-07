import { eventConfig } from "@/config/event";

export function Footer() {
  const { name, year, displayDate, location, footer } = eventConfig;

  return (
    <footer className="px-6 pb-8 pt-4">
      <div className="mx-auto max-w-5xl">
        <div
          className="mb-6 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, var(--border), transparent)",
          }}
        />
        <div className="flex flex-col items-center gap-4 text-center md:flex-row md:justify-between md:text-left">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-extrabold"
              style={{
                background: "linear-gradient(135deg, #F59E0B, #F97316)",
                color: "#1A1A2E",
              }}
            >
              SS
            </div>
            <span
              className="text-sm font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              {name} {year}
            </span>
          </div>
          <div
            className="text-[13px]"
            style={{ color: "var(--text-muted)" }}
          >
            {displayDate} · {location.city}
          </div>
          <div
            className="text-xs font-semibold italic"
            style={{ color: "var(--accent-amber)" }}
          >
            {footer.tagline}
          </div>
        </div>
      </div>
    </footer>
  );
}
