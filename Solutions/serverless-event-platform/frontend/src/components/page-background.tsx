interface PageBackgroundProps {
  glow?: "amber" | "blue" | "mixed";
}

export function PageBackground({ glow = "amber" }: PageBackgroundProps) {
  const glowStyle = {
    amber: "radial-gradient(ellipse 70% 60% at 30% 40%, var(--glow-amber) 0%, transparent 65%)",
    blue: "radial-gradient(ellipse 60% 60% at 35% 45%, var(--glow-blue) 0%, var(--glow-amber-faint) 40%, transparent 70%)",
    mixed:
      "radial-gradient(ellipse 50% 50% at 25% 40%, var(--glow-amber) 0%, transparent 60%), radial-gradient(ellipse 50% 50% at 75% 60%, var(--glow-blue) 0%, transparent 60%)",
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
      {/* Radial glow */}
      <div className="absolute inset-0" style={{ background: glowStyle[glow] }} />
    </div>
  );
}
