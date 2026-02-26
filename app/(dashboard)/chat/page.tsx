/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useChat } from '@ai-sdk/react'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useGoogleAuth } from '@/components/google-auth-provider-clean'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Square, AlertCircle, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WelcomeScreen } from '@/components/chat/welcome-screen'
import { ToolResultCard } from '@/components/chat/tool-result-card'
import { ChatHistory } from '@/components/chat/chat-history'

export default function ChatPage() {
  const { user, loading } = useGoogleAuth()
  const router = useRouter()
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [input, setInput] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [savingMessages, setSavingMessages] = useState(false)
  const prevMessageCountRef = useRef(0)

  const {
    messages,
    sendMessage,
    setMessages,
    stop,
    status,
    error,
  } = useChat({
    id: conversationId || undefined,
  })

  const isLoading = status === 'submitted' || status === 'streaming'

  // Auth guard
  useEffect(() => {
    if (!loading && !user) router.push('/auth/signin')
  }, [user, loading, router])

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 160)}px`
    }
  }, [input])

  // ── Conversation persistence ────────────────────────

  // Create conversation on first user message
  const ensureConversation = useCallback(async (): Promise<string | null> => {
    if (conversationId) return conversationId

    try {
      const res = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) return null
      const data = await res.json()
      setConversationId(data.id)
      return data.id
    } catch {
      return null
    }
  }, [conversationId])

  // Save messages when the assistant finishes responding
  useEffect(() => {
    const messageCount = messages.length
    const hadNewMessages = prevMessageCountRef.current < messageCount
    prevMessageCountRef.current = messageCount

    // Only save when status transitions to 'ready' and we have new messages
    if (status !== 'ready' || !hadNewMessages || !conversationId || messageCount === 0) return

    const saveMessages = async () => {
      setSavingMessages(true)
      try {
        const toSave = messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.parts
            ?.filter((p: any) => p.type === 'text' && p.text)
            .map((p: any) => p.text)
            .join('\n') || '',
          toolInvocations: m.parts
            ?.filter((p: any) => p.type === 'tool-invocation')
            .map((p: any) => p.toolInvocation) || [],
          createdAt: new Date().toISOString(),
        }))

        await fetch(`/api/chat/conversations/${conversationId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: toSave }),
        })

        // Auto-title: update title based on first user message (only on first exchange)
        const firstUserMsg = messages.find((m) => m.role === 'user')
        if (firstUserMsg && messageCount <= 3) {
          const title = firstUserMsg.parts
            ?.filter((p: any) => p.type === 'text')
            .map((p: any) => p.text)
            .join(' ')
            ?.slice(0, 80) || 'New conversation'

          await fetch(`/api/chat/conversations/${conversationId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title }),
          })
        }
      } catch {
        // Non-critical — don't disrupt the user
      } finally {
        setSavingMessages(false)
      }
    }

    saveMessages()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, conversationId])

  // ── Message handlers ────────────────────────────────

  const handleSend = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || isLoading) return

    await ensureConversation()
    sendMessage({ text: trimmed })
    setInput('')
  }, [input, isLoading, sendMessage, ensureConversation])

  const handlePromptSelect = useCallback(async (prompt: string) => {
    if (isLoading) return
    await ensureConversation()
    sendMessage({ text: prompt })
  }, [isLoading, sendMessage, ensureConversation])

  const handleRetry = useCallback(() => {
    if (messages.length > 0) {
      const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
      if (lastUserMsg) {
        const text = lastUserMsg.parts
          ?.filter((p: any) => p.type === 'text')
          .map((p: any) => p.text)
          .join('\n') || ''
        if (text) {
          sendMessage({ text })
        }
      }
    }
  }, [messages, sendMessage])

  // ── Conversation navigation ─────────────────────────

  const handleNewConversation = useCallback(() => {
    setConversationId(null)
    setMessages([])
    prevMessageCountRef.current = 0
    setHistoryOpen(false)
    inputRef.current?.focus()
  }, [setMessages])

  const handleSelectConversation = useCallback(async (id: string) => {
    if (id === conversationId) {
      setHistoryOpen(false)
      return
    }

    try {
      const res = await fetch(`/api/chat/conversations/${id}`)
      if (!res.ok) return

      const data = await res.json()
      setConversationId(id)

      if (data.messages?.length > 0) {
        const uiMessages = data.messages.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content || '',
          parts: [
            ...(m.content ? [{ type: 'text', text: m.content }] : []),
            ...(m.toolInvocations || []).map((t: any) => ({
              type: 'tool-invocation',
              toolInvocation: t,
            })),
          ],
        }))
        setMessages(uiMessages)
        prevMessageCountRef.current = uiMessages.length
      } else {
        setMessages([])
        prevMessageCountRef.current = 0
      }
    } catch {
      // Silently fail
    }

    setHistoryOpen(false)
  }, [conversationId, setMessages])

  // ── Render ──────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-dvh pl-24 lg:pl-32">
        <div className="size-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="flex h-dvh pl-0 lg:pl-[80px]">
      {/* Chat history sidebar */}
      <ChatHistory
        isOpen={historyOpen}
        onToggle={() => setHistoryOpen((prev) => !prev)}
        activeConversationId={conversationId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
      />

      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Messages area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
            {messages.length === 0 ? (
              <WelcomeScreen onSelectPrompt={handlePromptSelect} />
            ) : (
              <div className="space-y-6">
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}
                  >
                    <div
                      className={cn(
                        'max-w-[85%]',
                        message.role === 'user'
                          ? 'rounded-2xl bg-primary text-primary-foreground px-4 py-2.5'
                          : ''
                      )}
                    >
                      {message.parts?.map((part: any, i: number) => {
                        if (part.type === 'text' && part.text) {
                          return message.role === 'user' ? (
                            <p key={i} className="text-sm whitespace-pre-wrap">{part.text}</p>
                          ) : (
                            <div key={i} className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-muted prose-pre:text-foreground">
                              <ReactMarkdown>{part.text}</ReactMarkdown>
                            </div>
                          )
                        }
                        if (part.type === 'tool-invocation') {
                          return (
                            <ToolResultCard
                              key={i}
                              toolName={part.toolInvocation.toolName}
                              state={part.toolInvocation.state}
                              result={part.toolInvocation.result}
                            />
                          )
                        }
                        return null
                      })}
                    </div>
                  </motion.div>
                ))}

                {/* Thinking indicator */}
                {isLoading && messages[messages.length - 1]?.role === 'user' && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-1.5 px-4 py-2.5">
                      <div className="size-1.5 rounded-full bg-muted-foreground/40 animate-pulse" />
                      <div className="size-1.5 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:150ms]" />
                      <div className="size-1.5 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:300ms]" />
                    </div>
                  </div>
                )}

                {/* Error state with retry */}
                <AnimatePresence>
                  {error && !isLoading && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="flex justify-start"
                    >
                      <div className="flex items-start gap-3 max-w-[85%] rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
                        <AlertCircle className="size-4 text-destructive flex-shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-sm text-destructive font-medium">Something went wrong</p>
                          <p className="text-xs text-destructive/70 mt-0.5">
                            {error.message || 'The AI assistant encountered an error. Please try again.'}
                          </p>
                          <button
                            onClick={handleRetry}
                            className="flex items-center gap-1.5 mt-2 text-xs font-medium text-destructive hover:text-destructive/80 transition-colors"
                          >
                            <RotateCcw className="size-3" />
                            Retry
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        {/* Input area */}
        <div className="border-t border-border bg-background/80 backdrop-blur-sm">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4">
            <div className="relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder="Ask about your pipeline, leads, events, clients..."
                rows={1}
                className="w-full resize-none rounded-xl border border-border bg-card px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/50 transition-all"
              />
              {isLoading ? (
                <button
                  type="button"
                  onClick={() => stop()}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                >
                  <Square className="size-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Send className="size-4" />
                </button>
              )}
            </div>
            <div className="flex items-center justify-center gap-2 mt-2">
              <p className="text-[11px] text-muted-foreground/50">
                AI responses are generated from live Salesforce and Aircall data
              </p>
              {savingMessages && (
                <span className="text-[11px] text-muted-foreground/40 flex items-center gap-1">
                  <span className="size-1 rounded-full bg-muted-foreground/30 animate-pulse" />
                  Saving
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
