import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAdminDrinks } from '../hooks/useAdminDrinks';
import { useSections } from '../hooks/useSections';
import { Drink, CreateDrinkRequest, UpdateDrinkRequest, Section } from '../types';
import { Button, Card, SkeletonCard, ConfirmDialog, Tooltip } from '../components/UI';
import DrinkForm from '../components/Admin/DrinkForm';
import AdminDrinkDetailsModal from '../components/Admin/AdminDrinkDetailsModal';
import DrinkSearchInput from '../components/Admin/DrinkSearchInput';
import AdminSectionNavigation from '../components/Admin/AdminSectionNavigation';
import { PencilIcon, TrashIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

const AdminDrinksPage: React.FC = () => {
  const { drinks, isLoading: drinksLoading, createDrink, updateDrink, deleteDrink } = useAdminDrinks();
  const { sections, isLoading: sectionsLoading } = useSections();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDrink, setEditingDrink] = useState<Drink | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState<string | null>(null);

  // Delete confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [drinkToDelete, setDrinkToDelete] = useState<Drink | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Drink details modal state
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedDrink, setSelectedDrink] = useState<Drink | null>(null);

  // Toggle active state
  const [togglingDrinkId, setTogglingDrinkId] = useState<string | null>(null);

  // Section refs for scroll detection
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());

  const isLoading = drinksLoading || sectionsLoading;

  // Filter drinks by search query
  const filteredDrinks = useMemo(() => {
    if (!searchQuery.trim()) return drinks;
    const query = searchQuery.toLowerCase();
    return drinks.filter((drink) =>
      drink.name.toLowerCase().includes(query)
    );
  }, [drinks, searchQuery]);

  // Group drinks by section
  const drinksBySection = useMemo(() => {
    const groups: { section: Section; drinks: Drink[] }[] = [];

    sections.forEach((section) => {
      const sectionDrinks = filteredDrinks.filter(
        (drink) => drink.section_id === section.id
      );
      if (sectionDrinks.length > 0) {
        groups.push({ section, drinks: sectionDrinks });
      }
    });

    return groups;
  }, [sections, filteredDrinks]);

  // Create drink count map for navigation
  const drinkCounts = useMemo(() => {
    const counts = new Map<string, number>();
    drinksBySection.forEach(({ section, drinks }) => {
      counts.set(section.id, drinks.length);
    });
    return counts;
  }, [drinksBySection]);

  // Intersection Observer to detect active section
  useEffect(() => {
    if (searchQuery) {
      setActiveSection(null);
      return;
    }

    const observers = new Map<string, IntersectionObserver>();

    drinksBySection.forEach(({ section }) => {
      const element = sectionRefs.current.get(section.id);
      if (!element) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActiveSection(section.id);
          }
        },
        {
          rootMargin: '-120px 0px -70% 0px',
          threshold: 0,
        }
      );

      observer.observe(element);
      observers.set(section.id, observer);
    });

    return () => {
      observers.forEach((observer) => observer.disconnect());
    };
  }, [drinksBySection, searchQuery]);

  const scrollToSection = (sectionId: string) => {
    const element = sectionRefs.current.get(sectionId);
    if (element) {
      const offset = 140; // Account for sticky header + nav
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
    }
  };

  const handleCreateDrink = () => {
    setEditingDrink(null);
    setIsFormOpen(true);
  };

  const handleEditDrink = (drink: Drink) => {
    setEditingDrink(drink);
    setIsFormOpen(true);
  };

  const handleDeleteDrink = (drink: Drink) => {
    setDrinkToDelete(drink);
    setDeleteConfirmOpen(true);
  };

  const handleViewDrink = (drink: Drink) => {
    setSelectedDrink(drink);
    setDetailsModalOpen(true);
  };

  const handleEditFromDetails = (drink: Drink) => {
    setDetailsModalOpen(false);
    setSelectedDrink(null);
    handleEditDrink(drink);
  };

  const handleToggleActive = async (drink: Drink) => {
    setTogglingDrinkId(drink.id);
    try {
      await updateDrink({
        id: drink.id,
        is_active: !drink.is_active,
      });
    } catch (error) {
      console.error('Toggle error:', error);
    } finally {
      setTogglingDrinkId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!drinkToDelete) return;

    setIsDeleting(true);
    try {
      await deleteDrink(drinkToDelete.id);
      setDeleteConfirmOpen(false);
      setDrinkToDelete(null);
    } catch (error: any) {
      console.error('Delete error:', error);
      setDeleteConfirmOpen(false);
      setDrinkToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFormSubmit = async (data: CreateDrinkRequest | UpdateDrinkRequest) => {
    setIsSubmitting(true);
    try {
      if ('id' in data) {
        await updateDrink(data);
      } else {
        await createDrink(data);
      }
      setIsFormOpen(false);
      setEditingDrink(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render a drink card
  const renderDrinkCard = (drink: Drink) => (
    <Card
      key={drink.id}
      className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
      onClick={() => handleViewDrink(drink)}
    >
      {/* Image */}
      <div className="aspect-square bg-gray-100 dark:bg-gray-700">
        {drink.image_url ? (
          <img
            src={drink.image_url}
            alt={drink.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-4xl">
            🍹
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 line-clamp-1">
            {drink.name}
          </h3>
          <div className={`px-2 py-1 rounded-full text-xs ${
            drink.is_active
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
          }`}>
            {drink.is_active ? 'Active' : 'Inactive'}
          </div>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
          {drink.description}
        </p>

        {/* Ingredients */}
        <div className="flex flex-wrap gap-1 mb-4">
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

        {/* Actions */}
        <div className="flex space-x-2" onClick={(e) => e.stopPropagation()}>
          <Tooltip content={drink.is_active ? 'Hide from guests' : 'Show to guests'}>
            <Button
              size="sm"
              variant={drink.is_active ? 'secondary' : 'primary'}
              onClick={() => handleToggleActive(drink)}
              disabled={togglingDrinkId === drink.id}
            >
              {togglingDrinkId === drink.id ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : drink.is_active ? (
                <EyeSlashIcon className="h-4 w-4" />
              ) : (
                <EyeIcon className="h-4 w-4" />
              )}
            </Button>
          </Tooltip>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleEditDrink(drink)}
            className="flex-1"
          >
            <PencilIcon className="h-4 w-4 mr-1" />
            Edit
          </Button>
          <Tooltip content="Delete drink">
            <Button
              size="sm"
              variant="danger"
              onClick={() => handleDeleteDrink(drink)}
            >
              <TrashIcon className="h-4 w-4" />
            </Button>
          </Tooltip>
        </div>
      </div>
    </Card>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-h1 text-gray-900 dark:text-gray-100 mb-1">
            Manage Drinks
            <span className="ml-2 text-base font-normal text-amber-600 dark:text-amber-400">(Admin)</span>
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your drink catalog
          </p>
        </div>

        <Button onClick={handleCreateDrink}>
          Add Drink
        </Button>
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <DrinkSearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search drinks..."
        />
      </div>

      {/* Section Navigation */}
      {!searchQuery && drinksBySection.length > 0 && (
        <div className="mb-6 sticky top-14 md:top-16 z-20 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm py-3 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <AdminSectionNavigation
            sections={sections}
            activeSection={activeSection}
            onSectionClick={scrollToSection}
            drinkCounts={drinkCounts}
          />
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : drinks.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="text-4xl mb-4">🍹</div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            No drinks yet
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Start building your drink catalog by adding your first drink.
          </p>
          <Button onClick={handleCreateDrink}>
            Add Drink
          </Button>
        </Card>
      ) : filteredDrinks.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="text-4xl mb-4">🔍</div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            No drinks found
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            No drinks match the search "{searchQuery}"
          </p>
          <Button variant="secondary" onClick={() => setSearchQuery('')}>
            Clear search
          </Button>
        </Card>
      ) : searchQuery ? (
        // Search results - flat grid without sections
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {filteredDrinks.length} results for "{searchQuery}"
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDrinks.map(renderDrinkCard)}
          </div>
        </div>
      ) : (
        // Grouped by section
        <div className="space-y-2">
          {drinksBySection.map(({ section, drinks: sectionDrinks }) => (
            <section
              key={section.id}
              id={`section-${section.id}`}
              ref={(el) => {
                if (el) sectionRefs.current.set(section.id, el);
              }}
              className="scroll-mt-36"
            >
              {/* Admin-styled Section Divider */}
              <div className="sticky top-28 md:top-32 z-10 bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 text-white shadow-lg -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 py-4 mb-6 rounded-lg">
                <h2 className="text-2xl font-bold">
                  {section.name}
                  <span className="ml-3 text-sm font-normal opacity-90">
                    {sectionDrinks.length} {sectionDrinks.length === 1 ? 'drink' : 'drinks'}
                  </span>
                </h2>
              </div>

              {/* Drinks Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                {sectionDrinks.map(renderDrinkCard)}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Drink Form Modal */}
      <DrinkForm
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingDrink(null);
        }}
        onSubmit={handleFormSubmit}
        drink={editingDrink}
        isLoading={isSubmitting}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setDrinkToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Delete drink"
        message={`Are you sure you want to delete "${drinkToDelete ? drinkToDelete.name : ''}"?\n\nThis action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        isLoading={isDeleting}
      />

      {/* Drink Details Modal */}
      <AdminDrinkDetailsModal
        drink={selectedDrink}
        isOpen={detailsModalOpen}
        onClose={() => {
          setDetailsModalOpen(false);
          setSelectedDrink(null);
        }}
        onEditClick={handleEditFromDetails}
      />
    </div>
  );
};

export default AdminDrinksPage;
