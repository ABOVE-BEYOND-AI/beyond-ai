/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { Phone, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'

export function CallsCard({ data }: { data: any }) {
  const { period, stats, repStats } = data

  if (data.error) {
    return (
      <div className="w-full rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
        <p className="text-sm text-destructive">{data.error}</p>
      </div>
    )
  }

  const periodLabel = period.charAt(0).toUpperCase() + period.slice(1)
  const totalCalls = stats?.total_calls ?? stats?.total ?? 0
  const inboundCalls = stats?.inbound_calls ?? stats?.inbound ?? 0
  const outboundCalls = stats?.outbound_calls ?? stats?.outbound ?? 0
  const avgDuration = stats?.avg_duration ?? stats?.avgDuration ?? 0

  return (
    <div className="w-full rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
        <Phone className="size-4 text-teal-500" />
        <span className="text-sm font-medium">Call Activity — {periodLabel}</span>
      </div>
      <div className="p-4 space-y-4">
        {stats && (
          <div className="grid grid-cols-4 gap-3">
            <StatBox label="Total" value={totalCalls.toString()} />
            <StatBox label="Inbound" value={inboundCalls.toString()} />
            <StatBox label="Outbound" value={outboundCalls.toString()} />
            <StatBox label="Avg Duration" value={avgDuration ? `${Math.round(avgDuration / 60)}m` : '0m'} />
          </div>
        )}
        {repStats?.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Per Rep</p>
            <div className="space-y-1.5">
              {repStats.slice(0, 8).map((rep: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{rep.name || rep.email || 'Unknown'}</span>
                  <div className="flex items-center gap-3 text-muted-foreground text-xs tabular-nums">
                    <span>{rep.total_calls || rep.total || 0} calls</span>
                    {(rep.avg_duration || rep.avgDuration) && (
                      <span>{Math.round((rep.avg_duration || rep.avgDuration) / 60)}m avg</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <Link
        href="/calls"
        className="flex items-center gap-1 px-4 py-2 border-t border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        View call log <ArrowUpRight className="size-3" />
      </Link>
    </div>
  )
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-2.5 text-center">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-base font-semibold text-foreground mt-0.5">{value}</p>
    </div>
  )
}
