import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import HamburgerMenu from './HamburgerMenu';
import { Section } from '../../types';

interface HeaderProps {
  sections?: Section[];
  activeSectionId?: string;
  onSectionClick?: (sectionId: string) => void;
  showSections?: boolean;
}

const Header: React.FC<HeaderProps> = ({
  sections,
  activeSectionId,
  onSectionClick,
  showSections = false,
}) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link 
            to="/" 
            className="flex items-center space-x-2 text-xl font-bold text-gradient"
          >
            <span>🍹</span>
            <span>AI Bartender</span>
          </Link>

          {/* Controls */}
          <div className="flex items-center space-x-3">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              aria-label="Toggle dark mode"
            >
              {theme === 'light' ? (
                <MoonIcon className="h-5 w-5" />
              ) : (
                <SunIcon className="h-5 w-5" />
              )}
            </button>

            {/* Hamburger Menu */}
            <HamburgerMenu
              sections={sections}
              activeSectionId={activeSectionId}
              onSectionClick={onSectionClick}
              showSections={showSections}
            />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;