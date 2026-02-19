"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Globe, Sparkles, Zap, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useGoogleAuth } from "@/components/google-auth-provider-clean";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const features = [
  {
    title: "AI-Powered Research",
    description: "Advanced AI search with enhanced results on destinations, accommodations, and activities",
    icon: Sparkles,
  },
  {
    title: "Instant Generation",
    description: "Transform briefs into polished itineraries in under 30 seconds",
    icon: Zap,
  },
  {
    title: "Global Coverage",
    description: "Access to luxury destinations and experiences worldwide",
    icon: Globe,
  },
  {
    title: "Enterprise Security",
    description: "Bank-level encryption and data protection",
    icon: ShieldCheck,
  },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function DashboardPage() {
  const { user, loading } = useGoogleAuth();
  const router = useRouter();

  // Redirect to sign-in if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full size-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated (will redirect)
  if (!user) {
    return null;
  }

  return (
      <div className="p-8 lg:p-16 pl-24 lg:pl-32 max-w-[1400px] mx-auto">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
          className="mb-16 relative"
        >
          {/* Subtle decorative glow */}
          <div className="absolute -top-24 -left-20 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
          
          <h1 className="text-4xl lg:text-5xl font-bold tracking-tight mb-4 text-foreground relative z-10">
            Welcome back to Above + Beyond
          </h1>
          <p className="text-base lg:text-lg text-muted-foreground max-w-2xl text-pretty leading-relaxed relative z-10">
            Transform client briefs into extraordinary travel experiences with AI-powered research.
          </p>
          <div className="flex gap-4 mt-8 relative z-10">
            <Link href="/itinerary">
              <Button size="lg" className="group h-11 rounded-full px-6 shadow-soft hover:shadow-md transition-all border border-transparent hover:border-primary/10 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm">
                Create Itinerary
                <ArrowRight className="ml-2 size-4 transition-transform duration-300 ease-out group-hover:translate-x-1" strokeWidth={1.5} />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="h-11 rounded-full px-6 shadow-sm border-border/80 bg-background/50 backdrop-blur-sm hover:bg-muted/30 font-medium text-sm transition-all duration-300">
              View Demo
            </Button>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-16"
        >
          <motion.div variants={item}>
            <Card className="bg-card border-border/40 shadow-soft rounded-[20px] relative overflow-hidden transition-all hover:shadow-md">
              <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
              <CardContent className="p-7 relative z-10">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Options per brief</p>
                <div className="text-4xl font-bold text-foreground tabular-nums tracking-tight">3-5</div>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div variants={item}>
            <Card className="bg-card border-border/40 shadow-soft rounded-[20px] relative overflow-hidden transition-all hover:shadow-md">
              <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
              <CardContent className="p-7 relative z-10">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Avg generation</p>
                <div className="text-4xl font-bold text-foreground tabular-nums tracking-tight">30s</div>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div variants={item}>
            <Card className="bg-card border-border/40 shadow-soft rounded-[20px] relative overflow-hidden transition-all hover:shadow-md">
              <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
              <CardContent className="p-7 relative z-10">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">PDF Output</p>
                <div className="text-4xl font-bold text-foreground tabular-nums tracking-tight">100%</div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 gap-5"
        >
          {features.map((feature) => (
            <motion.div key={feature.title} variants={item}>
              <Card className="group transition-all duration-300 hover:border-primary/20 hover:shadow-md rounded-[20px] bg-card border-border/40 shadow-soft relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 pointer-events-none" />
                <CardHeader className="p-7 relative z-10">
                  <div className="flex items-start gap-5">
                    <div className="p-3 rounded-2xl bg-primary/[0.03] text-primary border border-primary/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.5)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] group-hover:scale-105 transition-transform duration-300">
                      <feature.icon className="size-6" strokeWidth={1.5} />
                    </div>
                    <div className="pt-0.5">
                      <CardTitle className="text-lg font-semibold tracking-tight">{feature.title}</CardTitle>
                      <CardDescription className="mt-2 text-sm text-muted-foreground/90 leading-relaxed">
                        {feature.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
  );
}
