/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { formatCurrency, OPPORTUNITY_STAGES } from '@/lib/constants'
import { Calendar } from 'lucide-react'

export function EventDealsCard({ data }: { data: any }) {
  const { eventName, count, totalValue, deals } = data

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
          <Calendar className="size-4 text-orange-500" />
          <span className="text-sm font-medium">{eventName || 'Event Deals'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{count} deals</span>
          <span className="text-sm font-semibold">{formatCurrency(totalValue)}</span>
        </div>
      </div>
      <div className="p-4 space-y-1.5">
        {deals?.length > 0 && (
          <>
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
          </>
        )}
      </div>
      {count > 8 && (
        <div className="px-4 py-2 border-t border-border">
          <p className="text-xs text-muted-foreground">Showing 8 of {count} deals</p>
        </div>
      )}
    </div>
  )
}
