// Lead source groupings for filter dropdown
export const LEAD_SOURCE_GROUPS: Record<string, string[]> = {
  'Digital Ads': ['Google AdWords', 'LinkedIn', 'Linkedin Ads', 'Display Ads', 'Facebook Lead Form', 'Advertisement'],
  'Organic': ['Organic Search', 'Website', 'Web', 'Web Form', 'Social Media'],
  'Outbound': ['Cognism', 'Credit Safe', 'Lusha', 'Phone', 'Purchased List', 'Central London Residents - Cold'],
  'Referral': ['Employee Referral', 'External Referral', 'Referral', 'Partner', 'Trade Contact', 'Networking'],
  'Events': ['Trade Show', 'Customer Event', 'Events', 'Webinar'],
  'Database': ['KT database', 'LT database', 'RR database', 'Snowbomb database', 'v1.1 Premium database', 'V2.1 database', 'V3.1'],
  'Email': ['Email', 'Chat'],
  'Other': ['Marketing (Max)', 'Other'],
}

// Reverse lookup: source value -> group name
export function getSourceGroup(source: string | null): string {
  if (!source) return 'Other'
  for (const [group, sources] of Object.entries(LEAD_SOURCE_GROUPS)) {
    if (sources.includes(source)) return group
  }
  return 'Other'
}

// Interest category checkbox fields -> display config
export const INTEREST_FIELDS: Record<string, { label: string; color: string }> = {
  'Formula_1__c': { label: 'Formula 1', color: '#FF1801' },
  'Football__c': { label: 'Football', color: '#00A651' },
  'Rugby__c': { label: 'Rugby', color: '#4A2D73' },
  'Tennis__c': { label: 'Tennis', color: '#2E7D32' },
  'Live_Music__c': { label: 'Live Music', color: '#E91E63' },
  'Culinary__c': { label: 'Culinary', color: '#FF9800' },
  'Luxury_Lifestyle_Celebrity__c': { label: 'Luxury', color: '#9C27B0' },
  'Unique_Experiences__c': { label: 'Experiences', color: '#00BCD4' },
  'Other__c': { label: 'Other', color: '#607D8B' },
}

// Lead status config
export const LEAD_STATUSES: Record<string, { color: string; bgColor: string; group: string }> = {
  'New': { color: '#3B82F6', bgColor: 'bg-blue-500/15 text-blue-400', group: 'New' },
  'Working': { color: '#EAB308', bgColor: 'bg-yellow-500/15 text-yellow-400', group: 'In Progress' },
  'Prospect': { color: '#EAB308', bgColor: 'bg-yellow-500/15 text-yellow-400', group: 'In Progress' },
  'Interested': { color: '#F97316', bgColor: 'bg-orange-500/15 text-orange-400', group: 'In Progress' },
  'Nurturing': { color: '#A855F7', bgColor: 'bg-purple-500/15 text-purple-400', group: 'In Progress' },
  'Qualified': { color: '#22C55E', bgColor: 'bg-green-500/15 text-green-400', group: 'Ready to Convert' },
  'Unqualified': { color: '#EF4444', bgColor: 'bg-red-500/15 text-red-400', group: 'Dead' },
}

// Opportunity stage config
export const OPPORTUNITY_STAGES: Record<string, { color: string; bgColor: string; type: string; probability: number }> = {
  'New': { color: '#3B82F6', bgColor: 'bg-blue-500/15 text-blue-400', type: 'open', probability: 10 },
  'Deposit Taken': { color: '#EAB308', bgColor: 'bg-yellow-500/15 text-yellow-400', type: 'open', probability: 50 },
  'Agreement Sent': { color: '#F97316', bgColor: 'bg-orange-500/15 text-orange-400', type: 'open', probability: 85 },
  'Agreement Signed': { color: '#22C55E', bgColor: 'bg-green-500/15 text-green-400', type: 'won', probability: 100 },
  'Amended': { color: '#22C55E', bgColor: 'bg-green-500/15 text-green-400', type: 'won', probability: 100 },
  'Amendment Signed': { color: '#22C55E', bgColor: 'bg-green-500/15 text-green-400', type: 'won', probability: 100 },
  'Closed Lost': { color: '#EF4444', bgColor: 'bg-red-500/15 text-red-400', type: 'lost', probability: 0 },
  'Cancelled': { color: '#EF4444', bgColor: 'bg-red-500/15 text-red-400', type: 'lost', probability: 0 },
}

// Active pipeline stages (Kanban columns)
export const PIPELINE_STAGES = ['New', 'Deposit Taken', 'Agreement Sent'] as const
export const WON_STAGES = ['Agreement Signed', 'Amended', 'Amendment Signed'] as const
export const LOST_STAGES = ['Closed Lost', 'Cancelled'] as const

// Event category colors (matching existing events page)
export const EVENT_CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  'formula-1': { bg: 'bg-red-500/15', text: 'text-red-400' },
  'formula 1': { bg: 'bg-red-500/15', text: 'text-red-400' },
  'f1': { bg: 'bg-red-500/15', text: 'text-red-400' },
  'tennis': { bg: 'bg-green-500/15', text: 'text-green-400' },
  'rugby': { bg: 'bg-violet-500/15', text: 'text-violet-400' },
  'football': { bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
  'live-music': { bg: 'bg-pink-500/15', text: 'text-pink-400' },
  'live music': { bg: 'bg-pink-500/15', text: 'text-pink-400' },
  'music': { bg: 'bg-pink-500/15', text: 'text-pink-400' },
  'culinary': { bg: 'bg-orange-500/15', text: 'text-orange-400' },
  'luxury': { bg: 'bg-purple-500/15', text: 'text-purple-400' },
  'awards': { bg: 'bg-amber-500/15', text: 'text-amber-400' },
  'racing': { bg: 'bg-red-500/15', text: 'text-red-400' },
  'motorsport': { bg: 'bg-red-500/15', text: 'text-red-400' },
  'motogp': { bg: 'bg-red-500/15', text: 'text-red-400' },
  'formula e': { bg: 'bg-sky-500/15', text: 'text-sky-400' },
  'formula-e': { bg: 'bg-sky-500/15', text: 'text-sky-400' },
  'cricket': { bg: 'bg-lime-500/15', text: 'text-lime-400' },
  'boxing': { bg: 'bg-rose-500/15', text: 'text-rose-400' },
  'combat sports': { bg: 'bg-rose-500/15', text: 'text-rose-400' },
  'golf': { bg: 'bg-teal-500/15', text: 'text-teal-400' },
  'horse racing': { bg: 'bg-amber-500/15', text: 'text-amber-400' },
  'horse-racing': { bg: 'bg-amber-500/15', text: 'text-amber-400' },
  'cycling': { bg: 'bg-yellow-500/15', text: 'text-yellow-400' },
  'darts': { bg: 'bg-orange-500/15', text: 'text-orange-400' },
  'basketball': { bg: 'bg-orange-500/15', text: 'text-orange-400' },
  'athletics': { bg: 'bg-blue-500/15', text: 'text-blue-400' },
  'sailing': { bg: 'bg-cyan-500/15', text: 'text-cyan-400' },
  'rowing': { bg: 'bg-blue-500/15', text: 'text-blue-400' },
  'theatre': { bg: 'bg-fuchsia-500/15', text: 'text-fuchsia-400' },
  'film': { bg: 'bg-indigo-500/15', text: 'text-indigo-400' },
  'fashion': { bg: 'bg-pink-500/15', text: 'text-pink-400' },
  'festival': { bg: 'bg-fuchsia-500/15', text: 'text-fuchsia-400' },
  'art': { bg: 'bg-indigo-500/15', text: 'text-indigo-400' },
  'arts & music': { bg: 'bg-indigo-500/15', text: 'text-indigo-400' },
  'multi-sport': { bg: 'bg-sky-500/15', text: 'text-sky-400' },
}

// Formatting helpers
export function formatCurrency(amount: number): string {
  return `£${amount.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function formatCurrencyFull(amount: number): string {
  return `£${amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`
  return `${Math.floor(diffDays / 365)}y ago`
}

export function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const date = new Date(dateStr)
  const now = new Date()
  return Math.ceil((date.getTime() - now.getTime()) / 86400000)
}

export function daysSince(dateStr: string | null): number {
  if (!dateStr) return 999
  const date = new Date(dateStr)
  const now = new Date()
  return Math.floor((now.getTime() - date.getTime()) / 86400000)
}
