// Redis/Upstash database operations for sales data
import { Redis } from '@upstash/redis'
import { Deal, SalesRep, MonthlySalesStats } from './types'

// Lazy Redis client initialization to prevent client-side execution
let redis: Redis | null = null;

function getRedisClient(): Redis {
  // Ensure we're running server-side only
  if (typeof window !== 'undefined') {
    throw new Error('Redis operations can only be performed server-side');
  }

  // Initialize Redis client if not already done
  if (!redis) {
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || process.env.KV_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

    // Debug logging for server-side execution
    console.log('🔧 Sales Redis Debug: URL exists:', !!redisUrl);
    console.log('🔧 Sales Redis Debug: Token exists:', !!redisToken);

    if (!redisUrl || !redisToken) {
      console.error('❌ Sales Redis configuration missing:', {
        url: !!redisUrl,
        token: !!redisToken
      });
      throw new Error('Redis configuration is incomplete. Check environment variables.');
    }

    redis = new Redis({
      url: redisUrl,
      token: redisToken,
    });
  }

  return redis;
}

// Redis key patterns for sales data (following existing patterns)
const SALES_KEYS = {
  // All deal IDs (set)
  allDeals: () => 'sales:deals',
  
  // Individual deal data
  deal: (id: string) => `sales:deal:${id}`,
  
  // Monthly aggregated stats
  monthlyStats: (month: string) => `sales:monthly:${month}`,
  
  // Monthly leaderboard data
  monthlyLeaderboard: (month: string) => `sales:leaderboard:${month}`,
  
  // Deal IDs for specific rep
  repDeals: (email: string) => `sales:rep:${email}:deals`,
  
  // Rep profile/stats
  repProfile: (email: string) => `sales:rep:${email}:profile`,
  
  // Slack message tracking (for duplicate detection)
  slackMessage: (channelId: string, ts: string) => `sales:slack:${channelId}:${ts}`,
  
  // Monthly targets
  monthlyTarget: (month: string) => `sales:target:${month}`,
}

// Deal operations
export async function saveDeal(
  dealData: Omit<Deal, 'id' | 'created_at' | 'updated_at'>, 
  customCreatedAt?: string
): Promise<string> {
  const redis = getRedisClient();
  const id = `deal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();
  
  const deal: Deal = {
    id,
    ...dealData,
    created_at: customCreatedAt || now,
    updated_at: now,
  };

  try {
    // Store the deal
    await redis.set(SALES_KEYS.deal(id), deal);

    // Add to all deals set
    await redis.sadd(SALES_KEYS.allDeals(), id);

    // Add to rep's deals list
    await redis.sadd(SALES_KEYS.repDeals(dealData.rep_email), id);

    // Store Slack message reference for duplicate detection
    if (dealData.slack_ts) {
      await redis.set(
        SALES_KEYS.slackMessage(dealData.slack_channel_id || 'unknown', dealData.slack_ts), 
        id,
        { ex: 60 * 60 * 24 * 30 } // Expire after 30 days
      );
    }

    console.log(`✅ Saved deal ${id} for rep ${dealData.rep_email} - £${dealData.amount}`);
    return id;
  } catch (error) {
    console.error('❌ Error saving deal:', error);
    throw error;
  }
}

export async function getDeal(id: string): Promise<Deal | null> {
  const redis = getRedisClient();
  
  try {
    const deal = await redis.get(SALES_KEYS.deal(id)) as Deal | null;
    return deal;
  } catch (error) {
    console.error('❌ Error getting deal:', error);
    return null;
  }
}

export async function getDeals(limit: number = 50, offset: number = 0): Promise<Deal[]> {
  const redis = getRedisClient();
  
  try {
    // Get all deal IDs
    const dealIds = await redis.smembers(SALES_KEYS.allDeals()) as string[];

    // Fetch all deals, sort by created_at desc, then paginate reliably
    const allDeals: Deal[] = [];
    for (const id of dealIds) {
      const deal = await redis.get(SALES_KEYS.deal(id)) as Deal | null;
      if (deal) {
        allDeals.push(deal);
      }
    }

    allDeals.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return allDeals.slice(offset, offset + limit);
  } catch (error) {
    console.error('❌ Error getting deals:', error);
    return [];
  }
}

// Delete a deal and remove all references
export async function deleteDealById(id: string): Promise<boolean> {
  const redis = getRedisClient();

  try {
    const deal = await redis.get(SALES_KEYS.deal(id)) as Deal | null;
    if (!deal) {
      return false;
    }

    // Delete primary record
    await redis.del(SALES_KEYS.deal(id));

    // Remove from global set
    await redis.srem(SALES_KEYS.allDeals(), id);

    // Remove from rep's set
    if (deal.rep_email) {
      await redis.srem(SALES_KEYS.repDeals(deal.rep_email), id);
    }

    // Remove slack duplicate key if present
    if (deal.slack_ts && deal.slack_channel_id) {
      await redis.del(SALES_KEYS.slackMessage(deal.slack_channel_id, deal.slack_ts));
    }

    console.log(`🗑️ Deleted deal ${id} (${deal.deal_name}) for ${deal.rep_name}`);
    return true;
  } catch (error) {
    console.error('❌ Error deleting deal:', error);
    return false;
  }
}

export async function getRepDeals(repEmail: string, limit: number = 50): Promise<Deal[]> {
  const redis = getRedisClient();
  
  try {
    // Get rep's deal IDs
    const dealIds = await redis.smembers(SALES_KEYS.repDeals(repEmail)) as string[];
    
    // Get deal details
    const deals: Deal[] = [];
    for (const id of dealIds.slice(0, limit)) {
      const deal = await redis.get(SALES_KEYS.deal(id)) as Deal | null;
      if (deal) {
        deals.push(deal);
      }
    }
    
    // Sort by created_at descending
    deals.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    return deals;
  } catch (error) {
    console.error('❌ Error getting rep deals:', error);
    return [];
  }
}

// Check if Slack message already processed (duplicate detection)
export async function isSlackMessageProcessed(channelId: string, messageTs: string): Promise<boolean> {
  const redis = getRedisClient();
  
  try {
    const dealId = await redis.get(SALES_KEYS.slackMessage(channelId, messageTs));
    return !!dealId;
  } catch (error) {
    console.error('❌ Error checking Slack message:', error);
    return false;
  }
}

// Monthly statistics operations
export async function saveMonthlySalesStats(stats: MonthlySalesStats): Promise<void> {
  const redis = getRedisClient();
  
  try {
    await redis.set(SALES_KEYS.monthlyStats(stats.month), stats);
    console.log(`✅ Saved monthly stats for ${stats.month}`);
  } catch (error) {
    console.error('❌ Error saving monthly stats:', error);
    throw error;
  }
}

export async function getMonthlySalesStats(month: string): Promise<MonthlySalesStats | null> {
  const redis = getRedisClient();
  
  try {
    const stats = await redis.get(SALES_KEYS.monthlyStats(month)) as MonthlySalesStats | null;
    return stats;
  } catch (error) {
    console.error('❌ Error getting monthly stats:', error);
    return null;
  }
}

// Leaderboard operations
export async function saveMonthlyLeaderboard(month: string, leaderboard: SalesRep[]): Promise<void> {
  const redis = getRedisClient();
  
  try {
    await redis.set(SALES_KEYS.monthlyLeaderboard(month), leaderboard);
    console.log(`✅ Saved leaderboard for ${month} with ${leaderboard.length} reps`);
  } catch (error) {
    console.error('❌ Error saving leaderboard:', error);
    throw error;
  }
}

export async function getMonthlyLeaderboard(month: string): Promise<SalesRep[]> {
  const redis = getRedisClient();
  
  try {
    const leaderboard = await redis.get(SALES_KEYS.monthlyLeaderboard(month)) as SalesRep[] | null;
    return leaderboard || [];
  } catch (error) {
    console.error('❌ Error getting leaderboard:', error);
    return [];
  }
}

// Target management
export async function setMonthlyTarget(month: string, targetAmount: number): Promise<void> {
  const redis = getRedisClient();
  
  try {
    await redis.set(SALES_KEYS.monthlyTarget(month), targetAmount);
    console.log(`✅ Set monthly target for ${month}: £${targetAmount/100}`);
  } catch (error) {
    console.error('❌ Error setting monthly target:', error);
    throw error;
  }
}

export async function getMonthlyTarget(month: string): Promise<number> {
  const redis = getRedisClient();
  
  try {
    const target = await redis.get(SALES_KEYS.monthlyTarget(month)) as number | null;
    return target || 0;
  } catch (error) {
    console.error('❌ Error getting monthly target:', error);
    return 0;
  }
}

// Utility functions
export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function getPreviousMonth(): string {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
}

// Parse currency amounts (£1,234.56 → 1234.56 pounds)
export function parseCurrencyAmount(amountStr: string): number {
  // Remove currency symbols and commas, return pounds
  const cleanAmount = amountStr.replace(/[£$,\s]/g, '');
  return parseFloat(cleanAmount);
}

// Format pounds to currency string (1234.56 → "£1,234.56")
export function formatCurrency(pounds: number, currency: string = 'GBP'): string {
  const symbol = currency === 'GBP' ? '£' : '$';
  return `${symbol}${pounds.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}