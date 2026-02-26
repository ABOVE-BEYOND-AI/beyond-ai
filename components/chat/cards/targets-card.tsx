/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { formatCurrency } from '@/lib/constants'
import { Target } from 'lucide-react'

export function TargetsCard({ data }: { data: any }) {
  if (data.error) {
    return (
      <div className="w-full rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
        <p className="text-sm text-destructive">{data.error}</p>
      </div>
    )
  }

  const { type } = data
  const items = data.data || []

  return (
    <div className="w-full rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
        <Target className="size-4 text-amber-500" />
        <span className="text-sm font-medium">
          {type === 'targets' ? 'Sales Targets' : 'Commission'}
        </span>
      </div>
      <div className="divide-y divide-border">
        {type === 'targets' && items.map((t: any) => (
          <div key={t.Id} className="px-4 py-2.5 flex items-center justify-between">
            <span className="text-sm text-foreground">{t.Owner?.Name || t.Name}</span>
            <span className="text-sm font-medium tabular-nums">{formatCurrency(t.Target_Amount__c || 0)}</span>
          </div>
        ))}

        {type === 'commission' && items.slice(0, 12).map((c: any) => (
          <div key={c.Id} className="px-4 py-2.5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">{c.Sales_Person__r?.Name || c.Name}</span>
              <span className="text-sm font-medium tabular-nums">
                {formatCurrency(c.Total_Monthly_commission__c || 0)}
              </span>
            </div>
            <div className="flex gap-3 mt-0.5 text-xs text-muted-foreground">
              {c.Month_Name__c && <span>{c.Month_Name__c} {c.Year__c}</span>}
              {c.Commission_Rate_Applicable__c && <span>{c.Commission_Rate_Applicable__c}% rate</span>}
              {c.KPI_Targets_Met__c !== undefined && (
                <span className={c.KPI_Targets_Met__c ? 'text-green-500' : 'text-red-500'}>
                  KPI {c.KPI_Targets_Met__c ? 'Met' : 'Not Met'}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
