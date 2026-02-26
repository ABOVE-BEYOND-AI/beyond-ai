/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { formatCurrency } from '@/lib/constants'
import { TrendingUp, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'

export function DashboardCard({ data }: { data: any }) {
  if (data.error) {
    return (
      <div className="w-full rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
        <p className="text-sm text-destructive">{data.error}</p>
      </div>
    )
  }

  const { period, totals, leaderboard } = data
  const periodLabel = period.charAt(0).toUpperCase() + period.slice(1)

  return (
    <div className="w-full rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
        <TrendingUp className="size-4 text-green-500" />
        <span className="text-sm font-medium">Sales Dashboard — {periodLabel}</span>
      </div>
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <MetricBox label="Revenue" value={formatCurrency(totals.total_amount)} />
          <MetricBox label="Deals" value={totals.total_deals.toString()} />
          <MetricBox label="Avg Deal" value={formatCurrency(totals.average_deal)} />
        </div>
        {leaderboard?.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Leaderboard</p>
            <div className="space-y-1.5">
              {leaderboard.slice(0, 5).map((rep: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">
                    <span className={i < 3 ? 'text-amber-500 font-semibold' : 'text-muted-foreground'}>{i + 1}.</span>{' '}
                    {rep.name}
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {formatCurrency(rep.total_amount)} <span className="text-xs">({rep.deal_count})</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <Link
        href="/sales"
        className="flex items-center gap-1 px-4 py-2 border-t border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        View sales dashboard <ArrowUpRight className="size-3" />
      </Link>
    </div>
  )
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-3 text-center">
      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-lg font-semibold text-foreground tracking-tight mt-0.5">{value}</p>
    </div>
  )
}
