import React from 'react';
import { motion } from 'framer-motion';
import { useAccessibility } from '../../contexts/AccessibilityContext';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  text?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  className = '',
  text = 'Loading...'
}) => {
  const { reducedMotion } = useAccessibility();

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  const containerSizeClasses = {
    sm: 'p-2',
    md: 'p-4',
    lg: 'p-8'
  };

  return (
    <div className={`flex flex-col items-center justify-center ${containerSizeClasses[size]} ${className}`}>
      <motion.div
        className={`${sizeClasses[size]} border-2 border-primary-200 border-t-primary-600 rounded-full`}
        animate={reducedMotion ? {} : { rotate: 360 }}
        transition={reducedMotion ? {} : {
          duration: 1,
          repeat: Infinity,
          ease: 'linear'
        }}
        style={{
          // GPU acceleration
          transform: 'translateZ(0)',
          willChange: reducedMotion ? 'auto' : 'transform'
        }}
        aria-hidden="true"
      />
      {text && (
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400" aria-live="polite">
          {text}
        </p>
      )}
    </div>
  );
};

export default LoadingSpinner;