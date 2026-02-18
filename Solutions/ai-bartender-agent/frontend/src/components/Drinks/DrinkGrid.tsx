import React from 'react';
import { motion } from 'framer-motion';
import { Drink } from '../../types';
import DrinkCard from './DrinkCard';
import { DrinkGridSkeleton } from '../Animations/LoadingStates';
import { NoDrinksEmptyState } from '../UI/EmptyState';
import { staggerContainer, staggerItem, getAnimationVariants } from '../../utils/animations';

interface DrinkGridProps {
  drinks: Drink[];
  isLoading: boolean;
  onOrderClick: (drink: Drink) => void;
  onDetailsClick: (drink: Drink) => void;
  onRefresh?: () => void;
}

const DrinkGrid: React.FC<DrinkGridProps> = ({
  drinks,
  isLoading,
  onOrderClick,
  onDetailsClick,
  onRefresh,
}) => {
  if (isLoading) {
    return <DrinkGridSkeleton />;
  }

  if (drinks.length === 0) {
    return <NoDrinksEmptyState onRefresh={onRefresh} />;
  }

  return (
    <motion.div
      variants={getAnimationVariants(staggerContainer)}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
    >
      {drinks.map((drink) => (
        <motion.div
          key={drink.id}
          variants={getAnimationVariants(staggerItem)}
        >
          <DrinkCard
            drink={drink}
            onOrderClick={onOrderClick}
            onDetailsClick={onDetailsClick}
          />
        </motion.div>
      ))}
    </motion.div>
  );
};

export default DrinkGrid;