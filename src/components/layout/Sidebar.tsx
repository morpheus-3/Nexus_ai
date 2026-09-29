"use client";
import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Bot, Package, ShieldAlert, FileCode2, CheckSquare,
  Activity, Settings, ScrollText, ChevronLeft, ChevronRight,
  Cpu, Zap, Menu, X,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/command", label: "AI Command Center", icon: Bot },
  { href: "/supply-chain", label: "Supply Chain", icon: Package },
  { href: "/fraud", label: "Fraud & Compliance", icon: ShieldAlert },
  { href: "/bdc", label: "BDC Automation", icon: FileCode2 },
  { href: "/approvals", label: "Approvals", icon: CheckSquare },
  { href: "/observability", label: "Agent Observability", icon: Activity },
  { href: "/audit", label: "Audit Log", icon: ScrollText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={cn("flex items-center gap-3 px-4 py-5 border-b border-[hsl(222_30%_18%)]", collapsed && "justify-center px-3")}>
        <div className="relative flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[hsl(185_84%_45%)] to-[hsl(200_84%_35%)] flex items-center justify-center">
            <Cpu className="w-4 h-4 text-[hsl(222_47%_8%)]" />
          </div>
          <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[hsl(222_47%_8%)]" />
        </div>
        {!collapsed && (
          <div>
            <p className="text-sm font-bold text-white tracking-tight">SAP Nexus AI</p>
            <p className="text-[10px] text-slate-500 font-medium">Enterprise Intelligence</p>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
        {navItems.map(item => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all group",
                active
                  ? "nav-item-active text-[hsl(185_84%_55%)] font-medium"
                  : "text-slate-400 hover:text-slate-200 hover:bg-[hsl(222_30%_14%)]",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className={cn("w-4 h-4 flex-shrink-0", active && "text-[hsl(185_84%_55%)]")} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Simulation Badge */}
      {!collapsed && (
        <div className="mx-3 mb-3 p-2.5 rounded-lg bg-sky-500/5 border border-sky-500/15">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
            <div>
              <p className="text-[10px] font-semibold text-sky-400">SIMULATION MODE</p>
              <p className="text-[10px] text-slate-500 mt-0.5">SAP operations are mocked</p>
            </div>
          </div>
        </div>
      )}

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-16 w-6 h-6 rounded-full bg-[hsl(222_40%_10%)] border border-[hsl(222_30%_22%)] flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors shadow-md hidden lg:flex"
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 w-9 h-9 flex items-center justify-center rounded-lg bg-[hsl(222_40%_10%)] border border-[hsl(222_30%_22%)] text-slate-400"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile sidebar */}
      <div className={cn(
        "lg:hidden fixed left-0 top-0 bottom-0 z-40 w-64 bg-[hsl(222_47%_8%)] border-r border-[hsl(222_30%_18%)] transition-transform duration-300",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="relative h-full">
          {renderSidebarContent()}
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className={cn(
        "hidden lg:flex flex-col relative border-r border-[hsl(222_30%_18%)] bg-[hsl(222_47%_8%)] transition-all duration-300 flex-shrink-0",
        collapsed ? "w-16" : "w-60"
      )}>
        {renderSidebarContent()}
      </div>
    </>
  );
}
