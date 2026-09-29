import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string, currency = "USD"): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(num);
}

export function formatNumber(num: number | string, decimals = 0): string {
  const n = typeof num === "string" ? parseFloat(num) : num;
  if (isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);
}

export function formatDate(date: Date | string | null | undefined, format: "short" | "long" | "relative" = "short"): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";

  if (format === "relative") {
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor(diff / 60000);
    if (days > 30) return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return "just now";
  }
  if (format === "long") {
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function getRiskColor(score: number): string {
  if (score >= 80) return "text-red-400";
  if (score >= 60) return "text-orange-400";
  if (score >= 40) return "text-yellow-400";
  return "text-emerald-400";
}

export function getRiskBg(score: number): string {
  if (score >= 80) return "bg-red-500/10 border-red-500/20";
  if (score >= 60) return "bg-orange-500/10 border-orange-500/20";
  if (score >= 40) return "bg-yellow-500/10 border-yellow-500/20";
  return "bg-emerald-500/10 border-emerald-500/20";
}

export function getRiskLabel(score: number): string {
  if (score >= 80) return "Critical";
  if (score >= 60) return "High";
  if (score >= 40) return "Medium";
  return "Low";
}

export function getSeverityColor(severity: string): string {
  switch (severity?.toLowerCase()) {
    case "critical": return "text-red-400";
    case "high": return "text-orange-400";
    case "medium": return "text-yellow-400";
    case "low": return "text-emerald-400";
    default: return "text-slate-400";
  }
}

export function getStatusColor(status: string): string {
  switch (status?.toLowerCase()) {
    case "completed": case "delivered": case "approved": case "cleared": case "paid": case "valid": case "success":
      return "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
    case "pending": case "open": case "unreviewed": case "running":
      return "text-sky-400 bg-sky-400/10 border-sky-400/20";
    case "delayed": case "warning": case "under_review":
      return "text-yellow-400 bg-yellow-400/10 border-yellow-400/20";
    case "blocked": case "failed": case "critical": case "escalated": case "error": case "invalid":
      return "text-red-400 bg-red-400/10 border-red-400/20";
    case "cancelled": case "rejected":
      return "text-slate-400 bg-slate-400/10 border-slate-400/20";
    default:
      return "text-slate-400 bg-slate-400/10 border-slate-400/20";
  }
}

export function generateId(prefix: string): string {
  const num = Math.floor(Math.random() * 9000) + 1000;
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${num}`;
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "…";
}
