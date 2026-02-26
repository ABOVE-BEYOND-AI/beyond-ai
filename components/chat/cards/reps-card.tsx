/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { Users } from 'lucide-react'

export function RepsCard({ data }: { data: any }) {
  const { salesforceUsers, aircallUsers } = data

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
          <Users className="size-4 text-indigo-500" />
          <span className="text-sm font-medium">Sales Reps</span>
        </div>
        {salesforceUsers?.length > 0 && (
          <span className="text-xs text-muted-foreground">{salesforceUsers.length} reps</span>
        )}
      </div>
      <div className="p-4 space-y-4">
        {salesforceUsers?.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Salesforce</p>
            {salesforceUsers.map((user: any) => (
              <div key={user.Id} className="flex items-center justify-between text-sm gap-2">
                <div className="min-w-0 flex-1">
                  <span className="text-foreground">{user.Name}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {user.Email && (
                    <span className="text-xs text-muted-foreground truncate max-w-[180px]">{user.Email}</span>
                  )}
                  <span className="text-[10px] font-mono text-muted-foreground/60">{user.Id}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        {aircallUsers?.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Aircall</p>
            {aircallUsers.map((user: any, i: number) => (
              <div key={user.id || i} className="flex items-center justify-between text-sm gap-2">
                <div className="min-w-0 flex-1">
                  <span className="text-foreground">{user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim()}</span>
                </div>
                {user.email && (
                  <span className="text-xs text-muted-foreground truncate max-w-[180px]">{user.email}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
