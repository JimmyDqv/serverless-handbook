import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Section } from '../../types';
import { Skeleton } from '../UI';

interface SectionNavProps {
  sections: Section[];
  activeSectionId?: string;
  onSectionClick: (sectionId: string) => void;
  isLoading?: boolean;
}

const SectionNav: React.FC<SectionNavProps> = ({
  sections,
  activeSectionId,
  onSectionClick,
  isLoading = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Close menu when section is selected
  useEffect(() => {
    if (activeSectionId) {
      setIsExpanded(false);
    }
  }, [activeSectionId]);

  if (isLoading) {
    return (
      <div className="fixed right-4 top-20 md:top-24 z-40">
        <Skeleton className="w-12 h-12 rounded-full" />
      </div>
    );
  }

  return (
    <div className="fixed right-4 top-24 z-40">
      {/* Toggle Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-12 h-12 rounded-full bg-primary-500 text-white shadow-lg flex items-center justify-center hover:bg-primary-600 transition-colors"
        aria-label="Toggle section navigation"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          className={`w-6 h-6 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d={isExpanded 
              ? "M6 18L18 6M6 6l12 12" 
              : "M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
            }
          />
        </svg>
      </motion.button>

      {/* Section List */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute right-0 top-14 bg-white dark:bg-gray-800 rounded-lg shadow-xl p-2 min-w-[200px] max-h-[calc(100vh-200px)] overflow-y-auto"
          >
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => onSectionClick(section.id)}
                className={`w-full text-left px-4 py-3 rounded-md transition-colors ${
                  activeSectionId === section.id
                    ? 'bg-primary-500 text-white'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                <div className="font-medium">{section.name}</div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SectionNav;
