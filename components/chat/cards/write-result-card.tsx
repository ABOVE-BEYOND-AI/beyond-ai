/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { LEAD_STATUSES, OPPORTUNITY_STAGES } from '@/lib/constants'
import { CheckCircle2 } from 'lucide-react'

export function WriteResultCard({ data }: { data: any }) {
  if (data.error) {
    return (
      <div className="w-full rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
        <p className="text-sm text-destructive">{data.error}</p>
      </div>
    )
  }

  return (
    <div className="w-full rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
        <CheckCircle2 className="size-4 text-green-500" />
        <span className="text-sm font-medium">Success</span>
      </div>
      <div className="px-4 py-3 space-y-2">
        <p className="text-sm text-foreground">{data.message || 'Operation completed successfully'}</p>

        {data.newStatus && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Status:</span>
            <StatusBadge status={data.newStatus} />
          </div>
        )}

        {data.newStage && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Stage:</span>
            <StageBadge stage={data.newStage} />
          </div>
        )}

        {data.noteId && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Note ID:</span>
            <span className="text-xs font-mono text-muted-foreground">{data.noteId}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const config = LEAD_STATUSES[status] || { bgColor: 'bg-muted text-muted-foreground' }
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${config.bgColor}`}>
      {status}
    </span>
  )
}

function StageBadge({ stage }: { stage: string }) {
  const config = OPPORTUNITY_STAGES[stage] || { bgColor: 'bg-muted text-muted-foreground' }
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${config.bgColor}`}>
      {stage}
    </span>
  )
}
