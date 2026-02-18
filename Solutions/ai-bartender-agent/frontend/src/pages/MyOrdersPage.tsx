import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useMyOrders } from '../hooks/useMyOrders';
import { Card, Button, LoadingSpinner } from '../components/UI';
import OrderStatusBadge from '../components/Orders/OrderStatusBadge';

const MyOrdersPage: React.FC = () => {
  const { orders, isLoading, error } = useMyOrders();

  const formatOrderTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) {
      return 'Just now';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes} min ago`;
    } else {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
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

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="p-8 text-center">
          <div className="text-4xl mb-4">❌</div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            An error occurred
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {error}
          </p>
          <Link to="/">
            <Button>Home</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-h2 text-gray-900 dark:text-gray-100 mb-2">
          My Orders
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Your active orders
        </p>
      </div>

      {/* Orders List */}
      {orders.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="text-6xl mb-4">🍹</div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            No active orders
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            You have no active orders. Go to the menu to order a drink.
          </p>
          <Link to="/">
            <Button variant="primary">
              Order a drink
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order, index) => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Link to={`/order/${order.id}`}>
                <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-center gap-4">
                    {/* Drink Image */}
                    {order.drink.image_url ? (
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0">
                        <img
                          src={order.drink.image_url}
                          alt={order.drink.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-gray-700 flex-shrink-0 flex items-center justify-center">
                        <span className="text-2xl">🍸</span>
                      </div>
                    )}

                    {/* Order Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {order.drink.name}
                        </h3>
                        <OrderStatusBadge status={order.status} size="sm" />
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Ordered {formatOrderTime(order.created_at)}
                      </p>
                    </div>

                    {/* Arrow */}
                    <div className="text-gray-400 dark:text-gray-500">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      {/* Back to Menu */}
      {orders.length > 0 && (
        <div className="text-center mt-8">
          <Link to="/">
            <Button variant="secondary">
              Back to menu
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
};

export default MyOrdersPage;
