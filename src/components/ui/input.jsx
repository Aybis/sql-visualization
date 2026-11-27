import React from 'react';
import { cn } from '@/lib/utils';

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        'flex h-9 w-full rounded-full border border-border bg-card px-3.5 py-1 text-xs text-foreground shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all duration-200 placeholder:text-muted-foreground hover:border-input hover:shadow-[0_4px_12px_rgba(0,0,0,0.07)] focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/10 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = 'Input';

export { Input };
