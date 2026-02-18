import React, { useState } from 'react';
// @ts-expect-error - virtual module from vite-plugin-pwa
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button, LoadingSpinner } from '../UI';

const UpdatePrompt: React.FC = () => {
  const [isUpdating, setIsUpdating] = useState(false);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl: string, r: ServiceWorkerRegistration | undefined) {
      // Check for updates every 60 seconds
      if (r) {
        setInterval(() => {
          r.update();
        }, 60 * 1000);
      }
    },
    onRegisterError(error: Error) {
      console.error('SW registration error:', error);
    },
  });

  const close = () => {
    setNeedRefresh(false);
  };

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      await updateServiceWorker(true);
      // Force reload if updateServiceWorker doesn't trigger it
      window.location.reload();
    } catch (error) {
      console.error('Failed to update service worker:', error);
      // Fallback: just reload the page
      window.location.reload();
    }
  };

  if (!needRefresh) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 text-2xl">🔄</div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              New version available
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Update to get the latest features and improvements.
            </p>
            <div className="flex gap-2 mt-3">
              <Button size="sm" variant="primary" onClick={handleUpdate} disabled={isUpdating}>
                {isUpdating ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Updating...
                  </>
                ) : (
                  'Update now'
                )}
              </Button>
              <Button size="sm" variant="secondary" onClick={close} disabled={isUpdating}>
                Later
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpdatePrompt;
