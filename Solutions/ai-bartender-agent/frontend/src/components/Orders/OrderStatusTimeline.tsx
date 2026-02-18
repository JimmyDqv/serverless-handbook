import React from 'react';
import { motion } from 'framer-motion';
import { Order } from '../../types';
interface OrderStatusTimelineProps {
  order: Order;
}

const OrderStatusTimeline: React.FC<OrderStatusTimelineProps> = ({ order }) => {
  const steps = [
    {
      key: 'pending',
      label: 'Pending',
      icon: '📝',
      description: 'Order received and queued',
    },
    {
      key: 'in_progress',
      label: 'In Progress',
      icon: '👨‍🍳',
      description: 'Bartender is preparing your drink',
    },
    {
      key: 'completed',
      label: 'Completed',
      icon: '✅',
      description: 'Your drink is ready for pickup!',
    },
  ];

  const getCurrentStepIndex = () => {
    switch (order.status) {
      case 'pending':
        return 0;
      case 'in_progress':
        return 1;
      case 'completed':
        return 2;
      case 'cancelled':
        return -1; // Special case for cancelled
      default:
        return 0;
    }
  };

  const currentStepIndex = getCurrentStepIndex();

  if (order.status === 'cancelled') {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-4">❌</div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Cancelled
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          This order has been cancelled
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {steps.map((step, index) => {
        const isCompleted = index < currentStepIndex;
        const isCurrent = index === currentStepIndex;
        const isPending = index > currentStepIndex;

        return (
          <motion.div
            key={step.key}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            className="flex items-start space-x-4"
          >
            {/* Icon */}
            <div className="flex-shrink-0">
              <motion.div
                className={`w-12 h-12 rounded-full flex items-center justify-center text-lg ${
                  isCompleted
                    ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400'
                    : isCurrent
                    ? 'bg-primary-100 text-primary-600 dark:bg-primary-900 dark:text-primary-400'
                    : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
                }`}
                animate={
                  isCurrent
                    ? {
                        scale: [1, 1.1, 1],
                        transition: {
                          duration: 2,
                          repeat: Infinity,
                          ease: 'easeInOut',
                        },
                      }
                    : {}
                }
              >
                {step.icon}
              </motion.div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h4
                className={`text-sm font-medium ${
                  isCompleted || isCurrent
                    ? 'text-gray-900 dark:text-gray-100'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {step.label}
              </h4>
              <p
                className={`text-sm mt-1 ${
                  isCompleted || isCurrent
                    ? 'text-gray-600 dark:text-gray-300'
                    : 'text-gray-400 dark:text-gray-500'
                }`}
              >
                {step.description}
              </p>
              
              {/* Timestamp */}
              {isCompleted && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  {new Date(order.updated_at).toLocaleTimeString()}
                </p>
              )}
              
              {isCurrent && (
                <motion.div
                  className="mt-2"
                  animate={{
                    opacity: [0.5, 1, 0.5],
                    transition: {
                      duration: 2,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    },
                  }}
                >
                  <div className="flex items-center space-x-2 text-xs text-primary-600 dark:text-primary-400">
                    <div className="w-2 h-2 bg-current rounded-full animate-pulse" />
                    <span>In progress...</span>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Connector Line */}
            {index < steps.length - 1 && (
              <div className="absolute left-6 mt-12 w-0.5 h-6 bg-gray-200 dark:bg-gray-700" />
            )}
          </motion.div>
        );
      })}
    </div>
  );
};

export default OrderStatusTimeline;