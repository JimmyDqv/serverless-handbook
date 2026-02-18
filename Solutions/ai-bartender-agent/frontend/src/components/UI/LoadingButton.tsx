import React from 'react';
import { motion } from 'framer-motion';
import { useAccessibility } from '../../contexts/AccessibilityContext';
import { useHaptics } from '../../hooks/useHaptics';

interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  loadingText?: string;
  haptic?: boolean;
  children: React.ReactNode;
}

const LoadingButton: React.FC<LoadingButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  loadingText = 'Loading...',
  haptic = true,
  children,
  className = '',
  disabled,
  onClick,
  ...props
}) => {
  const { reducedMotion } = useAccessibility();
  const { hapticFeedback } = useHaptics();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (haptic && !disabled && !isLoading) {
      hapticFeedback.buttonTap();
    }
    onClick?.(e);
  };

  const baseClasses = 'btn relative overflow-hidden transition-all duration-200';
  const variantClasses = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    danger: 'btn-danger',
  };
  
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  const classes = [
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    isLoading ? 'cursor-not-allowed' : '',
    className,
  ].join(' ');

  return (
    <motion.button
      whileTap={!isLoading && !disabled ? { scale: 0.98 } : {}}
      className={classes}
      disabled={disabled || isLoading}
      onClick={handleClick}
      aria-busy={isLoading}
      {...(props as any)} // Type assertion to avoid motion props conflict
    >
      <div className="flex items-center justify-center space-x-2">
        {isLoading && (
          <motion.div
            animate={reducedMotion ? {} : { rotate: 360 }}
            transition={reducedMotion ? {} : {
              duration: 1,
              repeat: Infinity,
              ease: 'linear'
            }}
            className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
            aria-hidden="true"
          />
        )}
        
        <motion.span
          animate={reducedMotion ? {} : {
            opacity: isLoading ? 0.7 : 1,
          }}
          transition={reducedMotion ? {} : { duration: 0.2 }}
        >
          {isLoading ? loadingText : children}
        </motion.span>
      </div>
      
      {/* Loading overlay */}
      {isLoading && (
        <motion.div
          initial={reducedMotion ? {} : { opacity: 0 }}
          animate={reducedMotion ? {} : { opacity: 0.1 }}
          className="absolute inset-0 bg-current"
          aria-hidden="true"
        />
      )}
    </motion.button>
  );
};

export default LoadingButton;