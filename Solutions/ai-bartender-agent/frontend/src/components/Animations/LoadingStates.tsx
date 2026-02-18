import React from 'react';
import { motion } from 'framer-motion';
import { Skeleton } from '../UI';
import { staggerContainer, staggerItem, getAnimationVariants } from '../../utils/animations';

// Loading state for drink grid
export const DrinkGridSkeleton: React.FC<{ count?: number }> = ({ count = 8 }) => {
  return (
    <motion.div
      variants={getAnimationVariants(staggerContainer)}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
    >
      {Array.from({ length: count }).map((_, i) => (
        <motion.div key={i} variants={getAnimationVariants(staggerItem)}>
          <div className="card overflow-hidden">
            <Skeleton className="aspect-square w-full" />
            <div className="p-4 space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <div className="flex space-x-2">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-14 rounded-full" />
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
};

// Loading state for order cards
export const OrderCardSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <motion.div
      variants={getAnimationVariants(staggerContainer)}
      initial="hidden"
      animate="visible"
      className="space-y-4"
    >
      {Array.from({ length: count }).map((_, i) => (
        <motion.div key={i} variants={getAnimationVariants(staggerItem)}>
          <div className="card p-4">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1 space-y-2">
                <div className="flex items-center space-x-3">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <div className="flex items-center space-x-4">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
              <Skeleton className="h-16 w-16 rounded-lg" />
            </div>
            <div className="flex space-x-2">
              <Skeleton className="h-10 flex-1 rounded-lg" />
              <Skeleton className="h-10 w-20 rounded-lg" />
            </div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
};

// Loading state for admin drinks
export const AdminDrinksSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => {
  return (
    <motion.div
      variants={getAnimationVariants(staggerContainer)}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
    >
      {Array.from({ length: count }).map((_, i) => (
        <motion.div key={i} variants={getAnimationVariants(staggerItem)}>
          <div className="card overflow-hidden">
            <Skeleton className="aspect-square w-full" />
            <div className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-12 rounded-full" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <div className="flex space-x-2">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-14 rounded-full" />
              </div>
              <div className="flex space-x-2 pt-2">
                <Skeleton className="h-8 flex-1 rounded-lg" />
                <Skeleton className="h-8 w-12 rounded-lg" />
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
};

// Shimmer effect component
export const ShimmerEffect: React.FC<{ className?: string }> = ({ 
  className = '' 
}) => {
  return (
    <div className={`skeleton-shimmer ${className}`}>
      <Skeleton className="w-full h-full" shimmer />
    </div>
  );
};