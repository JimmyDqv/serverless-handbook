import React, { Suspense, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { AccessibilityProvider } from './contexts/AccessibilityContext';
import { ToastProvider } from './contexts/ToastContext';
import RouteAwareLayout from './components/Layout/RouteAwareLayout';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import SkipLinks from './components/Accessibility/SkipLinks';
import LoadingSpinner from './components/UI/LoadingSpinner';
import OfflineIndicator from './components/UI/OfflineIndicator';
import PerformanceMonitor from './components/Performance/PerformanceMonitor';
import ErrorBoundary from './components/ErrorBoundary';
import { UpdatePrompt } from './components/PWA';
import { useNetworkError } from './hooks/useNetworkError';
import { configureAmplify } from './config/amplify';
import { AdminNotificationProvider } from './contexts/AdminNotificationContext';
import { UserNotificationProvider } from './contexts/UserNotificationContext';
import { initAudioOnInteraction } from './utils/sounds';

// Lazy load pages for code splitting
const HomePage = React.lazy(() => import('./pages/HomePage'));
const OrderStatusPage = React.lazy(() => import('./pages/OrderStatusPage'));
const RegistrationPage = React.lazy(() => import('./pages/RegistrationPage'));
const AdminLoginPage = React.lazy(() => import('./pages/AdminLoginPage'));
const AdminDashboardPage = React.lazy(() => import('./pages/AdminDashboardPage'));
const AdminDrinksPage = React.lazy(() => import('./pages/AdminDrinksPage'));
const AdminSectionsPage = React.lazy(() => import('./pages/AdminSectionsPage'));
const AdminRegistrationCodesPage = React.lazy(() => import('./pages/AdminRegistrationCodesPage'));
const SignInCallbackPage = React.lazy(() => import('./pages/SignInCallbackPage'));
const SignOutPage = React.lazy(() => import('./pages/SignOutPage'));
const DebugPage = React.lazy(() => import('./pages/DebugPage'));
const MyOrdersPage = React.lazy(() => import('./pages/MyOrdersPage'));
const AdminBartenderChatPage = React.lazy(() => import('./pages/AdminBartenderChatPage'));

// Inner App component that uses the network error hook
const AppContent: React.FC = () => {
  const { retry } = useNetworkError();

  return (
    <>
      <PerformanceMonitor />
      <OfflineIndicator showWhenOnline onRetry={retry} />
      <Router>
        <UserNotificationProvider>
          <AdminNotificationProvider>
            <SkipLinks />
            <RouteAwareLayout>
            <ErrorBoundary>
            <Suspense fallback={<LoadingSpinner />}>
              <Routes>
              {/* Public routes */}
              <Route path="/" element={<HomePage />} />
              <Route path="/order/:orderId" element={<OrderStatusPage />} />
              <Route path="/my-orders" element={<MyOrdersPage />} />
              <Route path="/register" element={<RegistrationPage />} />
              
              {/* Auth callback routes (Cognito Hosted UI) */}
              <Route path="/signin" element={<SignInCallbackPage />} />
              <Route path="/signout" element={<SignOutPage />} />
              
              {/* Debug route (development only) */}
              <Route path="/debug" element={<DebugPage />} />
              
              {/* Admin routes */}
              <Route path="/admin/login" element={<AdminLoginPage />} />
              <Route path="/login" element={<AdminLoginPage />} />
              <Route 
                path="/admin" 
                element={
                  <ProtectedRoute>
                    <AdminDashboardPage />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/admin/drinks" 
                element={
                  <ProtectedRoute>
                    <AdminDrinksPage />
                  </ProtectedRoute>
                } 
              />
              <Route
                path="/admin/sections"
                element={
                  <ProtectedRoute>
                    <AdminSectionsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/registration-codes"
                element={
                  <ProtectedRoute>
                    <AdminRegistrationCodesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/chat"
                element={
                  <ProtectedRoute>
                    <AdminBartenderChatPage />
                  </ProtectedRoute>
                }
              />
              </Routes>
            </Suspense>
            </ErrorBoundary>
            </RouteAwareLayout>
          </AdminNotificationProvider>
        </UserNotificationProvider>
      </Router>
    </>
  );
};

function App() {
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    // Configure Amplify once on app initialization
    configureAmplify();
    // Initialize audio context on first user interaction (required for mobile)
    initAudioOnInteraction();
    setIsConfigured(true);
  }, []);

  if (!isConfigured) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Initializing...</p>
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <AccessibilityProvider>
        <ToastProvider position="top-right">
          <AuthProvider>
            <AppContent />
            <UpdatePrompt />
          </AuthProvider>
        </ToastProvider>
      </AccessibilityProvider>
    </ThemeProvider>
  );
}

export default App;