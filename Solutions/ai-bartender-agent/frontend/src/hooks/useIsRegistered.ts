import { useState, useEffect, useCallback } from 'react';

/**
 * Check if the current user has a valid (non-expired) access token.
 * This is a pure function that can be called outside of React components.
 */
export const isTokenValid = (): boolean => {
  const token = localStorage.getItem('access_token');
  const expiry = localStorage.getItem('token_expiry');

  if (!token) return false;

  // Check if token is expired
  if (expiry) {
    const expiryTime = parseInt(expiry, 10) * 1000; // Convert to milliseconds
    if (Date.now() > expiryTime) {
      return false;
    }
  }

  return true;
};

/**
 * Get the user key only if the token is valid (non-expired).
 * Returns null if there's no valid token.
 */
export const getValidUserKey = (): string | null => {
  if (!isTokenValid()) return null;
  return localStorage.getItem('user_key');
};

/**
 * Hook to check if the current user is registered (has valid access token)
 * @returns Object with isRegistered boolean and refresh function
 */
export const useIsRegistered = () => {
  const [isRegistered, setIsRegistered] = useState<boolean>(() => isTokenValid());

  const checkRegistration = useCallback(() => {
    setIsRegistered(isTokenValid());
  }, []);

  // Listen for storage changes (in case user registers in another tab)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'access_token' || e.key === 'token_expiry') {
        checkRegistration();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [checkRegistration]);

  return { isRegistered, refresh: checkRegistration };
};

export default useIsRegistered;
