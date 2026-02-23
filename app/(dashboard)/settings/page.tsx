"use client"

import { useEffect, useState } from "react"
import { useGoogleAuth } from "@/components/google-auth-provider-clean"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { motion } from "framer-motion"
import {
  Check,
  ExternalLink,
  Loader2,
  LogOut,
  Shield,
  Unplug,
} from "lucide-react"

interface Integration {
  service: "google" | "canva" | "slack"
  connected: boolean
  email?: string
  scopes?: string[]
  connected_at?: string
  expires_at?: number
}

interface UserInfo {
  email: string
  name: string
  avatar_url: string
  role: string
}

const SCOPE_LABELS: Record<string, string> = {
  openid: "Sign-in",
  email: "Email address",
  profile: "Profile info",
  "https://www.googleapis.com/auth/drive": "Google Drive",
  "https://www.googleapis.com/auth/presentations": "Google Slides",
  "design:content:write": "Create designs",
  "asset:read": "Read assets",
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
}
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
}

export default function SettingsPage() {
  const { user, loading, signOut } = useGoogleAuth()
  const router = useRouter()
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [loadingIntegrations, setLoadingIntegrations] = useState(true)

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/signin")
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user) {
      fetch("/api/user/integrations")
        .then((res) => res.json())
        .then((data) => {
          setIntegrations(data.integrations || [])
          setUserInfo(data.user || null)
        })
        .catch(console.error)
        .finally(() => setLoadingIntegrations(false))
    }
  }, [user])

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const roleLabel =
    userInfo?.role === "admin"
      ? "Admin"
      : userInfo?.role === "member"
        ? "Member"
        : "Viewer"

  return (
    <div className="pl-[80px]">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="space-y-10"
        >
          {/* Header */}
          <motion.div variants={item}>
            <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage your account and connected services.
            </p>
          </motion.div>

          {/* Profile */}
          <motion.div variants={item} className="space-y-4">
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Account
            </h2>
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-4">
                {user.picture ? (
                  <Image
                    src={user.picture}
                    alt={user.name || ""}
                    width={48}
                    height={48}
                    className="rounded-full ring-2 ring-border"
                  />
                ) : (
                  <div className="size-12 rounded-full bg-muted flex items-center justify-center ring-2 ring-border">
                    <span className="text-lg font-semibold">
                      {(user.name || user.email)?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{user.name}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {user.email}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                    <Shield className="size-3" />
                    {roleLabel}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Integrations */}
          <motion.div variants={item} className="space-y-4">
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Integrations
            </h2>

            {loadingIntegrations ? (
              <div className="rounded-xl border border-border bg-card p-8 flex justify-center">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-3">
                {integrations.map((integration) => (
                  <IntegrationCard
                    key={integration.service}
                    integration={integration}
                  />
                ))}
              </div>
            )}
          </motion.div>

          {/* Sign Out */}
          <motion.div variants={item}>
            <button
              onClick={() => {
                signOut()
                router.push("/auth/signin")
              }}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-destructive transition-colors"
            >
              <LogOut className="size-4" />
              Sign out
            </button>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}

function IntegrationCard({ integration }: { integration: Integration }) {
  const icon =
    integration.service === "google"
      ? "/google-icon.svg"
      : integration.service === "canva"
        ? "/canva-icon.svg"
        : null

  const title =
    integration.service === "google"
      ? "Google"
      : integration.service === "canva"
        ? "Canva"
        : "Slack"

  const description =
    integration.service === "google"
      ? "Drive, Slides, and authentication"
      : integration.service === "canva"
        ? "Design creation and templates"
        : "Team messaging and notifications"

  const scopeLabels = (integration.scopes || [])
    .map((s) => SCOPE_LABELS[s] || s)
    .filter(
      (s) => !["Sign-in", "Email address", "Profile info"].includes(s)
    )

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {icon ? (
            <div className="size-9 rounded-lg bg-muted/50 flex items-center justify-center">
              <ServiceIcon service={integration.service} />
            </div>
          ) : (
            <div className="size-9 rounded-lg bg-muted/50 flex items-center justify-center">
              <Unplug className="size-4 text-muted-foreground" />
            </div>
          )}
          <div>
            <p className="font-medium text-sm">{title}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {integration.connected ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
              <Check className="size-3" />
              Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
              Not connected
            </span>
          )}
        </div>
      </div>

      {/* Show connected details */}
      {integration.connected && scopeLabels.length > 0 && (
        <div className="pt-2 border-t border-border/50">
          <p className="text-xs text-muted-foreground mb-2">Permissions</p>
          <div className="flex flex-wrap gap-1.5">
            {scopeLabels.map((label) => (
              <span
                key={label}
                className="text-[11px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      )}

      {integration.connected && integration.email && (
        <div className="pt-2 border-t border-border/50">
          <p className="text-xs text-muted-foreground">
            Signed in as{" "}
            <span className="text-foreground">{integration.email}</span>
          </p>
        </div>
      )}
    </div>
  )
}

function ServiceIcon({ service }: { service: string }) {
  if (service === "google") {
    return (
      <svg className="size-5" viewBox="0 0 24 24">
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.07 5.07 0 01-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
    )
  }
  if (service === "canva") {
    return (
      <svg className="size-5" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" fill="#00C4CC" />
        <path
          d="M15.5 8.5c-1.5-1.5-4-1.5-5.5 0s-1.5 4 0 5.5 4 1.5 5.5 0"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    )
  }
  return <Unplug className="size-4 text-muted-foreground" />
}
