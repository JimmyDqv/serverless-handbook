import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useOrder } from '../hooks/useOrder';
import { Card, LoadingSpinner, Button } from '../components/UI';
import OrderStatusBadge from '../components/Orders/OrderStatusBadge';
import OrderStatusTimeline from '../components/Orders/OrderStatusTimeline';
import OrderCompletedCelebration from '../components/Orders/OrderCompletedCelebration';

const OrderStatusPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const { order, isLoading, error, isConnected } = useOrder(orderId || null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [previousStatus, setPreviousStatus] = useState<string | null>(null);

  // Show celebration when order status changes to completed
  useEffect(() => {
    if (order && previousStatus && previousStatus !== 'completed' && order.status === 'completed') {
      setShowCelebration(true);
    }
    if (order) {
      setPreviousStatus(order.status);
    }
  }, [order?.status, previousStatus]);

  const getDrinkName = () => {
    if (!order) return '';
    return order.drink.name;
  };

  const getEstimatedTime = () => {
    if (!order) return null;
    
    switch (order.status) {
      case 'pending':
        return 5; // 5 minutes estimated
      case 'in_progress':
        return 3; // 3 minutes remaining
      case 'completed':
        return 0;
      default:
        return null;
    }
  };

  const formatOrderTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <LoadingSpinner size="lg" className="text-primary-600 mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="p-8 text-center">
          <div className="text-4xl mb-4">❌</div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Order Not Found
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {error || 'The order you are looking for could not be found.'}
          </p>
          <Link to="/">
            <Button>
              Back to Home
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  const estimatedTime = getEstimatedTime();

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-h2 text-gray-900 dark:text-gray-100 mb-2">
          Order Status
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Order #{orderId}
        </p>
        {/* Real-time connection indicator */}
        {order.status !== 'completed' && order.status !== 'cancelled' && (
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {isConnected ? 'Live updates' : 'Connecting...'}
            </span>
          </div>
        )}
      </div>

      {/* Order Details Card */}
      <Card className="p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
              {getDrinkName()}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Ordered {formatOrderTime(order.created_at)}
            </p>
          </div>
          
          <OrderStatusBadge status={order.status} animated />
        </div>

        {/* Estimated Time */}
        {estimatedTime !== null && estimatedTime > 0 && (
          <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-center space-x-2">
              <span className="text-primary-600 dark:text-primary-400 font-medium">
                Estimated time: {estimatedTime} minutes
              </span>
            </div>
          </div>
        )}

        {/* Drink Image */}
        {order.drink.image_url && (
          <div className="mb-6">
            <img
              src={order.drink.image_url}
              alt={getDrinkName()}
              className="w-full h-48 object-cover rounded-lg"
            />
          </div>
        )}
      </Card>

      {/* Status Timeline */}
      <Card className="p-6 mb-6">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">
          Order Progress
        </h4>
        <OrderStatusTimeline order={order} />
      </Card>

      {/* Actions */}
      <div className="text-center">
        <Link to="/">
          <Button variant="secondary">
            Order Another Drink
          </Button>
        </Link>
      </div>

      {/* Celebration Animation */}
      <OrderCompletedCelebration
        isVisible={showCelebration}
        onComplete={() => setShowCelebration(false)}
      />
    </div>
  );
};

export default OrderStatusPage;