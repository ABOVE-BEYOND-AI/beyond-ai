"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Menu,
  X,
  LogOut,
  Settings,
  CircleUser,
  Bell,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useGoogleAuth } from "@/components/google-auth-provider-clean";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { NotificationPanel } from "@/components/notification-panel";

type IconProps = React.SVGProps<SVGSVGElement>;

const CustomIcons = {
  Dashboard: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  ),
  Leads: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  Sales: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M18 7c0-1.1-.9-2-2-2h-3a3 3 0 0 0-3 3v8a3 3 0 0 1-3 3h12" />
      <path d="M6 13h8" />
    </svg>
  ),
  Pipeline: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M8 4v16" />
      <path d="M16 4v16" />
    </svg>
  ),
  Calls: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  ),
  Outreach: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  ),
  Events: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  Clients: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  Analytics: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  Notes: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  ),
  Finance: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  Dialer: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
      <path d="M8 6h8" />
      <path d="M8 10h8" />
      <path d="M8 14h8" />
    </svg>
  ),
  Settings: (props: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
};

const navigation = [
  { name: "Dashboard", href: "/", icon: CustomIcons.Dashboard, active: true },
  { name: "Leads", href: "/leads", icon: CustomIcons.Leads, active: true },
  { name: "Sales", href: "/sales", icon: CustomIcons.Sales, active: true },
  { name: "Pipeline", href: "/pipeline", icon: CustomIcons.Pipeline, active: true },
  { name: "Calls", href: "/calls", icon: CustomIcons.Calls, active: true },
  { name: "Outreach", href: "/outreach", icon: CustomIcons.Outreach, active: true },
  { name: "Dialer", href: "/dialer", icon: CustomIcons.Dialer, active: true },
  { name: "Events", href: "/events", icon: CustomIcons.Events, active: true },
  { name: "Clients", href: "/clients", icon: CustomIcons.Clients, active: true },
  { name: "Notes", href: "/notes", icon: CustomIcons.Notes, active: true },
  { name: "Finance", href: "/finance", icon: CustomIcons.Finance, active: true },
  { name: "Analytics", href: "/analytics", icon: CustomIcons.Analytics, active: true },
  { name: "Settings", href: "/settings", icon: CustomIcons.Settings, active: true },
];



interface SidebarProps {
  onExpandChange?: (expanded: boolean) => void;
}

export function Sidebar({ onExpandChange }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const pathname = usePathname();
  const { user, loading, signIn, signOut } = useGoogleAuth();

  const isExpanded = isOpen || isHovered;

  // Fetch unread notification count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?unread=true&limit=1");
      const json = await res.json();
      if (json.success) {
        setUnreadCount(json.data.unreadCount ?? 0);
      }
    } catch {
      // Silently fail — notification count is non-critical
    }
  }, []);

  // Poll for unread count when user is authenticated
  useEffect(() => {
    if (!user) return;
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60_000); // Every 60s
    return () => clearInterval(interval);
  }, [user, fetchUnreadCount]);

  // Refresh count when panel closes
  useEffect(() => {
    if (!notifOpen && user) {
      fetchUnreadCount();
    }
  }, [notifOpen, user, fetchUnreadCount]);

  // Notify parent of expansion state changes
  useEffect(() => {
    onExpandChange?.(isExpanded);
  }, [isExpanded, onExpandChange]);

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-6 left-6 z-50 lg:hidden bg-card/80 backdrop-blur-sm p-3 rounded-lg shadow-lg"
        aria-label={isOpen ? "Close menu" : "Open menu"}
      >
        {isOpen ? <X className="size-5" strokeWidth={1.5} /> : <Menu className="size-5" strokeWidth={1.5} />}
      </button>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          "h-dvh bg-card border-r border-border flex-shrink-0 overflow-hidden",
          "fixed left-0 top-0 z-40 transform transition-transform duration-300 ease-out",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
        animate={{
          width: isExpanded ? 288 : 80
        }}
        transition={{
          duration: 0.4,
          ease: [0.25, 0.46, 0.45, 0.94]
        }}
      >
        <div className="flex flex-col h-full bg-card/50">
          {/* Logo */}
          <div className="h-16 border-b border-border relative overflow-hidden">
            <Link href="/" className="absolute inset-0 flex items-center" onClick={() => setIsOpen(false)}>
              {/* Favicon - shown when collapsed */}
              <div className="absolute left-5 top-1/2 -translate-y-1/2">
                <AnimatePresence mode="wait">
                  {!isExpanded ? (
                    <motion.div
                      key="icon-logo"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{
                        duration: 0.4,
                        ease: [0.175, 0.885, 0.32, 1.275]
                      }}
                    >
                      <Image
                        src="/ab-favicon-gold.webp"
                        alt="Above + Beyond"
                        width={40}
                        height={40}
                        className="size-10 object-contain drop-shadow-md"
                      />
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>

              {/* Full logo - appears when expanded */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="absolute left-5 top-1/2 -translate-y-1/2"
                  >
                    <Image
                      src="/ab-logo-gold.webp"
                      alt="Above + Beyond"
                      width={150}
                      height={52}
                      className="h-[44px] w-auto object-contain drop-shadow-md"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 py-6 space-y-1">
            {navigation.map((item) => {
              const isActive = item.href === pathname || (item.href === "/itinerary" && pathname === "/itinerary");
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center rounded-xl transition-all duration-300 group h-11 relative mx-[18px] my-0.5",
                    isActive
                      ? "bg-transparent"
                      : "hover:bg-black/[0.03] dark:hover:bg-white/[0.02]",
                    !item.active && "opacity-50 cursor-not-allowed"
                  )}
                  onClick={(e) => {
                    if (!item.active) {
                      e.preventDefault();
                    }
                    setIsOpen(false);
                  }}
                  title={!isExpanded ? item.name : undefined}
                >
                  {isActive && (
                    <motion.div
                      layoutId="active-nav-row"
                      className="absolute inset-0 bg-black/[0.04] dark:bg-black/60 rounded-xl border border-black/[0.05] dark:border-white/[0.05] shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_1px_3px_rgba(0,0,0,0.8)]"
                      transition={{ type: "spring", stiffness: 350, damping: 30 }}
                    />
                  )}

                  {/* Icon - perfectly padded 5px inside the 44px height container */}
                  <div className="absolute left-[5px] top-1/2 -translate-y-1/2 flex items-center justify-center size-[34px] transition-transform duration-300 group-hover:scale-105">
                    {isActive && (
                      <motion.div
                        layoutId="active-icon-bg"
                        className="absolute inset-0 bg-white rounded-[10px] shadow-[0_2px_4px_rgba(0,0,0,0.08),_0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.8),_0_2px_4px_rgba(0,0,0,0.8)] ring-1 ring-black/[0.08] dark:ring-white/20"
                        transition={{ type: "spring", stiffness: 350, damping: 30 }}
                      />
                    )}
                    <item.icon
                      className={cn(
                        "relative z-10 size-[20px] transition-colors duration-300",
                        isActive ? "text-black drop-shadow-[0_1px_1px_rgba(255,255,255,1)]" : "text-muted-foreground group-hover:text-foreground"
                      )}
                      strokeWidth={isActive ? 2.5 : 1.5}
                    />
                  </div>

                  {/* Text - appears when expanded */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{
                          duration: 0.3,
                          delay: 0.1
                        }}
                        className="flex items-center justify-between w-full pl-[48px] pr-4 relative z-10"
                      >
                        <span 
                          className={cn(
                            "text-[14.5px] tracking-tight whitespace-nowrap transition-colors duration-300",
                            isActive ? "font-semibold text-foreground" : "font-medium text-muted-foreground group-hover:text-foreground"
                          )}
                        >
                          {item.name}
                        </span>
                        {!item.active && (
                          <motion.span
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.2, duration: 0.2 }}
                            className="text-[10px] uppercase tracking-wider font-bold bg-muted/80 text-muted-foreground px-2 py-0.5 rounded-md"
                          >
                            Soon
                          </motion.span>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Tooltip for collapsed state */}
                  {!isExpanded && (
                    <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-2 bg-card border border-border rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 whitespace-nowrap">
                      {item.name}
                      {!item.active && <span className="ml-2 text-xs text-muted-foreground">(Soon)</span>}
                    </div>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Theme Toggle + Notification Bell */}
          <div className="border-t border-border/50 relative h-14 flex items-center">
            <div className="absolute left-[10px]">
              <ThemeToggle showLabel={false} />
            </div>
            {user && (
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="absolute right-3"
                  >
                    <button
                      onClick={() => setNotifOpen(true)}
                      className="relative p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/50"
                      aria-label="Notifications"
                    >
                      <Bell className="size-[18px]" strokeWidth={1.5} />
                      {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full shadow-sm">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      )}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            )}
            {/* Bell for collapsed state */}
            {user && !isExpanded && (
              <div className="absolute right-0 left-0 flex justify-center mt-9 group/bell">
                <button
                  onClick={() => setNotifOpen(true)}
                  className="relative p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/50"
                  aria-label="Notifications"
                >
                  <Bell className="size-[18px]" strokeWidth={1.5} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full shadow-sm">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </button>
                {/* Tooltip */}
                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-2 bg-card border border-border rounded-lg shadow-lg opacity-0 group-hover/bell:opacity-100 transition-opacity duration-200 pointer-events-none z-50 whitespace-nowrap">
                  Notifications{unreadCount > 0 ? ` (${unreadCount})` : ""}
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-border relative h-[64px] flex items-center group">
            {loading ? (
              // Loading state
              <>
                <div className="absolute left-[24px] size-8 bg-muted rounded-full animate-pulse flex-shrink-0"></div>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="absolute left-[64px] right-4"
                    >
                      <div className="h-3 bg-muted rounded animate-pulse mb-1"></div>
                      <div className="h-2 bg-muted rounded animate-pulse w-20"></div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : user ? (
              // Authenticated user
              <>
                {/* Profile Picture */}
                <div className="absolute left-[24px] flex-shrink-0">
                  <div className="relative">
                    {user.picture ? (
                      <Image
                        src={user.picture}
                        alt={user.name || user.email || 'User'}
                        width={32}
                        height={32}
                        className="rounded-full ring-2 ring-green-500/20"
                      />
                    ) : (
                      <div className="size-8 bg-muted rounded-full flex items-center justify-center ring-2 ring-green-500/20">
                        <span className="text-foreground text-sm font-medium">
                          {(user.name || user.email)?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    {/* Online indicator */}
                    <div className="absolute -bottom-0.5 -right-0.5 size-3 bg-green-500 rounded-full border-2 border-card"></div>
                  </div>
                </div>

                {/* User info and actions - shown when expanded */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.3 }}
                      className="absolute left-[64px] right-4 flex items-center justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">
                          {user.name || user.email?.split('@')[0]}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {user.email}
                        </p>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-0.5 shrink-0">
                        <Link
                          href="/settings"
                          className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/50"
                          aria-label="Settings"
                          onClick={() => setIsOpen(false)}
                        >
                          <Settings className="size-4" strokeWidth={1.5} />
                        </Link>
                        <button
                          onClick={signOut}
                          className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors rounded-md hover:bg-red-500/10"
                          aria-label="Sign out"
                        >
                          <LogOut className="size-4" strokeWidth={1.5} />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Tooltip for collapsed state */}
                {!isExpanded && (
                  <div className="absolute left-[80px] ml-2 px-3 py-2 bg-card border border-border rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="size-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm font-medium">
                        {user.name || user.email?.split('@')[0]}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                )}
              </>
            ) : (
              // Not authenticated
              <>
                {/* Anonymous user icon */}
                <div className="absolute left-[24px] size-8 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
                  <CircleUser className="size-4 text-muted-foreground" strokeWidth={1.5} />
                </div>

                {/* Sign in prompt - shown when expanded */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.3 }}
                      className="absolute left-[76px] right-4"
                    >
                      <button
                        onClick={signIn}
                        className="w-full text-left"
                      >
                        <p className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                          Sign in
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Access your itineraries
                        </p>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Tooltip for collapsed state */}
                {!isExpanded && (
                  <div className="absolute left-[80px] ml-2 px-3 py-2 bg-card border border-border rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="size-2 bg-muted rounded-full"></div>
                      <span className="text-sm font-medium">Not signed in</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Click to sign in</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </motion.aside>

      {/* Notification Panel */}
      <NotificationPanel isOpen={notifOpen} onClose={() => setNotifOpen(false)} />
    </>
  );
}
