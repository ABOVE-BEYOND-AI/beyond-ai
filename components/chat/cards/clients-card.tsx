/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { Building2, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'

export function ClientsCard({ data }: { data: any }) {
  const { count, contacts } = data

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
          <Building2 className="size-4 text-cyan-500" />
          <span className="text-sm font-medium">Clients</span>
        </div>
        <span className="text-xs text-muted-foreground">{count} found</span>
      </div>
      <div className="divide-y divide-border">
        {contacts.slice(0, 10).map((contact: any) => (
          <div key={contact.Id} className="px-4 py-2.5 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">{contact.Name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {contact.Account?.Name || contact.Title || 'No company'}
                {contact.Owner?.Name ? ` · ${contact.Owner.Name}` : ''}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              {contact.Total_Spend_to_Date__c ? (
                <p className="text-sm font-medium tabular-nums">
                  £{Math.round(contact.Total_Spend_to_Date__c).toLocaleString()}
                </p>
              ) : null}
              {contact.LastActivityDate && (
                <p className="text-[11px] text-muted-foreground">
                  {new Date(contact.LastActivityDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
      {count > 10 && (
        <div className="px-4 py-2 border-t border-border">
          <p className="text-xs text-muted-foreground">Showing 10 of {count} contacts</p>
        </div>
      )}
      <Link
        href="/clients"
        className="flex items-center gap-1 px-4 py-2 border-t border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        View all clients <ArrowUpRight className="size-3" />
      </Link>
    </div>
  )
}
