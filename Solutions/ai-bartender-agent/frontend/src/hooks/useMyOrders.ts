import { useState, useEffect, useCallback, useRef } from 'react';
import { ordersApi } from '../services/api';
import { Order } from '../types';
import { useUserOrderEvents } from './useOrderEvents';

export const useMyOrders = (includeCompleted = false) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  // Get user_key from localStorage for real-time subscription
  const userKey = localStorage.getItem('user_key');

  const fetchOrders = useCallback(async () => {
    try {
      const data = await ordersApi.getMyOrders(includeCompleted);
      if (mountedRef.current) {
        setOrders(data || []); // Ensure we always have an array
        setError(null);
      }
    } catch (err: any) {
      console.error('Error fetching user orders:', err);
      if (mountedRef.current) {
        const errorMessage = err.message || 'Failed to fetch orders';
        setError(errorMessage);
        setOrders([]); // Reset to empty array on error
      }
    }
  }, [includeCompleted]);

  // Real-time event handlers - update local state only
  // Notifications are handled globally by UserNotificationContext
  const handleOrderCreated = useCallback((order: Order) => {
    console.log('useMyOrders: Order created', order.id);
    setOrders(prevOrders => {
      // Check if order already exists (avoid duplicates)
      if (prevOrders.some(o => o.id === order.id)) {
        return prevOrders;
      }
      // Add new order at the beginning
      return [order, ...prevOrders];
    });
  }, []);

  const handleOrderStatusChanged = useCallback((order: Order) => {
    console.log('useMyOrders: Order status changed', order.id, '->', order.status);
    setOrders(prevOrders =>
      prevOrders.map(o => o.id === order.id ? order : o)
    );
    // Notifications handled by UserNotificationContext
  }, []);

  const handleOrderCompleted = useCallback((order: Order) => {
    console.log('useMyOrders: Order completed', order.id);
    if (includeCompleted) {
      // Update the order in the list
      setOrders(prevOrders =>
        prevOrders.map(o => o.id === order.id ? order : o)
      );
    } else {
      // Remove completed order from active orders list
      setOrders(prevOrders => prevOrders.filter(o => o.id !== order.id));
    }
    // Notifications handled by UserNotificationContext
  }, [includeCompleted]);

  // Subscribe to real-time events for this user (for list updates)
  const { isConnected } = useUserOrderEvents(userKey, {
    onOrderCreated: handleOrderCreated,
    onOrderStatusChanged: handleOrderStatusChanged,
    onOrderCompleted: handleOrderCompleted,
    enabled: !isLoading,
  });

  useEffect(() => {
    mountedRef.current = true;

    const loadOrders = async () => {
      setIsLoading(true);
      try {
        await fetchOrders();
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    };

    loadOrders();

    return () => {
      mountedRef.current = false;
    };
  }, [fetchOrders]);

  const refetch = useCallback(async () => {
    await fetchOrders();
  }, [fetchOrders]);

  // Check if user has any active orders
  const hasActiveOrders = orders.some(
    order => order.status === 'pending' || order.status === 'in_progress'
  );

  return {
    orders,
    isLoading,
    error,
    isConnected,
    refetch,
    hasActiveOrders,
  };
};
