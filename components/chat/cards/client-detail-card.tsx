/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { formatCurrency, OPPORTUNITY_STAGES } from '@/lib/constants'
import { CircleUser, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'

export function ClientDetailCard({ data }: { data: any }) {
  const { contact, opportunities, notes } = data

  if (data.error) {
    return (
      <div className="w-full rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
        <p className="text-sm text-destructive">{data.error}</p>
      </div>
    )
  }

  const totalSpend = opportunities?.reduce((sum: number, o: any) => {
    if (['Agreement Signed', 'Amended', 'Amendment Signed'].includes(o.StageName)) {
      return sum + (o.Gross_Amount__c || o.Amount || 0)
    }
    return sum
  }, 0) || 0

  return (
    <div className="w-full rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <CircleUser className="size-4 text-blue-500" />
          <span className="text-sm font-medium">{contact.Name}</span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-muted-foreground">
          {contact.Account?.Name && <span>{contact.Account.Name}</span>}
          {contact.Title && <span>{contact.Title}</span>}
          {contact.Email && <span>{contact.Email}</span>}
          {contact.Phone && <span>{contact.Phone}</span>}
          {totalSpend > 0 && <span className="font-medium text-foreground">Lifetime: {formatCurrency(totalSpend)}</span>}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {opportunities?.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Deals ({opportunities.length})
            </p>
            <div className="space-y-1.5">
              {opportunities.slice(0, 6).map((opp: any) => {
                const stageConfig = OPPORTUNITY_STAGES[opp.StageName] || { bgColor: 'bg-muted text-muted-foreground' }
                return (
                  <div key={opp.Id} className="flex items-center justify-between text-sm gap-2">
                    <span className="truncate text-foreground min-w-0 flex-1">{opp.Name}</span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${stageConfig.bgColor}`}>
                        {opp.StageName}
                      </span>
                      <span className="tabular-nums font-medium">
                        {formatCurrency(opp.Gross_Amount__c || opp.Amount || 0)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {notes?.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Recent Notes ({notes.length})
            </p>
            <div className="space-y-2">
              {notes.slice(0, 3).map((note: any) => (
                <div key={note.Id} className="rounded-lg bg-muted/30 p-2.5">
                  <p className="text-xs text-foreground line-clamp-2">{note.Body__c || 'Empty note'}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {note.Owner?.Alias || 'Unknown'} · {new Date(note.CreatedDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <Link
        href="/clients"
        className="flex items-center gap-1 px-4 py-2 border-t border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        View in clients <ArrowUpRight className="size-3" />
      </Link>
    </div>
  )
}
