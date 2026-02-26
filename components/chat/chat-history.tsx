'use client'

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type KeyboardEvent,
} from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Download,
  Trash2,
  X,
  PanelLeftOpen,
  PanelLeftClose,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────

interface ConversationMeta {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messageCount: number
}

interface ChatHistoryProps {
  isOpen: boolean
  onToggle: () => void
  activeConversationId: string | null
  onSelectConversation: (id: string) => void
  onNewConversation: () => void
}

// ── Relative time helper ──────────────────────────────

function formatRelativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then

  if (diffMs < 0 || Number.isNaN(diffMs)) return 'Just now'

  const seconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const weeks = Math.floor(days / 7)
  const months = Math.floor(days / 30)

  if (seconds < 60) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (weeks < 4) return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`
  if (months < 12) return months === 1 ? '1 month ago' : `${months} months ago`

  const years = Math.floor(months / 12)
  return years === 1 ? '1 year ago' : `${years} years ago`
}

// ── Skeleton loader ───────────────────────────────────

function SkeletonItem() {
  return (
    <div className="flex items-start gap-3 px-3 py-3 animate-pulse">
      <div className="size-8 rounded-lg bg-muted flex-shrink-0 mt-0.5" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 bg-muted rounded w-3/4" />
        <div className="flex items-center gap-3">
          <div className="h-2.5 bg-muted rounded w-12" />
          <div className="h-2.5 bg-muted rounded w-16" />
        </div>
      </div>
    </div>
  )
}

// ── Context menu ──────────────────────────────────────

interface ContextMenuProps {
  conversationId: string
  onRename: () => void
  onExport: () => void
  onDelete: () => void
}

function ConversationContextMenu({
  conversationId,
  onRename,
  onExport,
  onDelete,
}: ContextMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu on outside click
  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen((prev) => !prev)
        }}
        className={cn(
          'p-1 rounded-md transition-colors',
          'text-muted-foreground hover:text-foreground hover:bg-muted',
          isOpen && 'text-foreground bg-muted'
        )}
        aria-label={`Actions for conversation ${conversationId}`}
      >
        <MoreHorizontal className="size-4" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-full mt-1 z-50 w-40 rounded-lg border border-border bg-card shadow-lg py-1"
          >
            <button
              onClick={(e) => {
                e.stopPropagation()
                setIsOpen(false)
                onRename()
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
            >
              <Pencil className="size-3.5" />
              Rename
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setIsOpen(false)
                onExport()
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
            >
              <Download className="size-3.5" />
              Export
            </button>
            <div className="h-px bg-border mx-2 my-1" />
            <button
              onClick={(e) => {
                e.stopPropagation()
                setIsOpen(false)
                onDelete()
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="size-3.5" />
              Delete
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Delete confirmation dialog ────────────────────────

interface DeleteDialogProps {
  title: string
  onConfirm: () => void
  onCancel: () => void
}

function DeleteConfirmDialog({ title, onConfirm, onCancel }: DeleteDialogProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm mx-4 rounded-xl border border-border bg-card p-6 shadow-xl"
      >
        <h3 className="text-sm font-semibold text-foreground mb-2">
          Delete conversation
        </h3>
        <p className="text-sm text-muted-foreground mb-5">
          Are you sure you want to delete{' '}
          <span className="font-medium text-foreground">&ldquo;{title}&rdquo;</span>?
          This cannot be undone.
        </p>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm font-medium rounded-lg border border-border text-foreground hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
          >
            Delete
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Main component ────────────────────────────────────

export function ChatHistory({
  isOpen,
  onToggle,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
}: ChatHistoryProps) {
  const [conversations, setConversations] = useState<ConversationMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<ConversationMeta | null>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)

  // ── Fetch conversations ───────────────────────────

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/conversations')
      if (!res.ok) return
      const data = await res.json()
      if (data.conversations) {
        setConversations(data.conversations)
      }
    } catch {
      // Silently fail — non-critical
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  // Refresh conversations when the sidebar opens or active conversation changes
  useEffect(() => {
    if (isOpen) {
      fetchConversations()
    }
  }, [isOpen, activeConversationId, fetchConversations])

  // ── Rename ────────────────────────────────────────

  const startRename = useCallback(
    (conversation: ConversationMeta) => {
      setRenamingId(conversation.id)
      setRenameValue(conversation.title)
      // Focus the input after it renders
      requestAnimationFrame(() => {
        renameInputRef.current?.focus()
        renameInputRef.current?.select()
      })
    },
    []
  )

  const submitRename = useCallback(async () => {
    if (!renamingId) return

    const trimmed = renameValue.trim()
    if (!trimmed) {
      setRenamingId(null)
      return
    }

    // Optimistic update
    setConversations((prev) =>
      prev.map((c) => (c.id === renamingId ? { ...c, title: trimmed } : c))
    )

    const targetId = renamingId
    setRenamingId(null)

    try {
      const res = await fetch(`/api/chat/conversations/${targetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed }),
      })
      if (!res.ok) {
        // Revert on failure
        fetchConversations()
      }
    } catch {
      fetchConversations()
    }
  }, [renamingId, renameValue, fetchConversations])

  const cancelRename = useCallback(() => {
    setRenamingId(null)
    setRenameValue('')
  }, [])

  const handleRenameKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        submitRename()
      } else if (e.key === 'Escape') {
        cancelRename()
      }
    },
    [submitRename, cancelRename]
  )

  // ── Export ────────────────────────────────────────

  const handleExport = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/chat/conversations/${id}/export`)
      if (!res.ok) return

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `conversation-${id}.md`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      // Silently fail
    }
  }, [])

  // ── Delete ────────────────────────────────────────

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return

    const targetId = deleteTarget.id
    setDeleteTarget(null)

    // Optimistic removal
    setConversations((prev) => prev.filter((c) => c.id !== targetId))

    try {
      const res = await fetch(`/api/chat/conversations/${targetId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        fetchConversations()
      }
    } catch {
      fetchConversations()
    }
  }, [deleteTarget, fetchConversations])

  return (
    <>
      {/* Toggle button — always visible */}
      <button
        onClick={onToggle}
        className={cn(
          'fixed z-30 top-4 flex items-center justify-center',
          'size-8 rounded-lg border border-border bg-card/80 backdrop-blur-sm',
          'text-muted-foreground hover:text-foreground hover:bg-card',
          'shadow-sm transition-colors duration-200',
          // Position: just after the main sidebar (80px) + offset
          isOpen ? 'left-[356px]' : 'left-[88px]',
          // On mobile, shift leftward since the main sidebar is hidden
          'max-lg:left-4',
          isOpen && 'max-lg:left-[284px]'
        )}
        style={{
          transition: 'left 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94), color 0.2s, background-color 0.2s',
        }}
        aria-label={isOpen ? 'Close chat history' : 'Open chat history'}
      >
        {isOpen ? (
          <PanelLeftClose className="size-4" />
        ) : (
          <PanelLeftOpen className="size-4" />
        )}
      </button>

      {/* Mobile overlay backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onToggle}
            className="fixed inset-0 z-20 bg-black/40 backdrop-blur-sm lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar panel */}
      <motion.aside
        initial={false}
        animate={{
          width: isOpen ? 280 : 0,
          opacity: isOpen ? 1 : 0,
        }}
        transition={{
          duration: 0.3,
          ease: [0.25, 0.46, 0.45, 0.94],
        }}
        className={cn(
          'h-dvh bg-card border-r border-border flex-shrink-0 overflow-hidden',
          // Desktop: sits next to the main sidebar in the flow
          'relative z-20',
          // Mobile: overlay on top of chat area
          'max-lg:fixed max-lg:left-0 max-lg:top-0 max-lg:z-30'
        )}
      >
        <div className="flex flex-col h-full w-[280px]">
          {/* Header */}
          <div className="h-14 border-b border-border flex items-center justify-between px-4 flex-shrink-0">
            <h2 className="text-sm font-semibold text-foreground tracking-tight whitespace-nowrap">
              Chat History
            </h2>
            <button
              onClick={onToggle}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors lg:hidden"
              aria-label="Close chat history"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* New conversation button */}
          <div className="px-3 pt-3 pb-1 flex-shrink-0">
            <button
              onClick={onNewConversation}
              className={cn(
                'flex items-center gap-2 w-full px-3 py-2.5 rounded-lg',
                'text-sm font-medium transition-all duration-200',
                'border border-dashed border-border',
                'text-muted-foreground hover:text-foreground',
                'hover:bg-muted/50 hover:border-solid hover:border-border'
              )}
            >
              <Plus className="size-4" />
              <span>New conversation</span>
            </button>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto scrollbar-hide px-2 py-2">
            {loading ? (
              // Skeleton loading state
              <div className="space-y-1">
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonItem key={i} />
                ))}
              </div>
            ) : conversations.length === 0 ? (
              // Empty state
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <div className="size-12 rounded-xl bg-muted flex items-center justify-center mb-3">
                  <MessageSquare className="size-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">
                  No conversations yet
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Start a new conversation and it will appear here.
                </p>
              </div>
            ) : (
              // Conversation list
              <div className="space-y-0.5">
                {conversations.map((conversation) => {
                  const isActive = conversation.id === activeConversationId
                  const isRenaming = renamingId === conversation.id

                  return (
                    <div
                      key={conversation.id}
                      onClick={() => {
                        if (!isRenaming) {
                          onSelectConversation(conversation.id)
                        }
                      }}
                      className={cn(
                        'group relative flex items-start gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-150',
                        isActive
                          ? 'bg-muted/80 border border-border/60'
                          : 'hover:bg-muted/40 border border-transparent'
                      )}
                    >
                      {/* Icon */}
                      <div
                        className={cn(
                          'size-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors',
                          isActive
                            ? 'bg-primary/10 text-primary'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        <MessageSquare className="size-3.5" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {isRenaming ? (
                          <input
                            ref={renameInputRef}
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={handleRenameKeyDown}
                            onBlur={submitRename}
                            className="w-full text-sm font-medium bg-background border border-border rounded-md px-2 py-1 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <p
                            className={cn(
                              'text-sm font-medium truncate pr-6',
                              isActive
                                ? 'text-foreground'
                                : 'text-foreground/80'
                            )}
                            title={conversation.title}
                          >
                            {conversation.title}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-muted-foreground">
                            {formatRelativeTime(conversation.updatedAt)}
                          </span>
                          <span className="text-muted-foreground/30">&middot;</span>
                          <span className="text-[11px] text-muted-foreground">
                            {conversation.messageCount}{' '}
                            {conversation.messageCount === 1 ? 'msg' : 'msgs'}
                          </span>
                        </div>
                      </div>

                      {/* Context menu — visible on hover or when active */}
                      {!isRenaming && (
                        <div
                          className={cn(
                            'absolute right-2 top-2 transition-opacity',
                            'opacity-0 group-hover:opacity-100',
                            isActive && 'opacity-100'
                          )}
                        >
                          <ConversationContextMenu
                            conversationId={conversation.id}
                            onRename={() => startRename(conversation)}
                            onExport={() => handleExport(conversation.id)}
                            onDelete={() => setDeleteTarget(conversation)}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border px-4 py-3 flex-shrink-0">
            <p className="text-[11px] text-muted-foreground/60 text-center">
              {conversations.length > 0
                ? `${conversations.length} conversation${conversations.length === 1 ? '' : 's'}`
                : 'Conversations auto-expire after 90 days'}
            </p>
          </div>
        </div>
      </motion.aside>

      {/* Delete confirmation dialog */}
      <AnimatePresence>
        {deleteTarget && (
          <DeleteConfirmDialog
            title={deleteTarget.title}
            onConfirm={handleDelete}
            onCancel={() => setDeleteTarget(null)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
