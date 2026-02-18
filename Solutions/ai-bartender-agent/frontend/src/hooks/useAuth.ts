import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_ENDPOINT;
const API_KEY = import.meta.env.VITE_API_KEY || '';

interface AuthState {
  isAuthenticated: boolean;
  username: string | null;
  userKey: string | null;
  accessToken: string | null;
  tokenExpiry: number | null; // Unix timestamp
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    username: null,
    userKey: null,
    accessToken: null,
    tokenExpiry: null,
  });
  const navigate = useNavigate();

  // Load auth state from localStorage on mount
  useEffect(() => {
    const accessToken = localStorage.getItem('access_token');
    const username = localStorage.getItem('username');
    const userKey = localStorage.getItem('user_key');
    const tokenExpiry = localStorage.getItem('token_expiry');

    if (accessToken && username && userKey && tokenExpiry) {
      setAuthState({
        isAuthenticated: true,
        username,
        userKey,
        accessToken,
        tokenExpiry: parseInt(tokenExpiry),
      });
    }
  }, []);

  const isTokenExpiringSoon = useCallback(() => {
    if (!authState.tokenExpiry) return true;

    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = authState.tokenExpiry - now;

    // Refresh if less than 5 minutes remaining
    return timeUntilExpiry < 300;
  }, [authState.tokenExpiry]);

  const refreshAccessToken = async (): Promise<boolean> => {
    const refreshToken = localStorage.getItem('refresh_token');

    if (!refreshToken) {
      logout();
      return false;
    }

    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();
      const newToken = data.data.access_token;

      // Decode JWT to get expiry (simple base64 decode of payload)
      const payload = JSON.parse(atob(newToken.split('.')[1]));
      const expiry = payload.exp;

      // Update tokens
      localStorage.setItem('access_token', newToken);
      localStorage.setItem('token_expiry', expiry.toString());

      setAuthState((prev) => ({
        ...prev,
        accessToken: newToken,
        tokenExpiry: expiry,
      }));

      return true;
    } catch (error) {
      console.error('Token refresh error:', error);
      logout();
      return false;
    }
  };

  const logout = useCallback(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('username');
    localStorage.removeItem('user_key');
    localStorage.removeItem('token_expiry');

    setAuthState({
      isAuthenticated: false,
      username: null,
      userKey: null,
      accessToken: null,
      tokenExpiry: null,
    });

    navigate('/register');
  }, [navigate]);

  const ensureValidToken = useCallback(async (): Promise<boolean> => {
    if (isTokenExpiringSoon()) {
      return await refreshAccessToken();
    }
    return true;
  }, [isTokenExpiringSoon, refreshAccessToken]);

  return {
    ...authState,
    isTokenExpiringSoon,
    refreshAccessToken,
    logout,
    ensureValidToken,
  };
};
