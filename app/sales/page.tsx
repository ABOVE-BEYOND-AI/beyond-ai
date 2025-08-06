"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, TrendingUp, Users, Calendar } from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCrown } from "@fortawesome/free-solid-svg-icons";
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
const formatCurrency = (pounds: number): string => {
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
  
  // For "This Month", use pre-calculated totals; for Today/Week, use filtered deals
  const displayAmount = selectedPeriod === 'month' 
    ? (dashboardData?.total_amount || 0)
    : filteredDeals.reduce((sum, deal) => sum + deal.amount, 0);
  
  const displayCount = selectedPeriod === 'month'
    ? (dashboardData?.total_deals || 0)
    : filteredDeals.length;

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
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-6 lg:p-8 pl-24">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight mb-2">
            Sales{" "}
            <span className="text-gradient">Dashboard</span>
          </h1>
          <p className="text-muted-foreground">
            Track your team&apos;s performance with real-time sales data from Slack notifications.
          </p>
        </motion.div>

        {/* Main Content Area */}
        <div className="max-w-7xl mx-auto">
          {/* Beautiful Tab Navigation */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex justify-center mb-12"
          >
            <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-full p-1.5 shadow-lg">
              <div className="flex gap-1">
                {(['today', 'week', 'month'] as TimePeriod[]).map((period) => (
                  <button
                    key={period}
                    onClick={() => setSelectedPeriod(period)}
                    className={`
                      px-6 py-3 rounded-full text-sm font-medium transition-all duration-300 relative
                      ${selectedPeriod === period 
                        ? 'bg-primary text-primary-foreground shadow-lg scale-105' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      }
                    `}
                  >
                    {period === 'today' && 'Today'}
                    {period === 'week' && 'Week'}
                    {period === 'month' && 'Month'}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Hero Amount Display */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="text-center mb-16"
          >
            <div className="relative">
              <div className="text-8xl lg:text-9xl font-black tracking-tighter leading-none">
                <span className="bg-gradient-to-b from-foreground via-foreground to-foreground/60 bg-clip-text text-transparent">
                  {dataLoading ? (
                    <div className="animate-pulse bg-muted/50 h-32 w-96 mx-auto rounded-xl"></div>
                  ) : (
                    <motion.span
                      key={`amount-${selectedPeriod}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5 }}
                    >
                      {formatCurrency(displayAmount)}
                    </motion.span>
                  )}
                </span>
              </div>
              {/* Subtle bottom gradient overlay */}
              <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-full h-12 bg-gradient-to-t from-background/60 to-transparent pointer-events-none"></div>
            </div>
            <motion.p
              key={`subtitle-${selectedPeriod}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="text-xl text-muted-foreground mt-4"
            >
              {dataLoading ? (
                <div className="animate-pulse bg-muted/50 h-6 w-48 mx-auto rounded"></div>
              ) : (
                `${displayCount} deal${displayCount !== 1 ? 's' : ''} closed ${
                  selectedPeriod === 'today' ? 'today' : 
                  selectedPeriod === 'week' ? 'this week' : 
                  'this month'
                }`
              )}
            </motion.p>
          </motion.div>
        </div>

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

          {/* Sales Leaderboard - Horizontal Scroll */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mb-8"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 shadow-lg">
                <FontAwesomeIcon icon={faCrown} className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Sales Leaderboard</h2>
                <p className="text-muted-foreground">Top performers this month</p>
              </div>
            </div>
            
            {dataLoading ? (
              <div className="flex gap-4 overflow-hidden">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex-shrink-0 w-72 bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6">
                    <div className="animate-pulse">
                      <div className="bg-muted/50 h-8 w-8 rounded-full mb-3"></div>
                      <div className="bg-muted/50 h-5 w-32 rounded mb-2"></div>
                      <div className="bg-muted/50 h-4 w-24 rounded mb-3"></div>
                      <div className="bg-muted/50 h-6 w-20 rounded"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : dashboardData?.leaderboard.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FontAwesomeIcon icon={faCrown} className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg">No sales data yet</p>
                <p>Leaderboard will appear when deals come in from Slack</p>
              </div>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                {dashboardData?.leaderboard.map((rep, index) => (
                  <motion.div
                    key={rep.email}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex-shrink-0 w-72 bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6 hover:shadow-lg hover:scale-105 transition-all duration-300"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`
                        flex items-center justify-center w-10 h-10 rounded-full font-bold text-white shadow-lg
                        ${index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' : 
                          index === 1 ? 'bg-gradient-to-br from-gray-400 to-gray-600' :
                          index === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-700' :
                          'bg-gradient-to-br from-slate-400 to-slate-600'}
                      `}>
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{rep.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {rep.monthly_deals} deal{rep.monthly_deals !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary">{formatCurrency(rep.monthly_amount)}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Recent Deals - Horizontal Scroll */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 rounded-xl bg-gradient-to-br from-green-400 to-teal-500 shadow-lg">
                <DollarSign className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Recent Deals</h2>
                <p className="text-muted-foreground">Latest sales activity</p>
              </div>
            </div>

            {dataLoading ? (
              <div className="flex gap-4 overflow-hidden">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex-shrink-0 w-80 bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6">
                    <div className="animate-pulse">
                      <div className="bg-muted/50 h-5 w-40 rounded mb-2"></div>
                      <div className="bg-muted/50 h-4 w-28 rounded mb-3"></div>
                      <div className="bg-muted/50 h-6 w-24 rounded"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredDeals.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <DollarSign className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg">No deals yet</p>
                <p>Recent deals will appear when they come in from Slack</p>
              </div>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                {filteredDeals.slice(0, 10).map((deal, index) => (
                  <motion.div
                    key={deal.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex-shrink-0 w-80 bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6 hover:shadow-lg hover:scale-105 transition-all duration-300"
                  >
                    <div>
                      <h3 className="font-semibold text-lg mb-2 leading-tight">{deal.deal_name}</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        {deal.rep_name} • {new Date(deal.created_at).toLocaleDateString()}
                      </p>
                      <div className="text-right">
                        <p className="text-xl font-bold text-primary">{formatCurrency(deal.amount)}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}