import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Drink } from '../../types';
import { Modal, Button } from '../UI';
import { ResponsiveImage } from '../UI/ResponsiveImage';
import { useIsRegistered } from '../../hooks/useIsRegistered';
import { drinksApi } from '../../services/api';

interface DrinkDetailsModalProps {
  drink: Drink | null;
  isOpen: boolean;
  onClose: () => void;
  onOrderClick: (drink: Drink) => void;
  isOrdering?: boolean;
}

const DrinkDetailsModal: React.FC<DrinkDetailsModalProps> = ({
  drink,
  isOpen,
  onClose,
  onOrderClick,
  isOrdering = false,
}) => {
  const { isRegistered } = useIsRegistered();
  const navigate = useNavigate();

  const [isRecipeExpanded, setIsRecipeExpanded] = useState(false);
  const [fullDrink, setFullDrink] = useState<Drink | null>(null);
  const [isLoadingRecipe, setIsLoadingRecipe] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Reset state when modal closes or drink changes
  useEffect(() => {
    if (!isOpen) {
      setIsRecipeExpanded(false);
      setFullDrink(null);
      setLoadError(null);
    }
  }, [isOpen, drink?.id]);

  const handleExpandRecipe = async () => {
    if (isRecipeExpanded) {
      setIsRecipeExpanded(false);
      return;
    }

    // If we already have the full drink data, just expand
    if (fullDrink?.recipe) {
      setIsRecipeExpanded(true);
      return;
    }

    // Fetch the full drink details
    if (drink?.id) {
      setIsLoadingRecipe(true);
      setLoadError(null);

      try {
        const data = await drinksApi.getById(drink.id);
        setFullDrink(data);
        setIsRecipeExpanded(true);
      } catch (error) {
        console.error('Failed to fetch drink details:', error);
        setLoadError('Could not load details');
      } finally {
        setIsLoadingRecipe(false);
      }
    }
  };

  if (!drink) return null;

  const handleOrderClick = () => {
    onOrderClick(drink);
  };

  const handleRegisterClick = () => {
    onClose();
    navigate('/register');
  };

  const recipe = fullDrink?.recipe;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
    >
      <div className="space-y-6">
        {/* Image */}
        <ResponsiveImage
          drinkId={drink.id}
          size="medium"
          alt={drink.name}
          className="w-full rounded-lg aspect-square"
          lazy={false}
          objectFit="cover"
        />

        {/* Content */}
        <div className="space-y-4">
          {/* Title */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {drink.name}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {drink.description}
            </p>
          </div>

          {/* Simple Ingredients List (always shown) */}
          {drink.ingredients.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Ingredients
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {drink.ingredients.map((ingredient, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.05 }}
                    className="flex items-center space-x-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <span className="text-lg">🍹</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {ingredient}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Show Recipe Button */}
          <button
            onClick={handleExpandRecipe}
            disabled={isLoadingRecipe}
            className="w-full flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors disabled:opacity-50"
          >
            <span className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-medium">
              <span>📖</span>
              {isRecipeExpanded ? 'Hide recipe' : 'Show recipe'}
            </span>
            {isLoadingRecipe ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-amber-600"></div>
            ) : (
              <motion.span
                animate={{ rotate: isRecipeExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                className="text-amber-600 dark:text-amber-400"
              >
                ▼
              </motion.span>
            )}
          </button>

          {/* Error state */}
          {loadError && (
            <div className="text-red-600 dark:text-red-400 text-center py-2">
              {loadError}
            </div>
          )}

          {/* Expandable Recipe Section */}
          <AnimatePresence>
            {isRecipeExpanded && recipe && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                  {/* Recipe metadata */}
                  {(recipe.glassware || recipe.garnish || recipe.preparation_time) && (
                    <div className="flex flex-wrap gap-3 text-sm text-gray-600 dark:text-gray-400">
                      {recipe.glassware && (
                        <span className="flex items-center gap-1">
                          <span>🥃</span>
                          <span>{recipe.glassware}</span>
                        </span>
                      )}
                      {recipe.garnish && (
                        <span className="flex items-center gap-1">
                          <span>🍋</span>
                          <span>{recipe.garnish}</span>
                        </span>
                      )}
                      {recipe.preparation_time && (
                        <span className="flex items-center gap-1">
                          <span>⏱️</span>
                          <span>{recipe.preparation_time} minutes</span>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Recipe Ingredients with amounts */}
                  {recipe.ingredients && recipe.ingredients.length > 0 && (
                    <div>
                      <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 mb-2">
                        Ingredients
                      </h4>
                      <div className="grid grid-cols-1 gap-2">
                        {recipe.ingredients.map((ingredient, index) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.2, delay: index * 0.05 }}
                            className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg"
                          >
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {ingredient.name}
                              {ingredient.optional && (
                                <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                                  (optional)
                                </span>
                              )}
                            </span>
                            <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                              {ingredient.amount}
                            </span>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recipe Steps */}
                  {recipe.steps && recipe.steps.length > 0 && (
                    <div>
                      <h4 className="text-md font-medium text-gray-800 dark:text-gray-200 mb-2">
                        Preparation
                      </h4>
                      <ol className="space-y-2">
                        {recipe.steps
                          .sort((a, b) => a.order - b.order)
                          .map((step, index) => (
                            <motion.li
                              key={step.order}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.2, delay: index * 0.1 }}
                              className="flex gap-3 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg"
                            >
                              <span className="flex-shrink-0 w-6 h-6 bg-amber-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                                {step.order}
                              </span>
                              <span className="text-sm text-gray-700 dark:text-gray-300">
                                {step.instruction}
                              </span>
                            </motion.li>
                          ))}
                      </ol>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Actions */}
          <div className="flex space-x-3 pt-4">
            {isRegistered ? (
              <Button
                onClick={handleOrderClick}
                className="flex-1"
                isLoading={isOrdering}
                loadingText="Ordering..."
              >
                Order Now
              </Button>
            ) : (
              <Button
                onClick={handleRegisterClick}
                className="flex-1"
              >
                Register to order
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={onClose}
              disabled={isOrdering}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default DrinkDetailsModal;
