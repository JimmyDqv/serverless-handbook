import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { api } from "@/config/api";

interface User {
  sub: string;
  firstName: string;
  lastName: string;
  isAdmin: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (token: string, lastName: string) => Promise<void>;
  logout: () => void;
  error: string | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isAdmin: false,
  login: async () => {},
  logout: () => {},
  error: null,
});

export function useAuth() {
  return useContext(AuthContext);
}

function decodePayload(jwt: string): User | null {
  try {
    const payload = JSON.parse(atob(jwt.split(".")[1]));
    // Expiry check disabled - tokens valid until after the party
    return {
      sub: payload.sub,
      firstName: payload.firstName,
      lastName: payload.lastName,
      isAdmin: payload.isAdmin === true,
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("event-auth-token");
    if (stored) {
      const decoded = decodePayload(stored);
      if (decoded) {
        setUser(decoded);
      } else {
        localStorage.removeItem("event-auth-token");
      }
    }
  }, []);

  const login = useCallback(async (token: string, lastName: string) => {
    setError(null);
    try {
      const res = await api.post<{ token: string }>("/auth/login", { token, lastName });
      localStorage.setItem("event-auth-token", res.token);
      const decoded = decodePayload(res.token);
      if (!decoded) throw new Error("Invalid token received");
      setUser(decoded);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("event-auth-token");
    setUser(null);
    setError(null);
    api.post("/auth/logout").catch(() => {});
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: user !== null,
        isAdmin: user?.isAdmin === true,
        login,
        logout,
        error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
