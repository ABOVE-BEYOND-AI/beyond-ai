"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  return (
    <div className="relative h-screen bg-background">
      {/* Main content - full width, no padding (children handle their own padding) */}
      <main className="h-full overflow-hidden">
        <div className="h-full">
          {children}
        </div>
      </main>
      
      {/* Sidebar overlay */}
      <Sidebar onExpandChange={setSidebarExpanded} />
      
      {/* Dark overlay when sidebar is expanded on desktop */}
      {sidebarExpanded && (
        <div className="fixed inset-0 bg-black/20 z-30 hidden lg:block pointer-events-none" />
      )}
    </div>
  );
}