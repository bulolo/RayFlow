import { X } from 'lucide-react';
import type React from 'react';
import { Button } from './button';
import { cn } from '@/lib/utils';

export interface ModalProps {
  children: React.ReactNode;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  cancelLabel?: string;
  showSubmit?: boolean;
  submitLabel?: string;
  submitClassName?: string;
  title: string;
  titleExtra?: React.ReactNode;
  onSubmit?: () => void | Promise<void>;
  disabled?: boolean;
  className?: string;
  bodyClassName?: string;
}

export function Modal({
  children,
  cancelLabel = '取消',
  onOpenChange,
  open,
  submitLabel = '创建',
  submitClassName,
  showSubmit = true,
  title,
  titleExtra,
  onSubmit,
  disabled = false,
  className,
  bodyClassName,
}: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/25 p-4 backdrop-blur-[4px]">
      <div className={cn('flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border-subtle bg-white shadow-[var(--shadow-modal)]', className)}>
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border-subtle px-6">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-base font-bold text-foreground">{title}</h2>
            {titleExtra}
          </div>
          <button type="button" aria-label="关闭" className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-slate-100 hover:text-foreground" onClick={() => onOpenChange(false)} disabled={disabled}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className={cn('min-h-0 flex-1 overflow-y-auto p-6', bodyClassName)}>{children}</div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-border-subtle bg-slate-50/50 px-6 py-4">
          <Button type="button" onClick={() => onOpenChange(false)} disabled={disabled}>
            {cancelLabel}
          </Button>
          {showSubmit ? (
            <Button
              type="button"
              variant="primary"
              onClick={onSubmit}
              disabled={disabled}
              className={submitClassName}
            >
              {submitLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
