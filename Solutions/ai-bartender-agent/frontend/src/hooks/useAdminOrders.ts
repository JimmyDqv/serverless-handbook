import { useState, useEffect, useCallback, useRef } from 'react';
import { adminOrdersApi } from '../services/api';
import { Order, OrdersMetadata } from '../types';
import { useAdminOrderEvents } from './useOrderEvents';
import { playNewOrderSound } from '../utils/sounds';
import toast from 'react-hot-toast';

// Module-level flag to prevent multiple fetches across StrictMode double-mount
let isFetchingOrders = false;

const initialMetadata: OrdersMetadata = {
  pending_count: 0,
  in_progress_count: 0,
  completed_24h_count: 0,
  pending_returned: 0,
};

export const useAdminOrders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [metadata, setMetadata] = useState<OrdersMetadata>(initialMetadata);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchOrders = useCallback(async (showToast = false, force = false) => {
    // Prevent concurrent fetches unless forced (manual refresh)
    if (isFetchingOrders && !force) {
      return;
    }

    isFetchingOrders = true;

    try {
      const response = await adminOrdersApi.getAll();
      if (mountedRef.current) {
        setOrders(response.orders);
        setMetadata(response.metadata);
        setError(null);
      }
    } catch (err: any) {
      console.error('Error fetching admin orders:', err);
      if (mountedRef.current) {
        const errorMessage = err.message || 'Failed to fetch orders';
        setError(errorMessage);
        if (showToast) {
          toast.error('Failed to load orders');
        }
      }
    } finally {
      isFetchingOrders = false;
    }
  }, []);

  // Real-time event handlers
  const handleOrderCreated = useCallback((order: Order) => {
    console.log('Real-time: New order created', order.id);
    setOrders(prevOrders => {
      // Check if order already exists (avoid duplicates)
      if (prevOrders.some(o => o.id === order.id)) {
        return prevOrders;
      }
      // Add new order at the end (will be sorted by status in UI)
      return [...prevOrders, order];
    });
    // Update metadata counts
    setMetadata(prev => ({
      ...prev,
      pending_count: prev.pending_count + 1,
      pending_returned: prev.pending_returned + 1,
    }));
    // Play notification sound for new orders (no toast - admin can see the order appear in the list)
    playNewOrderSound();
  }, []);

  const handleOrderStatusChanged = useCallback((order: Order, previousStatus?: string) => {
    console.log('Real-time: Order status changed', order.id, previousStatus, '->', order.status);
    setOrders(prevOrders =>
      prevOrders.map(o => o.id === order.id ? order : o)
    );
    // Update metadata counts based on status change
    setMetadata(prev => {
      const newMetadata = { ...prev };
      // Decrement previous status count
      if (previousStatus === 'pending') {
        newMetadata.pending_count = Math.max(0, newMetadata.pending_count - 1);
        newMetadata.pending_returned = Math.max(0, newMetadata.pending_returned - 1);
      } else if (previousStatus === 'in_progress') {
        newMetadata.in_progress_count = Math.max(0, newMetadata.in_progress_count - 1);
      }
      // Increment new status count
      if (order.status === 'pending') {
        newMetadata.pending_count++;
        newMetadata.pending_returned++;
      } else if (order.status === 'in_progress') {
        newMetadata.in_progress_count++;
      }
      return newMetadata;
    });
  }, []);

  const handleOrderCompleted = useCallback((order: Order) => {
    console.log('Real-time: Order completed', order.id);
    // Remove completed order from the list (admin queue only shows active orders)
    setOrders(prevOrders => prevOrders.filter(o => o.id !== order.id));
    // Update metadata
    setMetadata(prev => ({
      ...prev,
      in_progress_count: Math.max(0, prev.in_progress_count - 1),
      completed_24h_count: prev.completed_24h_count + 1,
    }));
  }, []);

  // Subscribe to real-time events
  const { isConnected } = useAdminOrderEvents({
    onOrderCreated: handleOrderCreated,
    onOrderStatusChanged: handleOrderStatusChanged,
    onOrderCompleted: handleOrderCompleted,
    enabled: !isLoading, // Only connect after initial load
  });

  useEffect(() => {
    mountedRef.current = true;

    const loadOrders = async () => {
      setIsLoading(true);
      await fetchOrders(true);
      if (mountedRef.current) {
        setIsLoading(false);
      }
    };

    loadOrders();

    return () => {
      mountedRef.current = false;
    };
  }, [fetchOrders]);

  const updateOrderStatus = async (orderId: string, status: Order['status']) => {
    try {
      const updatedOrder = await adminOrdersApi.updateStatus(orderId, status);

      // Update local state immediately (real-time event will also arrive but we handle duplicates)
      setOrders(prevOrders =>
        prevOrders.map(order =>
          order.id === orderId ? updatedOrder : order
        )
      );

      // No toast here - the admin initiated this action, UI already reflects the change
      return updatedOrder;
    } catch (err: any) {
      console.error('Error updating order status:', err);
      toast.error(err.message || 'Failed to update order status');
      throw err;
    }
  };

  const refetch = useCallback(async () => {
    await fetchOrders(true, true); // force=true for manual refresh
  }, [fetchOrders]);

  return {
    orders,
    metadata,
    isLoading,
    error,
    isConnected, // Expose WebSocket connection status
    updateOrderStatus,
    refetch,
  };
};
