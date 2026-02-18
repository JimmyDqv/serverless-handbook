import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccessibility } from '../../contexts/AccessibilityContext';

interface FormLoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  className?: string;
}

const FormLoadingOverlay: React.FC<FormLoadingOverlayProps> = ({
  isLoading,
  message = 'Saving...',
  className = ''
}) => {
  const { reducedMotion } = useAccessibility();

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={reducedMotion ? {} : { opacity: 0 }}
          animate={reducedMotion ? {} : { opacity: 1 }}
          exit={reducedMotion ? {} : { opacity: 0 }}
          transition={reducedMotion ? {} : { duration: 0.2 }}
          className={`
            absolute inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm
            flex items-center justify-center z-10 rounded-lg
            ${className}
          `}
          role="status"
          aria-live="polite"
          aria-label={message}
        >
          <div className="flex flex-col items-center space-y-3">
            <motion.div
              animate={reducedMotion ? {} : { rotate: 360 }}
              transition={reducedMotion ? {} : {
                duration: 1,
                repeat: Infinity,
                ease: 'linear'
              }}
              className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full"
              aria-hidden="true"
            />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {message}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FormLoadingOverlay;