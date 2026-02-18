import { Amplify } from 'aws-amplify';

// Environment variables with validation
const requiredEnvVars = {
  userPoolId: import.meta.env.VITE_USER_POOL_ID,
  userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID,
  domain: import.meta.env.VITE_COGNITO_DOMAIN,
  redirectSignIn: import.meta.env.VITE_COGNITO_REDIRECT_SIGNIN,
  redirectSignOut: import.meta.env.VITE_COGNITO_REDIRECT_SIGNOUT,
} as const;

// API configuration
const apiConfig = {
  endpoint: import.meta.env.VITE_API_ENDPOINT,
  region: import.meta.env.VITE_AWS_REGION || 'eu-west-1',
} as const;

// Validate that all required environment variables are present
const missingVars = Object.entries(requiredEnvVars)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  console.warn(
    `Missing required environment variables: ${missingVars.join(', ')}\n` +
      'Please check your .env file and ensure all VITE_* variables are set.\n' +
      'See .env.example for required variables.'
  );
}

// OAuth scopes
const scopes = ['phone', 'email', 'openid', 'profile'];

/**
 * Configure AWS Amplify for Cognito authentication with Hosted UI
 * 
 * This configuration enables:
 * - Authentication via Amazon Cognito User Pool
 * - OAuth2 with PKCE flow for secure authentication
 * - Hosted UI for login/signup/password management
 * - Automatic token refresh
 * - Secure token storage
 * - REST API with API key authentication
 */
export const configureAmplify = () => {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: requiredEnvVars.userPoolId || '',
        userPoolClientId: requiredEnvVars.userPoolClientId || '',
        loginWith: {
          oauth: {
            domain: requiredEnvVars.domain?.replace(/^https?:\/\//, '') || '', // Remove protocol if present
            scopes,
            redirectSignIn: [requiredEnvVars.redirectSignIn || 'http://localhost:5173/signin'],
            redirectSignOut: [requiredEnvVars.redirectSignOut || 'http://localhost:5173/signout'],
            responseType: 'code' as const,
          },
        },
      },
    },
    API: {
      REST: {
        AiBartender: {
          endpoint: apiConfig.endpoint,
          region: apiConfig.region,
        }
      }
    }
  });
};

/**
 * Get the Amplify configuration for debugging or display purposes
 */
export const getAmplifyConfig = () => ({
  userPoolId: requiredEnvVars.userPoolId,
  userPoolClientId: requiredEnvVars.userPoolClientId,
  domain: requiredEnvVars.domain,
  oauth: {
    scopes,
    redirectSignIn: requiredEnvVars.redirectSignIn,
    redirectSignOut: requiredEnvVars.redirectSignOut,
    responseType: 'code',
  },
  api: apiConfig,
});
