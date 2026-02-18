import React from 'react';
import Modal from './Modal';
import { Button, LoadingButton } from './index';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isLoading = false,
}) => {
  const handleConfirm = async () => {
    await onConfirm();
  };

  const variantStyles = {
    danger: {
      icon: '⚠️',
      iconBg: 'bg-red-100 dark:bg-red-900',
      iconColor: 'text-red-600 dark:text-red-400',
    },
    warning: {
      icon: '⚡',
      iconBg: 'bg-yellow-100 dark:bg-yellow-900',
      iconColor: 'text-yellow-600 dark:text-yellow-400',
    },
    info: {
      icon: 'ℹ️',
      iconBg: 'bg-blue-100 dark:bg-blue-900',
      iconColor: 'text-blue-600 dark:text-blue-400',
    },
  };

  const style = variantStyles[variant];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        {/* Icon */}
        <div className="flex justify-center">
          <div className={`w-12 h-12 rounded-full ${style.iconBg} ${style.iconColor} flex items-center justify-center text-2xl`}>
            {style.icon}
          </div>
        </div>

        {/* Message */}
        <p className="text-center text-gray-700 dark:text-gray-300 whitespace-pre-line">
          {message}
        </p>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelText}
          </Button>
          <LoadingButton
            variant={variant === 'warning' || variant === 'info' ? 'primary' : variant}
            onClick={handleConfirm}
            isLoading={isLoading}
            loadingText="Processing..."
          >
            {confirmText}
          </LoadingButton>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmDialog;
