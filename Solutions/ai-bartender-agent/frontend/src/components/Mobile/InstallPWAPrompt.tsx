import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { usePWA } from '../../hooks/usePWA';
import { Button } from '../UI';

const InstallPWAPrompt: React.FC = () => {
  const { isInstallable, installApp } = usePWA();
  const [isDismissed, setIsDismissed] = useState(() => {
    return localStorage.getItem('pwa-prompt-dismissed') === 'true';
  });

  const handleInstall = async () => {
    const success = await installApp();
    if (success) {
      setIsDismissed(true);
      localStorage.setItem('pwa-prompt-dismissed', 'true');
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('pwa-prompt-dismissed', 'true');
  };

  if (!isInstallable || isDismissed) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-80"
      >
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900 rounded-lg flex items-center justify-center">
                <span className="text-lg">🍹</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                  Install AI Bartender
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Add to home screen for quick access
                </p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="flex space-x-2">
            <Button
              onClick={handleInstall}
              size="sm"
              className="flex-1 text-xs"
            >
              <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
              Install
            </Button>
            <Button
              onClick={handleDismiss}
              variant="secondary"
              size="sm"
              className="text-xs"
            >
              Not now
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default InstallPWAPrompt;