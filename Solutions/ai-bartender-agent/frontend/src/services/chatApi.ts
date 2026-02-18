import { ChatRequest, ChatSSEEvent } from '../types/chat';

const CHAT_API_ENDPOINT = import.meta.env.VITE_CHAT_API_ENDPOINT || '';
const CHAT_API_KEY = import.meta.env.VITE_CHAT_API_KEY || import.meta.env.VITE_API_KEY || '';

/**
 * Send a chat message and stream the response via SSE.
 *
 * Uses fetch + ReadableStream because:
 * 1. The endpoint is POST (EventSource only supports GET)
 * 2. This is a separate API Gateway from the Amplify-configured REST API
 * 3. We need chunk-by-chunk processing for real-time streaming UI
 */
export async function streamChatMessage(
  request: ChatRequest,
  onChunk: (chunk: string, sessionId: string) => void,
  onDone: (fullResponse: string, sessionId: string) => void,
  onError: (error: string) => void,
  signal?: AbortSignal
): Promise<string | null> {
  try {
    const response = await fetch(`${CHAT_API_ENDPOINT}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CHAT_API_KEY,
      },
      body: JSON.stringify(request),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      onError(`HTTP ${response.status}: ${errorText}`);
      return null;
    }

    let sessionId = response.headers.get('X-Session-Id') || request.session_id || null;

    const reader = response.body?.getReader();
    if (!reader) {
      onError('Response body is not readable');
      return null;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse SSE events from the buffer (format: "data: {json}\n\n")
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';

      for (const event of events) {
        const lines = event.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6);
            try {
              const parsed: ChatSSEEvent = JSON.parse(jsonStr);

              if ('error' in parsed) {
                onError(parsed.error);
                return sessionId;
              }

              if ('done' in parsed && parsed.done) {
                sessionId = parsed.sessionId || sessionId;
                onDone(parsed.response, parsed.sessionId);
                return sessionId;
              }

              if ('chunk' in parsed) {
                sessionId = parsed.sessionId || sessionId;
                onChunk(parsed.chunk, parsed.sessionId);
              }
            } catch {
              // Ignore malformed JSON lines (could be heartbeats or comments)
            }
          }
        }
      }
    }

    return sessionId;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return null;
    }
    onError(err instanceof Error ? err.message : 'Failed to connect to chat service');
    return null;
  }
}
