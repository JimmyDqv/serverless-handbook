import { Moon, Sun } from "lucide-react";
import { useTheme } from "./theme-provider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="relative flex h-9 w-9 items-center justify-center rounded-lg border transition-colors"
      style={{
        borderColor: "var(--border)",
      }}
      aria-label={theme === "dark" ? "Byt till ljust tema" : "Byt till mörkt tema"}
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4" style={{ color: "var(--accent-amber)" }} />
      ) : (
        <Moon className="h-4 w-4" style={{ color: "var(--accent-amber)" }} />
      )}
    </button>
  );
}
