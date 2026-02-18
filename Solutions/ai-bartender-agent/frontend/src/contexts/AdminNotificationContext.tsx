import React, { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useAdminOrderEvents } from '../hooks/useOrderEvents';
import { playNewOrderSound } from '../utils/sounds';
import { Order } from '../types';
import toast from 'react-hot-toast';

interface AdminNotificationContextType {
  isConnected: boolean;
}

const AdminNotificationContext = createContext<AdminNotificationContextType | undefined>(undefined);

export const useAdminNotifications = () => {
  const context = useContext(AdminNotificationContext);
  if (context === undefined) {
    throw new Error('useAdminNotifications must be used within an AdminNotificationProvider');
  }
  return context;
};

interface AdminNotificationProviderProps {
  children: ReactNode;
}

export const AdminNotificationProvider: React.FC<AdminNotificationProviderProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  // Track if we're on the admin orders page to avoid duplicate notifications
  const isOnAdminOrdersPage = location.pathname === '/admin/orders' || location.pathname === '/admin';

  // Use ref to track the current page state in callbacks
  const isOnAdminOrdersPageRef = useRef(isOnAdminOrdersPage);
  useEffect(() => {
    isOnAdminOrdersPageRef.current = isOnAdminOrdersPage;
  }, [isOnAdminOrdersPage]);

  // Only enable for authenticated users on admin pages (but not on /admin/orders where local hook handles it)
  const isAdminPage = location.pathname.startsWith('/admin');
  const shouldConnect = isAuthenticated && isAdminPage && !isOnAdminOrdersPage;

  // Handle new order event - show toast and play sound
  const handleOrderCreated = (order: Order) => {
    // Skip if we're on the admin orders page (that page has its own handler)
    if (isOnAdminOrdersPageRef.current) {
      return;
    }

    console.log('Global admin notification: New order created', order.id);
    toast.success(`New order: ${order.drink.name}`, {
      duration: 5000,
      icon: '🍹',
    });
    playNewOrderSound();
  };

  // Subscribe to admin channel for global notifications
  const { isConnected } = useAdminOrderEvents({
    onOrderCreated: handleOrderCreated,
    enabled: shouldConnect,
  });

  const value: AdminNotificationContextType = {
    isConnected,
  };

  return (
    <AdminNotificationContext.Provider value={value}>
      {children}
    </AdminNotificationContext.Provider>
  );
};
