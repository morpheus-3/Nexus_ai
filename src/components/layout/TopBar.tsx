"use client";
import React from "react";

interface TopBarProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function TopBar({ title, subtitle, actions }: TopBarProps) {
  return (
    <header className="h-14 border-b border-[hsl(222_30%_18%)] bg-[hsl(222_47%_8%)/80] backdrop-blur-sm flex items-center justify-between px-6 flex-shrink-0 sticky top-0 z-30">
      <div>
        <h1 className="text-base font-semibold text-slate-100">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {actions}
      </div>
    </header>
  );
}
