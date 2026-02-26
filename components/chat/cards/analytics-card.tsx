/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { formatCurrency } from '@/lib/constants'
import { BarChart3, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'

export function AnalyticsCard({ data }: { data: any }) {
  if (data.error) {
    return (
      <div className="w-full rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
        <p className="text-sm text-destructive">{data.error}</p>
      </div>
    )
  }

  const { type } = data
  const title = type === 'channels' ? 'Channel Attribution' : type === 'reps' ? 'Rep Performance' : 'Event Performance'
  const items = data.data || []
  const maxRevenue = items.length > 0 ? items[0].totalRevenue || items[0].totalGross || 0 : 1

  return (
    <div className="w-full rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
        <BarChart3 className="size-4 text-indigo-500" />
        <span className="text-sm font-medium">{title}</span>
      </div>
      <div className="p-4 space-y-2">
        {items.slice(0, 10).map((item: any, i: number) => {
          const name = type === 'channels' ? item.LeadSource : type === 'reps' ? item.name : item.eventName
          const revenue = type === 'events' ? (item.totalGross || 0) : (item.totalRevenue || 0)
          const deals = item.totalDeals || 0
          const barWidth = maxRevenue > 0 ? (revenue / maxRevenue) * 100 : 0

          return (
            <div key={i}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-foreground truncate mr-2">{name || 'Unknown'}</span>
                <span className="text-muted-foreground tabular-nums whitespace-nowrap">
                  {formatCurrency(revenue)} <span className="text-xs">({deals})</span>
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-indigo-500/60 transition-all"
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
      <Link
        href="/analytics"
        className="flex items-center gap-1 px-4 py-2 border-t border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        View analytics <ArrowUpRight className="size-3" />
      </Link>
    </div>
  )
}
