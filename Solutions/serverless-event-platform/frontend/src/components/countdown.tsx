import { useEffect, useState } from "react";
import NumberFlow from "@number-flow/react";

interface CountdownProps {
  targetDate: string;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
}

function calculateTimeLeft(targetDate: string): TimeLeft {
  const diff = new Date(targetDate).getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0 };
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
  };
}

export function Countdown({ targetDate }: CountdownProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() =>
    calculateTimeLeft(targetDate)
  );

  useEffect(() => {
    const timer = setInterval(
      () => setTimeLeft(calculateTimeLeft(targetDate)),
      60_000
    );
    return () => clearInterval(timer);
  }, [targetDate]);

  const units = [
    { value: timeLeft.days, label: "Days" },
    { value: timeLeft.hours, label: "Hrs" },
    { value: timeLeft.minutes, label: "Min" },
  ];

  return (
    <div
      className="rounded-xl border px-4 py-3"
      style={{
        backgroundColor: "var(--accent-blue-subtle)",
        borderColor: "rgba(59, 130, 246, 0.15)",
      }}
    >
      <div
        className="mb-2 text-center text-[9px] font-semibold uppercase tracking-[1.5px]"
        style={{ color: "var(--text-muted)" }}
      >
        Event starts in
      </div>
      <div className="flex items-center justify-center gap-3">
        {units.map((unit, i) => (
          <div key={unit.label} className="flex items-center gap-3">
            <div className="text-center">
              <NumberFlow
                value={unit.value}
                className="text-xl font-bold"
                style={{ color: "var(--text-primary)" }}
                format={{ minimumIntegerDigits: 2 }}
              />
              <div
                className="mt-1 text-[8px] uppercase tracking-wider"
                style={{ color: "var(--text-muted)" }}
              >
                {unit.label}
              </div>
            </div>
            {i < units.length - 1 && (
              <span
                className="text-base font-light"
                style={{ color: "var(--accent-blue)" }}
              >
                :
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
