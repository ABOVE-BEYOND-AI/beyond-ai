"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Globe, Sparkles, Zap, Shield } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

const features = [
  {
    title: "AI-Powered Research",
            description: "Advanced AI search with enhanced results on destinations, accommodations, and activities",
    icon: Sparkles,
    gradient: "from-yellow-400 to-orange-500",
  },
  {
    title: "Instant Generation",
    description: "Transform briefs into polished itineraries in under 30 seconds",
    icon: Zap,
    gradient: "from-blue-400 to-purple-500",
  },
  {
    title: "Global Coverage",
    description: "Access to luxury destinations and experiences worldwide",
    icon: Globe,
    gradient: "from-green-400 to-teal-500",
  },
  {
    title: "Enterprise Security",
    description: "Bank-level encryption and data protection",
    icon: Shield,
    gradient: "from-red-400 to-pink-500",
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
          <h1 className="text-4xl lg:text-6xl font-extrabold tracking-tight mb-4">
            Welcome to{" "}
            <span className="text-gradient">Above + Beyond</span>
          </h1>
          <p className="text-lg lg:text-xl text-muted-foreground max-w-3xl">
            Transform client briefs into extraordinary travel experiences with AI-powered research 
            and beautiful Canva templates. Create luxury itineraries that exceed expectations.
          </p>
          <div className="flex gap-4 mt-8">
            <Link href="/itinerary">
              <Button size="lg" variant="premium" className="group">
                Create Itinerary
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
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
                <div className="text-4xl font-bold text-primary mb-2">3-5</div>
                <p className="text-sm text-muted-foreground">
                  Unique trip options per brief
                </p>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div variants={item}>
            <Card className="glass border-primary/20">
              <CardContent className="p-6">
                <div className="text-4xl font-bold text-primary mb-2">30s</div>
                <p className="text-sm text-muted-foreground">
                  Average generation time
                </p>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div variants={item}>
            <Card className="glass border-primary/20">
              <CardContent className="p-6">
                <div className="text-4xl font-bold text-primary mb-2">100%</div>
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
              <Card className="group hover:shadow-glow transition-all duration-300 hover:-translate-y-1">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-lg bg-gradient-to-br ${feature.gradient} shadow-lg`}>
                      <feature.icon className="h-6 w-6 text-white" />
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