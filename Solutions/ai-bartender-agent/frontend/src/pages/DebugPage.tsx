import { useState, useEffect } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { useAuth } from '../contexts/AuthContext';
import OrderCompletedCelebration from '../components/Orders/OrderCompletedCelebration';

// Celebration sound (same as in OrderCompletedCelebration)
const playCelebrationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

    const playNote = (frequency: number, startTime: number, duration: number, type: OscillatorType = 'sine') => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, startTime);

      // Envelope for a pleasant sound
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };

    const now = audioContext.currentTime;

    // "Da" - C note
    playNote(523.25, now, 0.15, 'triangle');
    // "Dum" - E note
    playNote(659.25, now + 0.15, 0.15, 'triangle');
    // "Ta!" - G note (higher, longer for emphasis)
    playNote(783.99, now + 0.3, 0.3, 'triangle');

    // Add a subtle harmony on the final note
    playNote(523.25, now + 0.3, 0.25, 'sine');

    return true;
  } catch (error) {
    console.error('Audio playback failed:', error);
    return false;
  }
};

interface TokenInfo {
  idToken: string | null;
  accessToken: string | null;
  idTokenPayload: Record<string, unknown> | null;
  accessTokenPayload: Record<string, unknown> | null;
  expiresAt: number | null;
}

interface ApiTestResult {
  status: number | null;
  statusText: string | null;
  headers: Record<string, string>;
  body: unknown;
  error: string | null;
  timestamp: string | null;
}

export default function DebugPage() {
  const { isAuthenticated } = useAuth();
  const [tokenInfo, setTokenInfo] = useState<TokenInfo>({
    idToken: null,
    accessToken: null,
    idTokenPayload: null,
    accessTokenPayload: null,
    expiresAt: null,
  });
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [decodeModalOpen, setDecodeModalOpen] = useState<'id' | 'access' | null>(null);

  // API Test state
  const [userApiResult, setUserApiResult] = useState<ApiTestResult | null>(null);
  const [adminApiResult, setAdminApiResult] = useState<ApiTestResult | null>(null);
  const [adminOrdersResult, setAdminOrdersResult] = useState<ApiTestResult | null>(null);
  const [isLoadingUserApi, setIsLoadingUserApi] = useState(false);
  const [isLoadingAdminApi, setIsLoadingAdminApi] = useState(false);
  const [isLoadingAdminOrders, setIsLoadingAdminOrders] = useState(false);

  // Sound & Celebration test state
  const [showCelebration, setShowCelebration] = useState(false);
  const [soundTestResult, setSoundTestResult] = useState<string | null>(null);

  const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT;
  const API_KEY = import.meta.env.VITE_API_KEY || '';

  // Load tokens on mount and when authentication changes
  useEffect(() => {
    if (isAuthenticated) {
      loadTokens();
    }
  }, [isAuthenticated]);

  const loadTokens = async () => {
    setIsLoadingTokens(true);
    try {
      const session = await fetchAuthSession({ forceRefresh: false });
      
      // Calculate expiration from ID token
      const idTokenPayload = session.tokens?.idToken?.payload;
      const expiresAt = idTokenPayload?.exp ? (idTokenPayload.exp as number) * 1000 : null;

      setTokenInfo({
        idToken: session.tokens?.idToken?.toString() || null,
        accessToken: session.tokens?.accessToken?.toString() || null,
        idTokenPayload: (session.tokens?.idToken?.payload as Record<string, unknown>) || null,
        accessTokenPayload: (session.tokens?.accessToken?.payload as Record<string, unknown>) || null,
        expiresAt,
      });
    } catch (error) {
      console.error('Error loading tokens:', error);
    } finally {
      setIsLoadingTokens(false);
    }
  };

  const handleRefreshTokens = async () => {
    setIsLoadingTokens(true);
    try {
      await fetchAuthSession({ forceRefresh: true });
      await loadTokens();
    } catch (error) {
      console.error('Error refreshing tokens:', error);
    } finally {
      setIsLoadingTokens(false);
    }
  };

  const copyToClipboard = async (text: string, tokenType: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedToken(tokenType);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const formatExpiration = (expiresAt: number | null) => {
    if (!expiresAt) return 'Unknown';
    
    const now = Date.now();
    const diff = expiresAt - now;
    
    if (diff <= 0) return 'Expired';
    
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    if (minutes > 60) {
      const hours = Math.floor(minutes / 60);
      return `${hours}h ${minutes % 60}m`;
    }
    
    return `${minutes}m ${seconds}s`;
  };

  // Decode JWT without external libraries
  const decodeJWT = (token: string): Record<string, unknown> | null => {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      
      // Decode base64url (JWT uses base64url encoding)
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error decoding JWT:', error);
      return null;
    }
  };

  // Test User API (public getDrinks)
  const testUserApi = async () => {
    setIsLoadingUserApi(true);
    setUserApiResult(null);
    
    try {
      const url = `${API_ENDPOINT}/drinks`;
      console.log('[Debug] User API Request:', { url, apiKey: API_KEY ? 'present' : 'missing' });
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-api-key': API_KEY,
        },
      });
      
      // Extract response headers
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        body = await response.text();
      }
      
      console.log('[Debug] User API Response:', { status: response.status, headers, body });
      
      setUserApiResult({
        status: response.status,
        statusText: response.statusText,
        headers,
        body,
        error: null,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[Debug] User API Error:', error);
      setUserApiResult({
        status: null,
        statusText: null,
        headers: {},
        body: null,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsLoadingUserApi(false);
    }
  };

  // Test Admin API (authenticated getDrinks)
  const testAdminApi = async () => {
    setIsLoadingAdminApi(true);
    setAdminApiResult(null);
    
    try {
      const session = await fetchAuthSession();
      const accessToken = session.tokens?.accessToken?.toString();
      
      const url = `${API_ENDPOINT}/admin/drinks`;
      console.log('[Debug] Admin API Request:', { 
        url, 
        apiKey: API_KEY ? 'present' : 'missing',
        accessToken: accessToken ? 'present' : 'missing'
      });
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-api-key': API_KEY,
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      
      // Extract response headers
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        body = await response.text();
      }
      
      console.log('[Debug] Admin API Response:', { status: response.status, headers, body });
      
      setAdminApiResult({
        status: response.status,
        statusText: response.statusText,
        headers,
        body,
        error: null,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[Debug] Admin API Error:', error);
      setAdminApiResult({
        status: null,
        statusText: null,
        headers: {},
        body: null,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsLoadingAdminApi(false);
    }
  };

  // Test Admin Orders API (authenticated getOrders)
  const testAdminOrders = async () => {
    setIsLoadingAdminOrders(true);
    setAdminOrdersResult(null);

    try {
      const session = await fetchAuthSession();
      const accessToken = session.tokens?.accessToken?.toString();

      const url = `${API_ENDPOINT}/admin/orders`;
      console.log('[Debug] Admin Orders API Request:', {
        url,
        apiKey: API_KEY ? 'present' : 'missing',
        accessToken: accessToken ? 'present' : 'missing'
      });

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-api-key': API_KEY,
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      // Extract response headers
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        body = await response.text();
      }

      console.log('[Debug] Admin Orders API Response:', { status: response.status, headers, body });

      setAdminOrdersResult({
        status: response.status,
        statusText: response.statusText,
        headers,
        body,
        error: null,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[Debug] Admin Orders API Error:', error);
      setAdminOrdersResult({
        status: null,
        statusText: null,
        headers: {},
        body: null,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsLoadingAdminOrders(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <p className="text-yellow-800">Please sign in to view debug information.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Debug Information</h1>
        <span className="px-3 py-1 rounded-md bg-yellow-100 text-yellow-800 text-sm font-medium">
          Development Mode Only
        </span>
      </div>

      {/* Security Warning */}
      <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-lg">
        <p className="text-sm text-red-800">
          ⚠️ <strong>Security Warning:</strong> Never share these tokens. They provide full access to your account.
        </p>
      </div>

      {/* JWT Tokens Grid */}
      <div className="grid gap-6 md:grid-cols-2 mb-6">
        {/* ID Token Card */}
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">ID Token</h2>
              <p className="text-xs text-gray-500 mt-1">Contains user identity and profile claims</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDecodeModalOpen('id')}
                disabled={!tokenInfo.idToken || isLoadingTokens}
                className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Decode
              </button>
              <button
                onClick={() => tokenInfo.idToken && copyToClipboard(tokenInfo.idToken, 'id')}
                disabled={!tokenInfo.idToken || isLoadingTokens}
                className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white hover:bg-green-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {copiedToken === 'id' ? '✓ Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {isLoadingTokens ? (
            <div className="animate-pulse space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          ) : tokenInfo.idToken ? (
            <div className="bg-gray-50 rounded p-3 border border-gray-300">
              <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap break-all">
                {tokenInfo.idToken}
              </pre>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Not available</p>
          )}
        </div>

        {/* Access Token Card */}
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Access Token</h2>
              <p className="text-xs text-gray-500 mt-1">Used for API authorization and scopes</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDecodeModalOpen('access')}
                disabled={!tokenInfo.accessToken || isLoadingTokens}
                className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Decode
              </button>
              <button
                onClick={() => tokenInfo.accessToken && copyToClipboard(tokenInfo.accessToken, 'access')}
                disabled={!tokenInfo.accessToken || isLoadingTokens}
                className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white hover:bg-green-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {copiedToken === 'access' ? '✓ Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {isLoadingTokens ? (
            <div className="animate-pulse space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          ) : tokenInfo.accessToken ? (
            <div className="bg-gray-50 rounded p-3 border border-gray-300">
              <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap break-all">
                {tokenInfo.accessToken}
              </pre>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Not available</p>
          )}
        </div>

        {/* Token Status Card */}
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200 md:col-span-2">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Token Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex flex-col border-b border-gray-200 pb-2">
                <dt className="text-xs font-medium text-gray-600">Time Until Expiration:</dt>
                <dd className="font-mono text-sm text-gray-900 mt-1">
                  {formatExpiration(tokenInfo.expiresAt)}
                </dd>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex flex-col border-b border-gray-200 pb-2">
                <dt className="text-xs font-medium text-gray-600">Expires At:</dt>
                <dd className="font-mono text-sm text-gray-900 mt-1">
                  {tokenInfo.expiresAt ? new Date(tokenInfo.expiresAt).toLocaleString() : 'Unknown'}
                </dd>
              </div>
            </div>
            <div className="flex items-end">
              <button
                onClick={handleRefreshTokens}
                disabled={isLoadingTokens}
                className="w-full px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoadingTokens ? 'Refreshing...' : 'Refresh Tokens'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sound & Celebration Testing Section */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-4 text-gray-900">Sound & Celebration Testing</h2>
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <p className="text-sm text-gray-600 mb-4">
            Test the celebration sound and visual effects. If you don't hear any sound, check your device volume
            and ensure the browser has permission to play audio.
          </p>

          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => {
                const success = playCelebrationSound();
                setSoundTestResult(success ? 'Sound played successfully!' : 'Sound playback failed - check console');
                setTimeout(() => setSoundTestResult(null), 3000);
              }}
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded transition-colors"
            >
              🔊 Test Sound Only
            </button>

            <button
              onClick={() => {
                setShowCelebration(true);
              }}
              className="px-4 py-2 text-sm font-medium bg-green-600 text-white hover:bg-green-700 rounded transition-colors"
            >
              🎉 Test Full Celebration (Sound + Confetti)
            </button>
          </div>

          {soundTestResult && (
            <div className={`mt-4 p-3 rounded ${
              soundTestResult.includes('successfully')
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}>
              {soundTestResult}
            </div>
          )}

          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> Browsers may block autoplay audio until the user interacts with the page.
              The celebration sound uses Web Audio API which typically works after any user interaction.
            </p>
          </div>
        </div>
      </div>

      {/* API Testing Section */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-4 text-gray-900">API Testing</h2>
        <div className="grid gap-6 md:grid-cols-2">
          {/* User API Test Card */}
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">User API - getDrinks</h3>
                <p className="text-xs text-gray-500 mt-1">Public endpoint: GET /drinks</p>
              </div>
              <button
                onClick={testUserApi}
                disabled={isLoadingUserApi}
                className="px-4 py-2 text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoadingUserApi ? 'Loading...' : 'Request'}
              </button>
            </div>

            {userApiResult && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    userApiResult.status && userApiResult.status >= 200 && userApiResult.status < 300
                      ? 'bg-green-100 text-green-800'
                      : userApiResult.error
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {userApiResult.error ? 'ERROR' : `${userApiResult.status} ${userApiResult.statusText}`}
                  </span>
                  <span className="text-xs text-gray-500">{userApiResult.timestamp}</span>
                </div>

                {userApiResult.error && (
                  <div className="bg-red-50 rounded p-3 border border-red-200">
                    <p className="text-sm text-red-800 font-medium">Error:</p>
                    <pre className="text-xs font-mono text-red-700 mt-1 whitespace-pre-wrap break-all">
                      {userApiResult.error}
                    </pre>
                  </div>
                )}

                <div className="bg-gray-50 rounded p-3 border border-gray-300">
                  <p className="text-sm text-gray-800 font-medium mb-2">Response Headers:</p>
                  <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap break-all">
                    {JSON.stringify(userApiResult.headers, null, 2)}
                  </pre>
                </div>

                <div className="bg-gray-50 rounded p-3 border border-gray-300">
                  <p className="text-sm text-gray-800 font-medium mb-2">Response Body:</p>
                  <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap break-all max-h-64 overflow-y-auto">
                    {JSON.stringify(userApiResult.body, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {!userApiResult && !isLoadingUserApi && (
              <p className="text-sm text-gray-500">Click "Request" to test the User API</p>
            )}

            {isLoadingUserApi && (
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="h-16 bg-gray-200 rounded"></div>
              </div>
            )}
          </div>

          {/* Admin API Test Card */}
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Admin API - getDrinks</h3>
                <p className="text-xs text-gray-500 mt-1">Authenticated endpoint: GET /admin/drinks</p>
              </div>
              <button
                onClick={testAdminApi}
                disabled={isLoadingAdminApi}
                className="px-4 py-2 text-sm font-medium bg-orange-600 text-white hover:bg-orange-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoadingAdminApi ? 'Loading...' : 'Request'}
              </button>
            </div>

            {adminApiResult && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    adminApiResult.status && adminApiResult.status >= 200 && adminApiResult.status < 300
                      ? 'bg-green-100 text-green-800'
                      : adminApiResult.error
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {adminApiResult.error ? 'ERROR' : `${adminApiResult.status} ${adminApiResult.statusText}`}
                  </span>
                  <span className="text-xs text-gray-500">{adminApiResult.timestamp}</span>
                </div>

                {adminApiResult.error && (
                  <div className="bg-red-50 rounded p-3 border border-red-200">
                    <p className="text-sm text-red-800 font-medium">Error:</p>
                    <pre className="text-xs font-mono text-red-700 mt-1 whitespace-pre-wrap break-all">
                      {adminApiResult.error}
                    </pre>
                  </div>
                )}

                <div className="bg-gray-50 rounded p-3 border border-gray-300">
                  <p className="text-sm text-gray-800 font-medium mb-2">Response Headers:</p>
                  <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap break-all">
                    {JSON.stringify(adminApiResult.headers, null, 2)}
                  </pre>
                </div>

                <div className="bg-gray-50 rounded p-3 border border-gray-300">
                  <p className="text-sm text-gray-800 font-medium mb-2">Response Body:</p>
                  <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap break-all max-h-64 overflow-y-auto">
                    {JSON.stringify(adminApiResult.body, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {!adminApiResult && !isLoadingAdminApi && (
              <p className="text-sm text-gray-500">Click "Request" to test the Admin API</p>
            )}

            {isLoadingAdminApi && (
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="h-16 bg-gray-200 rounded"></div>
              </div>
            )}
          </div>

          {/* Admin Orders API Test Card */}
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200 md:col-span-2">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Admin API - getOrders</h3>
                <p className="text-xs text-gray-500 mt-1">Authenticated endpoint: GET /admin/orders</p>
              </div>
              <button
                onClick={testAdminOrders}
                disabled={isLoadingAdminOrders}
                className="px-4 py-2 text-sm font-medium bg-teal-600 text-white hover:bg-teal-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoadingAdminOrders ? 'Loading...' : 'Request'}
              </button>
            </div>

            {adminOrdersResult && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    adminOrdersResult.status && adminOrdersResult.status >= 200 && adminOrdersResult.status < 300
                      ? 'bg-green-100 text-green-800'
                      : adminOrdersResult.error
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {adminOrdersResult.error ? 'ERROR' : `${adminOrdersResult.status} ${adminOrdersResult.statusText}`}
                  </span>
                  <span className="text-xs text-gray-500">{adminOrdersResult.timestamp}</span>
                </div>

                {adminOrdersResult.error && (
                  <div className="bg-red-50 rounded p-3 border border-red-200">
                    <p className="text-sm text-red-800 font-medium">Error:</p>
                    <pre className="text-xs font-mono text-red-700 mt-1 whitespace-pre-wrap break-all">
                      {adminOrdersResult.error}
                    </pre>
                  </div>
                )}

                <div className="bg-gray-50 rounded p-3 border border-gray-300">
                  <p className="text-sm text-gray-800 font-medium mb-2">Response Headers:</p>
                  <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap break-all">
                    {JSON.stringify(adminOrdersResult.headers, null, 2)}
                  </pre>
                </div>

                <div className="bg-gray-50 rounded p-3 border border-gray-300">
                  <p className="text-sm text-gray-800 font-medium mb-2">Response Body:</p>
                  <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap break-all max-h-64 overflow-y-auto">
                    {JSON.stringify(adminOrdersResult.body, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {!adminOrdersResult && !isLoadingAdminOrders && (
              <p className="text-sm text-gray-500">Click "Request" to test the Admin Orders API</p>
            )}

            {isLoadingAdminOrders && (
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="h-16 bg-gray-200 rounded"></div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Order Completed Celebration */}
      <OrderCompletedCelebration
        isVisible={showCelebration}
        onComplete={() => setShowCelebration(false)}
      />

      {/* Decode Modal */}
      {decodeModalOpen && (
        <div 
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" 
          onClick={() => setDecodeModalOpen(null)}
        >
          <div 
            className="bg-white rounded-lg max-w-3xl w-full max-h-[80vh] overflow-hidden shadow-2xl" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-white">
              <h3 className="text-xl font-semibold text-gray-900">
                Decoded {decodeModalOpen === 'id' ? 'ID' : 'Access'} Token
              </h3>
              <button
                onClick={() => setDecodeModalOpen(null)}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)] bg-white">
              <pre className="text-sm font-mono text-gray-900 whitespace-pre-wrap break-words bg-gray-50 p-4 rounded border border-gray-300">
                {JSON.stringify(
                  decodeModalOpen === 'id' 
                    ? (tokenInfo.idTokenPayload || decodeJWT(tokenInfo.idToken || ''))
                    : (tokenInfo.accessTokenPayload || decodeJWT(tokenInfo.accessToken || '')),
                  null,
                  2
                )}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
