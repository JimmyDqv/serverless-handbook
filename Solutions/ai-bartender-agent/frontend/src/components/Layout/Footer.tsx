import React from 'react';

// Build info injected at build time
const BUILD_ID = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';

const Footer: React.FC = () => {
  return (
    <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
            <span>© 2025 AI Bartender</span>
          </div>

          <div className="flex items-center space-x-6 text-sm text-gray-600 dark:text-gray-400">
            <span>Made with ❤️ for great drinks</span>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              v{BUILD_ID}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;