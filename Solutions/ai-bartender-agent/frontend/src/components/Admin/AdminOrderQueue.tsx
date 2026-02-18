import React, { useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useAdminOrders } from '../../hooks/useAdminOrders';
import AdminOrderCard from './AdminOrderCard';
import { SkeletonCard } from '../UI';
import { NoOrdersEmptyState } from '../UI/EmptyState';

interface AdminOrderQueueProps {
  onRefetchReady?: (refetch: () => Promise<void>) => void;
}

const AdminOrderQueue: React.FC<AdminOrderQueueProps> = ({ onRefetchReady }) => {
  const { orders, metadata, isLoading, isConnected, updateOrderStatus, refetch } = useAdminOrders();

  useEffect(() => {
    if (onRefetchReady) {
      onRefetchReady(refetch);
    }
  }, [onRefetchReady, refetch]);

  // Separate in_progress and pending orders (already sorted by created_at ASC from backend)
  const inProgressOrders = orders.filter(order => order.status === 'in_progress');
  const pendingOrders = orders.filter(order => order.status === 'pending');

  // Check if there are more pending orders not shown
  const hasMorePending = metadata.pending_count > metadata.pending_returned;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} className="h-32" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Summary */}
      <div className="flex flex-wrap gap-3">
        <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 px-4 py-2 rounded-lg">
          <span className="font-semibold">{metadata.pending_count}</span>
          <span className="ml-1 text-sm">Pending</span>
        </div>
        <div className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-4 py-2 rounded-lg">
          <span className="font-semibold">{metadata.in_progress_count}</span>
          <span className="ml-1 text-sm">In Progress</span>
        </div>
        <div className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 px-4 py-2 rounded-lg">
          <span className="font-semibold">{metadata.completed_24h_count}</span>
          <span className="ml-1 text-sm">Completed (24h)</span>
        </div>
        {/* Real-time connection indicator */}
        <div className={`px-3 py-2 rounded-lg flex items-center gap-2 ${
          isConnected
            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
        }`}>
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
          <span className="text-sm">{isConnected ? 'Live' : 'Connecting...'}</span>
        </div>
      </div>

      {/* Active Orders */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Order Queue
          </h2>
          <div className="bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 px-3 py-1 rounded-full text-sm font-medium">
            {orders.length} shown
          </div>
        </div>

        {/* Warning if more pending orders exist */}
        {hasMorePending && (
          <div className="mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3">
            <p className="text-amber-800 dark:text-amber-200 text-sm">
              Showing {metadata.pending_returned} of {metadata.pending_count} pending orders.
              {' '}More orders will appear as you complete these.
            </p>
          </div>
        )}

        {orders.length === 0 ? (
          <NoOrdersEmptyState />
        ) : (
          <div className="space-y-6">
            {/* In Progress Section */}
            {inProgressOrders.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-blue-700 dark:text-blue-300 mb-3">
                  In Progress ({inProgressOrders.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <AnimatePresence mode="popLayout">
                    {inProgressOrders.map((order) => (
                      <AdminOrderCard
                        key={order.id}
                        order={order}
                        onStatusUpdate={updateOrderStatus}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* Pending Section */}
            {pendingOrders.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-amber-700 dark:text-amber-300 mb-3">
                  Pending ({pendingOrders.length}{hasMorePending ? ` of ${metadata.pending_count}` : ''})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <AnimatePresence mode="popLayout">
                    {pendingOrders.map((order) => (
                      <AdminOrderCard
                        key={order.id}
                        order={order}
                        onStatusUpdate={updateOrderStatus}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminOrderQueue;
