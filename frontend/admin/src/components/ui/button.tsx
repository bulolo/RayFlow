import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg border border-transparent font-semibold transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-primary/15 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/95',
        secondary: 'border-border bg-white text-foreground shadow-sm hover:bg-zinc-50',
        ghost: 'border-transparent bg-transparent text-muted-foreground hover:bg-zinc-50 hover:text-foreground',
      },
      size: {
        default: 'h-9 px-3.5 text-sm',
        sm: 'h-8 px-2.5 text-xs',
        lg: 'h-10 px-4 text-base',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'default',
    },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild,
  ...props
}: ComponentPropsWithoutRef<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

