"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Globe, MagicWand, Lightning, ShieldCheck } from "@phosphor-icons/react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useGoogleAuth } from "@/components/google-auth-provider-clean";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const features = [
  {
    title: "AI-Powered Research",
            description: "Advanced AI search with enhanced results on destinations, accommodations, and activities",
    icon: MagicWand,
  },
  {
    title: "Instant Generation",
    description: "Transform briefs into polished itineraries in under 30 seconds",
    icon: Lightning,
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
    <DashboardLayout>
      <div className="p-8 lg:p-16 pl-24 lg:pl-32 max-w-[1400px] mx-auto">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-16"
        >
          <h1 className="text-3xl lg:text-5xl font-bold tracking-tight mb-3 text-foreground">
            Welcome back to Above + Beyond
          </h1>
          <p className="text-base lg:text-lg text-muted-foreground max-w-2xl text-pretty">
            Transform client briefs into extraordinary travel experiences with AI-powered research.
          </p>
          <div className="flex gap-3 mt-8">
            <Link href="/itinerary">
              <Button size="lg" className="group rounded-full px-6">
                Create Itinerary
                <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="rounded-full px-6">
              View Demo
            </Button>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-16"
        >
          <motion.div variants={item}>
            <Card className="bg-card border border-border/50 shadow-sm rounded-2xl">
              <CardContent className="p-6">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Options per brief</p>
                <div className="text-3xl font-bold text-foreground tabular-nums">3-5</div>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div variants={item}>
            <Card className="bg-card border border-border/50 shadow-sm rounded-2xl">
              <CardContent className="p-6">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Avg generation</p>
                <div className="text-3xl font-bold text-foreground tabular-nums">30s</div>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div variants={item}>
            <Card className="bg-card border border-border/50 shadow-sm rounded-2xl">
              <CardContent className="p-6">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">PDF Output</p>
                <div className="text-3xl font-bold text-foreground tabular-nums">100%</div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {features.map((feature) => (
            <motion.div key={feature.title} variants={item}>
              <Card className="group transition-all duration-200 hover:border-foreground/20 hover:bg-muted/10 rounded-2xl bg-card border-border/50 shadow-sm">
                <CardHeader className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="p-2.5 rounded-lg bg-muted/50 text-foreground">
                      <feature.icon className="size-5" weight="fill" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold">{feature.title}</CardTitle>
                      <CardDescription className="mt-1 text-sm text-muted-foreground leading-relaxed">
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
    </DashboardLayout>
  );
}
