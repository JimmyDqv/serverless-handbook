import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, LoadingSpinner, LoadingButton, ConfirmDialog } from '../components/UI';
import { adminRegistrationCodesApi } from '../services/api';
import { RegistrationCode } from '../types';
import toast from 'react-hot-toast';

// QR Code component using external API (no additional package needed)
const QRCode: React.FC<{ value: string; size?: number }> = ({ value, size = 200 }) => {
  const encodedValue = encodeURIComponent(value);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodedValue}&format=svg`;

  return (
    <img
      src={qrUrl}
      alt="QR Code"
      width={size}
      height={size}
      className="mx-auto"
    />
  );
};

type StatusFilter = 'all' | 'active' | 'used' | 'expired';

const AdminRegistrationCodesPage: React.FC = () => {
  const [codes, setCodes] = useState<RegistrationCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [expiresInHours, setExpiresInHours] = useState(24);
  const [maxUses, setMaxUses] = useState(1);
  const [notes, setNotes] = useState('');
  const [deleteConfirmCode, setDeleteConfirmCode] = useState<string | null>(null);

  const fetchCodes = useCallback(async () => {
    try {
      setIsLoading(true);
      const status = statusFilter === 'all' ? undefined : statusFilter;
      const data = await adminRegistrationCodesApi.getAll(status as 'active' | 'used' | 'expired' | undefined);
      setCodes(data);
    } catch (error) {
      console.error('Failed to fetch registration codes:', error);
      toast.error('Could not fetch registration codes');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchCodes();
  }, [fetchCodes]);

  const handleGenerateCode = async () => {
    try {
      setIsGenerating(true);
      const newCode = await adminRegistrationCodesApi.create({
        expires_in_hours: expiresInHours,
        max_uses: maxUses,
        notes: notes || undefined,
      });
      setCodes([newCode, ...codes]);
      setNotes('');
      setMaxUses(1);
      toast.success('Registration code created!');
    } catch (error) {
      console.error('Failed to generate registration code:', error);
      toast.error('Could not create registration code');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteCode = async () => {
    if (!deleteConfirmCode) return;

    try {
      setIsDeleting(true);
      await adminRegistrationCodesApi.delete(deleteConfirmCode);
      setCodes(codes.filter(c => c.code !== deleteConfirmCode));
      toast.success('Registration code deleted!');
    } catch (error) {
      console.error('Failed to delete registration code:', error);
      toast.error('Could not delete registration code');
    } finally {
      setIsDeleting(false);
      setDeleteConfirmCode(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  const isFullyUsed = (code: RegistrationCode) => {
    return code.use_count >= code.max_uses;
  };

  const getStatusBadge = (code: RegistrationCode) => {
    if (isFullyUsed(code)) {
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
          Fully used
        </span>
      );
    }
    if (isExpired(code.expires_at)) {
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
          Expired
        </span>
      );
    }
    return (
      <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
        Active
      </span>
    );
  };

  const handlePrint = (code: RegistrationCode) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(code.registration_url)}&format=svg`;
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Registration Code</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              padding: 20px;
              box-sizing: border-box;
            }
            .container {
              text-align: center;
              max-width: 400px;
            }
            h1 {
              font-size: 24px;
              margin-bottom: 20px;
              color: #1f2937;
            }
            img {
              margin: 20px 0;
            }
            .instructions {
              font-size: 16px;
              color: #4b5563;
              margin-bottom: 20px;
            }
            .expires {
              font-size: 14px;
              color: #6b7280;
            }
            .notes {
              font-size: 14px;
              color: #6b7280;
              font-style: italic;
              margin-top: 10px;
            }
            @media print {
              body { -webkit-print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Welcome!</h1>
            <p class="instructions">Scan the QR code to register and order drinks</p>
            <img src="${qrUrl}" alt="QR Code" width="300" height="300" />
            <p class="expires">Valid until: ${formatDate(code.expires_at)}</p>
            ${code.notes ? `<p class="notes">${code.notes}</p>` : ''}
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.close();
              }, 500);
            };
          </script>
        </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-h1 text-gray-900 dark:text-gray-100 mb-2">
          Registration Codes
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Create and manage registration codes for guests
        </p>
      </header>

      {/* Generate New Code */}
      <Card className="mb-8 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Create New Code
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Validity period (hours)
            </label>
            <select
              value={expiresInHours}
              onChange={(e) => setExpiresInHours(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value={1}>1 hour</option>
              <option value={4}>4 hours</option>
              <option value={8}>8 hours</option>
              <option value={24}>24 hours</option>
              <option value={48}>48 hours</option>
              <option value={168}>7 days</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Max number of uses
            </label>
            <input
              type="number"
              min={1}
              max={25}
              value={maxUses}
              onChange={(e) => setMaxUses(Math.min(25, Math.max(1, Number(e.target.value))))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">1-25 guests per code</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes (optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="E.g. 'Holiday party 2024'"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div className="flex items-end">
            <LoadingButton
              onClick={handleGenerateCode}
              isLoading={isGenerating}
              loadingText="Creating..."
              className="w-full"
            >
              Create Code
            </LoadingButton>
          </div>
        </div>
      </Card>

      {/* Filter */}
      <div className="mb-6 flex gap-2">
        {(['all', 'active', 'used', 'expired'] as StatusFilter[]).map((filter) => (
          <button
            key={filter}
            onClick={() => setStatusFilter(filter)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              statusFilter === filter
                ? 'bg-amber-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            {filter === 'all' && 'All'}
            {filter === 'active' && 'Active'}
            {filter === 'used' && 'Used'}
            {filter === 'expired' && 'Expired'}
          </button>
        ))}
      </div>

      {/* Codes Grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : codes.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-gray-600 dark:text-gray-400">
            {statusFilter === 'all'
              ? 'No registration codes created yet'
              : `No ${statusFilter === 'active' ? 'active' : statusFilter === 'used' ? 'used' : 'expired'} codes`
            }
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {codes.map((code) => (
            <Card key={code.code} className="p-6">
              <div className="flex flex-col items-center">
                {/* Status Badge */}
                <div className="self-end mb-2">
                  {getStatusBadge(code)}
                </div>

                {/* QR Code */}
                <div className="bg-white p-4 rounded-lg mb-4">
                  <QRCode value={code.registration_url} size={180} />
                </div>

                {/* Code Info */}
                <div className="w-full space-y-2">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Code:</p>
                    <code className="text-xs bg-gray-100 dark:bg-gray-700 p-2 rounded block break-all text-gray-800 dark:text-gray-200">
                      {code.code}
                    </code>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Created:</span>
                    <span className="text-gray-700 dark:text-gray-300">{formatDate(code.created_at)}</span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Expires:</span>
                    <span className={`${isExpired(code.expires_at) ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      {formatDate(code.expires_at)}
                    </span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Created by:</span>
                    <span className="text-gray-700 dark:text-gray-300">{code.created_by}</span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Uses:</span>
                    <span className={`font-medium ${isFullyUsed(code) ? 'text-gray-500 dark:text-gray-400' : 'text-green-600 dark:text-green-400'}`}>
                      {code.use_count} / {code.max_uses}
                    </span>
                  </div>

                  {code.notes && (
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Notes:</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300 italic">{code.notes}</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-4 flex gap-2 w-full">
                  {!isFullyUsed(code) && !isExpired(code.expires_at) && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1"
                      onClick={() => handlePrint(code)}
                    >
                      Print
                    </Button>
                  )}
                  <Button
                    variant="danger"
                    size="sm"
                    className={!isFullyUsed(code) && !isExpired(code.expires_at) ? '' : 'w-full'}
                    onClick={() => setDeleteConfirmCode(code.code)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteConfirmCode}
        onClose={() => setDeleteConfirmCode(null)}
        onConfirm={handleDeleteCode}
        title="Delete registration code"
        message="Are you sure you want to delete this registration code? This cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        isLoading={isDeleting}
        variant="danger"
      />
    </div>
  );
};

export default AdminRegistrationCodesPage;
