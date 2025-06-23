// src/hooks/useConfirmation.tsx
import React, { useState, useCallback } from 'react';
import ConfirmationDialog from '@/components/ConfirmationDialog';

interface ConfirmationOptions {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'destructive' | 'default';
  icon?: React.ReactNode;
}

interface UseConfirmationReturn {
  ConfirmationComponent: React.FC;
  confirm: (options: ConfirmationOptions) => Promise<boolean>;
}

export const useConfirmation = (): UseConfirmationReturn => {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmationOptions | null>(null);
  const [resolvePromise, setResolvePromise] = useState<((value: boolean) => void) | null>(null);

  const confirm = useCallback((confirmationOptions: ConfirmationOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setOptions(confirmationOptions);
      setResolvePromise(() => resolve);
      setIsOpen(true);
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (resolvePromise) {
      resolvePromise(true);
    }
    setIsOpen(false);
    setResolvePromise(null);
  }, [resolvePromise]);

  const handleCancel = useCallback(() => {
    if (resolvePromise) {
      resolvePromise(false);
    }
    setIsOpen(false);
    setResolvePromise(null);
  }, [resolvePromise]);

  const ConfirmationComponent: React.FC = () => {
    if (!options) return null;

    return (
      <ConfirmationDialog
        isOpen={isOpen}
        onClose={handleCancel}
        onConfirm={handleConfirm}
        title={options.title}
        description={options.description}
        confirmText={options.confirmText}
        cancelText={options.cancelText}
        variant={options.variant}
        icon={options.icon}
      />
    );
  };

  return {
    ConfirmationComponent,
    confirm
  };
};