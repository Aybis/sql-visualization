import React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-sm border px-1.5 py-0.5 font-mono text-[10px] font-bold leading-none transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary/15 text-primary',
        secondary: 'border-transparent bg-secondary text-muted-foreground',
        outline: 'border-border text-foreground',
        pk: 'border-transparent bg-amber-500/15 text-amber-600 dark:text-amber-400',
        fk: 'border-transparent bg-blue-500/15 text-blue-600 dark:text-blue-400',
        uk: 'border-transparent bg-purple-500/15 text-purple-600 dark:text-purple-400',
        warn: 'border-transparent bg-amber-500/15 text-amber-600 dark:text-amber-400',
        success: 'border-transparent bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
