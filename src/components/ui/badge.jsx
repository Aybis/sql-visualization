import React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold leading-none transition-colors',
  {
    variants: {
      variant: {
        default: 'border-border bg-secondary text-foreground',
        secondary: 'border-transparent bg-secondary text-muted-foreground',
        outline: 'border-border text-foreground',
        pk: 'border-transparent bg-primary text-primary-foreground',
        fk: 'border-border bg-secondary text-foreground',
        uk: 'border-transparent bg-muted text-muted-foreground',
        warn: 'border-dashed border-foreground/40 bg-secondary text-foreground',
        success: 'border-border bg-secondary text-foreground',
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
