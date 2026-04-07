import { eventConfig } from "@/config/event";
import { SectionReveal } from "./section-reveal";

const tagBg: Record<"amber" | "blue", string> = {
  amber: "var(--accent-amber-subtle)",
  blue: "var(--accent-blue-subtle)",
};
const tagColor: Record<"amber" | "blue", string> = {
  amber: "var(--accent-amber)",
  blue: "var(--accent-blue)",
};
const statBorder: Record<"amber" | "blue", string> = {
  amber: "rgba(245, 158, 11, 0.12)",
  blue: "rgba(59, 130, 246, 0.12)",
};

export function Keynote() {
  const { keynote } = eventConfig;

  return (
    <SectionReveal className="mx-auto max-w-5xl px-6 py-20">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[3px]" style={{ color: "var(--accent-amber)" }}>
        {keynote.sectionLabel}
      </div>
      <h2 className="mb-1.5 text-[28px] font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>
        {keynote.title}
      </h2>
      <p className="mb-8 text-sm" style={{ color: "var(--text-muted)" }}>
        {keynote.description}
      </p>

      <div className="grid items-center gap-7 md:grid-cols-[1fr_1.2fr]">
        <div
          className="relative overflow-hidden rounded-2xl border p-8 text-center"
          style={{ background: "linear-gradient(145deg, var(--surface-gradient-from), var(--surface-gradient-to))", borderColor: "var(--border)" }}
        >
          <div className="pointer-events-none absolute -top-8 left-1/2 h-28 w-48 -translate-x-1/2" style={{ background: "radial-gradient(ellipse, rgba(245,158,11,0.12) 0%, transparent 70%)" }} />
          <div className="relative z-10">
            <div className="mb-4 text-6xl">{keynote.emoji}</div>
            <div className="mb-1 text-[22px] font-extrabold" style={{ color: "var(--text-primary)" }}>QUIZEN</div>
            <div className="mb-2 text-[13px] uppercase tracking-[2px]" style={{ color: "var(--accent-amber)" }}>
              {keynote.stage} · {keynote.time}
            </div>
            <div className="mb-4 text-[13px]" style={{ color: "var(--text-muted)" }}>
              Ledd av <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{keynote.speaker}</span>
            </div>
            <div className="flex justify-center gap-2">
              {keynote.tags.map((tag) => (
                <span key={tag.label} className="rounded-full px-3.5 py-1.5 text-[11px] font-semibold" style={{ backgroundColor: tagBg[tag.color], color: tagColor[tag.color] }}>
                  {tag.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div>
          <h3 className="mb-1.5 text-[15px] font-bold" style={{ color: "var(--text-primary)" }}>Så fungerar det</h3>
          <p className="mb-5 text-sm leading-relaxed" style={{ color: "var(--text-body)" }}>
            {keynote.howItWorks}
          </p>
          <div className="flex gap-4">
            {keynote.stats.map((stat) => (
              <div key={stat.label} className="flex-1 rounded-xl border p-4 text-center" style={{ backgroundColor: tagBg[stat.color], borderColor: statBorder[stat.color] }}>
                <div className="text-[28px] font-extrabold" style={{ color: tagColor[stat.color] }}>{stat.value}</div>
                <div className="text-[11px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SectionReveal>
  );
}
