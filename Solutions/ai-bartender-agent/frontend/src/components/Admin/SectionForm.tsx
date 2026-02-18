import React, { useState, useEffect } from 'react';
import { Section, CreateSectionRequest, UpdateSectionRequest } from '../../types';
import { Modal, Input, LoadingButton } from '../UI';

interface SectionFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateSectionRequest | UpdateSectionRequest) => Promise<void>;
  section?: Section | null;
  isLoading?: boolean;
  existingSections: Section[];
}

interface FormData {
  name: string;
  display_order: number;
}

const SectionForm: React.FC<SectionFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  section,
  isLoading = false,
  existingSections,
}) => {
  const isEditing = !!section;

  const [formData, setFormData] = useState<FormData>({
    name: '',
    display_order: 1,
  });

  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  // Reset form when modal opens/closes or section changes
  useEffect(() => {
    if (isOpen) {
      if (section) {
        setFormData({
          name: section.name,
          display_order: section.display_order,
        });
      } else {
        // For new sections, suggest next display order
        const maxOrder = existingSections.reduce(
          (max, s) => Math.max(max, s.display_order),
          0
        );
        setFormData({
          name: '',
          display_order: maxOrder + 1,
        });
      }
      setErrors({});
    }
  }, [isOpen, section, existingSections]);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (formData.name.length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    } else if (formData.name.length > 100) {
      newErrors.name = 'Name must be at most 100 characters';
    }

    if (formData.display_order < 1) {
      newErrors.display_order = 'Display order must be at least 1';
    }

    // Check for duplicate display order (excluding current section when editing)
    const isDuplicateOrder = existingSections.some(
      s => s.display_order === formData.display_order && (!section || s.id !== section.id)
    );
    if (isDuplicateOrder) {
      newErrors.display_order = 'This display order is already in use';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      if (isEditing && section) {
        await onSubmit({
          id: section.id,
          name: formData.name.trim(),
          display_order: formData.display_order,
        } as UpdateSectionRequest);
      } else {
        await onSubmit({
          name: formData.name.trim(),
          display_order: formData.display_order,
        } as CreateSectionRequest);
      }
      onClose();
    } catch (error) {
      // Error is handled by the hook with toast
      console.error('Form submission error:', error);
    }
  };

  const handleChange = (field: keyof FormData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
    // Clear error when field is modified
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined,
      }));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Section' : 'Create New Section'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Name"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          error={errors.name}
          placeholder="e.g., Classic Cocktails"
          required
          disabled={isLoading}
        />

        <Input
          label="Display Order"
          type="number"
          value={formData.display_order.toString()}
          onChange={(e) => handleChange('display_order', parseInt(e.target.value) || 1)}
          error={errors.display_order}
          min={1}
          required
          disabled={isLoading}
        />

        <div className="text-xs text-gray-500 dark:text-gray-400">
          Sections are displayed in ascending order by this number.
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <LoadingButton
            type="submit"
            isLoading={isLoading}
            loadingText={isEditing ? 'Updating...' : 'Creating...'}
          >
            {isEditing ? 'Update Section' : 'Create Section'}
          </LoadingButton>
        </div>
      </form>
    </Modal>
  );
};

export default SectionForm;
