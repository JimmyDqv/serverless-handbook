import { useState } from "react";
import { eventConfig } from "@/config/event";
import { SectionReveal } from "./section-reveal";

function GalleryCard({ item, index }: { item: (typeof eventConfig.gallery.items)[number]; index: number }) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div
      className="aspect-[3/4] cursor-pointer"
      style={{ perspective: "800px" }}
      onClick={() => setFlipped(!flipped)}
    >
      <div
        className="relative h-full w-full transition-transform duration-500"
        style={{
          transformStyle: "preserve-3d",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        <div
          className="absolute inset-0 flex flex-col overflow-hidden rounded-[14px] border transition-shadow hover:shadow-lg"
          style={{
            background: "linear-gradient(145deg, var(--surface-gradient-from), var(--surface-gradient-to))",
            borderColor: "var(--border)",
            backfaceVisibility: "hidden",
          }}
        >
          <div
            className="flex flex-1 items-center justify-center text-[56px]"
            style={{
              background: index % 2 === 0
                ? "linear-gradient(135deg, var(--accent-amber-subtle), var(--accent-blue-subtle))"
                : "linear-gradient(135deg, var(--accent-blue-subtle), var(--accent-amber-subtle))",
            }}
          >
            {item.emoji}
          </div>
          <div className="p-4">
            <div className="mb-1 text-[15px] font-bold" style={{ color: "var(--text-primary)" }}>{item.title}</div>
            <div className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{item.description}</div>
          </div>
          <div className="px-4 pb-3">
            <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-faded)" }}>Click for image</div>
          </div>
        </div>

        <div
          className="absolute inset-0 overflow-hidden rounded-[14px] border"
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            borderColor: "var(--border)",
          }}
        >
          <img
            src={item.image}
            alt={item.title}
            className="h-full w-full object-cover"
          />
          <div
            className="absolute inset-x-0 bottom-0 p-4"
            style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.7))" }}
          >
            <div className="text-[15px] font-bold text-white">{item.title}</div>
            <div className="text-[10px] uppercase tracking-wider text-white/60">Click to go back</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function GalleryGrid() {
  const { gallery } = eventConfig;

  return (
    <SectionReveal className="mx-auto max-w-5xl px-6 py-20">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[3px]" style={{ color: "var(--accent-amber)" }}>
        {gallery.sectionLabel}
      </div>
      <h2 className="mb-1.5 text-[28px] font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>
        {gallery.title}
      </h2>
      <p className="mb-8 text-sm" style={{ color: "var(--text-muted)" }}>
        {gallery.description}
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {gallery.items.map((item, i) => (
          <GalleryCard key={item.title} item={item} index={i} />
        ))}
      </div>
    </SectionReveal>
  );
}
