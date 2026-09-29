import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-9 w-full rounded-md border border-[hsl(222_30%_22%)] bg-[hsl(222_30%_14%)] px-3 py-1 text-sm text-slate-200 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(185_84%_45%)] focus-visible:border-[hsl(185_84%_45%)] disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
