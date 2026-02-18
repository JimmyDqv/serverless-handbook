import React, { useRef, useEffect } from 'react';
import { Section } from '../../types';

interface AdminSectionNavigationProps {
  sections: Section[];
  activeSection: string | null;
  onSectionClick: (sectionId: string) => void;
  drinkCounts: Map<string, number>;
  disabled?: boolean;
}

const AdminSectionNavigation: React.FC<AdminSectionNavigationProps> = ({
  sections,
  activeSection,
  onSectionClick,
  drinkCounts,
  disabled = false,
}) => {
  const navRef = useRef<HTMLDivElement>(null);
  const activeButtonRef = useRef<HTMLButtonElement>(null);

  // Scroll active button into view when it changes
  useEffect(() => {
    if (activeButtonRef.current && navRef.current) {
      const button = activeButtonRef.current;
      const nav = navRef.current;
      const buttonRect = button.getBoundingClientRect();
      const navRect = nav.getBoundingClientRect();

      // Check if button is outside visible area
      if (buttonRect.left < navRect.left || buttonRect.right > navRect.right) {
        button.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center',
        });
      }
    }
  }, [activeSection]);

  const handleClick = (sectionId: string) => {
    if (disabled) return;
    onSectionClick(sectionId);
  };

  // Filter to only show sections with drinks
  const sectionsWithDrinks = sections.filter(
    (section) => (drinkCounts.get(section.id) || 0) > 0
  );

  if (sectionsWithDrinks.length === 0) {
    return null;
  }

  return (
    <nav
      ref={navRef}
      className={`flex gap-2 overflow-x-auto pb-2 scrollbar-hide ${disabled ? 'opacity-50' : ''}`}
      role="navigation"
      aria-label="Section navigation"
    >
      {sectionsWithDrinks.map((section) => {
        const isActive = activeSection === section.id;
        const count = drinkCounts.get(section.id) || 0;

        return (
          <button
            key={section.id}
            ref={isActive ? activeButtonRef : null}
            onClick={() => handleClick(section.id)}
            disabled={disabled}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
              isActive
                ? 'bg-amber-500 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 hover:text-amber-700 dark:hover:text-amber-400'
            } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            title={`Go to ${section.name} (${count} drinks)`}
          >
            {section.name}
            <span className={`ml-2 text-xs ${isActive ? 'text-amber-100' : 'text-gray-500 dark:text-gray-400'}`}>
              ({count})
            </span>
          </button>
        );
      })}
    </nav>
  );
};

export default AdminSectionNavigation;
