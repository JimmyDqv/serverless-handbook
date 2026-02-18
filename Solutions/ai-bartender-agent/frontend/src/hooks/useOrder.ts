import { useState, useEffect, useRef, useCallback } from 'react';
import { ordersApi } from '../services/api';
import { Order } from '../types';
import { useUserOrderEvents } from './useOrderEvents';
import { playStatusChangeSound, playOrderReadySound } from '../utils/sounds';
import toast from 'react-hot-toast';

export const useOrder = (orderId: string | null) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  // Get user_key from localStorage for real-time subscription
  const userKey = localStorage.getItem('user_key');

  const fetchOrder = useCallback(async () => {
    if (!orderId) return;

    try {
      setError(null);
      const data = await ordersApi.getById(orderId);
      if (mountedRef.current) {
        setOrder(data);
      }
    } catch (err: any) {
      console.error('Error fetching order:', err);
      if (mountedRef.current) {
        setError(err.message || 'Failed to fetch order');
        toast.error('Failed to load order status');
      }
    }
  }, [orderId]);

  // Real-time event handlers
  const handleOrderStatusChanged = useCallback((updatedOrder: Order) => {
    if (updatedOrder.id === orderId) {
      console.log('Real-time: Order status changed', updatedOrder.id, '->', updatedOrder.status);
      setOrder(updatedOrder);
      // Play sound for status change to in_progress
      if (updatedOrder.status === 'in_progress') {
        playStatusChangeSound();
      }
    }
  }, [orderId]);

  const handleOrderCompleted = useCallback((updatedOrder: Order) => {
    if (updatedOrder.id === orderId) {
      console.log('Real-time: Order completed', updatedOrder.id);
      setOrder(updatedOrder);
      // Play celebratory sound when order is ready
      playOrderReadySound();
    }
  }, [orderId]);

  // Subscribe to real-time events for this user
  const { isConnected } = useUserOrderEvents(userKey, {
    onOrderStatusChanged: handleOrderStatusChanged,
    onOrderCompleted: handleOrderCompleted,
    enabled: !isLoading && !!orderId && order?.status !== 'completed' && order?.status !== 'cancelled',
  });

  useEffect(() => {
    mountedRef.current = true;

    if (!orderId) {
      setOrder(null);
      return;
    }

    const loadOrder = async () => {
      setIsLoading(true);
      await fetchOrder();
      if (mountedRef.current) {
        setIsLoading(false);
      }
    };

    loadOrder();

    return () => {
      mountedRef.current = false;
    };
  }, [orderId, fetchOrder]);

  const refetch = useCallback(() => {
    fetchOrder();
  }, [fetchOrder]);

  return {
    order,
    isLoading,
    error,
    isConnected,
    refetch,
  };
};