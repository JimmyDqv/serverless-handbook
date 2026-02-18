import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getCurrentUser, fetchAuthSession, signOut as amplifySignOut, AuthUser } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';
import toast from 'react-hot-toast';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

interface UserProfile {
  userId: string;
  email: string;
  emailVerified: boolean;
  name?: string;
}

interface AuthContextType {
  status: AuthStatus;
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: Error | null;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Load current authenticated user and token claims
   */
  const loadUser = async () => {
    try {
      setStatus('loading');
      setError(null);

      const currentUser = await getCurrentUser();
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken;
      const payload = idToken?.payload as Record<string, unknown> | undefined;

      const userProfile: UserProfile = {
        userId: currentUser.userId,
        email: (payload?.email as string) || '',
        emailVerified: (payload?.email_verified as boolean) || false,
        name: payload?.name as string | undefined,
      };

      setUser(userProfile);
      setStatus('authenticated');
    } catch (err) {
      // This is expected when user is not authenticated - don't treat as error
      console.log('No authenticated user found');
      setUser(null);
      setStatus('unauthenticated');
      // Only set error for unexpected errors, not for "no user" scenario
      if (err instanceof Error && !err.message.includes('not authenticated')) {
        setError(err);
      }
    }
  };

  /**
   * Sign out the current user using Amplify's signOut
   * This will redirect to Cognito Hosted UI logout and then to the signout callback
   */
  const signOut = async () => {
    try {
      // Amplify will redirect to Cognito logout, which will redirect back to our signout URL
      await amplifySignOut();
    } catch (err) {
      console.error('Error signing out:', err);
      setError(err instanceof Error ? err : new Error('Failed to sign out'));
      toast.error('Failed to sign out');
      throw err;
    }
  };

  /**
   * Refresh user profile data
   */
  const refreshUser = async () => {
    try {
      await loadUser();
    } catch (err) {
      console.error('Error refreshing user:', err);
      setError(err instanceof Error ? err : new Error('Failed to refresh user'));
    }
  };

  /**
   * Get access token for API calls
   */
  const getAccessToken = async (): Promise<string | null> => {
    try {
      const session = await fetchAuthSession();
      return session.tokens?.accessToken?.toString() ?? null;
    } catch (error) {
      console.error('Error getting access token:', error);
      return null;
    }
  };

  // Load user on mount
  useEffect(() => {
    loadUser();
  }, []);

  // Listen to auth events from Amplify Hub
  useEffect(() => {
    const unsubscribe = Hub.listen('auth', ({ payload }) => {
      switch (payload.event) {
        case 'signedIn':
          console.log('User signed in');
          loadUser();
          break;
        case 'signedOut':
          console.log('User signed out');
          // Don't update state immediately - this can cancel the OAuth redirect
          // State will be updated when we land on the signout callback page
          break;
        case 'tokenRefresh':
          console.log('Auth tokens refreshed');
          refreshUser();
          break;
        case 'tokenRefresh_failure':
          console.error('Token refresh failed');
          setStatus('unauthenticated');
          setUser(null);
          break;
        case 'signInWithRedirect':
          console.log('Sign in with redirect initiated');
          break;
        case 'signInWithRedirect_failure':
          console.error('Sign in with redirect failed:', payload.data);
          setError(new Error('Sign in failed'));
          setStatus('error');
          toast.error('Sign in failed. Please try again.');
          break;
        case 'customOAuthState':
          console.log('Custom OAuth state:', payload.data);
          break;
      }
    });

    return () => unsubscribe();
  }, []);

  const value: AuthContextType = {
    status,
    user,
    isLoading: status === 'loading',
    isAuthenticated: status === 'authenticated',
    error,
    signOut,
    refreshUser,
    getAccessToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};