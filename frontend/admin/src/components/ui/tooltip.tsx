import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface TooltipProps {
  children: ReactNode;
  className?: string;
  content: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  tooltipClassName?: string;
}

const sideClassName: Record<NonNullable<TooltipProps['side']>, string> = {
  top: 'bottom-full left-1/2 mb-1.5 -translate-x-1/2',
  right: 'left-full top-1/2 ml-2 -translate-y-1/2',
  bottom: 'top-full left-1/2 mt-1.5 -translate-x-1/2',
  left: 'right-full top-1/2 mr-2 -translate-y-1/2',
};

export function Tooltip({
  children,
  className,
  content,
  side = 'bottom',
  tooltipClassName,
}: TooltipProps) {
  return (
    <div className={cn('group relative', className)}>
      {children}
      <div
        className={cn(
          'pointer-events-none absolute z-20 opacity-0 transition duration-150 group-hover:opacity-100',
          sideClassName[side],
        )}
      >
        <div className={cn('whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white shadow-lg', tooltipClassName)}>
          {content}
        </div>
      </div>
    </div>
  );
}
