import React from 'react';
import { DrinkRecipe, RecipeIngredient, RecipeStep } from '../../types';
import { Button, Input } from '../UI';

interface RecipeEditorProps {
  recipe: DrinkRecipe | null;
  onChange: (recipe: DrinkRecipe | null) => void;
}

const emptyIngredient = (): RecipeIngredient => ({
  name: '',
  amount: '',
  optional: false,
});

const emptyStep = (order: number): RecipeStep => ({
  order,
  instruction: '',
});

const emptyRecipe = (): DrinkRecipe => ({
  ingredients: [emptyIngredient()],
  steps: [emptyStep(1)],
  garnish: '',
  glassware: '',
  preparation_time: undefined,
});

export const RecipeEditor: React.FC<RecipeEditorProps> = ({
  recipe,
  onChange,
}) => {
  const currentRecipe = recipe || emptyRecipe();

  const updateRecipe = (updates: Partial<DrinkRecipe>) => {
    onChange({ ...currentRecipe, ...updates });
  };

  // Ingredient handlers
  const addIngredient = () => {
    const newRecipe = {
      ...currentRecipe,
      ingredients: [...currentRecipe.ingredients, emptyIngredient()],
    };
    onChange(newRecipe);
  };

  const removeIngredient = (index: number) => {
    const newRecipe = {
      ...currentRecipe,
      ingredients: currentRecipe.ingredients.filter((_, i) => i !== index),
    };
    onChange(newRecipe);
  };

  const updateIngredient = (index: number, field: keyof RecipeIngredient, value: string | boolean) => {
    const newIngredients = [...currentRecipe.ingredients];
    newIngredients[index] = { ...newIngredients[index], [field]: value };
    updateRecipe({ ingredients: newIngredients });
  };

  // Step handlers
  const addStep = () => {
    const nextOrder = currentRecipe.steps.length + 1;
    const newRecipe = {
      ...currentRecipe,
      steps: [...currentRecipe.steps, emptyStep(nextOrder)],
    };
    onChange(newRecipe);
  };

  const removeStep = (index: number) => {
    const newSteps = currentRecipe.steps
      .filter((_, i) => i !== index)
      .map((step, i) => ({ ...step, order: i + 1 }));
    
    const newRecipe = { ...currentRecipe, steps: newSteps };
    onChange(newRecipe);
  };

  const updateStep = (index: number, field: keyof RecipeStep, value: string | number) => {
    const newSteps = [...currentRecipe.steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    updateRecipe({ steps: newSteps });
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recipe (optional)</h3>

      {/* Ingredients Section */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h4 className="font-medium text-gray-900 dark:text-white">Ingredients</h4>
          <Button type="button" variant="secondary" onClick={addIngredient}>
            + Add ingredient
          </Button>
        </div>

        <div className="space-y-3">
          {currentRecipe.ingredients.map((ingredient, index) => (
            <div key={index} className="bg-white dark:bg-gray-700 rounded p-3 border border-gray-200 dark:border-gray-600">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                <Input
                  label="Name"
                  value={ingredient.name}
                  onChange={(e) => updateIngredient(index, 'name', e.target.value)}
                />
                <Input
                  label="Amount"
                  value={ingredient.amount}
                  onChange={(e) => updateIngredient(index, 'amount', e.target.value)}
                  placeholder="5 cl, 2 dashes, etc."
                />
              </div>
              <div className="flex justify-between items-center">
                <label className="flex items-center text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={ingredient.optional}
                    onChange={(e) => updateIngredient(index, 'optional', e.target.checked)}
                    className="mr-2 rounded"
                  />
                  Optional
                </label>
                <button
                  type="button"
                  onClick={() => removeIngredient(index)}
                  className="text-sm text-red-600 hover:text-red-700 dark:text-red-400"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Steps Section */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h4 className="font-medium text-gray-900 dark:text-white">Preparation steps</h4>
          <Button type="button" variant="secondary" onClick={addStep}>
            + Add step
          </Button>
        </div>

        <div className="space-y-3">
          {currentRecipe.steps.map((step, index) => (
            <div key={index} className="bg-white dark:bg-gray-700 rounded p-3 border border-gray-200 dark:border-gray-600">
              <div className="flex items-start gap-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 font-semibold text-sm flex-shrink-0 mt-2">
                  {step.order}
                </span>
                <div className="flex-1">
                  <textarea
                    value={step.instruction}
                    onChange={(e) => updateStep(index, 'instruction', e.target.value)}
                    placeholder="Instruction"
                    rows={2}
                    className="input w-full text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeStep(index)}
                  className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 mt-2"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Optional details */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 dark:text-white mb-4">Optional details</h4>
        
        <div className="space-y-3">
          <Input
            label="Garnish"
            value={currentRecipe.garnish || ''}
            onChange={(e) => updateRecipe({ garnish: e.target.value })}
            placeholder="Lime wedge, mint sprig, etc."
          />

          <Input
            label="Glass"
            value={currentRecipe.glassware || ''}
            onChange={(e) => updateRecipe({ glassware: e.target.value })}
            placeholder="Highball, rocks, coupe, etc."
          />

          <div className="max-w-xs">
            <Input
              label="Preparation time (minutes)"
              type="number"
              value={currentRecipe.preparation_time?.toString() || ''}
              onChange={(e) => {
                const value = parseInt(e.target.value) || undefined;
                updateRecipe({ preparation_time: value });
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
