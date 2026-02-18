import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import { Section } from '../../types';
import { Button } from '../UI';

interface HamburgerMenuProps {
  sections?: Section[];
  activeSectionId?: string;
  onSectionClick?: (sectionId: string) => void;
  showSections?: boolean;
}

const HamburgerMenu: React.FC<HamburgerMenuProps> = ({
  sections = [],
  activeSectionId,
  onSectionClick,
  showSections = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { isAuthenticated, signOut } = useAuth();
  const location = useLocation();

  const isAdminRoute = location.pathname.startsWith('/admin');
  const isGuestAuthenticated = !!localStorage.getItem('access_token');

  const handleLogout = async () => {
    try {
      await signOut();
      setIsOpen(false);
    } catch (error) {
      // Error is handled in the context
    }
  };

  const handleSectionClick = (sectionId: string) => {
    onSectionClick?.(sectionId);
    setIsOpen(false);
  };

  const handleLinkClick = () => {
    setIsOpen(false);
  };

  return (
    <>
      {/* Hamburger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
        aria-label="Toggle menu"
      >
        {isOpen ? (
          <XMarkIcon className="h-6 w-6" />
        ) : (
          <Bars3Icon className="h-6 w-6" />
        )}
      </button>

      {/* Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/50 z-40"
          />
        )}
      </AnimatePresence>

      {/* Slide-out Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.3 }}
            className="fixed top-0 right-0 h-full w-80 bg-white dark:bg-gray-800 shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gradient">Navigation</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                aria-label="Close menu"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Menu Content */}
            <div className="flex-1 overflow-y-auto">
              {/* Section Navigation (if provided) */}
              {showSections && sections.length > 0 && (
                <div className="p-4">
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                    Categories
                  </h3>
                  <div className="space-y-2">
                    {sections.map((section) => (
                      <button
                        key={section.id}
                        onClick={() => handleSectionClick(section.id)}
                        className={`w-full text-left px-4 py-3 rounded-md transition-colors ${
                          activeSectionId === section.id
                            ? 'bg-primary-500 text-white'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <div className="font-medium">{section.name}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Main Navigation */}
              <nav className={`p-4 space-y-2 ${showSections && sections.length > 0 ? 'border-t border-gray-200 dark:border-gray-700' : ''}`}>
                <Link
                  to="/"
                  onClick={handleLinkClick}
                  className={`block px-4 py-3 rounded-md transition-colors ${
                    location.pathname === '/'
                      ? 'bg-primary-500 text-white'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  Home
                </Link>

                {isGuestAuthenticated && (
                  <Link
                    to="/my-orders"
                    onClick={handleLinkClick}
                    className={`block px-4 py-3 rounded-md transition-colors ${
                      location.pathname === '/my-orders'
                        ? 'bg-primary-500 text-white'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    My Orders
                  </Link>
                )}

                {isAuthenticated && (
                  <>
                    <Link
                      to="/admin"
                      onClick={handleLinkClick}
                      className={`block px-4 py-3 rounded-md transition-colors ${
                        isAdminRoute
                          ? 'bg-primary-500 text-white'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      Admin
                    </Link>

                    {/* TODO: Restore import.meta.env.DEV check after debugging sound issues */}
                    <Link
                      to="/debug"
                      onClick={handleLinkClick}
                      className={`block px-4 py-3 rounded-md transition-colors ${
                        location.pathname === '/debug'
                          ? 'bg-primary-500 text-white'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      Debug
                    </Link>
                  </>
                )}
              </nav>
            </div>

            {/* Footer - Auth Controls */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              {isAuthenticated ? (
                <Button
                  onClick={handleLogout}
                  variant="secondary"
                  className="w-full"
                >
                  Logout
                </Button>
              ) : (
                <Link to="/admin/login" onClick={handleLinkClick}>
                  <Button className="w-full">
                    Login
                  </Button>
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default HamburgerMenu;
