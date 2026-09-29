import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-[hsl(222_47%_8%)] overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">{children}</div>
      </main>
    </div>
  );
}
