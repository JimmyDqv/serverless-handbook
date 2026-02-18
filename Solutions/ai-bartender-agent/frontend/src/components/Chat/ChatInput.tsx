import React, { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { PaperAirplaneIcon, StopIcon } from '@heroicons/react/24/solid';

interface ChatInputProps {
  onSend: (message: string) => void;
  onCancel: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSend, onCancel, isStreaming, disabled }) => {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      if (input.trim() && !isStreaming) {
        onSend(input);
        setInput('');
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
      }
    },
    [input, isStreaming, onSend]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
  };

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex items-end gap-3">
        <div className="flex-1">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            disabled={disabled}
            rows={1}
            className="input resize-none min-h-[44px] max-h-[150px] py-3 pr-4 w-full"
            aria-label="Type a message..."
          />
        </div>

        {isStreaming ? (
          <motion.button
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={onCancel}
            className="btn btn-danger flex-shrink-0 p-3 rounded-xl"
            aria-label="Cancel"
          >
            <StopIcon className="h-5 w-5" />
          </motion.button>
        ) : (
          <motion.button
            whileTap={{ scale: 0.95 }}
            type="submit"
            disabled={!input.trim() || disabled}
            className="btn btn-primary flex-shrink-0 p-3 rounded-xl disabled:opacity-50"
            aria-label="Send"
          >
            <PaperAirplaneIcon className="h-5 w-5" />
          </motion.button>
        )}
      </form>
    </div>
  );
};

export default ChatInput;
