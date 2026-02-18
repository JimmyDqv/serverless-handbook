import React, { useState, useEffect } from 'react';
import { useAdminSections } from '../hooks/useAdminSections';
import { useAdminDrinks } from '../hooks/useAdminDrinks';
import { Section, CreateSectionRequest, UpdateSectionRequest } from '../types';
import { Button, Card, Skeleton, ConfirmDialog, Tooltip } from '../components/UI';
import SectionForm from '../components/Admin/SectionForm';
import { PencilIcon, TrashIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const AdminSectionsPage: React.FC = () => {
  const { sections, isLoading, createSection, updateSection, deleteSection, refetch } = useAdminSections();
  const { drinks } = useAdminDrinks();
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Delete confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [sectionToDelete, setSectionToDelete] = useState<Section | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [drinkCountInSection, setDrinkCountInSection] = useState(0);

  const handleCreateSection = () => {
    setEditingSection(null);
    setIsFormOpen(true);
  };

  const handleEditSection = (section: Section) => {
    setEditingSection(section);
    setIsFormOpen(true);
  };

  const handleDeleteClick = (section: Section) => {
    // Count drinks in this section
    const count = drinks.filter(drink => drink.section_id === section.id).length;
    setDrinkCountInSection(count);
    
    // If section has drinks, show error immediately
    if (count > 0) {
      toast.error(
        `Cannot delete section "${section.name}" because it contains ${count} drink${count !== 1 ? 's' : ''}. Please move or delete the drinks first.`,
        { duration: 6000 }
      );
      return;
    }
    
    setSectionToDelete(section);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!sectionToDelete) return;
    
    setIsDeleting(true);
    try {
      await deleteSection(sectionToDelete.id);
      setDeleteConfirmOpen(false);
      setSectionToDelete(null);
    } catch (error: any) {
      console.error('Delete error:', error);
      // Error toast is already shown in the hook
      setDeleteConfirmOpen(false);
      setSectionToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFormSubmit = async (data: CreateSectionRequest | UpdateSectionRequest) => {
    setIsSubmitting(true);
    try {
      if ('id' in data) {
        await updateSection(data);
      } else {
        await createSection(data);
      }
      setIsFormOpen(false);
      setEditingSection(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSectionName = (section: Section) => {
    return section.name;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-h1 text-gray-900 dark:text-gray-100 mb-2">
            Section Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Organize your drinks into sections (categories)
          </p>
        </div>
        
        <div className="flex gap-3">
          <Tooltip content="Refresh sections">
            <Button
              variant="secondary"
              onClick={async () => {
                setIsRefreshing(true);
                await refetch();
                setIsRefreshing(false);
              }}
              disabled={isRefreshing}
              className="!px-3 !bg-blue-500 hover:!bg-blue-600 !text-white !border-blue-500 hover:!border-blue-600 disabled:!bg-blue-400 disabled:!border-blue-400"
            >
              <ArrowPathIcon
                className={`w-5 h-5 transition-transform duration-500 ${
                  isRefreshing ? 'animate-spin' : 'group-hover:rotate-180'
                }`}
              />
            </Button>
          </Tooltip>
          <Button onClick={handleCreateSection}>
            Add Section
          </Button>
        </div>
      </div>

      {/* Sections List */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 flex items-center gap-3">
                  <Skeleton className="w-8 h-8 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-64" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-16 rounded-lg" />
                  <Skeleton className="h-8 w-8 rounded-lg" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : sections.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="text-4xl mb-4">📂</div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            No Sections Yet
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Create sections to organize your drinks into categories.
          </p>
          <Button onClick={handleCreateSection}>
            Add Section
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {sections.map((section) => (
            <Card key={section.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400 text-sm font-medium">
                      {section.display_order}
                    </span>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                        {getSectionName(section)}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {section.name}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 ml-11">
                    Created: {formatDate(section.created_at)}
                    {section.updated_at !== section.created_at && (
                      <> • Updated: {formatDate(section.updated_at)}</>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleEditSection(section)}
                  >
                    <PencilIcon className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Tooltip content="Delete section">
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleDeleteClick(section)}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </Tooltip>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Info Card */}
      <Card className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
          💡 About Sections
        </h3>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
          <li>Sections are displayed in order by their display order number</li>
          <li>Each section needs a name</li>
          <li>Sections with drinks cannot be deleted - remove drinks first</li>
          <li>Display order must be unique for each section</li>
        </ul>
      </Card>

      {/* Section Form Modal */}
      <SectionForm
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingSection(null);
        }}
        onSubmit={handleFormSubmit}
        section={editingSection}
        isLoading={isSubmitting}
        existingSections={sections}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setSectionToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Delete section"
        message={`Are you sure you want to delete the section "${sectionToDelete ? sectionToDelete.name : ''}"?\n\nThis action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};

export default AdminSectionsPage;
