import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';

export function Badge({
  className,
  tone = 'neutral',
  ...props
}: ComponentPropsWithoutRef<'span'> & {
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
}) {
  const tones = {
    neutral: 'border border-slate-200 bg-slate-50 text-slate-600 ring-slate-500/10',
    success: 'border border-emerald-200 bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    warning: 'border border-amber-200 bg-amber-50 text-amber-700 ring-amber-600/20',
    danger: 'border border-rose-200 bg-rose-50 text-rose-700 ring-rose-600/20',
    info: 'border border-blue-200 bg-blue-50 text-blue-700 ring-blue-600/20',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset',
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

