import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccessibility } from '../../contexts/AccessibilityContext';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  isLoading?: boolean;
  success?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  isLoading = false,
  success = false,
  leftIcon,
  rightIcon,
  className = '',
  id,
  onFocus,
  onBlur,
  ...props
}) => {
  const { reducedMotion } = useAccessibility();
  const [isFocused, setIsFocused] = useState(false);
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
  
  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  const getInputClasses = () => {
    const baseClasses = 'input transition-all duration-200';
    const stateClasses = {
      error: 'border-error focus:border-error focus:ring-error/20',
      success: 'border-success focus:border-success focus:ring-success/20',
      loading: 'pr-10',
      focused: 'ring-2 ring-primary-500/20',
      withLeftIcon: 'pl-10',
      withRightIcon: 'pr-10'
    };

    let classes = baseClasses;
    
    if (error) classes += ` ${stateClasses.error}`;
    else if (success) classes += ` ${stateClasses.success}`;
    else if (isFocused) classes += ` ${stateClasses.focused}`;
    
    if (leftIcon) classes += ` ${stateClasses.withLeftIcon}`;
    if (rightIcon || isLoading) classes += ` ${stateClasses.withRightIcon}`;
    
    return `${classes} ${className}`;
  };

  return (
    <div className="space-y-1">
      {label && (
        <label 
          htmlFor={inputId}
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {label}
          {props.required && <span className="text-error ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        {leftIcon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <div className="text-gray-400 dark:text-gray-500">
              {leftIcon}
            </div>
          </div>
        )}
        
        <input
          id={inputId}
          className={getInputClasses()}
          onFocus={handleFocus}
          onBlur={handleBlur}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={
            error ? `${inputId}-error` : 
            helperText ? `${inputId}-helper` : undefined
          }
          {...props}
        />
        
        {(rightIcon || isLoading || success) && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            {isLoading ? (
              <motion.div
                animate={reducedMotion ? {} : { rotate: 360 }}
                transition={reducedMotion ? {} : {
                  duration: 1,
                  repeat: Infinity,
                  ease: 'linear'
                }}
                className="w-4 h-4 border-2 border-gray-300 border-t-primary-500 rounded-full"
              />
            ) : success ? (
              <motion.div
                initial={reducedMotion ? {} : { scale: 0 }}
                animate={reducedMotion ? {} : { scale: 1 }}
                transition={reducedMotion ? {} : { duration: 0.2 }}
                className="text-success"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </motion.div>
            ) : rightIcon ? (
              <div className="text-gray-400 dark:text-gray-500">
                {rightIcon}
              </div>
            ) : null}
          </div>
        )}
      </div>
      
      <AnimatePresence>
        {error && (
          <motion.div
            initial={reducedMotion ? {} : { opacity: 0, y: -10 }}
            animate={reducedMotion ? {} : { opacity: 1, y: 0 }}
            exit={reducedMotion ? {} : { opacity: 0, y: -10 }}
            transition={reducedMotion ? {} : { duration: 0.2 }}
            className="flex items-center space-x-1"
          >
            <svg className="w-4 h-4 text-error flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p id={`${inputId}-error`} className="text-sm text-error">
              {error}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      
      {helperText && !error && (
        <p id={`${inputId}-helper`} className="text-sm text-gray-500 dark:text-gray-400">
          {helperText}
        </p>
      )}
    </div>
  );
};

export default Input;