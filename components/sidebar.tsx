"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Calendar,
  Menu,
  Shield,
  Sparkles,
  User,
  X,
  Mail,
  Home,
  LogOut,
  Settings,
  DollarSign,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useGoogleAuth } from "@/components/google-auth-provider-clean";

const navigation = [
  {
    name: "Dashboard",
    href: "/",
    icon: Home,
    active: true,
  },
  {
    name: "Itinerary Creator",
    href: "/itinerary",
    icon: Sparkles,
    active: true,
  },
  {
    name: "Sales",
    href: "/sales",
    icon: DollarSign,
    active: true,
  },
  {
    name: "Upcoming Events",
    href: "#",
    icon: Calendar,
    active: false,
  },
  {
    name: "Upgrades",
    href: "#",
    icon: Shield,
    active: false,
  },
  {
    name: "Contact",
    href: "#",
    icon: Mail,
    active: false,
  },
  {
    name: "Profile",
    href: "#",
    icon: User,
    active: false,
  },
];



interface SidebarProps {
  onExpandChange?: (expanded: boolean) => void;
}

export function Sidebar({ onExpandChange }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const pathname = usePathname();
  const { user, loading, signIn, signOut } = useGoogleAuth();

  const isExpanded = isOpen || isHovered;

  // Notify parent of expansion state changes
  useEffect(() => {
    onExpandChange?.(isExpanded);
  }, [isExpanded, onExpandChange]);

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-6 left-6 z-50 lg:hidden bg-card/80 backdrop-blur-xl p-3 rounded-lg shadow-lg"
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
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
          "h-screen bg-card/95 backdrop-blur-2xl border-r border-border/50 flex-shrink-0 overflow-hidden",
          "fixed left-0 top-0 z-40 transform transition-transform duration-300 ease-out",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
        animate={{ 
          width: isExpanded ? 288 : 80
        }}
        transition={{ 
          duration: 0.4, 
          ease: [0.25, 0.46, 0.45, 0.94] // Custom easing for smoother animation
        }}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="h-20 border-b border-border/50 relative overflow-hidden">
            <Link href="/" className="absolute inset-0 flex items-center" onClick={() => setIsOpen(false)}>
              {/* Star icon - fixed position at 40px from left (center of 80px) */}
              <div className="absolute left-6 top-1/2 -translate-y-1/2">
                <AnimatePresence mode="wait">
                  {!isExpanded ? (
                    <motion.img
                      key="icon-logo"
                      src="/aboveandbeyond-ai-icon-logo.svg"
                      alt="Above + Beyond AI Icon"
                      className="h-8 w-8 logo-sidebar"
                      initial={{ opacity: 0, rotate: -180 }}
                      animate={{ opacity: 1, rotate: 0 }}
                      exit={{ opacity: 0, rotate: 180 }}
                      transition={{ 
                        duration: 0.5, 
                        ease: [0.175, 0.885, 0.32, 1.275]
                      }}
                    />
                  ) : null}
                </AnimatePresence>
              </div>
              
              {/* Full logo - appears to the left when expanded */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="absolute left-6 top-1/2 -translate-y-1/2"
                  >
                    <Image
                      src="/BeyondAI (6) (1).svg"
                      alt="Above + Beyond AI"
                      width={120}
                      height={40}
                      className="h-10 w-auto logo-sidebar"
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
                    "flex items-center rounded-lg transition-all duration-200 group h-12 relative mx-2",
                    isActive
                      ? "text-black dark:text-white bg-white/5 dark:bg-white/5"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300",
                    !item.active && "opacity-60 cursor-not-allowed"
                  )}
                  onClick={(e) => {
                    if (!item.active) {
                      e.preventDefault();
                    }
                    setIsOpen(false);
                  }}
                  title={!isExpanded ? item.name : undefined}
                >
                  {/* Icon - fixed at 24px from left edge */}
                  <div className="absolute left-6 -translate-x-1/2 flex items-center justify-center h-full">
                    <item.icon 
                      className={cn(
                        "h-5 w-5 transition-all duration-200",
                        isActive 
                          ? "fill-black dark:fill-white stroke-black dark:stroke-white" 
                          : ""
                      )} 
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
                        className="flex items-center justify-between w-full pl-14 pr-4"
                      >
                        <span className="font-medium whitespace-nowrap">{item.name}</span>
                        {!item.active && (
                          <motion.span
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.2, duration: 0.2 }}
                            className="text-2xs bg-muted px-2 py-1 rounded"
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

          {/* User Profile Section */}
          <div className="border-t border-border/50 relative group">
            {loading ? (
              // Loading state
              <div className="p-4 flex items-center">
                <div className="w-8 h-8 bg-muted rounded-full animate-pulse flex-shrink-0"></div>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="ml-3 flex-1"
                  >
                    <div className="h-3 bg-muted rounded animate-pulse mb-1"></div>
                    <div className="h-2 bg-muted rounded animate-pulse w-20"></div>
                  </motion.div>
                )}
              </div>
            ) : user ? (
              // Authenticated user
              <div className="p-4">
                <div className="flex items-center">
                  {/* Profile Picture */}
                  <div className="relative flex-shrink-0">
                    {user.picture ? (
                      <Image
                        src={user.picture}
                        alt={user.name || user.email || 'User'}
                        width={32}
                        height={32}
                        className="rounded-full ring-2 ring-green-500/20"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center ring-2 ring-green-500/20">
                        <span className="text-white text-sm font-medium">
                          {(user.name || user.email)?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    {/* Online indicator */}
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-card"></div>
                  </div>

                  {/* User info and actions - shown when expanded */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.3 }}
                        className="ml-3 flex-1 min-w-0"
                      >
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground truncate">
                              {user.name || user.email?.split('@')[0]}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {user.email}
                            </p>
                          </div>
                          
                          {/* Action buttons */}
                          <div className="flex items-center gap-1 ml-2">
                            <button
                              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/50"
                              title="Settings"
                            >
                              <Settings className="w-4 h-4" />
                            </button>
                            <button
                              onClick={signOut}
                              className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors rounded-md hover:bg-red-500/10"
                              title="Sign out"
                            >
                              <LogOut className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Tooltip for collapsed state */}
                {!isExpanded && (
                  <div className="absolute left-full ml-2 bottom-4 px-3 py-2 bg-card border border-border rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm font-medium">
                        {user.name || user.email?.split('@')[0]}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                )}
              </div>
            ) : (
              // Not authenticated
              <div className="p-4">
                <div className="flex items-center">
                  {/* Anonymous user icon */}
                  <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-muted-foreground" />
                  </div>

                  {/* Sign in prompt - shown when expanded */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.3 }}
                        className="ml-3 flex-1"
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
                </div>

                {/* Tooltip for collapsed state */}
                {!isExpanded && (
                  <div className="absolute left-full ml-2 bottom-4 px-3 py-2 bg-card border border-border rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-muted rounded-full"></div>
                      <span className="text-sm font-medium">Not signed in</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Click to sign in</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.aside>
    </>
  );
}