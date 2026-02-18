export type ChatMessageRole = 'user' | 'assistant' | 'error';

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export interface ChatSSEChunkEvent {
  chunk: string;
  sessionId: string;
}

export interface ChatSSEDoneEvent {
  done: true;
  sessionId: string;
  response: string;
}

export interface ChatSSEErrorEvent {
  error: string;
  sessionId: string;
}

export type ChatSSEEvent = ChatSSEChunkEvent | ChatSSEDoneEvent | ChatSSEErrorEvent;

export interface ChatRequest {
  message: string;
  session_id?: string;
  actor_id?: string;
}
