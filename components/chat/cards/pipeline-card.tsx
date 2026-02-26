/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { formatCurrency, OPPORTUNITY_STAGES } from '@/lib/constants'
import { BarChart3, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'

export function PipelineCard({ data }: { data: any }) {
  const { count, totalValue, byStage, deals } = data

  if (data.error) {
    return (
      <div className="w-full rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
        <p className="text-sm text-destructive">{data.error}</p>
      </div>
    )
  }

  return (
    <div className="w-full rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <BarChart3 className="size-4 text-violet-500" />
          <span className="text-sm font-medium">Pipeline</span>
        </div>
        <span className="text-sm font-semibold">{formatCurrency(totalValue)}</span>
      </div>
      <div className="p-4 space-y-4">
        {byStage && Object.keys(byStage).length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">By Stage</p>
            {Object.entries(byStage).map(([stage, info]: [string, any]) => {
              const stageConfig = OPPORTUNITY_STAGES[stage] || { bgColor: 'bg-muted text-muted-foreground' }
              return (
                <div key={stage} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${stageConfig.bgColor}`}>
                      {stage}
                    </span>
                    <span className="text-xs text-muted-foreground">{info.count} deals</span>
                  </div>
                  <span className="text-sm font-medium tabular-nums">{formatCurrency(info.total)}</span>
                </div>
              )
            })}
          </div>
        )}
        {deals?.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Top Deals</p>
            {deals.slice(0, 8).map((deal: any) => {
              const stageConfig = OPPORTUNITY_STAGES[deal.StageName] || { bgColor: 'bg-muted text-muted-foreground' }
              return (
                <div key={deal.Id} className="flex items-center justify-between text-sm gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="truncate text-foreground">{deal.Name}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${stageConfig.bgColor}`}>
                      {deal.StageName}
                    </span>
                    <span className="text-sm font-medium tabular-nums whitespace-nowrap">
                      {formatCurrency(deal.Gross_Amount__c || deal.Amount || 0)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      {count > 8 && (
        <div className="px-4 py-2 border-t border-border">
          <p className="text-xs text-muted-foreground">Showing 8 of {count} deals</p>
        </div>
      )}
      <Link
        href="/pipeline"
        className="flex items-center gap-1 px-4 py-2 border-t border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        View pipeline <ArrowUpRight className="size-3" />
      </Link>
    </div>
  )
}
