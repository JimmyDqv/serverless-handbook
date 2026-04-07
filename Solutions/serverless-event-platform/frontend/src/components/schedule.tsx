import { eventConfig, type ScheduleEvent } from "@/config/event";
import { SectionReveal } from "./section-reveal";

const dotColors: Record<ScheduleEvent["color"], string> = {
  amber: "var(--accent-amber)",
  blue: "var(--accent-blue)",
  faded: "rgba(59, 130, 246, 0.3)",
};

const timeColors: Record<ScheduleEvent["color"], string> = {
  amber: "var(--accent-amber)",
  blue: "var(--accent-blue)",
  faded: "var(--text-faded)",
};

const eventEmojis: Record<string, string> = {
  "16:00": "🥂",
  "17:00": "🎲",
  "18:30": "🍽️",
  "20:30": "🧠",
  "21:30": "🎉",
};

export function Schedule() {
  const { schedule } = eventConfig;

  return (
    <SectionReveal className="mx-auto max-w-5xl px-6 py-20">
      <div className="grid items-center gap-12 md:grid-cols-[1fr_1fr]">
        {/* Left — Header + Timeline */}
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[3px]" style={{ color: "var(--accent-amber)" }}>
            {schedule.sectionLabel}
          </div>
          <h2 className="mb-1.5 text-[28px] font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>
            {schedule.title}
          </h2>
          <p className="mb-8 text-sm" style={{ color: "var(--text-muted)" }}>
            {schedule.description}
          </p>

          <div className="relative pl-8">
            <div
              className="absolute bottom-2 left-[6px] top-2 w-0.5"
              style={{ background: "linear-gradient(180deg, var(--accent-amber) 0%, var(--accent-blue) 50%, rgba(59,130,246,0.2) 100%)" }}
            />

            {schedule.events.map((event, i) => (
              <div key={event.time} className={`relative ${i < schedule.events.length - 1 ? "mb-7" : ""}`}>
                <div
                  className="absolute -left-8 top-[3px] h-3.5 w-3.5 rounded-full"
                  style={{ backgroundColor: dotColors[event.color], border: "3px solid var(--badge-border-color)" }}
                />
                <div className="flex gap-4" style={{ alignItems: "baseline" }}>
                  <span className="min-w-[50px] text-[13px] font-bold" style={{ color: timeColors[event.color] }}>
                    {event.time}
                  </span>
                  <div>
                    <div className="mb-1 text-base font-bold" style={{ color: "var(--text-primary)" }}>
                      {event.title}
                    </div>
                    <div className="text-[13px]" style={{ color: "var(--text-muted)" }}>
                      {event.description}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — Event highlight cards */}
        <div className="grid grid-cols-2 gap-4">
          {schedule.events.map((event) => (
            <div
              key={event.time}
              className="rounded-2xl border p-6 text-center"
              style={{
                background: "linear-gradient(145deg, var(--surface-gradient-from), var(--surface-gradient-to))",
                borderColor: "var(--border)",
              }}
            >
              <div className="mb-3 text-4xl">{eventEmojis[event.time] ?? "📌"}</div>
              <div
                className="mb-1 text-2xl font-extrabold"
                style={{ color: timeColors[event.color] }}
              >
                {event.time}
              </div>
              <div
                className="text-xs font-semibold leading-snug"
                style={{ color: "var(--text-muted)" }}
              >
                {event.title}
              </div>
            </div>
          ))}
        </div>
      </div>
    </SectionReveal>
  );
}
