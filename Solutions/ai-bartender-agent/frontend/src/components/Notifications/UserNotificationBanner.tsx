import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useUserNotifications, UserNotification } from '../../contexts/UserNotificationContext';

const NotificationItem: React.FC<{
  notification: UserNotification;
  onDismiss: () => void;
}> = ({ notification, onDismiss }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (notification.orderId) {
      navigate(`/order/${notification.orderId}`);
    }
    onDismiss();
  };

  const getBgColor = () => {
    switch (notification.type) {
      case 'order_ready':
        return 'bg-green-500';
      case 'order_in_progress':
        return 'bg-blue-500';
      default:
        return 'bg-primary-500';
    }
  };

  const getIcon = () => {
    switch (notification.type) {
      case 'order_ready':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'order_in_progress':
        return (
          <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={`${getBgColor()} text-white px-4 py-3 flex items-center justify-between shadow-lg`}
    >
      <button
        onClick={handleClick}
        className="flex items-center space-x-3 flex-1 text-left"
      >
        <span className="flex-shrink-0">{getIcon()}</span>
        <span className="font-medium">{notification.message}</span>
        {notification.orderId && (
          <span className="text-sm opacity-80 hidden sm:inline">Tap to view</span>
        )}
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        className="ml-4 p-1 hover:bg-white/20 rounded-full transition-colors"
        aria-label="Dismiss notification"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </motion.div>
  );
};

const UserNotificationBanner: React.FC = () => {
  const { notifications, dismissNotification } = useUserNotifications();

  // Only show the most recent notification
  const latestNotification = notifications[0];

  return (
    <AnimatePresence>
      {latestNotification && (
        <NotificationItem
          key={latestNotification.id}
          notification={latestNotification}
          onDismiss={() => dismissNotification(latestNotification.id)}
        />
      )}
    </AnimatePresence>
  );
};

export default UserNotificationBanner;
