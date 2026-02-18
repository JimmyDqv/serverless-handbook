import React from 'react';
import { motion } from 'framer-motion';
import { useAccessibility } from '../../contexts/AccessibilityContext';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = ''
}) => {
  const { reducedMotion } = useAccessibility();

  return (
    <motion.div
      initial={reducedMotion ? {} : { opacity: 0, y: 20 }}
      animate={reducedMotion ? {} : { opacity: 1, y: 0 }}
      transition={reducedMotion ? {} : { duration: 0.3 }}
      className={`flex flex-col items-center justify-center text-center p-8 ${className}`}
    >
      {icon && (
        <motion.div
          initial={reducedMotion ? {} : { scale: 0.8 }}
          animate={reducedMotion ? {} : { scale: 1 }}
          transition={reducedMotion ? {} : { duration: 0.3, delay: 0.1 }}
          className="mb-4 text-gray-400 dark:text-gray-500"
        >
          {icon}
        </motion.div>
      )}
      
      <motion.h3
        initial={reducedMotion ? {} : { opacity: 0 }}
        animate={reducedMotion ? {} : { opacity: 1 }}
        transition={reducedMotion ? {} : { duration: 0.3, delay: 0.2 }}
        className="text-h4 text-gray-900 dark:text-gray-100 mb-2"
      >
        {title}
      </motion.h3>
      
      <motion.p
        initial={reducedMotion ? {} : { opacity: 0 }}
        animate={reducedMotion ? {} : { opacity: 1 }}
        transition={reducedMotion ? {} : { duration: 0.3, delay: 0.3 }}
        className="text-body text-gray-600 dark:text-gray-400 max-w-md mb-6"
      >
        {description}
      </motion.p>
      
      {action && (
        <motion.button
          initial={reducedMotion ? {} : { opacity: 0, y: 10 }}
          animate={reducedMotion ? {} : { opacity: 1, y: 0 }}
          transition={reducedMotion ? {} : { duration: 0.3, delay: 0.4 }}
          onClick={action.onClick}
          className="btn btn-primary"
        >
          {action.label}
        </motion.button>
      )}
    </motion.div>
  );
};

// Predefined empty state components for common scenarios
export const NoDrinksEmptyState: React.FC<{ onRefresh?: () => void }> = ({ onRefresh }) => (
  <EmptyState
    icon={
      <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    }
    title="No drinks available"
    description="There are no drinks to display right now. Check back later or try refreshing the page."
    action={onRefresh ? { label: "Refresh", onClick: onRefresh } : undefined}
  />
);

export const NoOrdersEmptyState: React.FC = () => (
  <EmptyState
    icon={
      <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    }
    title="No orders yet"
    description="Orders will appear here when customers place them. You will see new orders in real time."
  />
);

export const SearchEmptyState: React.FC<{ searchTerm: string; onClearSearch: () => void }> = ({ 
  searchTerm, 
  onClearSearch 
}) => (
  <EmptyState
    icon={
      <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    }
    title="No results found"
    description={`No drinks match "${searchTerm}". Try a different search term or browse all drinks.`}
    action={{ label: "Clear search", onClick: onClearSearch }}
  />
);

export const OfflineEmptyState: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <EmptyState
    icon={
      <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M12 2.25a9.75 9.75 0 109.75 9.75c0-1.856-.5-3.6-1.372-5.098" />
      </svg>
    }
    title="You're offline"
    description="Check your internet connection and try again. Some features may not be available while offline."
    action={{ label: "Try again", onClick: onRetry }}
  />
);

export default EmptyState;