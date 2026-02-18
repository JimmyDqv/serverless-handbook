import React from 'react';
import { motion } from 'framer-motion';
import { UserCircleIcon } from '@heroicons/react/24/solid';
import { ChatMessage as ChatMessageType } from '../../types/chat';
import { getAnimationVariants, slideUpVariants } from '../../utils/animations';
import ChatMarkdownRenderer from './ChatMarkdownRenderer';

interface ChatMessageProps {
  message: ChatMessageType;
  onRetry?: () => void;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, onRetry }) => {
  const isUser = message.role === 'user';
  const isError = message.role === 'error';

  return (
    <motion.div
      variants={getAnimationVariants(slideUpVariants)}
      initial="hidden"
      animate="visible"
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
    >
      <div
        className={`flex items-start gap-3 max-w-[85%] sm:max-w-[75%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
      >
        {/* Avatar */}
        <div
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
            isUser
              ? 'bg-primary-500 text-white'
              : isError
                ? 'bg-red-500 text-white'
                : 'bg-accent-500 text-white'
          }`}
        >
          {isUser ? (
            <UserCircleIcon className="h-5 w-5" />
          ) : (
            <span className="text-sm">🍹</span>
          )}
        </div>

        {/* Bubble */}
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white'
              : isError
                ? 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
                : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100'
          }`}
        >
          {isUser ? (
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          ) : isError ? (
            <div>
              <p className="text-sm">{message.content}</p>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="mt-2 text-xs font-medium text-red-600 dark:text-red-400 hover:underline"
                >
                  Try again
                </button>
              )}
            </div>
          ) : (
            <ChatMarkdownRenderer content={message.content} />
          )}

          {/* Streaming indicator */}
          {message.isStreaming && !message.content && (
            <div className="flex items-center gap-1 py-1">
              <span className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce [animation-delay:0ms]" />
              <span className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce [animation-delay:150ms]" />
              <span className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce [animation-delay:300ms]" />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default ChatMessage;
