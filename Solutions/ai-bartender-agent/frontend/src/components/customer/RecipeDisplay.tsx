import React from 'react';
import { DrinkRecipe } from '../../types';

interface RecipeDisplayProps {
  recipe: DrinkRecipe | null;
}

export const RecipeDisplay: React.FC<RecipeDisplayProps> = ({ recipe }) => {
  if (!recipe) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Quick Info */}
      <div className="flex gap-2 flex-wrap">
        {recipe.preparation_time && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {recipe.preparation_time} min
          </span>
        )}
        {recipe.glassware && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            {recipe.glassware}
          </span>
        )}
      </div>

      {/* Ingredients */}
      <div>
        <h4 className="font-semibold text-lg mb-2 text-gray-900 dark:text-white">
          Ingredienser
        </h4>
        <ul className="space-y-1">
          {recipe.ingredients.map((ingredient, index) => (
            <li key={index} className="flex items-center text-gray-700 dark:text-gray-300">
              <span className="mr-2">•</span>
              <span className="font-medium mr-2">
                {ingredient.amount}
              </span>
              <span>{ingredient.name}</span>
              {ingredient.optional && (
                <span className="ml-2 text-xs px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                  Valfri
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <hr className="border-gray-200 dark:border-gray-700" />

      {/* Preparation Steps */}
      <div>
        <h4 className="font-semibold text-lg mb-2 text-gray-900 dark:text-white">
          Instruktioner
        </h4>
        <ol className="space-y-2">
          {recipe.steps.map((step, index) => (
            <li key={index} className="flex items-start">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 font-semibold text-sm mr-3 flex-shrink-0">
                {step.order}
              </span>
              <span className="text-gray-700 dark:text-gray-300">
                {step.instruction}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {/* Garnish */}
      {recipe.garnish && (
        <>
          <hr className="border-gray-200 dark:border-gray-700" />
          <div>
            <h5 className="font-medium text-sm text-gray-500 dark:text-gray-400 mb-1">
              Garnering
            </h5>
            <p className="text-gray-700 dark:text-gray-300">
              {recipe.garnish}
            </p>
          </div>
        </>
      )}
    </div>
  );
};
