import { useState } from "react";
import { Menu, X, LogOut } from "lucide-react";
import { eventConfig } from "@/config/event";
import { Link, useLocation } from "@/router";
import { useAuth } from "@/context/auth";
import { ThemeToggle } from "./theme-toggle";

export function Nav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { nav, name } = eventConfig;
  const { path: currentPath } = useLocation();
  const { isAdmin, logout } = useAuth();

  const visibleLinks = nav.links.filter(
    (link) => (link.href as string) !== "/admin" || isAdmin
  );

  return (
    <nav
      className="sticky top-0 z-50 border-b backdrop-blur-xl"
      style={{
        backgroundColor: "color-mix(in srgb, var(--base) 90%, transparent)",
        borderColor: "var(--border-subtle)",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-extrabold"
            style={{ background: "linear-gradient(135deg, #F59E0B, #F97316)", color: "#1A1A2E" }}
          >
            SS
          </div>
          <span className="text-[15px] font-bold" style={{ color: "var(--text-primary)" }}>
            {name}
          </span>
        </Link>

        <div className="hidden items-center gap-7 md:flex">
          {visibleLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="relative text-[13px] font-medium transition-colors hover:opacity-80"
              style={{
                color: currentPath === link.href ? "var(--accent-amber)" : "var(--text-muted)",
              }}
            >
              {link.label}
              {currentPath === link.href && (
                <span
                  className="absolute -bottom-[19px] left-0 right-0 h-[2px]"
                  style={{
                    background: "linear-gradient(90deg, transparent, var(--accent-amber), transparent)",
                  }}
                />
              )}
            </Link>
          ))}
          <ThemeToggle />
          <button
            onClick={logout}
            className="text-[13px] font-medium transition-opacity hover:opacity-70"
            style={{ color: "var(--text-muted)" }}
            title="Log out"
          >
            <LogOut className="h-4 w-4" />
          </button>
          <Link
            href={nav.cta.href}
            className="rounded-lg px-5 py-2 text-[13px] font-bold transition-colors hover:opacity-90"
            style={{ backgroundColor: "var(--accent-amber)", color: "#1A1A2E" }}
          >
            {nav.cta.label}
          </Link>
        </div>

        <div className="flex items-center gap-3 md:hidden">
          <ThemeToggle />
          <button onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu">
            {mobileOpen ? (
              <X className="h-5 w-5" style={{ color: "var(--text-primary)" }} />
            ) : (
              <Menu className="h-5 w-5" style={{ color: "var(--text-primary)" }} />
            )}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t px-6 pb-4 pt-2 md:hidden" style={{ borderColor: "var(--border-subtle)" }}>
          {visibleLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="block py-2.5 text-[14px] font-medium"
              style={{
                color: currentPath === link.href ? "var(--accent-amber)" : "var(--text-muted)",
              }}
            >
              {link.label}
            </Link>
          ))}
          <button
            onClick={() => { logout(); setMobileOpen(false); }}
            className="block w-full py-2.5 text-left text-[14px] font-medium"
            style={{ color: "var(--text-muted)" }}
          >
            Log out
          </button>
          <Link
            href={nav.cta.href}
            onClick={() => setMobileOpen(false)}
            className="mt-2 block rounded-lg px-5 py-3 text-center text-[14px] font-bold"
            style={{ backgroundColor: "var(--accent-amber)", color: "#1A1A2E" }}
          >
            {nav.cta.label}
          </Link>
        </div>
      )}
    </nav>
  );
}
