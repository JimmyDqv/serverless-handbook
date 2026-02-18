import React from 'react';
import { motion } from 'framer-motion';
import { Drink } from '../../types';
import { Modal, Button } from '../UI';
import { ResponsiveImage } from '../UI/ResponsiveImage';
import { RecipeDisplay } from '../customer/RecipeDisplay';
import { PencilIcon } from '@heroicons/react/24/outline';

interface AdminDrinkDetailsModalProps {
  drink: Drink | null;
  isOpen: boolean;
  onClose: () => void;
  onEditClick: (drink: Drink) => void;
}

const AdminDrinkDetailsModal: React.FC<AdminDrinkDetailsModalProps> = ({
  drink,
  isOpen,
  onClose,
  onEditClick,
}) => {
  if (!drink) return null;

  const handleEditClick = () => {
    onEditClick(drink);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
    >
      <div className="space-y-6 max-h-[80vh] overflow-y-auto">
        {/* Image */}
        <ResponsiveImage
          drinkId={drink.id}
          size="medium"
          alt={drink.name}
          className="w-full rounded-lg aspect-video object-cover"
          lazy={false}
        />

        {/* Content */}
        <div className="space-y-4">
          {/* Title and Status */}
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                {drink.name}
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                {drink.description}
              </p>
            </div>
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              drink.is_active
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
            }`}>
              {drink.is_active ? 'Active' : 'Inactive'}
            </div>
          </div>

          {/* Section Info */}
          {drink.section_name && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Section:</span>
              <span className="px-2 py-1 bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 rounded text-sm font-medium">
                {drink.section_name}
              </span>
            </div>
          )}

          {/* Simple Ingredients (legacy display) */}
          {drink.ingredients.length > 0 && !drink.recipe && (
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

          {/* Full Recipe with Instructions */}
          {drink.recipe && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Recipe
              </h3>
              <RecipeDisplay recipe={drink.recipe} />
            </div>
          )}

          {/* No Recipe Message */}
          {!drink.recipe && drink.ingredients.length === 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                This drink has no recipe or ingredients yet. Click "Edit" to add them.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              onClick={handleEditClick}
              className="flex-1"
            >
              <PencilIcon className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button
              variant="secondary"
              onClick={onClose}
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default AdminDrinkDetailsModal;
