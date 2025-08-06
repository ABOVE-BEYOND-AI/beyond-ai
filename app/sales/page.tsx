"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign } from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCrown } from "@fortawesome/free-solid-svg-icons";
import { motion } from "framer-motion";
import { useGoogleAuth } from "@/components/google-auth-provider-clean";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import NumberFlow from "@number-flow/react";

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


        {/* Main Content Area */}
        <div className="max-w-7xl mx-auto">
          {/* Beautiful Tab Navigation */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex justify-center mb-12 mt-10"
          >
            <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-full p-2 shadow-lg relative">
              <div className="flex relative">
                {/* Sliding background pill */}
                <motion.div
                  className="absolute bg-primary rounded-full shadow-lg"
                  initial={false}
                  animate={{
                    x: selectedPeriod === 'today' ? 0 : selectedPeriod === 'week' ? 80 : 152,
                    width: selectedPeriod === 'today' ? 80 : selectedPeriod === 'week' ? 72 : 88
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  style={{
                    height: '40px',
                    top: '0px',
                  }}
                />
                {(['today', 'week', 'month'] as TimePeriod[]).map((period) => (
                  <button
                    key={period}
                    onClick={() => setSelectedPeriod(period)}
                    className={`
                      relative z-10 py-2.5 text-sm font-medium transition-colors duration-200 text-center
                      ${selectedPeriod === period 
                        ? 'text-primary-foreground' 
                        : 'text-muted-foreground hover:text-foreground'
                      }
                    `}
                    style={{
                      width: period === 'today' ? '80px' : period === 'week' ? '72px' : '88px'
                    }}
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
              <div className="text-8xl lg:text-9xl font-black tracking-tighter leading-none number-flow-container">
                {dataLoading ? (
                  <div className="animate-pulse bg-muted/50 h-32 w-96 mx-auto rounded-xl"></div>
                ) : (
                  <NumberFlow
                    value={displayAmount}
                    format={{
                      style: 'currency',
                      currency: 'GBP',
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    }}
                    locales="en-GB"
                    transformTiming={{ duration: 600, easing: 'ease-out' }}
                    spinTiming={{ duration: 500, easing: 'ease-out' }}
                    opacityTiming={{ duration: 300, easing: 'ease-out' }}
                    willChange={false}
                  />
                )}
              </div>
              {/* Subtle bottom gradient overlay */}
              <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 w-full h-20 bg-gradient-to-t from-background/60 to-transparent pointer-events-none"></div>
            </div>
            <motion.div
              key={`subtitle-${selectedPeriod}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="text-xl text-muted-foreground mt-2 relative z-10"
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
            </motion.div>
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

        {/* Leaderboard & Recent Deals */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl mx-auto"
        >
          {/* Leaderboard */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-gradient-to-br from-yellow-400 to-orange-500 shadow-lg">
                  <FontAwesomeIcon icon={faCrown} className="h-6 w-6 text-white" />
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
                  <FontAwesomeIcon icon={faCrown} className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No sales data yet</p>
                  <p className="text-sm">Deals will appear here when they come in from Slack</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {dashboardData?.leaderboard.map((rep, index) => (
                    <motion.div
                      key={rep.email}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white text-black font-bold text-sm shadow-sm">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{rep.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {rep.monthly_deals} deal{rep.monthly_deals !== 1 ? 's' : ''}
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

          {/* Recent Deals */}
          <Card>
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
      </div>
    </DashboardLayout>
  );
}