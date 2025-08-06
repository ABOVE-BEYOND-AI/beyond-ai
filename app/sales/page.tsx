"use client";

import { DashboardLayout } from "@/components/dashboard-layout";

export default function SalesPage() {
  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-background to-background/95 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-card/50 backdrop-blur-xl rounded-xl border border-border/50 p-8 shadow-lg">
            <h1 className="text-3xl font-bold text-foreground mb-4">Sales Dashboard</h1>
            <p className="text-muted-foreground">
              This page is coming soon. Sales features will be available here.
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}