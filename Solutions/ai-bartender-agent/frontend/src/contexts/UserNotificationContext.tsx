import React, { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useUserOrderEvents } from '../hooks/useOrderEvents';
import { playStatusChangeSound, playOrderReadySound } from '../utils/sounds';
import { ordersApi } from '../services/api';
import { Order } from '../types';
import { getValidUserKey } from '../hooks/useIsRegistered';

export interface UserNotification {
  id: string;
  type: 'order_ready' | 'order_in_progress' | 'info';
  message: string;
  orderId?: string;
  drinkName?: string;
  timestamp: Date;
}

interface UserNotificationContextType {
  notifications: UserNotification[];
  dismissNotification: (id: string) => void;
  dismissAllNotifications: () => void;
  isConnected: boolean;
}

const UserNotificationContext = createContext<UserNotificationContextType | undefined>(undefined);

export const useUserNotifications = () => {
  const context = useContext(UserNotificationContext);
  if (context === undefined) {
    throw new Error('useUserNotifications must be used within an UserNotificationProvider');
  }
  return context;
};

interface UserNotificationProviderProps {
  children: ReactNode;
}

export const UserNotificationProvider: React.FC<UserNotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<UserNotification[]>([]);

  // Get user_key only if token is valid (not expired)
  // This prevents API calls and WebSocket subscriptions for expired tokens
  const userKey = getValidUserKey();

  // Track orders we've already notified about to avoid duplicates
  const notifiedOrdersRef = useRef<Set<string>>(new Set());
  // Track last known order statuses to detect changes after wake
  const lastKnownStatusRef = useRef<Map<string, string>>(new Map());

  const addNotification = useCallback((notification: Omit<UserNotification, 'id' | 'timestamp'>) => {
    const newNotification: UserNotification = {
      ...notification,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };
    setNotifications(prev => [newNotification, ...prev]);
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const dismissAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Handle order status changed to in_progress
  const handleOrderStatusChanged = useCallback((order: Order) => {
    console.log('User notification: Order status changed', order.id, '->', order.status);

    if (order.status === 'in_progress') {
      addNotification({
        type: 'order_in_progress',
        message: `Your ${order.drink.name} is being prepared!`,
        orderId: order.id,
        drinkName: order.drink.name,
      });
      playStatusChangeSound();
    }
  }, [addNotification]);

  // Handle order completed - this is the key notification
  const handleOrderCompleted = useCallback((order: Order) => {
    console.log('User notification: Order completed', order.id);

    addNotification({
      type: 'order_ready',
      message: `Your ${order.drink.name} is ready!`,
      orderId: order.id,
      drinkName: order.drink.name,
    });
    playOrderReadySound();
  }, [addNotification]);

  // Subscribe to real-time events for this user
  const { isConnected } = useUserOrderEvents(userKey, {
    onOrderStatusChanged: handleOrderStatusChanged,
    onOrderCompleted: handleOrderCompleted,
    enabled: !!userKey,
  });

  // Check for order status changes when page becomes visible (after sleep/background)
  useEffect(() => {
    if (!userKey) return;

    const checkOrdersOnWake = async () => {
      // Re-check token validity before making API call (token could have expired while in background)
      if (!getValidUserKey()) {
        console.log('Token expired, skipping order check');
        return;
      }

      try {
        // Fetch current orders including recently completed ones
        const orders = await ordersApi.getMyOrders(true);

        orders.forEach((order) => {
          const lastKnownStatus = lastKnownStatusRef.current.get(order.id);
          const notificationKey = `${order.id}-${order.status}`;

          // If we knew about this order and its status changed
          if (lastKnownStatus && lastKnownStatus !== order.status) {
            // Check if we already notified about this specific status
            if (!notifiedOrdersRef.current.has(notificationKey)) {
              if (order.status === 'completed') {
                console.log('Wake check: Order completed while sleeping', order.id);
                addNotification({
                  type: 'order_ready',
                  message: `Your ${order.drink.name} is ready!`,
                  orderId: order.id,
                  drinkName: order.drink.name,
                });
                playOrderReadySound();
                notifiedOrdersRef.current.add(notificationKey);
              } else if (order.status === 'in_progress' && lastKnownStatus === 'pending') {
                console.log('Wake check: Order started while sleeping', order.id);
                addNotification({
                  type: 'order_in_progress',
                  message: `Your ${order.drink.name} is being prepared!`,
                  orderId: order.id,
                  drinkName: order.drink.name,
                });
                playStatusChangeSound();
                notifiedOrdersRef.current.add(notificationKey);
              }
            }
          }

          // Update last known status
          lastKnownStatusRef.current.set(order.id, order.status);
        });

        // Clean up old entries from maps (orders no longer in the list)
        const currentOrderIds = new Set(orders.map(o => o.id));
        lastKnownStatusRef.current.forEach((_, orderId) => {
          if (!currentOrderIds.has(orderId)) {
            lastKnownStatusRef.current.delete(orderId);
          }
        });
      } catch (error) {
        console.error('Error checking orders on wake:', error);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Page became visible, checking for order updates...');
        checkOrdersOnWake();
      }
    };

    // Initial fetch to populate lastKnownStatusRef
    checkOrdersOnWake();

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [userKey, addNotification]);

  const value: UserNotificationContextType = {
    notifications,
    dismissNotification,
    dismissAllNotifications,
    isConnected,
  };

  return (
    <UserNotificationContext.Provider value={value}>
      {children}
    </UserNotificationContext.Provider>
  );
};
