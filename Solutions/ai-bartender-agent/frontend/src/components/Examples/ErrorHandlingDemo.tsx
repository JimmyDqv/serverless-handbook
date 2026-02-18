import React, { useState } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { useNetworkError } from '../../hooks/useNetworkError';
import { useFormValidation } from '../../hooks/useFormValidation';
import {
  LoadingButton,
  Input,
  EmptyState,
  NoDrinksEmptyState,
  NoOrdersEmptyState,
  SearchEmptyState,
  OfflineEmptyState,
  FormLoadingOverlay
} from '../UI';

/**
 * Demo component showcasing all error handling and empty state features
 * This component demonstrates:
 * - Toast notifications (success, error, warning, info)
 * - Network error handling with retry
 * - Form validation with inline errors
 * - Loading states for buttons and forms
 * - Empty state components
 * - Offline handling
 */
const ErrorHandlingDemo: React.FC = () => {
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  const { executeWithRetry, handleNetworkError, networkState } = useNetworkError();
  const [showEmptyStates, setShowEmptyStates] = useState(false);
  const [isFormLoading, setIsFormLoading] = useState(false);

  // Form validation example
  const {
    values,
    errors,
    touched,
    isValid,
    setValue,
    setTouched,
    handleSubmit,
    reset
  } = useFormValidation(
    { email: '', name: '', message: '' },
    {
      email: {
        required: true,
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      },
      name: {
        required: true,
        minLength: 2,
        maxLength: 50
      },
      message: {
        required: true,
        minLength: 10,
        maxLength: 500
      }
    }
  );

  // Toast examples
  const showToastExamples = () => {
    showSuccess('Success!', 'This is a success message with auto-dismiss.');
    
    setTimeout(() => {
      showError('Error occurred', 'This is an error message that stays longer.');
    }, 1000);
    
    setTimeout(() => {
      showWarning('Warning', 'This is a warning message.');
    }, 2000);
    
    setTimeout(() => {
      showInfo('Information', 'This is an info message.');
    }, 3000);
  };

  // Network error simulation
  const simulateNetworkError = async () => {
    try {
      await executeWithRetry(
        async () => {
          // Simulate network failure
          throw new Error('Network request failed');
        },
        {
          maxRetries: 2,
          onRetry: (attempt) => {
            showWarning('Retrying...', `Attempt ${attempt} of 3`);
          },
          onMaxRetriesReached: () => {
            showError('Max retries reached', 'Please try again later.');
          }
        }
      );
    } catch (error) {
      handleNetworkError(error, 'Demo operation');
    }
  };

  // Form submission example
  const onFormSubmit = async (formData: any) => {
    setIsFormLoading(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      showSuccess('Form submitted!', `Thank you ${formData.name}, your message has been sent.`);
      reset();
    } catch (error) {
      showError('Submission failed', 'Please try again.');
    } finally {
      setIsFormLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Error Handling & Empty States Demo
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Comprehensive demonstration of error handling, validation, and empty state components
        </p>
      </div>

      {/* Network Status */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-2">Network Status</h2>
        <div className="flex items-center space-x-4">
          <div className={`w-3 h-3 rounded-full ${networkState.isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
          <span>{networkState.isOnline ? 'Online' : 'Offline'}</span>
          {networkState.hasNetworkError && (
            <span className="text-error">Network Error Detected</span>
          )}
          {networkState.isRetrying && (
            <span className="text-warning">Retrying... ({networkState.retryCount})</span>
          )}
        </div>
      </div>

      {/* Toast Examples */}
      <div className="bg-white dark:bg-gray-900 rounded-lg p-6 shadow-card">
        <h2 className="text-xl font-semibold mb-4">Toast Notifications</h2>
        <div className="space-y-4">
          <LoadingButton onClick={showToastExamples} variant="primary">
            Show Toast Examples
          </LoadingButton>
          <LoadingButton onClick={simulateNetworkError} variant="secondary">
            Simulate Network Error
          </LoadingButton>
        </div>
      </div>

      {/* Form Validation Example */}
      <div className="bg-white dark:bg-gray-900 rounded-lg p-6 shadow-card relative">
        <FormLoadingOverlay isLoading={isFormLoading} message="Submitting form..." />
        
        <h2 className="text-xl font-semibold mb-4">Form Validation Example</h2>
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          <Input
            label="Email Address"
            type="email"
            value={values.email}
            onChange={(e) => setValue('email', e.target.value)}
            onBlur={() => setTouched('email')}
            error={touched.email ? errors.email : undefined}
            required
            leftIcon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
              </svg>
            }
          />
          
          <Input
            label="Full Name"
            value={values.name}
            onChange={(e) => setValue('name', e.target.value)}
            onBlur={() => setTouched('name')}
            error={touched.name ? errors.name : undefined}
            required
            leftIcon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            }
          />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Message <span className="text-error">*</span>
            </label>
            <textarea
              value={values.message}
              onChange={(e) => setValue('message', e.target.value)}
              onBlur={() => setTouched('message')}
              className={`input ${touched.message && errors.message ? 'border-error focus:border-error focus:ring-error/20' : ''}`}
              rows={4}
              placeholder="Enter your message..."
              required
            />
            {touched.message && errors.message && (
              <p className="text-sm text-error mt-1 flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {errors.message}
              </p>
            )}
          </div>
          
          <div className="flex space-x-3">
            <LoadingButton
              type="submit"
              isLoading={isFormLoading}
              loadingText="Submitting..."
              disabled={!isValid}
            >
              Submit Form
            </LoadingButton>
            <LoadingButton
              type="button"
              variant="secondary"
              onClick={() => reset()}
            >
              Reset
            </LoadingButton>
          </div>
        </form>
      </div>

      {/* Empty States Examples */}
      <div className="bg-white dark:bg-gray-900 rounded-lg p-6 shadow-card">
        <h2 className="text-xl font-semibold mb-4">Empty State Components</h2>
        <div className="space-y-4">
          <LoadingButton
            onClick={() => setShowEmptyStates(!showEmptyStates)}
            variant="secondary"
          >
            {showEmptyStates ? 'Hide' : 'Show'} Empty States
          </LoadingButton>
          
          {showEmptyStates && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">No Drinks</h3>
                <NoDrinksEmptyState onRefresh={() => showInfo('Refreshed', 'Data refreshed successfully')} />
              </div>
              
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">No Orders</h3>
                <NoOrdersEmptyState />
              </div>
              
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Search Results</h3>
                <SearchEmptyState 
                  searchTerm="mojito" 
                  onClearSearch={() => showInfo('Search cleared', 'Showing all results')} 
                />
              </div>
              
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Offline State</h3>
                <OfflineEmptyState onRetry={() => showInfo('Retrying', 'Attempting to reconnect...')} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Custom Empty State Example */}
      <div className="bg-white dark:bg-gray-900 rounded-lg p-6 shadow-card">
        <h2 className="text-xl font-semibold mb-4">Custom Empty State</h2>
        <EmptyState
          icon={
            <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          }
          title="Custom Empty State"
          description="This is a custom empty state component with an icon, title, description, and action button."
          action={{
            label: "Take Action",
            onClick: () => showSuccess('Action taken!', 'Custom empty state action was triggered.')
          }}
        />
      </div>
    </div>
  );
};

export default ErrorHandlingDemo;