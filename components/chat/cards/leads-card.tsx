/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { LEAD_STATUSES } from '@/lib/constants'
import { Users, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'

export function LeadsCard({ data }: { data: any }) {
  const { count, leads } = data

  if (data.error) {
    return <ErrorCard message={data.error} />
  }

  return (
    <div className="w-full rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-blue-500" />
          <span className="text-sm font-medium">Leads</span>
        </div>
        <span className="text-xs text-muted-foreground">{count} found</span>
      </div>
      <div className="divide-y divide-border">
        {leads.slice(0, 10).map((lead: any) => {
          const statusConfig = LEAD_STATUSES[lead.Status] || { bgColor: 'bg-muted text-muted-foreground' }
          return (
            <div key={lead.Id} className="px-4 py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{lead.Name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {lead.Company || 'No company'} {lead.Owner?.Name ? `· ${lead.Owner.Name}` : ''}
                </p>
              </div>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${statusConfig.bgColor}`}>
                {lead.Status}
              </span>
            </div>
          )
        })}
      </div>
      {count > 10 && (
        <div className="px-4 py-2 border-t border-border">
          <p className="text-xs text-muted-foreground">Showing 10 of {count} leads</p>
        </div>
      )}
      <Link
        href="/leads"
        className="flex items-center gap-1 px-4 py-2 border-t border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        View all leads <ArrowUpRight className="size-3" />
      </Link>
    </div>
  )
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="w-full rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
      <p className="text-sm text-destructive">{message}</p>
    </div>
  )
}
