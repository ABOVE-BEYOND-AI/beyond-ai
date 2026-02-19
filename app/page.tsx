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
      <div className="p-6 lg:p-12 pl-32">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-12"
        >
          <h1 className="text-4xl lg:text-6xl font-extrabold tracking-tight mb-4 text-balance">
            Welcome to{" "}
            <span className="text-gradient">Above + Beyond</span>
          </h1>
          <p className="text-lg lg:text-xl text-muted-foreground max-w-3xl text-pretty">
            Transform client briefs into extraordinary travel experiences with AI-powered research
            and beautiful Canva templates. Create luxury itineraries that exceed expectations.
          </p>
          <div className="flex gap-4 mt-8">
            <Link href="/itinerary">
              <Button size="lg" variant="premium" className="group">
                Create Itinerary
                <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Button size="lg" variant="outline">
              View Demo
            </Button>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12"
        >
          <motion.div variants={item}>
            <Card className="glass border-primary/20">
              <CardContent className="p-6">
                <div className="text-4xl font-bold text-primary mb-2 tabular-nums">3-5</div>
                <p className="text-sm text-muted-foreground">
                  Unique trip options per brief
                </p>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div variants={item}>
            <Card className="glass border-primary/20">
              <CardContent className="p-6">
                <div className="text-4xl font-bold text-primary mb-2 tabular-nums">30s</div>
                <p className="text-sm text-muted-foreground">
                  Average generation time
                </p>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div variants={item}>
            <Card className="glass border-primary/20">
              <CardContent className="p-6">
                <div className="text-4xl font-bold text-primary mb-2 tabular-nums">100%</div>
                <p className="text-sm text-muted-foreground">
                  Professional PDF output
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          {features.map((feature) => (
            <motion.div key={feature.title} variants={item}>
              <Card className="group hover:shadow-lg transition-shadow duration-300 hover:-translate-y-1">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-muted">
                      <feature.icon className="size-6 text-foreground" weight="duotone" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{feature.title}</CardTitle>
                      <CardDescription className="mt-1">
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
