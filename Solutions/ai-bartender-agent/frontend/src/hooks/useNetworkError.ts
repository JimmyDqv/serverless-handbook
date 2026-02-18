import { useState, useCallback, useEffect } from 'react';
import { useToast } from '../contexts/ToastContext';

export interface NetworkErrorState {
  isOnline: boolean;
  hasNetworkError: boolean;
  retryCount: number;
  isRetrying: boolean;
}

export interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  exponentialBackoff?: boolean;
  onRetry?: (attempt: number) => void;
  onMaxRetriesReached?: () => void;
}

export interface UseNetworkErrorReturn {
  networkState: NetworkErrorState;
  executeWithRetry: <T>(
    operation: () => Promise<T>,
    options?: RetryOptions
  ) => Promise<T>;
  handleNetworkError: (error: any, context?: string) => void;
  retry: () => void;
  resetNetworkState: () => void;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  retryDelay: 1000,
  exponentialBackoff: true,
  onRetry: () => {},
  onMaxRetriesReached: () => {},
};

export function useNetworkError(): UseNetworkErrorReturn {
  const { showError } = useToast();
  
  const [networkState, setNetworkState] = useState<NetworkErrorState>({
    isOnline: navigator.onLine,
    hasNetworkError: false,
    retryCount: 0,
    isRetrying: false,
  });

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setNetworkState(prev => ({ ...prev, isOnline: true, hasNetworkError: false }));
      // No toast - OfflineIndicator already shows a visual indicator
    };

    const handleOffline = () => {
      setNetworkState(prev => ({ ...prev, isOnline: false, hasNetworkError: true }));
      // No toast - OfflineIndicator already shows a visual indicator
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const isNetworkError = useCallback((error: any): boolean => {
    // Check for common network error indicators
    if (!navigator.onLine) return true;
    
    // Check error types
    if (error instanceof TypeError && error.message.includes('fetch')) return true;
    if (error.name === 'NetworkError') return true;
    if (error.code === 'NETWORK_ERROR') return true;
    
    // Check HTTP status codes that indicate network issues
    if (error.response?.status >= 500) return true;
    if (error.response?.status === 408) return true; // Request Timeout
    if (error.response?.status === 429) return true; // Too Many Requests
    
    // Check for specific error messages
    const errorMessage = error.message?.toLowerCase() || '';
    const networkKeywords = [
      'network error',
      'connection failed',
      'timeout',
      'unreachable',
      'connection refused',
      'dns',
      'cors'
    ];
    
    return networkKeywords.some(keyword => errorMessage.includes(keyword));
  }, []);

  const sleep = useCallback((ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
  }, []);

  const executeWithRetry = useCallback(async <T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> => {
    const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
    let lastError: any;

    setNetworkState(prev => ({ ...prev, isRetrying: true, retryCount: 0 }));

    for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
      try {
        const result = await operation();
        
        // Success - reset network error state
        setNetworkState(prev => ({
          ...prev,
          hasNetworkError: false,
          retryCount: 0,
          isRetrying: false,
        }));
        
        return result;
      } catch (error) {
        lastError = error;
        
        setNetworkState(prev => ({ ...prev, retryCount: attempt + 1 }));

        // If this is not a network error, don't retry
        if (!isNetworkError(error)) {
          setNetworkState(prev => ({ ...prev, isRetrying: false }));
          throw error;
        }

        // If we've reached max retries, stop
        if (attempt === opts.maxRetries) {
          setNetworkState(prev => ({
            ...prev,
            hasNetworkError: true,
            isRetrying: false,
          }));
          opts.onMaxRetriesReached();
          break;
        }

        // Calculate delay for next retry
        const delay = opts.exponentialBackoff
          ? opts.retryDelay * Math.pow(2, attempt)
          : opts.retryDelay;

        opts.onRetry(attempt + 1);
        
        // Wait before retrying
        await sleep(delay);
      }
    }

    setNetworkState(prev => ({ ...prev, isRetrying: false }));
    throw lastError;
  }, [isNetworkError, sleep]);

  const handleNetworkError = useCallback((error: any, context = 'Operation') => {
    if (isNetworkError(error)) {
      setNetworkState(prev => ({ ...prev, hasNetworkError: true }));
      
      if (!navigator.onLine) {
        showError(
          'No internet connection',
          'Please check your connection and try again.',
        );
      } else {
        showError(
          `${context} failed`,
          'There was a network error. Please try again.',
        );
      }
    } else {
      // Handle non-network errors
      const errorMessage = error.response?.data?.message || error.message || 'An unexpected error occurred';
      showError(`${context} failed`, errorMessage);
    }
  }, [isNetworkError, showError]);

  const retry = useCallback(() => {
    setNetworkState(prev => ({
      ...prev,
      hasNetworkError: false,
      retryCount: 0,
      isRetrying: false,
    }));
  }, []);

  const resetNetworkState = useCallback(() => {
    setNetworkState({
      isOnline: navigator.onLine,
      hasNetworkError: false,
      retryCount: 0,
      isRetrying: false,
    });
  }, []);

  return {
    networkState,
    executeWithRetry,
    handleNetworkError,
    retry,
    resetNetworkState,
  };
}