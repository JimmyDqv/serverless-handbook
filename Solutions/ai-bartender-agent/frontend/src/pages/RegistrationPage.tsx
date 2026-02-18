import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Input, LoadingButton, Card } from '../components/UI';
import { PageTransition } from '../components/Animations';
import { useToast } from '../contexts/ToastContext';
import { registerUser } from '../services/authApi';

const RegistrationPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [code, setCode] = useState('');
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'code' | 'username'>('code');
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();

  // Extract registration code from URL if present (from QR scan)
  useEffect(() => {
    const urlCode = searchParams.get('code');
    if (urlCode) {
      setCode(urlCode);
      setStep('username'); // Skip to username step if code is in URL
    }
  }, [searchParams]);

  useEffect(() => {
    // Check if user is already registered with a valid (non-expired) token
    const existingToken = localStorage.getItem('access_token');
    const expiry = localStorage.getItem('token_expiry');

    if (existingToken && expiry) {
      const expiryTime = parseInt(expiry, 10) * 1000; // Convert to milliseconds
      if (Date.now() < expiryTime) {
        // Token exists and is not expired - redirect to home
        navigate('/', { replace: true });
      } else {
        // Token is expired - clear it so user can re-register
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('token_expiry');
        localStorage.removeItem('user_key');
        localStorage.removeItem('username');
      }
    } else if (existingToken && !expiry) {
      // Token exists but no expiry - assume it's valid (legacy case)
      navigate('/', { replace: true });
    }
  }, [navigate]);

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim()) {
      setStep('username');
      setError(null);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!code.trim()) {
      setError('Registration code required');
      setIsLoading(false);
      return;
    }

    try {
      // Call registration API
      const data = await registerUser(username.trim(), code.trim());

      // Decode JWT to get expiry
      const payload = JSON.parse(atob(data.data.access_token.split('.')[1]));

      // Store tokens, user info, and expiry
      localStorage.setItem('access_token', data.data.access_token);
      localStorage.setItem('refresh_token', data.data.refresh_token);
      localStorage.setItem('user_key', data.data.user_key);
      localStorage.setItem('username', data.data.username);
      localStorage.setItem('token_expiry', payload.exp.toString());

      showSuccess('Welcome! You are now registered.');

      // Navigate to home
      navigate('/', { replace: true });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToCode = () => {
    setStep('code');
    setError(null);
  };

  return (
    <PageTransition>
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <Card className="p-8 max-w-md w-full">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full mb-4">
              <svg
                className="w-8 h-8 text-blue-600 dark:text-blue-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Register
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {step === 'code'
                ? 'Enter the registration code to get started'
                : '3-100 characters'
              }
            </p>
          </div>

          {step === 'code' ? (
            <form onSubmit={handleCodeSubmit} className="space-y-6">
              <Input
                label="Registration code"
                id="code"
                name="code"
                type="text"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setError(null);
                }}
                placeholder="Enter your code"
                required
                error={error || undefined}
                disabled={isLoading}
                autoFocus
                helperText="Scan the QR code or enter the code manually"
              />

              <LoadingButton
                type="submit"
                isLoading={false}
                className="w-full"
                disabled={!code.trim()}
              >
                Continue
              </LoadingButton>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-6">
              {/* Show entered code with option to change */}
              <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Registration code
                  </p>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {code}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleBackToCode}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Change
                </button>
              </div>

              <Input
                label="Username"
                id="username"
                name="username"
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError(null);
                }}
                placeholder="Your username"
                required
                minLength={3}
                maxLength={100}
                error={error || undefined}
                disabled={isLoading}
                autoFocus
                helperText="3-100 characters. Letters, numbers, spaces, hyphens, and underscores allowed."
              />

              <LoadingButton
                type="submit"
                isLoading={isLoading}
                loadingText="Registering..."
                className="w-full"
                disabled={!username.trim() || username.trim().length < 3}
              >
                Register
              </LoadingButton>
            </form>
          )}

          <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
            <p>
              By registering you agree to our terms and privacy policy.
            </p>
          </div>

          <div className="mt-4 text-center">
            <button
              onClick={() => navigate('/')}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Back to home
            </button>
          </div>
        </Card>
      </div>
    </PageTransition>
  );
};

export default RegistrationPage;
