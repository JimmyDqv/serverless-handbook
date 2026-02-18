import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Order, Drink } from '../../types';
import { Card, Button, Tooltip } from '../UI';
import OrderStatusBadge from '../Orders/OrderStatusBadge';
import { drinksApi } from '../../services/api';

interface AdminOrderCardProps {
  order: Order;
  onStatusUpdate: (orderId: string, status: Order['status']) => Promise<Order>;
}

const AdminOrderCard: React.FC<AdminOrderCardProps> = ({
  order,
  onStatusUpdate,
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [drinkDetails, setDrinkDetails] = useState<Drink | null>(null);
  const [loadingRecipe, setLoadingRecipe] = useState(true);

  // Fetch drink details on mount
  useEffect(() => {
    const fetchDrinkDetails = async () => {
      try {
        const details = await drinksApi.getById(order.drink.id);
        setDrinkDetails(details);
      } catch (error) {
        console.error('Failed to fetch drink details:', error);
      } finally {
        setLoadingRecipe(false);
      }
    };
    fetchDrinkDetails();
  }, [order.drink.id]);

  const formatOrderTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) {
      return 'Just now';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  };

  const handleStatusUpdate = async (newStatus: Order['status']) => {
    if (isUpdating) return;

    setIsUpdating(true);
    try {
      await onStatusUpdate(order.id, newStatus);
    } finally {
      setIsUpdating(false);
    }
  };

  const getNextAction = () => {
    switch (order.status) {
      case 'pending':
        return {
          label: 'Start Order',
          status: 'in_progress' as const,
        };
      case 'in_progress':
        return {
          label: 'Complete Order',
          status: 'completed' as const,
        };
      default:
        return null;
    }
  };

  const nextAction = getNextAction();
  const isPending = order.status === 'pending';
  const isInProgress = order.status === 'in_progress';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      layout
    >
      <Card className={`p-3 ${isPending ? 'ring-2 ring-yellow-400 dark:ring-yellow-600' : ''} ${isInProgress ? 'ring-2 ring-blue-400 dark:ring-blue-600' : ''}`}>
        {/* Header Row - Image, Name, Status, Time */}
        <div className="flex items-center gap-3 mb-3">
          {/* Drink Image */}
          {order.drink.image_url ? (
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0">
              <img
                src={order.drink.image_url}
                alt={order.drink.name}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-700 flex-shrink-0 flex items-center justify-center">
              <span className="text-xl">🍸</span>
            </div>
          )}

          {/* Name and Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                {order.drink.name}
              </h3>
              <OrderStatusBadge status={order.status} size="sm" />
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {order.username && <span className="font-medium text-gray-700 dark:text-gray-300">{order.username}</span>}
              {order.username && ' • '}
              #{order.id.slice(-6)} • {formatOrderTime(order.created_at)}
            </div>
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="flex items-center gap-2 mb-3">
          {nextAction && (
            <Button
              onClick={() => handleStatusUpdate(nextAction.status)}
              variant="primary"
              size="sm"
              isLoading={isUpdating}
              className="flex-1"
            >
              {nextAction.label}
            </Button>
          )}

          {order.status !== 'completed' && order.status !== 'cancelled' && (
            <Tooltip content="Cancel order">
              <Button
                onClick={() => handleStatusUpdate('cancelled')}
                variant="secondary"
                size="sm"
                disabled={isUpdating}
                className="!bg-transparent !border-transparent text-red-600 hover:text-red-700 hover:!bg-red-50 dark:text-red-400 dark:hover:!bg-red-900/20"
              >
                ✕
              </Button>
            </Tooltip>
          )}
        </div>

        {/* Recipe Section - Always visible */}
        {loadingRecipe ? (
          <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="animate-pulse space-y-2">
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-28"></div>
            </div>
          </div>
        ) : drinkDetails ? (
          <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
            {/* Ingredients */}
            {drinkDetails.recipe?.ingredients && drinkDetails.recipe.ingredients.length > 0 ? (
              <div className="mb-3">
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">
                  Ingredients
                </h4>
                <ul className="space-y-1">
                  {drinkDetails.recipe.ingredients.map((ing, idx) => (
                    <li key={idx} className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                      <span className="font-medium">{ing.amount}</span>
                      <span>{ing.name}</span>
                      {ing.optional && <span className="text-xs text-gray-400">(optional)</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ) : drinkDetails.ingredients && drinkDetails.ingredients.length > 0 ? (
              <div className="mb-3">
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">
                  Ingredients
                </h4>
                <ul className="space-y-1">
                  {drinkDetails.ingredients.map((ing, idx) => (
                    <li key={idx} className="text-sm text-gray-600 dark:text-gray-400">
                      • {ing}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* Recipe Steps */}
            {drinkDetails.recipe?.steps && drinkDetails.recipe.steps.length > 0 && (
              <div className="mb-3">
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">
                  Steps
                </h4>
                <ol className="space-y-1">
                  {drinkDetails.recipe.steps
                    .sort((a, b) => a.order - b.order)
                    .map((step, idx) => (
                      <li key={idx} className="text-sm text-gray-600 dark:text-gray-400 flex gap-2">
                        <span className="font-medium text-gray-500">{step.order}.</span>
                        <span>{step.instruction}</span>
                      </li>
                    ))}
                </ol>
              </div>
            )}

            {/* Garnish & Glassware */}
            {(drinkDetails.recipe?.garnish || drinkDetails.recipe?.glassware) && (
              <div className="flex gap-4 text-sm text-gray-600 dark:text-gray-400">
                {drinkDetails.recipe?.glassware && (
                  <span>🥃 {drinkDetails.recipe.glassware}</span>
                )}
                {drinkDetails.recipe?.garnish && (
                  <span>🍋 {drinkDetails.recipe.garnish}</span>
                )}
              </div>
            )}

            {/* No recipe info available */}
            {!drinkDetails.recipe && (!drinkDetails.ingredients || drinkDetails.ingredients.length === 0) && (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                No recipe information available
              </p>
            )}
          </div>
        ) : null}
      </Card>
    </motion.div>
  );
};

export default AdminOrderCard;
