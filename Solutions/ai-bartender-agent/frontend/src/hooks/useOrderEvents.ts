import { useEffect, useRef, useState } from 'react';
import { Order } from '../types';

// Event types from backend
export type OrderEventType = 'ORDER_CREATED' | 'ORDER_STATUS_CHANGED' | 'ORDER_COMPLETED';

export interface OrderEvent {
  type: OrderEventType;
  data: Order & {
    previous_status?: string;
  };
}

interface UseOrderEventsOptions {
  channel: string;
  onOrderCreated?: (order: Order) => void;
  onOrderStatusChanged?: (order: Order, previousStatus?: string) => void;
  onOrderCompleted?: (order: Order) => void;
  onError?: (error: Error) => void;
  enabled?: boolean;
}

interface UseOrderEventsReturn {
  isConnected: boolean;
  error: Error | null;
}

const APPSYNC_REALTIME_ENDPOINT = import.meta.env.VITE_APPSYNC_EVENTS_REALTIME_ENDPOINT;
const APPSYNC_API_KEY = import.meta.env.VITE_APPSYNC_EVENTS_API_KEY;

// Base64 URL encoding as required by AppSync Events WebSocket protocol
// The auth header is passed as a subprotocol: header-{base64url-encoded-auth}
function getBase64URLEncoded(obj: object): string {
  return btoa(JSON.stringify(obj))
    .replace(/\+/g, '-')  // Convert '+' to '-'
    .replace(/\//g, '_')  // Convert '/' to '_'
    .replace(/=+$/, '');  // Remove padding '='
}

function getAuthProtocol(authorization: object): string {
  const header = getBase64URLEncoded(authorization);
  return `header-${header}`;
}

export const useOrderEvents = ({
  channel,
  onOrderCreated,
  onOrderStatusChanged,
  onOrderCompleted,
  onError,
  enabled = true,
}: UseOrderEventsOptions): UseOrderEventsReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const subscriptionIdRef = useRef<string | null>(null);
  const maxReconnectAttempts = 5;
  const connectRef = useRef<() => void>(() => {});

  // Use refs for callbacks to prevent reconnection loops
  const onOrderCreatedRef = useRef(onOrderCreated);
  const onOrderStatusChangedRef = useRef(onOrderStatusChanged);
  const onOrderCompletedRef = useRef(onOrderCompleted);
  const onErrorRef = useRef(onError);

  // Keep refs updated
  useEffect(() => {
    onOrderCreatedRef.current = onOrderCreated;
    onOrderStatusChangedRef.current = onOrderStatusChanged;
    onOrderCompletedRef.current = onOrderCompleted;
    onErrorRef.current = onError;
  }, [onOrderCreated, onOrderStatusChanged, onOrderCompleted, onError]);

  useEffect(() => {
    if (!APPSYNC_REALTIME_ENDPOINT || !APPSYNC_API_KEY) {
      console.warn('AppSync Events not configured, real-time updates disabled');
      return;
    }

    if (!enabled) {
      // Clean up if disabled
      if (wsRef.current) {
        wsRef.current.close(1000, 'Disabled');
        wsRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    // Don't reconnect if already connected to the same channel
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return;
    }

    const connect = () => {
      // Store connect function in ref for visibility change handler
      connectRef.current = connect;
      // Clean up existing connection
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      try {
        // AppSync Events WebSocket connection
        // Realtime endpoint: xxx.appsync-realtime-api.region.amazonaws.com
        // HTTP endpoint (for host header): xxx.appsync-api.region.amazonaws.com
        const realtimeDomain = APPSYNC_REALTIME_ENDPOINT.replace('wss://', '').replace('https://', '').replace(/\/$/, '');
        // The host in authorization must be the HTTP API domain (appsync-api, not appsync-realtime-api)
        const httpDomain = realtimeDomain.replace('appsync-realtime-api', 'appsync-api');

        // Authorization object for API_KEY auth
        const authorization = {
          host: httpDomain,
          'x-api-key': APPSYNC_API_KEY,
        };

        // Get the auth protocol subprotocol (header-{base64url-encoded-auth})
        const authProtocol = getAuthProtocol(authorization);

        // Construct WebSocket URL (no query params needed - auth is in subprotocol)
        const wsUrl = `wss://${realtimeDomain}/event/realtime`;

        console.log('Connecting to AppSync Events:', wsUrl);

        // Connect with both required subprotocols
        const ws = new WebSocket(wsUrl, ['aws-appsync-event-ws', authProtocol]);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('WebSocket opened, sending connection_init');

          // Send connection init message
          ws.send(JSON.stringify({
            type: 'connection_init',
          }));
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);

            switch (message.type) {
              case 'connection_ack':
                console.log('Connection acknowledged, subscribing to channel:', channel);
                setIsConnected(true);
                setError(null);
                reconnectAttemptsRef.current = 0;

                // Subscribe to channel after connection is acknowledged
                subscriptionIdRef.current = crypto.randomUUID();
                ws.send(JSON.stringify({
                  type: 'subscribe',
                  id: subscriptionIdRef.current,
                  channel: channel,
                  authorization: {
                    host: httpDomain,
                    'x-api-key': APPSYNC_API_KEY,
                  },
                }));
                break;

              case 'subscribe_success':
                console.log('Successfully subscribed to channel:', channel);
                break;

              case 'data':
                // Handle incoming event
                console.log('Received data event:', message);
                if (message.event) {
                  const eventData = typeof message.event === 'string'
                    ? JSON.parse(message.event)
                    : message.event;

                  const order = eventData.data;
                  switch (eventData.type) {
                    case 'ORDER_CREATED':
                      onOrderCreatedRef.current?.(order);
                      break;
                    case 'ORDER_STATUS_CHANGED':
                      onOrderStatusChangedRef.current?.(order, eventData.data.previous_status);
                      break;
                    case 'ORDER_COMPLETED':
                      onOrderCompletedRef.current?.(order);
                      break;
                  }
                }
                break;

              case 'error':
              case 'connection_error':
                console.error('WebSocket error message:', message);
                const errorMsg = message.errors?.[0]?.message || message.errors?.[0]?.errorType || 'WebSocket error';
                console.error('Error details:', JSON.stringify(message.errors, null, 2));
                setError(new Error(errorMsg));
                onErrorRef.current?.(new Error(errorMsg));
                break;

              case 'ka':
                // Keep-alive, ignore silently
                break;

              default:
                console.log('Unknown message type:', message.type, message);
            }
          } catch (e) {
            console.error('Error parsing WebSocket message:', e, event.data);
          }
        };

        ws.onerror = (event) => {
          console.error('WebSocket error event:', event);
          setError(new Error('WebSocket connection error'));
          setIsConnected(false);
          onErrorRef.current?.(new Error('WebSocket connection error'));
        };

        ws.onclose = (event) => {
          console.log('WebSocket closed:', event.code, event.reason);
          setIsConnected(false);
          wsRef.current = null;
          subscriptionIdRef.current = null;

          // Attempt reconnect if not a clean close and under max attempts
          if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts && enabled) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
            console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`);

            reconnectTimeoutRef.current = setTimeout(() => {
              reconnectAttemptsRef.current++;
              connect();
            }, delay);
          }
        };
      } catch (e) {
        console.error('Error creating WebSocket:', e);
        setError(e instanceof Error ? e : new Error('Failed to create WebSocket'));
      }
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounting');
        wsRef.current = null;
      }
    };
  }, [channel, enabled]); // Only reconnect when channel or enabled changes

  // Reconnect when page becomes visible again (user returns from sleep/background)
  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Check if WebSocket is disconnected or in a bad state
        const ws = wsRef.current;
        const needsReconnect = !ws ||
          ws.readyState === WebSocket.CLOSED ||
          ws.readyState === WebSocket.CLOSING;

        if (needsReconnect) {
          console.log('Page became visible, reconnecting WebSocket...');
          reconnectAttemptsRef.current = 0; // Reset attempts on visibility change
          connectRef.current();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled]);

  return {
    isConnected,
    error,
  };
};

// Convenience hook for admin channel
export const useAdminOrderEvents = (options: Omit<UseOrderEventsOptions, 'channel'>) => {
  return useOrderEvents({
    ...options,
    channel: '/orders/admin',
  });
};

// Convenience hook for user-specific channel
export const useUserOrderEvents = (userKey: string | null, options: Omit<UseOrderEventsOptions, 'channel'>) => {
  return useOrderEvents({
    ...options,
    channel: `/orders/user/${userKey}`,
    enabled: !!userKey && (options.enabled ?? true),
  });
};
