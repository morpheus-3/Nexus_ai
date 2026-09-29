import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "SAP Nexus AI — Enterprise Intelligence Platform",
  description: "AI-powered multi-agent orchestration for SAP supply chain intelligence, fraud detection, and BDC automation.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[hsl(222_47%_8%)] text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
