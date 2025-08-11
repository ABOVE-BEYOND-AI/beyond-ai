"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";

interface EventItem {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  location: string;
  description: string;
  category: string;
}

export default function EventsPage() {
  const [items, setItems] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch(`/api/events?limit=200`);
        const data = await res.json();
        setItems(data.items || []);
      } catch (_e) {
        setError("Failed to load events");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-6 lg:p-8 pl-24">
        <div className="max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-3xl font-bold mb-6">Upcoming Events</h1>
          </motion.div>

          {loading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : error ? (
            <p className="text-destructive">{error}</p>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground">No events yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map((e, idx) => (
                <motion.div key={e.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.02 }}>
                  <Card className="hover:bg-accent/30 transition-colors">
                    <CardHeader>
                      <CardTitle className="text-lg">{e.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-muted-foreground">
                        <p>{new Date(e.startDate).toLocaleDateString()} – {new Date(e.endDate).toLocaleDateString()}</p>
                        <p className="mt-1">{e.location}</p>
                        <p className="mt-2 line-clamp-3">{e.description}</p>
                        <div className="mt-3 inline-block text-xs px-2 py-1 rounded bg-muted">{e.category}</div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}


