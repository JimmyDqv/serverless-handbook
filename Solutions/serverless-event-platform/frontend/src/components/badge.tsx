import { motion } from "framer-motion";
import { eventConfig } from "@/config/event";
import { useAuth } from "@/context/auth";
import { Countdown } from "./countdown";

export function Badge() {
  const { date, displayDate, location } = eventConfig;
  const { user } = useAuth();
  const name = user ? `${user.firstName} ${user.lastName}` : "Guest";

  return (
    <motion.div
      className="relative mx-auto max-w-[280px] md:ml-auto md:mr-0"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", bounce: 0.3, duration: 0.8, delay: 0.3 }}
    >
      {/* Pulsing glow behind badge */}
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[400px] w-[320px] -translate-x-1/2 -translate-y-1/2"
        style={{
          background: "radial-gradient(ellipse, var(--glow-amber) 0%, transparent 55%)",
        }}
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Floating wrapper */}
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Lanyard clip */}
        <div className="flex flex-col items-center">
          <div className="h-5 w-0.5" style={{ backgroundColor: "rgba(245, 158, 11, 0.3)" }} />
          <div className="h-5 w-10 rounded-b-full" style={{ backgroundColor: "var(--accent-amber-subtle)" }} />
        </div>

        {/* Badge card */}
        <div
          className="rounded-2xl border p-7 text-center"
          style={{
            background: "linear-gradient(145deg, var(--surface-gradient-from), var(--surface-gradient-to))",
            borderColor: "var(--border)",
          }}
        >
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full text-3xl"
            style={{ background: "linear-gradient(135deg, #F59E0B, #F97316)" }}
          >
            👨‍💼
          </div>

          <div className="mb-4 text-lg font-bold" style={{ color: "var(--text-primary)" }}>
            {name}
          </div>

          <div className="mb-4 h-px" style={{ backgroundColor: "var(--border)" }} />

          <div className="mb-4 flex items-center justify-center gap-5 text-xs" style={{ color: "var(--text-muted)" }}>
            <span className="flex items-center gap-1.5">
              <span style={{ color: "var(--accent-amber)" }}>●</span>
              {displayDate.split(" ").slice(0, 2).join(" ")}
            </span>
            <span className="flex items-center gap-1.5">
              <span style={{ color: "var(--accent-amber)" }}>●</span>
              {location.city}
            </span>
          </div>

          <div className="mb-4">
            <Countdown targetDate={date} />
          </div>

          <div className="text-[10px] font-medium uppercase tracking-[1.5px]" style={{ color: "var(--text-muted)" }}>
            Attendee #{String(Math.floor(Math.random() * 50) + 1).padStart(4, "0")}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
