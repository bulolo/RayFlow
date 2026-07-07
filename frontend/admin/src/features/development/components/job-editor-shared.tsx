'use client';

import type { ReactNode } from 'react';
import { Badge, Button, Tooltip } from '@/components/ui';

interface EditorToolButtonProps {
  children: ReactNode;
  className: string;
  disabled?: boolean;
  onClick: () => void;
  tooltip: string;
}

export function EditorToolButton({
  children,
  className,
  disabled = false,
  onClick,
  tooltip,
}: EditorToolButtonProps) {
  return (
    <Tooltip content={tooltip}>
      <Button
        onClick={() => onClick()}
        disabled={disabled}
        variant="ghost"
        size="sm"
        className={className}
        aria-label={tooltip}
      >
        {children}
      </Button>
    </Tooltip>
  );
}

export function getJobStatusMeta(status?: string) {
  if (!status || status === 'CREATED') return null;

  if (status === 'RUNNING') {
    return {
      label: '运行中',
      dotClass: 'bg-emerald-500',
      badgeClass: 'border-emerald-200/60 bg-emerald-50 text-emerald-700',
    };
  }

  if (status === 'FINISHED') {
    return {
      label: '已完成',
      dotClass: 'bg-sky-500',
      badgeClass: 'border-sky-200/60 bg-sky-50 text-sky-700',
    };
  }

  if (status === 'FAILED' || status === 'ERROR') {
    return {
      label: '失败',
      dotClass: 'bg-rose-500',
      badgeClass: 'border-rose-200/60 bg-rose-50 text-rose-700',
    };
  }

  if (status === 'CANCELED' || status === 'STOPPED') {
    return {
      label: '已停止',
      dotClass: 'bg-zinc-400',
      badgeClass: 'border-zinc-200 bg-zinc-50 text-muted-foreground',
    };
  }

  if (status === 'PENDING') {
    return {
      label: '等待中',
      dotClass: 'bg-amber-500',
      badgeClass: 'border-amber-200/60 bg-amber-50 text-amber-700',
    };
  }

  return {
    label: status,
    dotClass: 'bg-zinc-300',
    badgeClass: 'border-zinc-200 bg-zinc-50 text-muted-foreground',
  };
}

export function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="last:border-0 flex items-center justify-between gap-4 border-b border-border/80 py-2">
      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="select-all break-all text-right text-xs font-semibold text-foreground">{value}</span>
    </div>
  );
}

export { Badge };
