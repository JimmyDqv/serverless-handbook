import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * OAuth callback handler for sign-out
 * 
 * This component handles the redirect from Cognito Hosted UI after logout.
 * Amplify's signOut() has already cleared tokens before redirecting here.
 * Redirects to home page after a brief moment.
 */
const SignOutPage: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    console.log('Sign-out complete, redirecting to home page');
    
    // Small delay to show the user feedback before redirect
    const timer = setTimeout(() => {
      navigate('/', { replace: true });
    }, 1500);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full text-center">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
          <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20 mb-4">
            <svg className="h-8 w-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Signed Out Successfully
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            You have been signed out of your account.
          </p>
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
            Redirecting to home page...
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignOutPage;
