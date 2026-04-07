import { useState } from "react";
import { useAuth } from "@/context/auth";
import { eventConfig } from "@/config/event";

export default function Login() {
  const { login, error } = useAuth();
  const [token, setToken] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim() || !lastName.trim()) return;
    setLoading(true);
    try {
      await login(token.trim(), lastName.trim());
    } catch {
      // error is set in auth context
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center p-6"
      style={{ backgroundColor: "var(--base)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-extrabold"
            style={{ background: "linear-gradient(135deg, #F59E0B, #F97316)", color: "#1A1A2E" }}
          >
            SS
          </div>
          <h1 className="text-2xl font-extrabold" style={{ color: "var(--text-primary)" }}>
            {eventConfig.name}
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            Log in with your invitation code
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border p-7"
          style={{
            background: "linear-gradient(145deg, var(--surface-gradient-from), var(--surface-gradient-to))",
            borderColor: "var(--border)",
          }}
        >
          <div>
            <label
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-muted)" }}
            >
              Invitation Code
            </label>
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Your code"
              required
              className="w-full rounded-xl border px-4 py-3 text-sm focus:outline-none"
              style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
          </div>

          <div>
            <label
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-muted)" }}
            >
              Last Name
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Your last name"
              required
              className="w-full rounded-xl border px-4 py-3 text-sm focus:outline-none"
              style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
          </div>

          {error && (
            <div
              className="rounded-lg px-4 py-2.5 text-[13px] font-medium"
              style={{ backgroundColor: "rgba(239, 68, 68, 0.1)", color: "#f87171" }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl py-3.5 text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "var(--accent-amber)", color: "#1A1A2E" }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Logging in...
              </span>
            ) : "LOG IN"}
          </button>
        </form>
      </div>
    </div>
  );
}
