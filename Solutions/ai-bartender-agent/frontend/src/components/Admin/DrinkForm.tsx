import React, { useState, useEffect } from 'react';
import { Drink, CreateDrinkRequest, UpdateDrinkRequest, DrinkRecipe } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import { useSections } from '../../hooks/useSections';
import { useFormValidation } from '../../hooks/useFormValidation';
import { useImageUpload } from '../../hooks/useImageUpload';
import { Modal, Input, LoadingButton, FormLoadingOverlay } from '../UI';
import { RecipeEditor } from './RecipeEditor';
import { ImageUploader } from './ImageUploader';
import { SectionSelect } from '../UI/SectionSelect';

interface DrinkFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateDrinkRequest | UpdateDrinkRequest) => Promise<void>;
  drink?: Drink | null;
  isLoading?: boolean;
}

interface FormData {
  name: string;
  section_id: string;
  description: string;
  ingredients: string[];
  image_url: string;
  recipe: DrinkRecipe | null;
}

const DrinkForm: React.FC<DrinkFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  drink,
  isLoading = false,
}) => {
  const { showError } = useToast();
  const { sections } = useSections();
  const { uploadImage, isUploading, progress, error: uploadError, reset: resetUpload } = useImageUpload();
  
  const [ingredientInput, setIngredientInput] = useState('');
  const [recipe, setRecipe] = useState<DrinkRecipe | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [pendingImageKey, setPendingImageKey] = useState<string | null>(null);

  const initialValues: FormData = {
    name: '',
    section_id: '',
    description: '',
    ingredients: [],
    image_url: '',
    recipe: null,
  };

  const validationRules = {
    name: { required: true, minLength: 2, maxLength: 200 },
    section_id: { required: true },
    description: { required: true, minLength: 10, maxLength: 1000 },
    ingredients: { 
      required: true,
      custom: (value: string[]) => {
        if (!Array.isArray(value) || value.length === 0) {
          return 'At least one ingredient is required';
        }
        return null;
      }
    },
    image_url: {
      pattern: /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/,
      custom: (value: string) => {
        if (value && !value.match(/^https?:\/\//)) {
          return 'Image URL must start with http:// or https://';
        }
        return null;
      }
    }
  };

  const {
    values,
    errors,
    touched,
    isValid,
    isSubmitting,
    setValue,
    setValues,
    setTouched,
    handleSubmit,
    reset
  } = useFormValidation(initialValues, validationRules);

  // Initialize form data when drink changes or modal opens
  useEffect(() => {
    if (isOpen) {
      if (drink) {
        setValues({
          name: drink.name,
          section_id: drink.section_id,
          description: drink.description,
          ingredients: [...drink.ingredients],
          image_url: drink.image_url || '',
          recipe: drink.recipe || null,
        });
        setRecipe(drink.recipe || null);
      } else {
        reset();
        setRecipe(null);
      }
      setIngredientInput('');
      setSelectedImage(null);
      setPendingImageKey(null);
      resetUpload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drink?.id, isOpen]);

  const handleRecipeChange = (newRecipe: DrinkRecipe | null) => {
    setRecipe(newRecipe);
    setValue('recipe', newRecipe);
  };

  const handleImageSelect = (file: File) => {
    setSelectedImage(file);
  };

  const handleImageRemove = () => {
    setSelectedImage(null);
    setPendingImageKey(null);
    setValue('image_url', '');
    resetUpload();
  };

  const onFormSubmit = async (formData: FormData) => {
    try {
      // Upload image first if selected
      let imageKey = pendingImageKey;
      if (selectedImage && !imageKey) {
        const tempDrinkId = drink?.id || `temp-${Date.now()}`;
        imageKey = await uploadImage(selectedImage, tempDrinkId);
        setPendingImageKey(imageKey);
      }
      
      const submitData = drink 
        ? { ...formData, id: drink.id, recipe, image_url: imageKey || formData.image_url } as UpdateDrinkRequest
        : { ...formData, recipe, image_url: imageKey || formData.image_url } as CreateDrinkRequest;
      
      await onSubmit(submitData);
      onClose();
      reset();
      setRecipe(null);
    } catch (error: any) {
      showError('Form submission failed', error.message || 'Please try again');
    }
  };

  const addIngredient = () => {
    const ingredient = ingredientInput.trim();
    if (ingredient && !values.ingredients.includes(ingredient)) {
      setValue('ingredients', [...values.ingredients, ingredient]);
      setIngredientInput('');
    }
  };

  const removeIngredient = (index: number) => {
    setValue('ingredients', values.ingredients.filter((_, i) => i !== index));
  };

  const handleIngredientKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addIngredient();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={drink ? 'Edit Drink' : 'Add Drink'}
      size="lg"
    >
      <div className="relative">
        <FormLoadingOverlay isLoading={isSubmitting} message="Saving drink..." />
        
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
          {/* Names */}
          <div>
            <Input
              label="Name"
              value={values.name}
              onChange={(e) => setValue('name', e.target.value)}
              onBlur={() => setTouched('name')}
              error={touched.name ? errors.name : undefined}
              required
              leftIcon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              }
            />
          </div>

          {/* Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Section <span className="text-error">*</span>
            </label>
            <SectionSelect
              sections={sections}
              value={values.section_id}
              onChange={(sectionId) => setValue('section_id', sectionId)}
              onBlur={() => setTouched('section_id')}
              error={touched.section_id && errors.section_id ? errors.section_id : undefined}
              required
            />
            {touched.section_id && errors.section_id && (
              <p className="text-sm text-error mt-1 flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {errors.section_id}
              </p>
            )}
          </div>

          {/* Descriptions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description <span className="text-error">*</span>
            </label>
            <textarea
              value={values.description}
              onChange={(e) => setValue('description', e.target.value)}
              onBlur={() => setTouched('description')}
              className={`input ${touched.description && errors.description ? 'border-error focus:border-error focus:ring-error/20' : ''}`}
              rows={3}
              required
            />
            {touched.description && errors.description && (
              <p className="text-sm text-error mt-1 flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {errors.description}
              </p>
            )}
          </div>

          {/* Ingredients */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Ingredients <span className="text-error">*</span>
            </label>
            <div className="flex space-x-2 mb-2">
              <input
                type="text"
                value={ingredientInput}
                onChange={(e) => setIngredientInput(e.target.value)}
                onKeyPress={handleIngredientKeyPress}
                className="input flex-1"
                placeholder="Add an ingredient..."
              />
              <LoadingButton
                type="button"
                onClick={addIngredient}
                variant="secondary"
                size="sm"
                disabled={!ingredientInput.trim()}
              >
                Add
              </LoadingButton>
            </div>
            
            {/* Ingredient List */}
            <div className="flex flex-wrap gap-2 mb-2">
              {values.ingredients.map((ingredient, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-3 py-1 bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 rounded-full text-sm"
                >
                  {ingredient}
                  <button
                    type="button"
                    onClick={() => removeIngredient(index)}
                    className="ml-2 text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-200 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded"
                    aria-label={`Remove ${ingredient}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            
            {touched.ingredients && errors.ingredients && (
              <p className="text-sm text-error flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {errors.ingredients}
              </p>
            )}
          </div>

          {/* Image Upload */}
          <ImageUploader
            currentImageUrl={values.image_url}
            onImageSelect={handleImageSelect}
            onImageRemove={handleImageRemove}
            isUploading={isUploading}
            uploadProgress={progress?.percentage}
            error={uploadError}
          />

          {/* Recipe Editor */}
          <RecipeEditor
            recipe={recipe}
            onChange={handleRecipeChange}
          />

          {/* Actions */}
          <div className="flex space-x-3 pt-4">
            <div className="flex-1 relative group">
              <LoadingButton
                type="submit"
                isLoading={isSubmitting || isUploading}
                loadingText={isUploading ? 'Uploading image...' : (drink ? 'Updating...' : 'Creating...')}
                className="w-full"
                disabled={!isValid || isUploading}
              >
                {drink ? 'Update Drink' : 'Create Drink'}
              </LoadingButton>
              {!isValid && (
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                  <div className="text-xs font-medium mb-1">Required fields missing:</div>
                  <ul className="text-xs list-disc list-inside">
                    {!values.name && <li>Name</li>}
                    {!values.section_id && <li>Section</li>}
                    {(!values.description || values.description.length < 10) && <li>Description - at least 10 characters</li>}
                    {values.ingredients.length === 0 && <li>At least one ingredient</li>}
                  </ul>
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
                </div>
              )}
            </div>
            <LoadingButton
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </LoadingButton>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default DrinkForm;