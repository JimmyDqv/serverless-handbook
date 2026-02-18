import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Cog6ToothIcon, 
  XMarkIcon,
  EyeIcon,
  SpeakerWaveIcon,
  AdjustmentsHorizontalIcon 
} from '@heroicons/react/24/outline';
import { useAccessibility } from '../../contexts/AccessibilityContext';
import { Modal, Button } from '../UI';

const AccessibilitySettings: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { 
    reducedMotion, 
    setReducedMotion,
    highContrast,
    setHighContrast,
    textSize,
    setTextSize,
    focusMode,
    setFocusMode,
    announce
  } = useAccessibility();
  const handleSettingChange = (setting: string, value: any) => {
    announce(`${setting} ${value ? 'enabled' : 'disabled'}`, 'polite');
  };

  return (
    <>
      {/* Accessibility Settings Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-4 w-12 h-12 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800 rounded-full shadow-lg hover:shadow-xl transition-shadow z-40 md:bottom-4"
        aria-label="Open accessibility settings"
        title="Accessibility Settings"
      >
        <AdjustmentsHorizontalIcon className="h-6 w-6 mx-auto" />
      </button>

      {/* Settings Modal */}
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Accessibility Settings"
        size="md"
      >
        <div className="space-y-6">
          {/* Visual Settings */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
              <EyeIcon className="h-5 w-5 mr-2" />
              Visual Settings
            </h3>
            
            <div className="space-y-4">
              {/* High Contrast */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    High Contrast Mode
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Increases contrast for better visibility
                  </p>
                </div>
                <button
                  onClick={() => {
                    setHighContrast(!highContrast);
                    handleSettingChange('High contrast', !highContrast);
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    highContrast ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                  role="switch"
                  aria-checked={highContrast}
                  aria-labelledby="high-contrast-label"
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      highContrast ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Text Size */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  Text Size
                </label>
                <div className="flex space-x-2">
                  {(['small', 'medium', 'large'] as const).map((size) => (
                    <button
                      key={size}
                      onClick={() => {
                        setTextSize(size);
                        announce(`Text size set to ${size}`, 'polite');
                      }}
                      className={`px-3 py-2 text-sm rounded-md transition-colors ${
                        textSize === size
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {size.charAt(0).toUpperCase() + size.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Motion Settings */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
              <SpeakerWaveIcon className="h-5 w-5 mr-2" />
              Motion & Interaction
            </h3>
            
            <div className="space-y-4">
              {/* Reduced Motion */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Reduce Motion
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Minimizes animations and transitions
                  </p>
                </div>
                <button
                  onClick={() => {
                    setReducedMotion(!reducedMotion);
                    handleSettingChange('Reduced motion', !reducedMotion);
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    reducedMotion ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                  role="switch"
                  aria-checked={reducedMotion}
                  aria-labelledby="reduced-motion-label"
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      reducedMotion ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Focus Mode */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Enhanced Focus Indicators
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Makes focus outlines more prominent
                  </p>
                </div>
                <button
                  onClick={() => {
                    setFocusMode(!focusMode);
                    handleSettingChange('Focus mode', !focusMode);
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    focusMode ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                  role="switch"
                  aria-checked={focusMode}
                  aria-labelledby="focus-mode-label"
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      focusMode ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Reset Button */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="secondary"
              onClick={() => {
                setReducedMotion(false);
                setHighContrast(false);
                setTextSize('medium');
                setFocusMode(false);
                announce('Accessibility settings reset to defaults', 'polite');
              }}
              className="w-full"
            >
              Reset to Defaults
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default AccessibilitySettings;