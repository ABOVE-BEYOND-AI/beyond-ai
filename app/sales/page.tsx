"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, TrendingUp, Users, Calendar } from "lucide-react";
import { motion } from "framer-motion";
import { useGoogleAuth } from "@/components/google-auth-provider-clean";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// Time period type
type TimePeriod = 'today' | 'week' | 'month';

// Interfaces for sales data
interface Deal {
  id: string;
  rep_name: string;
  deal_name: string;
  amount: number;
  created_at: string;
}

interface SalesRep {
  name: string;
  email: string;
  monthly_deals: number;
  monthly_amount: number;
  rank?: number;
}

interface DashboardData {
  total_amount: number;
  total_deals: number;
  recent_deals: Deal[];
  leaderboard: SalesRep[];
}

// Animation variants
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

// Format currency
const formatCurrency = (pence: number): string => {
  const pounds = pence / 100;
  return `£${pounds.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Filter deals by time period
const filterDealsByPeriod = (deals: Deal[], period: TimePeriod): Deal[] => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisWeek = new Date(today.getTime() - (today.getDay() * 24 * 60 * 60 * 1000));
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  return deals.filter(deal => {
    const dealDate = new Date(deal.created_at);
    switch (period) {
      case 'today':
        return dealDate >= today;
      case 'week':
        return dealDate >= thisWeek;
      case 'month':
        return dealDate >= thisMonth;
      default:
        return true;
    }
  });
};

export default function SalesPage() {
  const { user, loading } = useGoogleAuth();
  const router = useRouter();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('month');
  const [error, setError] = useState<string | null>(null);

  // Redirect to sign-in if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin');
    }
  }, [user, loading, router]);

  // Fetch sales data
  useEffect(() => {
    const fetchData = async () => {
      setDataLoading(true);
      setError(null);
      
      try {
        const response = await fetch('/api/sales/data');
        if (!response.ok) {
          throw new Error('Failed to fetch sales data');
        }
        
        const result = await response.json();
        setDashboardData({
          total_amount: result.data?.current_month?.total_amount || 0,
          total_deals: result.data?.current_month?.total_deals || 0,
          recent_deals: result.data?.recent_deals || [],
          leaderboard: result.data?.leaderboard || [],
        });
      } catch (err) {
        console.error('Error fetching sales data:', err);
        setError('Failed to load sales data');
        setDashboardData({
          total_amount: 0,
          total_deals: 0,
          recent_deals: [],
          leaderboard: [],
        });
      } finally {
        setDataLoading(false);
      }
    };

    if (user) {
      fetchData();
    }
  }, [user]);

  // Calculate filtered stats
  const filteredDeals = dashboardData ? filterDealsByPeriod(dashboardData.recent_deals, selectedPeriod) : [];
  const filteredAmount = filteredDeals.reduce((sum, deal) => sum + deal.amount, 0);
  const filteredCount = filteredDeals.length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
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
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <h1 className="text-4xl lg:text-6xl font-extrabold tracking-tight mb-4">
            Sales{" "}
            <span className="text-gradient">Dashboard</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-3xl">
            Track your team's performance with real-time sales data from Slack notifications.
          </p>
        </motion.div>

        {/* Time Filter Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex gap-2 mb-8"
        >
          <Button
            variant={selectedPeriod === 'today' ? 'default' : 'outline'}
            onClick={() => setSelectedPeriod('today')}
          >
            <Calendar className="h-4 w-4 mr-2" />
            Today
          </Button>
          <Button
            variant={selectedPeriod === 'week' ? 'default' : 'outline'}
            onClick={() => setSelectedPeriod('week')}
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            This Week
          </Button>
          <Button
            variant={selectedPeriod === 'month' ? 'default' : 'outline'}
            onClick={() => setSelectedPeriod('month')}
          >
            <DollarSign className="h-4 w-4 mr-2" />
            This Month
          </Button>
        </motion.div>

        {/* Error State */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="p-6">
                <p className="text-destructive">{error}</p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Sales Stats */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12"
        >
          <motion.div variants={item}>
            <Card className="glass border-primary/20">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-gradient-to-br from-green-400 to-emerald-500 shadow-lg">
                    <DollarSign className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <div className="text-4xl font-bold text-primary mb-1">
                      {dataLoading ? (
                        <div className="animate-pulse bg-gray-300 h-10 w-32 rounded"></div>
                      ) : (
                        <motion.span
                          key={`amount-${selectedPeriod}`}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.3 }}
                        >
                          {formatCurrency(filteredAmount)}
                        </motion.span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Total Sales ({selectedPeriod === 'today' ? 'Today' : selectedPeriod === 'week' ? 'This Week' : 'This Month'})
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={item}>
            <Card className="glass border-primary/20">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-gradient-to-br from-blue-400 to-purple-500 shadow-lg">
                    <TrendingUp className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <div className="text-4xl font-bold text-primary mb-1">
                      {dataLoading ? (
                        <div className="animate-pulse bg-gray-300 h-10 w-16 rounded"></div>
                      ) : (
                        <motion.span
                          key={`count-${selectedPeriod}`}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.3 }}
                        >
                          {filteredCount}
                        </motion.span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Deals Closed ({selectedPeriod === 'today' ? 'Today' : selectedPeriod === 'week' ? 'This Week' : 'This Month'})
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* Leaderboard & Recent Deals */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          {/* Leaderboard */}
          <motion.div variants={item}>
            <Card className="group hover:shadow-glow transition-all duration-300">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-gradient-to-br from-yellow-400 to-orange-500 shadow-lg">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Sales Leaderboard</CardTitle>
                    <CardDescription>Top performers this month</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {dataLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="animate-pulse bg-gray-300 h-8 w-8 rounded-full"></div>
                        <div className="flex-1">
                          <div className="animate-pulse bg-gray-300 h-4 w-24 rounded mb-1"></div>
                          <div className="animate-pulse bg-gray-300 h-3 w-16 rounded"></div>
                        </div>
                        <div className="animate-pulse bg-gray-300 h-4 w-20 rounded"></div>
                      </div>
                    ))}
                  </div>
                ) : dashboardData?.leaderboard.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No sales data yet</p>
                    <p className="text-sm">Deals will appear here when they come in from Slack</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dashboardData?.leaderboard.slice(0, 5).map((rep, index) => (
                      <motion.div
                        key={rep.email}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/80 text-white font-bold text-sm">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{rep.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {rep.monthly_deals} deals
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatCurrency(rep.monthly_amount)}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Recent Deals */}
          <motion.div variants={item}>
            <Card className="group hover:shadow-glow transition-all duration-300">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-gradient-to-br from-green-400 to-teal-500 shadow-lg">
                    <DollarSign className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Recent Deals</CardTitle>
                    <CardDescription>Latest sales activity</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {dataLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="animate-pulse bg-gray-300 h-4 w-32 rounded mb-1"></div>
                          <div className="animate-pulse bg-gray-300 h-3 w-20 rounded"></div>
                        </div>
                        <div className="animate-pulse bg-gray-300 h-4 w-16 rounded"></div>
                      </div>
                    ))}
                  </div>
                ) : filteredDeals.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <DollarSign className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No deals yet</p>
                    <p className="text-sm">Recent deals will appear here when they come in from Slack</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {filteredDeals.slice(0, 10).map((deal, index) => (
                      <motion.div
                        key={deal.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-sm">{deal.deal_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {deal.rep_name} • {new Date(deal.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-sm">{formatCurrency(deal.amount)}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}