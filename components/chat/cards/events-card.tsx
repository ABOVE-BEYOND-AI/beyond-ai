/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { formatCurrency } from '@/lib/constants'
import { Calendar, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'

export function EventsCard({ data }: { data: any }) {
  const { count, events } = data

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
          <span className="text-sm font-medium">Events</span>
        </div>
        <span className="text-xs text-muted-foreground">{count} events</span>
      </div>
      <div className="divide-y divide-border">
        {events.slice(0, 12).map((event: any) => {
          const ticketsRemaining = event.Total_Tickets_Remaining__c ?? 0
          const ticketsRequired = event.Total_Tickets_Required__c ?? 0
          const pctSold = ticketsRequired > 0 ? ((ticketsRequired - ticketsRemaining) / ticketsRequired) * 100 : 0
          const isLowStock = ticketsRequired > 0 && ticketsRemaining > 0 && ticketsRemaining <= 5

          return (
            <div key={event.Id} className="px-4 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{event.Name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    {event.Start_Date__c && (
                      <span>{new Date(event.Start_Date__c).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    )}
                    {event.Category__c && (
                      <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-medium">{event.Category__c}</span>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  {event.Revenue_Target__c ? (
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(event.Sum_of_Closed_Won_Gross__c || 0)} / {formatCurrency(event.Revenue_Target__c)}
                    </p>
                  ) : null}
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {ticketsRequired > 0 && (
                      <div className="flex items-center gap-1">
                        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${pctSold >= 90 ? 'bg-red-500' : pctSold >= 70 ? 'bg-amber-500' : 'bg-green-500'}`}
                            style={{ width: `${Math.min(pctSold, 100)}%` }}
                          />
                        </div>
                        <span className={`text-[10px] font-medium ${isLowStock ? 'text-red-500' : 'text-muted-foreground'}`}>
                          {ticketsRemaining} left
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {count > 12 && (
        <div className="px-4 py-2 border-t border-border">
          <p className="text-xs text-muted-foreground">Showing 12 of {count} events</p>
        </div>
      )}
      <Link
        href="/events"
        className="flex items-center gap-1 px-4 py-2 border-t border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        View all events <ArrowUpRight className="size-3" />
      </Link>
    </div>
  )
}
