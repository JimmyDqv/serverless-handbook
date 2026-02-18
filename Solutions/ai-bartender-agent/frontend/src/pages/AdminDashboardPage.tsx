import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/UI';
import AdminOrderQueue from '../components/Admin/AdminOrderQueue';
import PullToRefresh from '../components/Mobile/PullToRefresh';

const AdminDashboardPage: React.FC = () => {
  const refetchRef = useRef<(() => Promise<void>) | null>(null);

  const handleRefresh = async () => {
    if (refetchRef.current) {
      await refetchRef.current();
    }
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-h1 text-gray-900 dark:text-gray-100 mb-2">
            Admin Panel
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage orders and drinks from this dashboard
          </p>
        </header>

        {/* Main Content */}
        <main id="main-content" tabIndex={-1}>
          {/* Quick Actions */}
          <nav id="admin-navigation" className="mb-8" aria-label="Admin quick actions">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Link to="/admin" className="block" aria-describedby="order-queue-desc">
                <Card hover className="p-6">
                  <div className="flex items-center">
                    <div className="text-3xl mr-4" aria-hidden="true">📋</div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Order Queue
                      </h3>
                      <p id="order-queue-desc" className="text-gray-600 dark:text-gray-400">
                        View and manage pending orders
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>

              <Link to="/admin/drinks" className="block" aria-describedby="drink-mgmt-desc">
                <Card hover className="p-6">
                  <div className="flex items-center">
                    <div className="text-3xl mr-4" aria-hidden="true">🍹</div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Drink Management
                      </h3>
                      <p id="drink-mgmt-desc" className="text-gray-600 dark:text-gray-400">
                        Add, edit, and manage drinks
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>

              <Link to="/admin/sections" className="block" aria-describedby="section-mgmt-desc">
                <Card hover className="p-6">
                  <div className="flex items-center">
                    <div className="text-3xl mr-4" aria-hidden="true">📂</div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Section Management
                      </h3>
                      <p id="section-mgmt-desc" className="text-gray-600 dark:text-gray-400">
                        Organize drinks into categories
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>

              <Link to="/admin/registration-codes" className="block" aria-describedby="reg-codes-desc">
                <Card hover className="p-6">
                  <div className="flex items-center">
                    <div className="text-3xl mr-4" aria-hidden="true">🔗</div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Registration Codes
                      </h3>
                      <p id="reg-codes-desc" className="text-gray-600 dark:text-gray-400">
                        Create QR codes for guest registration
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>

              <Link to="/admin/chat" className="block" aria-describedby="ai-bartender-desc">
                <Card hover className="p-6">
                  <div className="flex items-center">
                    <div className="text-3xl mr-4" aria-hidden="true">🤖</div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        AI Bartender
                      </h3>
                      <p id="ai-bartender-desc" className="text-gray-600 dark:text-gray-400">
                        Chat with the AI bartender about drinks
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>
            </div>
          </nav>

          {/* Order Queue */}
          <section id="order-queue" aria-label="Current order queue" role="region">
            <AdminOrderQueue onRefetchReady={(refetch) => { refetchRef.current = refetch; }} />
          </section>
        </main>
      </div>
    </PullToRefresh>
  );
};

export default AdminDashboardPage;