import React, { useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeftIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { useChat } from '../hooks/useChat';
import { getAnimationVariants, fadeVariants } from '../utils/animations';
import ChatMessage from '../components/Chat/ChatMessage';
import ChatInput from '../components/Chat/ChatInput';

const SUGGESTIONS = [
  'Recommend a drink',
  'What drinks do you have?',
  'I want something with gin',
];

const AdminBartenderChatPage: React.FC = () => {
  const { messages, isStreaming, sendMessage, cancelStream, resetChat, retryLastMessage } =
    useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Chat Header */}
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/admin"
              className="p-2 text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              aria-label="Back to admin"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                AI Bartender
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Ask about drinks and recipes
              </p>
            </div>
          </div>
          <button
            onClick={resetChat}
            className="p-2 text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            aria-label="New conversation"
            title="New conversation"
          >
            <ArrowPathIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-4xl mx-auto">
          {isEmpty ? (
            <motion.div
              variants={getAnimationVariants(fadeVariants)}
              initial="hidden"
              animate="visible"
              className="flex flex-col items-center justify-center h-full min-h-[50vh] text-center"
            >
              <div className="text-6xl mb-4">🍹</div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Hi! I'm your AI Bartender
              </h2>
              <p className="text-gray-600 dark:text-gray-400 max-w-md">
                Ask me about drinks, recipes, ingredients, or recommendations. I'm happy to help!
              </p>
              <div className="flex flex-wrap gap-2 mt-6 justify-center">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => sendMessage(suggestion)}
                    className="px-4 py-2 rounded-full border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:border-primary-300 dark:hover:border-primary-600 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </motion.div>
          ) : (
            <AnimatePresence>
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  onRetry={message.role === 'error' ? retryLastMessage : undefined}
                />
              ))}
            </AnimatePresence>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0">
        <ChatInput
          onSend={sendMessage}
          onCancel={cancelStream}
          isStreaming={isStreaming}
        />
      </div>
    </div>
  );
};

export default AdminBartenderChatPage;
