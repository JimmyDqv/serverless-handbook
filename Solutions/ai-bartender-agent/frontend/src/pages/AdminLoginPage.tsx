import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithRedirect } from 'aws-amplify/auth';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/UI';

/**
 * Admin login page that redirects to Cognito Hosted UI
 * 
 * If user is already authenticated, automatically redirects to admin dashboard.
 */
const AdminLoginPage: React.FC = () => {
  const [isRedirecting, setIsRedirecting] = useState(false);
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  // Redirect to admin if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      console.log('User is authenticated, redirecting to admin');
      navigate('/admin', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  const handleSignIn = async () => {
    if (isRedirecting) return;
    
    try {
      setIsRedirecting(true);
      console.log('Initiating sign in redirect...');
      await signInWithRedirect();
      // If we reach here without redirect, something went wrong
      console.error('signInWithRedirect did not redirect');
    } catch (error) {
      console.error('Failed to initiate sign-in:', error);
      setIsRedirecting(false);
      
      const errorMessage = error instanceof Error 
        ? `Failed to redirect to login: ${error.message}` 
        : 'Failed to redirect to login. Please try again.';
      alert(errorMessage);
    }
  };

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Checking authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900 mb-6">
            <svg className="h-8 w-8 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-h2 text-gray-900 dark:text-gray-100">
            Sign In
          </h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Sign in to access the admin dashboard
          </p>
        </div>

        <div className="mt-8 space-y-6">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              You will be redirected to a secure sign-in page
            </p>
            <Button
              onClick={handleSignIn}
              isLoading={isRedirecting}
              className="w-full"
              size="lg"
            >
              {isRedirecting ? 'Redirecting...' : 'Sign In'}
            </Button>
          </div>

          <p className="text-center text-xs text-gray-500 dark:text-gray-400">
            Secured with AWS Cognito
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminLoginPage;