import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Drink, Section } from '../../types';
import DrinkCard from './DrinkCard';
import { EmptyState, Skeleton } from '../UI';

interface GroupedDrinksViewProps {
  sections: Section[];
  drinksBySection: Map<string, Drink[]>;
  isLoading?: boolean;
  onOrderClick: (drink: Drink) => void;
  onDetailsClick: (drink: Drink) => void;
  onActiveSectionChange?: (sectionId: string) => void;
  isOrdering?: boolean;
  orderingDrinkId?: string | null;
}

const GroupedDrinksView: React.FC<GroupedDrinksViewProps> = ({
  sections,
  drinksBySection,
  isLoading = false,
  onOrderClick,
  onDetailsClick,
  onActiveSectionChange,
  isOrdering = false,
  orderingDrinkId = null,
}) => {
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [activeSection, setActiveSection] = useState<string | undefined>();

  // Intersection Observer to detect active section
  useEffect(() => {
    const observers = new Map<string, IntersectionObserver>();

    sections.forEach((section) => {
      const element = sectionRefs.current.get(section.id);
      if (!element) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActiveSection(section.id);
            onActiveSectionChange?.(section.id);
          }
        },
        {
          rootMargin: '-100px 0px -80% 0px',
          threshold: 0,
        }
      );

      observer.observe(element);
      observers.set(section.id, observer);
    });

    return () => {
      observers.forEach((observer) => observer.disconnect());
    };
  }, [sections, onActiveSectionChange]);

  if (isLoading) {
    return (
      <div className="space-y-12">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div key={idx}>
            <Skeleton className="h-8 w-48 mb-6" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-80 rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const totalDrinks = Array.from(drinksBySection.values()).reduce(
    (sum, drinks) => sum + drinks.length,
    0
  );

  if (totalDrinks === 0) {
    return (
      <EmptyState
        icon={
          <svg
            className="w-16 h-16 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
        }
        title="No drinks available"
        description="No drinks have been added yet"
      />
    );
  }

  return (
    <div className="space-y-2">
      {sections.map((section) => {
        const drinks = drinksBySection.get(section.id) || [];
        if (drinks.length === 0) return null;

        return (
          <section
            key={section.id}
            id={`section-${section.id}`}
            ref={(el) => {
              if (el) sectionRefs.current.set(section.id, el);
            }}
            className="scroll-mt-20"
          >
            {/* Sticky Section Header */}
            <div className="sticky top-14 md:top-16 z-30 bg-gradient-to-r from-primary-500 via-primary-600 to-secondary-600 text-white shadow-lg -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 py-4 mb-6 rounded-lg">
              <h2 className="text-2xl font-bold">
                {section.name}
                <span className="ml-3 text-sm font-normal opacity-90">
                  {drinks.length} {drinks.length === 1 ? 'drink' : 'drinks'}
                </span>
              </h2>
            </div>

            {/* Drinks Grid */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12"
            >
              {drinks.map((drink) => (
                <DrinkCard
                  key={drink.id}
                  drink={drink}
                  onOrderClick={onOrderClick}
                  onDetailsClick={onDetailsClick}
                  isOrdering={isOrdering}
                  orderingDrinkId={orderingDrinkId}
                />
              ))}
            </motion.div>
          </section>
        );
      })}
    </div>
  );
};

export default GroupedDrinksView;
