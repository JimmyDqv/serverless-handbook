import React from 'react';
import { motion } from 'framer-motion';
import { Order } from '../../types';
import { Badge } from '../UI';

interface OrderStatusBadgeProps {
  status: Order['status'];
  animated?: boolean;
  size?: 'sm' | 'md';
}

const OrderStatusBadge: React.FC<OrderStatusBadgeProps> = ({
  status,
  animated = false,
  size = 'md',
}) => {
  const getStatusText = () => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'in_progress':
        return 'In Progress';
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status;
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'pending':
        return '⏳';
      case 'in_progress':
        return '👨‍🍳';
      case 'completed':
        return '✅';
      case 'cancelled':
        return '❌';
      default:
        return '❓';
    }
  };

  const getVariant = (): 'pending' | 'in-progress' | 'completed' | 'cancelled' => {
    return status === 'in_progress' ? 'in-progress' : status;
  };

  const badgeContent = (
    <Badge variant={getVariant()} size={size}>
      <span className="flex items-center space-x-1">
        <span>{getStatusIcon()}</span>
        <span>{getStatusText()}</span>
      </span>
    </Badge>
  );

  if (!animated) {
    return badgeContent;
  }

  // Add animations based on status
  const getAnimation = () => {
    switch (status) {
      case 'pending':
        return {
          scale: [1, 1.05, 1],
          transition: {
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          },
        };
      case 'in_progress':
        return {
          rotate: [0, 5, -5, 0],
          transition: {
            duration: 1,
            repeat: Infinity,
            ease: 'easeInOut',
          },
        };
      case 'completed':
        return {
          scale: [1, 1.2, 1],
          transition: {
            duration: 0.5,
            ease: 'easeOut',
          },
        };
      default:
        return {};
    }
  };

  return (
    <motion.div animate={getAnimation()}>
      {badgeContent}
    </motion.div>
  );
};

export default OrderStatusBadge;