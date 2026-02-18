import { useState, useCallback, useRef } from 'react';
import { ChatMessage, ChatRequest } from '../types/chat';
import { streamChatMessage } from '../services/chatApi';

const generateId = () => `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const useChat = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    setError(null);

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };

    const assistantMessageId = generateId();
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    };

    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setIsStreaming(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const request: ChatRequest = {
      message: text.trim(),
      session_id: sessionId || undefined,
    };

    const newSessionId = await streamChatMessage(
      request,
      (chunk: string) => {
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantMessageId
              ? { ...msg, content: msg.content + chunk }
              : msg
          )
        );
      },
      (fullResponse: string, respSessionId: string) => {
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantMessageId
              ? { ...msg, content: fullResponse, isStreaming: false }
              : msg
          )
        );
        setSessionId(respSessionId);
      },
      (errorMsg: string) => {
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantMessageId
              ? { ...msg, role: 'error' as const, content: errorMsg, isStreaming: false }
              : msg
          )
        );
        setError(errorMsg);
      },
      abortController.signal
    );

    if (newSessionId) {
      setSessionId(newSessionId);
    }

    // Finalize any still-streaming messages (e.g. if stream ended abruptly)
    setMessages(prev =>
      prev.map(msg =>
        msg.id === assistantMessageId && msg.isStreaming
          ? { ...msg, isStreaming: false }
          : msg
      )
    );

    setIsStreaming(false);
    abortControllerRef.current = null;
  }, [isStreaming, sessionId]);

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setMessages(prev =>
      prev.map(msg =>
        msg.isStreaming ? { ...msg, isStreaming: false } : msg
      )
    );
  }, []);

  const resetChat = useCallback(() => {
    cancelStream();
    setMessages([]);
    setSessionId(null);
    setError(null);
  }, [cancelStream]);

  const retryLastMessage = useCallback(() => {
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMessage) return;

    // Remove the error message that followed the last user message
    setMessages(prev => {
      const lastUserIdx = prev.map(m => m.role).lastIndexOf('user');
      return prev.slice(0, lastUserIdx);
    });

    setTimeout(() => {
      sendMessage(lastUserMessage.content);
    }, 50);
  }, [messages, sendMessage]);

  return {
    messages,
    sessionId,
    isStreaming,
    error,
    sendMessage,
    cancelStream,
    resetChat,
    retryLastMessage,
  };
};
