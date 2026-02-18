import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Hub } from 'aws-amplify/utils';

/**
 * OAuth callback handler for sign-in
 * 
 * This component waits for Amplify to automatically process the OAuth callback.
 * Amplify handles the token exchange automatically - we just listen for completion.
 */
const SignInCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    // Listen for Amplify Hub authentication events
    const unsubscribe = Hub.listen('auth', ({ payload }) => {
      console.log('Auth Hub event:', payload.event);
      
      if (payload.event === 'signInWithRedirect') {
        console.log('Amplify is processing the OAuth callback...');
      } else if (payload.event === 'signInWithRedirect_failure') {
        console.error('Sign in failed');
        setHasError(true);
      } else if (payload.event === 'signedIn') {
        console.log('Sign in successful!');
        // Redirect to admin dashboard
        navigate('/admin', { replace: true });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [navigate]);

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md w-full text-center">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
            <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20 mb-4">
              <svg className="h-8 w-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Sign In Failed
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Unable to complete sign in. Please try again.
            </p>
            <button
              onClick={() => navigate('/admin/login', { replace: true })}
              className="w-full px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
            >
              Return to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state while processing callback
  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full text-center">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Signing you in...
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Please wait while we complete the authentication.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignInCallbackPage;
