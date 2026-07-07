import type React from 'react';

import { Modal } from './modal';

export interface ConfirmModalProps {
  confirmLabel?: string;
  description: React.ReactNode;
  onClose: () => void;
  onConfirm: () => void;
  open: boolean;
  title: string;
  tone?: 'default' | 'danger';
}

export function ConfirmModal({
  confirmLabel = '确认',
  description,
  onClose,
  onConfirm,
  open,
  title,
  tone = 'default',
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <Modal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      title={title}
      submitLabel={confirmLabel}
      submitClassName={tone === 'danger' ? 'border-rose-750 bg-rose-600 text-white hover:bg-rose-500 hover:text-white' : undefined}
      onSubmit={onConfirm}
      className="max-w-sm"
      bodyClassName="px-6 py-5"
    >
      <div className="text-sm leading-relaxed text-muted-foreground">{description}</div>
    </Modal>
  );
}
