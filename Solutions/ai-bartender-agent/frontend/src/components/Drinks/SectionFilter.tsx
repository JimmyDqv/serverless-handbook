import React from 'react';
import { motion } from 'framer-motion';
import { Section } from '../../types';
import { useSections } from '../../hooks/useSections';
import { Skeleton } from '../UI';

interface SectionFilterProps {
  selectedSectionId?: string;
  onSectionChange: (sectionId?: string) => void;
}

const SectionFilter: React.FC<SectionFilterProps> = ({
  selectedSectionId,
  onSectionChange,
}) => {
  const { sections, isLoading } = useSections();

  if (isLoading) {
    return (
      <div className="flex space-x-2 overflow-x-auto pb-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-24 rounded-full flex-shrink-0" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
      {/* All Drinks Filter */}
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => onSectionChange(undefined)}
        className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
          !selectedSectionId
            ? 'bg-primary-500 text-white shadow-md'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
        }`}
      >
        All Drinks
      </motion.button>

      {/* Section Filters */}
      {sections.map((section) => (
        <motion.button
          key={section.id}
          whileTap={{ scale: 0.95 }}
          onClick={() => onSectionChange(section.id)}
          className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
            selectedSectionId === section.id
              ? 'bg-primary-500 text-white shadow-md'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          {section.name}
        </motion.button>
      ))}
    </div>
  );
};

export default SectionFilter;