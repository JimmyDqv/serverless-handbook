import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import { useNetworkError } from '../hooks/useNetworkError';
import { useDrinks } from '../hooks/useDrinks';
import { useSections } from '../hooks/useSections';
import { useAuth } from '../hooks/useAuth';
import { Drink } from '../types';
import { ordersApi } from '../services/api';
import GroupedDrinksView from '../components/Drinks/GroupedDrinksView';
import IngredientFilter from '../components/Drinks/IngredientFilter';
import DrinkDetailsModal from '../components/Drinks/DrinkDetailsModal';
import { PageTransition } from '../components/Animations';

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const { executeWithRetry, handleNetworkError } = useNetworkError();
  const { ensureValidToken, userKey } = useAuth();
  const [selectedDrink, setSelectedDrink] = useState<Drink | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isOrdering, setIsOrdering] = useState(false);
  const [orderingDrinkId, setOrderingDrinkId] = useState<string | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | undefined>();
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);

  const { sections, isLoading: sectionsLoading } = useSections();
  const { drinks, isLoading: drinksLoading } = useDrinks();

  // Notify parent layout of active section changes
  useEffect(() => {
    if (activeSectionId) {
      const event = new CustomEvent('activeSectionChange', { detail: activeSectionId });
      window.dispatchEvent(event);
    }
  }, [activeSectionId]);

  // Filter drinks by selected ingredients
  const filteredDrinks = useMemo(() => {
    if (selectedIngredients.length === 0) return drinks;
    
    return drinks.filter((drink) =>
      selectedIngredients.every((ingredient) =>
        drink.ingredients.includes(ingredient)
      )
    );
  }, [drinks, selectedIngredients]);

  // Group drinks by section
  const drinksBySection = useMemo(() => {
    const map = new Map<string, Drink[]>();
    
    sections.forEach((section) => {
      const sectionDrinks = filteredDrinks.filter(
        (drink) => drink.section_id === section.id
      );
      if (sectionDrinks.length > 0) {
        map.set(section.id, sectionDrinks);
      }
    });
    
    return map;
  }, [sections, filteredDrinks]);

  // Generate or get session ID for anonymous users (fallback for users without registration)
  const getSessionId = () => {
    // If user is authenticated, use their user_key
    if (userKey) {
      return userKey;
    }
    
    // Fallback to anonymous session for non-registered users
    let sessionId = localStorage.getItem('ai-bartender-session-id');
    if (!sessionId) {
      // Use cryptographically secure random UUID
      sessionId = `guest-${crypto.randomUUID()}`;
      localStorage.setItem('ai-bartender-session-id', sessionId);
    }
    return sessionId;
  };

  const handleOrderClick = async (drink: Drink) => {
    if (isOrdering) return;

    // Check if user is registered before attempting to order
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      navigate('/register');
      return;
    }

    try {
      setIsOrdering(true);
      setOrderingDrinkId(drink.id);

      // Ensure we have a valid token before making the order
      const hasValidToken = await ensureValidToken();
      if (!hasValidToken) {
        navigate('/register');
        return;
      }
      
      const sessionId = getSessionId();
      
      const order = await executeWithRetry(
        () => ordersApi.create({
          drink_id: drink.id,
          user_session_id: sessionId,
        }),
        {
          maxRetries: 2,
          onRetry: (attempt) => {
            showError('Order failed', `Retrying... (attempt ${attempt})`);
          }
        }
      );

      showSuccess('Order placed successfully!', `Your ${drink.name} is being prepared.`);
      navigate(`/order/${order.id}`);
    } catch (error: any) {
      console.error('Error creating order:', error);
      handleNetworkError(error, 'Order placement');
    } finally {
      setIsOrdering(false);
      setOrderingDrinkId(null);
    }
  };

  const handleDetailsClick = (drink: Drink) => {
    setSelectedDrink(drink);
    setIsDetailsModalOpen(true);
  };

  const handleCloseDetailsModal = () => {
    setIsDetailsModalOpen(false);
    setSelectedDrink(null);
  };

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(`section-${sectionId}`);
    if (element) {
      const offset = 80; // Account for sticky header
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
    }
  };

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <header className="text-center mb-12">
          <h1 className="text-h1 text-gradient mb-4">
            AI Bartender
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Browse and order your favorite drinks
          </p>
        </header>

        {/* Main Content */}
        <main id="main-content" tabIndex={-1}>
          {/* Ingredient Filter */}
          <IngredientFilter
            allDrinks={drinks}
            selectedIngredients={selectedIngredients}
            onIngredientsChange={setSelectedIngredients}
          />

          {/* Grouped Drinks View */}
          <GroupedDrinksView
            sections={sections}
            drinksBySection={drinksBySection}
            isLoading={sectionsLoading || drinksLoading}
            onOrderClick={handleOrderClick}
            onDetailsClick={handleDetailsClick}
            onActiveSectionChange={setActiveSectionId}
            isOrdering={isOrdering}
            orderingDrinkId={orderingDrinkId}
          />
        </main>

        {/* Drink Details Modal */}
        <DrinkDetailsModal
          drink={selectedDrink}
          isOpen={isDetailsModalOpen}
          onClose={handleCloseDetailsModal}
          onOrderClick={handleOrderClick}
          isOrdering={isOrdering}
        />
      </div>
    </PageTransition>
  );
};

export default HomePage;