/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { formatCurrency } from '@/lib/constants'
import { Sparkles, CheckCircle2, UserPlus, Calendar, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'

export function DailyRecapCard({ data }: { data: any }) {
  if (data.error) {
    return (
      <div className="w-full rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
        <p className="text-sm text-destructive">{data.error}</p>
      </div>
    )
  }

  const { closedToday, newLeadsToday, upcomingEvents } = data

  return (
    <div className="w-full rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
        <Sparkles className="size-4 text-amber-500" />
        <span className="text-sm font-medium">Daily Recap</span>
      </div>
      <div className="p-4 space-y-4">
        {/* Deals Closed Today */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="size-3.5 text-green-500" />
            <p className="text-xs font-medium text-muted-foreground">Deals Closed Today</p>
          </div>
          {closedToday.count > 0 ? (
            <>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl font-bold text-foreground">{closedToday.count}</span>
                <span className="text-sm text-muted-foreground">deals worth {formatCurrency(closedToday.totalValue)}</span>
              </div>
              <div className="space-y-1">
                {closedToday.deals?.slice(0, 5).map((deal: any) => (
                  <div key={deal.Id} className="flex items-center justify-between text-sm">
                    <span className="text-foreground truncate mr-2">{deal.Name}</span>
                    <span className="text-muted-foreground tabular-nums font-medium">
                      {formatCurrency(deal.Gross_Amount__c || deal.Amount || 0)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No deals closed yet today</p>
          )}
        </div>

        {/* New Leads */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <UserPlus className="size-3.5 text-blue-500" />
            <p className="text-xs font-medium text-muted-foreground">New Leads Today</p>
          </div>
          <p className="text-2xl font-bold text-foreground">{newLeadsToday}</p>
        </div>

        {/* Upcoming Events */}
        {upcomingEvents?.count > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="size-3.5 text-orange-500" />
              <p className="text-xs font-medium text-muted-foreground">
                Upcoming Events ({upcomingEvents.count})
              </p>
            </div>
            <div className="space-y-1">
              {upcomingEvents.events?.slice(0, 5).map((event: any) => (
                <div key={event.Id} className="flex items-center justify-between text-sm">
                  <span className="text-foreground truncate mr-2">{event.Name}</span>
                  {event.Start_Date__c && (
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(event.Start_Date__c).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
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
