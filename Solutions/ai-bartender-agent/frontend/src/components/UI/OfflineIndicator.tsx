import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccessibility } from '../../contexts/AccessibilityContext';

interface OfflineIndicatorProps {
  className?: string;
  showWhenOnline?: boolean;
  onRetry?: () => void;
}

const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  className = '',
  showWhenOnline = false,
  onRetry
}) => {
  const { reducedMotion } = useAccessibility();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOnlineMessage, setShowOnlineMessage] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (showWhenOnline) {
        setShowOnlineMessage(true);
        // Hide the online message after 3 seconds
        setTimeout(() => setShowOnlineMessage(false), 3000);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowOnlineMessage(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [showWhenOnline]);

  const shouldShow = !isOnline || (showWhenOnline && showOnlineMessage);

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          initial={reducedMotion ? {} : { opacity: 0, y: -50 }}
          animate={reducedMotion ? {} : { opacity: 1, y: 0 }}
          exit={reducedMotion ? {} : { opacity: 0, y: -50 }}
          transition={reducedMotion ? {} : { duration: 0.3 }}
          className={`
            fixed top-0 left-0 right-0 z-50 px-4 py-3
            ${isOnline 
              ? 'bg-success text-white' 
              : 'bg-error text-white'
            }
            ${className}
          `}
          role="alert"
          aria-live="polite"
        >
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                {isOnline ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                  </svg>
                ) : (
                  <motion.svg
                    animate={reducedMotion ? {} : { rotate: [0, 10, -10, 0] }}
                    transition={reducedMotion ? {} : { duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364" />
                  </motion.svg>
                )}
              </div>
              
              <div>
                <p className="text-sm font-medium">
                  {isOnline ? 'Connection restored' : 'You are offline'}
                </p>
                <p className="text-xs opacity-90">
                  {isOnline 
                    ? 'All features are now available' 
                    : 'Some features may not work properly'
                  }
                </p>
              </div>
            </div>
            
            {!isOnline && onRetry && (
              <button
                onClick={onRetry}
                className="flex-shrink-0 px-3 py-1 text-xs font-medium bg-white/20 hover:bg-white/30 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white/50"
              >
                Try again
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OfflineIndicator;