import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Drink } from '../../types';

interface IngredientFilterProps {
  allDrinks: Drink[];
  selectedIngredients: string[];
  onIngredientsChange: (ingredients: string[]) => void;
}

const IngredientFilter: React.FC<IngredientFilterProps> = ({
  allDrinks,
  selectedIngredients,
  onIngredientsChange,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Extract all unique ingredients from drinks
  const allIngredients = useMemo(() => {
    const ingredientsSet = new Set<string>();
    allDrinks.forEach((drink) => {
      drink.ingredients.forEach((ing) => ingredientsSet.add(ing));
    });
    return Array.from(ingredientsSet).sort();
  }, [allDrinks]);

  // Filter ingredients based on search term
  const filteredIngredients = useMemo(() => {
    if (!searchTerm) return allIngredients;
    return allIngredients.filter((ing) =>
      ing.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [allIngredients, searchTerm]);

  const toggleIngredient = (ingredient: string) => {
    if (selectedIngredients.includes(ingredient)) {
      onIngredientsChange(selectedIngredients.filter((i) => i !== ingredient));
    } else {
      onIngredientsChange([...selectedIngredients, ingredient]);
    }
  };

  const clearAll = () => {
    onIngredientsChange([]);
    setSearchTerm('');
  };

  return (
    <div className="mb-6">
      {/* Filter Toggle Button */}
      <div className="flex items-center gap-3 mb-4">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-5 h-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z"
            />
          </svg>
          <span className="font-medium text-gray-700 dark:text-gray-300">
            Filter ingredients
          </span>
          {selectedIngredients.length > 0 && (
            <span className="px-2 py-0.5 bg-primary-500 text-white text-xs rounded-full">
              {selectedIngredients.length}
            </span>
          )}
        </motion.button>

        {selectedIngredients.length > 0 && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            whileTap={{ scale: 0.95 }}
            onClick={clearAll}
            className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
          >
            Clear all
          </motion.button>
        )}
      </div>

      {/* Filter Panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              {/* Search Input */}
              <div className="mb-4">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search ingredient..."
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Ingredient List */}
              <div className="max-h-64 overflow-y-auto">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {filteredIngredients.map((ingredient) => {
                    const isSelected = selectedIngredients.includes(ingredient);
                    return (
                      <motion.button
                        key={ingredient}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => toggleIngredient(ingredient)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          isSelected
                            ? 'bg-primary-500 text-white shadow-md'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        {ingredient}
                      </motion.button>
                    );
                  })}
                </div>

                {filteredIngredients.length === 0 && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No ingredients found
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Filters */}
      {selectedIngredients.length > 0 && !isExpanded && (
        <div className="flex flex-wrap gap-2 mt-3">
          {selectedIngredients.map((ingredient) => (
            <motion.span
              key={ingredient}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="inline-flex items-center gap-1 px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-sm"
            >
              {ingredient}
              <button
                onClick={() => toggleIngredient(ingredient)}
                className="ml-1 hover:text-primary-900 dark:hover:text-primary-100"
                aria-label={`Remove ${ingredient}`}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </motion.span>
          ))}
        </div>
      )}
    </div>
  );
};

export default IngredientFilter;
