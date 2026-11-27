import React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'bouncy-interactive inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-[0_2px_10px_rgba(0,0,0,0.12)] hover:shadow-[0_4px_14px_rgba(0,0,0,0.18)]',
        destructive:
          'bg-destructive text-destructive-foreground shadow-xs hover:opacity-90',
        outline:
          'border border-border bg-card text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:border-input hover:bg-secondary hover:shadow-[0_3px_10px_rgba(0,0,0,0.06)]',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-accent',
        ghost:
          'text-foreground hover:bg-secondary',
        active:
          'border border-primary bg-primary text-primary-foreground shadow-[0_2px_10px_rgba(0,0,0,0.14)]',
      },
      size: {
        default: 'h-8.5 px-3.5',
        sm: 'h-7 px-2.5 text-[11.5px]',
        lg: 'h-10 px-5 text-sm',
        icon: 'h-8.5 w-8.5',
        'icon-sm': 'h-7 w-7',
      },
    },
    defaultVariants: {
      variant: 'outline',
      size: 'default',
    },
  }
);

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = 'Button';

export { Button, buttonVariants };
