"use client"

import { useEffect, useState } from "react"
import { useGoogleAuth } from "@/components/google-auth-provider-clean"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { motion } from "framer-motion"
import {
  ChevronDown,
  Crown,
  Eye,
  Loader2,
  Shield,
  ShieldAlert,
  User as UserIcon,
  Users,
} from "lucide-react"

interface UserData {
  email: string
  name: string
  avatar_url: string
  role: "admin" | "member" | "viewer"
  created_at: string
  updated_at: string
}

const ROLE_CONFIG = {
  admin: {
    label: "Admin",
    icon: Crown,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
  },
  member: {
    label: "Member",
    icon: UserIcon,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/10",
  },
  viewer: {
    label: "Viewer",
    icon: Eye,
    color: "text-muted-foreground",
    bg: "bg-muted",
  },
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
}
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
}

export default function AdminPage() {
  const { user, loading } = useGoogleAuth()
  const router = useRouter()
  const [users, setUsers] = useState<UserData[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingRole, setUpdatingRole] = useState<string | null>(null)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/signin")
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user) {
      fetch("/api/users")
        .then(async (res) => {
          if (res.status === 403) {
            setError("You don't have admin access.")
            return
          }
          if (!res.ok) throw new Error("Failed to load users")
          const data = await res.json()
          setUsers(data.users || [])
        })
        .catch((err) => setError(err.message))
        .finally(() => setLoadingUsers(false))
    }
  }, [user])

  const handleRoleChange = async (email: string, newRole: string) => {
    setUpdatingRole(email)
    setOpenDropdown(null)
    try {
      const res = await fetch("/api/users/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: newRole }),
      })

      if (!res.ok) {
        const data = await res.json()
        alert(data.error || "Failed to update role")
        return
      }

      const data = await res.json()
      setUsers((prev) =>
        prev.map((u) =>
          u.email === email ? { ...u, role: data.user.role } : u
        )
      )
    } catch (err) {
      alert("Failed to update role")
    } finally {
      setUpdatingRole(null)
    }
  }

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="pl-[80px]">
        <div className="max-w-2xl mx-auto px-6 py-12">
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-8 text-center">
            <ShieldAlert className="size-8 mx-auto mb-3 text-destructive" />
            <p className="font-medium">{error}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Contact an administrator for access.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="pl-[80px]">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="space-y-8"
        >
          {/* Header */}
          <motion.div variants={item}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/10">
                <Shield className="size-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  User Management
                </h1>
                <p className="text-muted-foreground text-sm">
                  {users.length} user{users.length !== 1 ? "s" : ""} registered
                </p>
              </div>
            </div>
          </motion.div>

          {/* Users list */}
          {loadingUsers ? (
            <div className="rounded-xl border border-border bg-card p-8 flex justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <motion.div variants={item} className="space-y-2">
              {users
                .sort((a, b) => {
                  const roleOrder = { admin: 0, member: 1, viewer: 2 }
                  return roleOrder[a.role] - roleOrder[b.role]
                })
                .map((u) => {
                  const roleConfig = ROLE_CONFIG[u.role] || ROLE_CONFIG.viewer
                  const RoleIcon = roleConfig.icon
                  const isCurrentUser = u.email === user?.email

                  return (
                    <div
                      key={u.email}
                      className="rounded-xl border border-border bg-card p-4 flex items-center gap-4"
                    >
                      {/* Avatar */}
                      {u.avatar_url ? (
                        <Image
                          src={u.avatar_url}
                          alt={u.name}
                          width={40}
                          height={40}
                          className="rounded-full ring-1 ring-border"
                        />
                      ) : (
                        <div className="size-10 rounded-full bg-muted flex items-center justify-center ring-1 ring-border">
                          <span className="text-sm font-semibold">
                            {u.name?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {u.name}
                          {isCurrentUser && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              (you)
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {u.email}
                        </p>
                      </div>

                      {/* Joined date */}
                      <div className="hidden sm:block text-xs text-muted-foreground">
                        Joined{" "}
                        {new Date(u.created_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>

                      {/* Role selector */}
                      <div className="relative">
                        {updatingRole === u.email ? (
                          <div className="px-3 py-1.5">
                            <Loader2 className="size-4 animate-spin text-muted-foreground" />
                          </div>
                        ) : (
                          <button
                            onClick={() =>
                              setOpenDropdown(
                                openDropdown === u.email ? null : u.email
                              )
                            }
                            disabled={isCurrentUser}
                            className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${roleConfig.bg} ${roleConfig.color} ${isCurrentUser ? "opacity-60 cursor-not-allowed" : "hover:opacity-80 cursor-pointer"}`}
                          >
                            <RoleIcon className="size-3" />
                            {roleConfig.label}
                            {!isCurrentUser && (
                              <ChevronDown className="size-3 ml-0.5" />
                            )}
                          </button>
                        )}

                        {/* Dropdown */}
                        {openDropdown === u.email && (
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => setOpenDropdown(null)}
                            />
                            <div className="absolute right-0 top-full mt-1 z-50 w-40 rounded-lg border border-border bg-card shadow-lg overflow-hidden">
                              {(["admin", "member", "viewer"] as const).map(
                                (role) => {
                                  const config = ROLE_CONFIG[role]
                                  const Icon = config.icon
                                  return (
                                    <button
                                      key={role}
                                      onClick={() =>
                                        handleRoleChange(u.email, role)
                                      }
                                      className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors hover:bg-muted/50 ${u.role === role ? "bg-muted/30 font-medium" : ""}`}
                                    >
                                      <Icon
                                        className={`size-3.5 ${config.color}`}
                                      />
                                      {config.label}
                                    </button>
                                  )
                                }
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
            </motion.div>
          )}

          {/* Role explanation */}
          <motion.div
            variants={item}
            className="rounded-xl border border-border/50 bg-card/50 p-5 space-y-3"
          >
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Role Permissions
            </h3>
            <div className="grid gap-2 text-sm">
              <div className="flex items-center gap-2">
                <Crown className="size-3.5 text-amber-500" />
                <span className="font-medium">Admin</span>
                <span className="text-muted-foreground">
                  — Full access. Manage users, integrations, and all tools.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <UserIcon className="size-3.5 text-blue-500" />
                <span className="font-medium">Member</span>
                <span className="text-muted-foreground">
                  — Use all tools. Can create itineraries and connect
                  integrations.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Eye className="size-3.5 text-muted-foreground" />
                <span className="font-medium">Viewer</span>
                <span className="text-muted-foreground">
                  — Read-only access. Can view itineraries but not create or
                  edit.
                </span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
