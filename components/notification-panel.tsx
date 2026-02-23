"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import {
  X,
  Bell,
  BellOff,
  TrendingDown,
  CreditCard,
  UserPlus,
  Clock,
  CheckCheck,
  ExternalLink,
} from "lucide-react"
import type { AppNotification } from "@/lib/salesforce-types"

interface NotificationPanelProps {
  isOpen: boolean
  onClose: () => void
}

const typeConfig: Record<
  AppNotification["type"],
  { icon: typeof Bell; color: string; bg: string }
> = {
  stale_deal: {
    icon: TrendingDown,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
  payment_overdue: {
    icon: CreditCard,
    color: "text-red-500",
    bg: "bg-red-500/10",
  },
  call_reminder: {
    icon: Clock,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  follow_up: {
    icon: Clock,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
  new_lead: {
    icon: UserPlus,
    color: "text-green-500",
    bg: "bg-green-500/10",
  },
  daily_recap: {
    icon: Bell,
    color: "text-indigo-500",
    bg: "bg-indigo-500/10",
  },
  general: {
    icon: Bell,
    color: "text-muted-foreground",
    bg: "bg-muted/50",
  },
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  )
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function NotificationPanel({ isOpen, onClose }: NotificationPanelProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/notifications?limit=50")
      const json = await res.json()
      if (json.success) {
        setNotifications(json.data.notifications || [])
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      fetchNotifications()
    }
  }, [isOpen, fetchNotifications])

  const handleMarkRead = async (notificationId: string) => {
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId }),
      })
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      )
    } catch (err) {
      console.error("Failed to mark read:", err)
    }
  }

  const handleMarkAllRead = async () => {
    setMarkingAll(true)
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      })
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    } catch (err) {
      console.error("Failed to mark all read:", err)
    } finally {
      setMarkingAll(false)
    }
  }

  const handleNotificationClick = (notif: AppNotification) => {
    if (!notif.read) {
      handleMarkRead(notif.id)
    }
    if (notif.link) {
      onClose()
      window.location.href = notif.link
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/60 backdrop-blur-sm z-50"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 h-dvh w-full max-w-md bg-card border-l border-border shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 h-16 border-b border-border shrink-0">
              <div className="flex items-center gap-3">
                <Bell className="size-5 text-foreground" strokeWidth={1.5} />
                <h2 className="text-base font-semibold tracking-tight">
                  Notifications
                </h2>
                {unreadCount > 0 && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-500/10 text-red-500">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    disabled={markingAll}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-lg hover:bg-muted/50"
                  >
                    <CheckCheck className="size-3.5" />
                    Mark all read
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/50"
                >
                  <X className="size-4" strokeWidth={1.5} />
                </button>
              </div>
            </div>

            {/* Notification list */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="size-5 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <BellOff className="size-10 mb-3 opacity-40" />
                  <p className="text-sm font-medium">No notifications</p>
                  <p className="text-xs mt-1">
                    You&apos;re all caught up.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {notifications.map((notif) => {
                    const config = typeConfig[notif.type] || typeConfig.general
                    const Icon = config.icon
                    return (
                      <button
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif)}
                        className={cn(
                          "w-full text-left px-5 py-4 hover:bg-muted/30 transition-colors flex gap-3",
                          !notif.read && "bg-primary/[0.02]"
                        )}
                      >
                        {/* Icon */}
                        <div
                          className={cn(
                            "shrink-0 size-9 rounded-lg flex items-center justify-center mt-0.5",
                            config.bg
                          )}
                        >
                          <Icon
                            className={cn("size-4", config.color)}
                            strokeWidth={1.5}
                          />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p
                              className={cn(
                                "text-sm truncate",
                                !notif.read
                                  ? "font-semibold text-foreground"
                                  : "font-medium text-muted-foreground"
                              )}
                            >
                              {notif.title}
                            </p>
                            {!notif.read && (
                              <div className="shrink-0 size-2 rounded-full bg-blue-500 mt-1.5" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {notif.body}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[11px] text-muted-foreground/70">
                              {timeAgo(notif.createdAt)}
                            </span>
                            {notif.link && (
                              <ExternalLink className="size-3 text-muted-foreground/50" />
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
