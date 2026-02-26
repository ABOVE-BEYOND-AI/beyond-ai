/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { formatCurrency } from '@/lib/constants'
import { DollarSign, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'

export function FinanceCard({ data }: { data: any }) {
  if (data.error) {
    return (
      <div className="w-full rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
        <p className="text-sm text-destructive">{data.error}</p>
      </div>
    )
  }

  const { type } = data

  return (
    <div className="w-full rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
        <DollarSign className="size-4 text-emerald-500" />
        <span className="text-sm font-medium">
          {type === 'accounts' ? 'Account Financials' : type === 'paymentPlans' ? 'Payment Plans' : 'Credit Accounts'}
        </span>
      </div>
      <div className="divide-y divide-border">
        {type === 'accounts' && data.data?.slice(0, 10).map((acct: any) => (
          <div key={acct.Id} className="px-4 py-2.5">
            <p className="text-sm font-medium text-foreground truncate">{acct.Name}</p>
            <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
              <span>Invoiced: {formatCurrency(acct.Bread_Winner__Total_Amount_Invoiced__c || 0)}</span>
              <span>Paid: {formatCurrency(acct.Bread_Winner__Total_Amount_Paid__c || 0)}</span>
              {(acct.Bread_Winner__Total_Amount_Overdue__c || 0) > 0 && (
                <span className="text-red-500 font-medium">
                  Overdue: {formatCurrency(acct.Bread_Winner__Total_Amount_Overdue__c)}
                </span>
              )}
            </div>
          </div>
        ))}

        {type === 'paymentPlans' && data.data?.slice(0, 10).map((deal: any) => (
          <div key={deal.Id} className="px-4 py-2.5 flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">{deal.Name}</p>
              <p className="text-xs text-muted-foreground">{deal.Account?.Name || ''}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-medium tabular-nums">{formatCurrency(deal.Total_Balance__c || 0)}</p>
              <p className="text-[11px] text-muted-foreground">
                {deal.Percentage_Paid__c ? `${Math.round(deal.Percentage_Paid__c)}% paid` : 'No payments'}
              </p>
            </div>
          </div>
        ))}

        {type === 'credits' && data.data?.slice(0, 10).map((acct: any) => (
          <div key={acct.Id} className="px-4 py-2.5 flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground truncate">{acct.Name}</p>
            <span className="text-sm font-medium text-emerald-500 tabular-nums">
              {formatCurrency(acct.Bread_Winner__Total_Unallocated_Credit__c || 0)}
            </span>
          </div>
        ))}
      </div>
      <Link
        href="/finance"
        className="flex items-center gap-1 px-4 py-2 border-t border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        View finance <ArrowUpRight className="size-3" />
      </Link>
    </div>
  )
}
