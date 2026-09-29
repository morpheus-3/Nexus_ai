import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-[hsl(185_84%_45%)] text-[hsl(222_47%_8%)] hover:bg-[hsl(185_84%_40%)] font-semibold",
        destructive: "bg-red-600 text-white hover:bg-red-700",
        outline: "border border-[hsl(222_30%_22%)] bg-transparent text-slate-300 hover:bg-[hsl(222_30%_16%)] hover:text-white",
        secondary: "bg-[hsl(222_30%_16%)] text-slate-300 hover:bg-[hsl(222_30%_20%)]",
        ghost: "text-slate-400 hover:bg-[hsl(222_30%_14%)] hover:text-slate-200",
        link: "text-[hsl(185_84%_45%)] underline-offset-4 hover:underline p-0 h-auto",
        warning: "bg-yellow-600/20 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-600/30",
        success: "bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/30",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-11 rounded-md px-6 text-base",
        icon: "h-9 w-9",
        "icon-sm": "h-7 w-7 rounded",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
