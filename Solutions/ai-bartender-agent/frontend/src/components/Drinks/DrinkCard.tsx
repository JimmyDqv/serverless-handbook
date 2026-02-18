import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Drink } from '../../types';
import { Button } from '../UI';
import { ResponsiveImage } from '../UI/ResponsiveImage';
import { useIsRegistered } from '../../hooks/useIsRegistered';

interface DrinkCardProps {
  drink: Drink;
  onOrderClick: (drink: Drink) => void;
  onDetailsClick: (drink: Drink) => void;
  isOrdering?: boolean;
  orderingDrinkId?: string | null;
}

const DrinkCard: React.FC<DrinkCardProps> = ({
  drink,
  onOrderClick,
  onDetailsClick,
  isOrdering = false,
  orderingDrinkId = null,
}) => {
  const { isRegistered } = useIsRegistered();
  const navigate = useNavigate();

  const isThisDrinkOrdering = isOrdering && orderingDrinkId === drink.id;

  const handleOrderOrRegister = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRegistered) {
      onOrderClick(drink);
    } else {
      navigate('/register');
    }
  };

  // Get ingredient emojis (simplified mapping)
  const getIngredientEmojis = (ingredients: string[]) => {
    const emojiMap: { [key: string]: string } = {
      'vodka': '🍸',
      'gin': '🍸',
      'rum': '🥃',
      'whiskey': '🥃',
      'tequila': '🍹',
      'lime': '🍋',
      'lemon': '🍋',
      'orange': '🍊',
      'mint': '🌿',
      'sugar': '🧂',
      'soda': '🥤',
      'juice': '🧃',
      'beer': '🍺',
      'wine': '🍷',
      'coffee': '☕',
      'cream': '🥛',
    };

    return ingredients
      .slice(0, 3) // Show max 3 emojis
      .map(ingredient => {
        const key = ingredient.toLowerCase();
        return emojiMap[key] || '🍹';
      })
      .join('');
  };

  return (
    <motion.div
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      className="card card-hover overflow-hidden cursor-pointer"
      onClick={() => onDetailsClick(drink)}
    >
      {/* Image Container */}
      <div className="relative">
        <ResponsiveImage
          drinkId={drink.id}
          size="small"
          alt={drink.name}
          className="w-full aspect-[3/4]"
          lazy={true}
          objectFit="cover"
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Ingredient Indicators */}
        <div className="absolute top-3 right-3 text-lg">
          {getIngredientEmojis(drink.ingredients)}
        </div>

        {/* Quick Order Button */}
        <div className="absolute bottom-3 right-3">
          <Button
            size="sm"
            onClick={handleOrderOrRegister}
            className="shadow-lg"
            isLoading={isThisDrinkOrdering}
            loadingText="Ordering..."
            disabled={isOrdering}
          >
            {isRegistered ? 'Order Now' : 'Register to order'}
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1 line-clamp-1">
          {drink.name}
        </h3>
        
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
          {drink.description}
        </p>

        {/* Ingredients */}
        <div className="flex flex-wrap gap-1 mb-3">
          {drink.ingredients.slice(0, 3).map((ingredient, index) => (
            <span
              key={index}
              className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-400 rounded-full"
            >
              {ingredient}
            </span>
          ))}
          {drink.ingredients.length > 3 && (
            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-400 rounded-full">
              +{drink.ingredients.length - 3}
            </span>
          )}
        </div>

        {/* View Details Link */}
        <span className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium transition-colors">
          View Details →
        </span>
      </div>
    </motion.div>
  );
};

export default DrinkCard;