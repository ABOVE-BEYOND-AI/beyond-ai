// Xero API client with OAuth token management and all finance API methods
import { Redis } from '@upstash/redis'
import type {
  XeroOrgTokens,
  XeroInvoice,
  XeroContact,
  XeroBankAccount,
  XeroHistoryRecord,
  XeroCreditNote,
  ChaseStageKey,
  ChaseStageData,
  ChaseActivity,
  ChaseStageConfig,
  EnrichedInvoice,
  PaymentPlanInvoice,
} from './types'

// ── Constants ──

const XERO_AUTH_URL = 'https://login.xero.com/identity/connect/authorize'
const XERO_TOKEN_URL = 'https://identity.xero.com/connect/token'
const XERO_API_BASE = 'https://api.xero.com/api.xro/2.0'
const XERO_CONNECTIONS_URL = 'https://api.xero.com/connections'

// New granular scopes (required for apps created after March 2, 2026)
// accounting.transactions was split into accounting.invoices + accounting.payments
const XERO_SCOPES = 'openid profile email accounting.invoices accounting.payments accounting.contacts accounting.settings offline_access'

// Token refresh buffer: refresh 5 minutes before expiry
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000

// UUID format validation for Xero IDs (invoices, contacts, accounts, credit notes)
const XERO_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function assertValidXeroId(id: string, label = 'ID'): void {
  if (!XERO_UUID_REGEX.test(id)) {
    throw new Error(`Invalid ${label} format`)
  }
}

// Redis keys
const REDIS_KEYS = {
  orgTokens: 'xero:org_tokens',
  chaseStages: 'xero:chase_stages',
  chaseActivity: (invoiceId: string) => `xero:chase_activity:${invoiceId}`,
  contactCache: (contactId: string) => `xero:contacts_cache:${contactId}`,
  bankAccounts: 'xero:bank_accounts',
  oauthState: (state: string) => `xero:oauth_state:${state}`,
  invoicesCache: 'xero:invoices_cache',
}

// ── Xero Date Parser ──
// Xero returns dates as "/Date(1629292800000+0000)/" or ISO strings
function parseXeroDate(dateStr: string): string {
  if (!dateStr) return ''
  // Handle /Date(timestamp+offset)/ format
  const match = dateStr.match(/\/Date\((\d+)([+-]\d{4})?\)\//)
  if (match) {
    return new Date(parseInt(match[1])).toISOString()
  }
  // Already ISO or standard date string
  return dateStr
}

// Chase stage definitions matching Scarlett's Salesforce dropdown
export const CHASE_STAGES: ChaseStageConfig[] = [
  { key: '1-3_days_xero_reminder', label: '1-3 days Xero Reminder', color: 'bg-green-100', textColor: 'text-green-700', description: 'Automated Xero reminder sent' },
  { key: '3-5_days_finance_email', label: '3-5 days Finance Email', color: 'bg-blue-100', textColor: 'text-blue-700', description: 'Finance team sends manual email' },
  { key: '8_days_process_email', label: '8 days Process + Email', color: 'bg-orange-100', textColor: 'text-orange-700', description: 'Attempt to take payment + email' },
  { key: '10_days_process_email', label: '10 days Process + Email', color: 'bg-purple-100', textColor: 'text-purple-700', description: 'Second attempt to process + email' },
  { key: 'daily_chaser', label: 'Daily Chaser', color: 'bg-amber-100', textColor: 'text-amber-700', description: 'Daily follow-up' },
  { key: 'final_warning', label: 'Final Warning', color: 'bg-red-100', textColor: 'text-red-600', description: 'Last warning before cancellation' },
  { key: 'cancellation_terms', label: 'Cancellation Terms', color: 'bg-red-200', textColor: 'text-red-800', description: 'Cancellation terms issued' },
  { key: 'bolt_on', label: 'BOLT ON', color: 'bg-emerald-100', textColor: 'text-emerald-800', description: 'Bolt-on / resolved' },
]

// ── Redis Client ──

let redisClient: Redis | null = null
function getRedis(): Redis {
  if (!redisClient) {
    redisClient = Redis.fromEnv()
  }
  return redisClient
}

// ── In-Memory Token Cache ──

let cachedTokens: XeroOrgTokens | null = null

// Mutex to prevent concurrent token refreshes (Xero rotates refresh tokens,
// so two simultaneous refreshes will cause the second to fail)
let refreshPromise: Promise<XeroOrgTokens> | null = null

// ── OAuth Helpers ──

export async function getXeroAuthUrl(adminEmail: string): Promise<string> {
  const state = crypto.randomUUID()
  const redis = getRedis()
  // Store state for CSRF validation (10 min expiry) — must await to ensure state is stored before redirect
  await redis.set(REDIS_KEYS.oauthState(state), { email: adminEmail, created: Date.now() }, { ex: 600 })

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.XERO_CLIENT_ID!,
    redirect_uri: process.env.XERO_REDIRECT_URI!,
    scope: XERO_SCOPES,
    state,
  })

  return `${XERO_AUTH_URL}?${params.toString()}`
}

export async function validateOAuthState(state: string): Promise<{ email: string } | null> {
  const redis = getRedis()
  // Atomic get-and-delete to prevent TOCTOU race condition (state reuse)
  const key = REDIS_KEYS.oauthState(state)
  const data = await redis.get(key) as { email: string } | null
  if (data) {
    // Delete immediately — if two requests race, only the first succeeds
    const deleted = await redis.del(key)
    if (deleted === 0) {
      // Another request already consumed this state token
      return null
    }
  }
  return data
}

export async function exchangeCodeForTokens(code: string): Promise<XeroOrgTokens> {
  const credentials = Buffer.from(`${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`).toString('base64')

  const tokenRes = await fetch(XERO_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.XERO_REDIRECT_URI!,
    }),
  })

  if (!tokenRes.ok) {
    const err = await tokenRes.text()
    console.error('Xero token exchange failed:', tokenRes.status, err.slice(0, 200))
    throw new Error('Xero token exchange failed. Please try again.')
  }

  const data = await tokenRes.json()

  // Get tenant ID from connections endpoint
  const connectionsRes = await fetch(XERO_CONNECTIONS_URL, {
    headers: { 'Authorization': `Bearer ${data.access_token}` },
  })

  if (!connectionsRes.ok) {
    throw new Error('Failed to get Xero tenant connections')
  }

  const connections = await connectionsRes.json()
  if (!connections.length) {
    throw new Error('No Xero organisations connected')
  }

  const tenantId = connections[0].tenantId

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in * 1000),
    tenant_id: tenantId,
    connected_by: '', // filled by caller
    connected_at: new Date().toISOString(),
  }
}

export async function saveOrgTokens(tokens: XeroOrgTokens): Promise<void> {
  const redis = getRedis()
  await redis.set(REDIS_KEYS.orgTokens, tokens)
  cachedTokens = tokens
}

export async function getOrgTokens(): Promise<XeroOrgTokens | null> {
  const redis = getRedis()
  return await redis.get(REDIS_KEYS.orgTokens) as XeroOrgTokens | null
}

export async function disconnectXero(): Promise<void> {
  const redis = getRedis()
  await redis.del(REDIS_KEYS.orgTokens)
  cachedTokens = null
}

// ── Token Management ──

async function refreshTokens(): Promise<XeroOrgTokens> {
  // If a refresh is already in progress, wait for it instead of starting another
  // This prevents race conditions where two concurrent requests both try to refresh,
  // and the second fails because Xero already rotated the refresh token
  if (refreshPromise) {
    return refreshPromise
  }

  refreshPromise = doRefreshTokens()
  try {
    return await refreshPromise
  } finally {
    refreshPromise = null
  }
}

async function doRefreshTokens(): Promise<XeroOrgTokens> {
  const redis = getRedis()
  const stored = await redis.get(REDIS_KEYS.orgTokens) as XeroOrgTokens | null

  if (!stored?.refresh_token) {
    throw new Error('No Xero refresh token available. Please reconnect Xero.')
  }

  const credentials = Buffer.from(`${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`).toString('base64')

  const res = await fetch(XERO_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: stored.refresh_token,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('Xero token refresh failed:', res.status, err.slice(0, 200))
    throw new Error('Xero token refresh failed. Please reconnect Xero.')
  }

  const data = await res.json()

  const updated: XeroOrgTokens = {
    ...stored,
    access_token: data.access_token,
    refresh_token: data.refresh_token, // Xero rotates refresh tokens
    expires_at: Date.now() + (data.expires_in * 1000),
  }

  await redis.set(REDIS_KEYS.orgTokens, updated)
  cachedTokens = updated
  return updated
}

async function getValidToken(): Promise<{ accessToken: string; tenantId: string }> {
  // Check in-memory cache first
  if (cachedTokens && Date.now() < cachedTokens.expires_at - TOKEN_REFRESH_BUFFER_MS) {
    return { accessToken: cachedTokens.access_token, tenantId: cachedTokens.tenant_id }
  }

  // Check Redis
  const stored = await getOrgTokens()
  if (!stored) {
    throw new Error('Xero is not connected. Please connect from Settings.')
  }

  // If token is still valid, use it
  if (Date.now() < stored.expires_at - TOKEN_REFRESH_BUFFER_MS) {
    cachedTokens = stored
    return { accessToken: stored.access_token, tenantId: stored.tenant_id }
  }

  // Refresh needed
  const refreshed = await refreshTokens()
  return { accessToken: refreshed.access_token, tenantId: refreshed.tenant_id }
}

// ── Generic API Caller ──

async function xeroFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; retried?: boolean } = {}
): Promise<T> {
  const { accessToken, tenantId } = await getValidToken()
  const method = options.method || 'GET'

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${accessToken}`,
    'Xero-Tenant-Id': tenantId,
    'Accept': 'application/json',
  }

  if (options.body) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(`${XERO_API_BASE}${path}`, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  // Handle token expiry — retry once after refresh
  if (res.status === 401 && !options.retried) {
    cachedTokens = null
    await refreshTokens()
    return xeroFetch<T>(path, { ...options, retried: true })
  }

  if (res.status === 429) {
    const minRemaining = res.headers.get('X-MinLimit-Remaining')
    const dayRemaining = res.headers.get('X-DayLimit-Remaining')
    console.warn(`Xero 429: MinLimit=${minRemaining}, DayLimit=${dayRemaining}. Path: ${path}`)

    // If daily limit is exhausted, don't retry — it won't help
    if (dayRemaining !== null && parseInt(dayRemaining) <= 0) {
      throw new Error('Xero daily API limit reached (5,000/day). Data will refresh after midnight UTC.')
    }

    // Per-minute limit: wait 15s and retry once
    if (!options.retried) {
      await new Promise(resolve => setTimeout(resolve, 15000))
      return xeroFetch<T>(path, { ...options, retried: true })
    }
    throw new Error('Xero rate limit exceeded. Please wait a moment and try again.')
  }

  if (!res.ok) {
    const errText = await res.text()
    // Log truncated error for debugging — never expose full Xero error to clients
    console.error(`Xero API error ${res.status} on ${method} ${path}:`, errText.slice(0, 300))
    throw new Error(`Xero API error: ${res.status}`)
  }

  return res.json()
}

// ── Invoice Methods ──

export async function getOverdueInvoices(page = 1): Promise<XeroInvoice[]> {
  // Build today's date as DateTime(year,month,day) for Xero's query syntax
  const now = new Date()
  const dateFilter = `DateTime(${now.getUTCFullYear()},${now.getUTCMonth() + 1},${now.getUTCDate()})`
  const where = encodeURIComponent(`Status=="AUTHORISED"&&AmountDue>0&&Type=="ACCREC"&&DueDate<${dateFilter}`)
  const data = await xeroFetch<{ Invoices: XeroInvoice[] }>(
    `/Invoices?where=${where}&order=DueDate&page=${page}`
  )
  return data.Invoices || []
}

export async function getAllOverdueInvoices(): Promise<XeroInvoice[]> {
  const allInvoices: XeroInvoice[] = []
  let page = 1
  const MAX_PAGES = 10 // Safety limit: max 1,000 invoices (10 pages × 100 per page)

  while (page <= MAX_PAGES) {
    const invoices = await getOverdueInvoices(page)
    allInvoices.push(...invoices)
    if (invoices.length < 100) break // Last page
    page++
  }

  if (page > MAX_PAGES) {
    console.warn(`getAllOverdueInvoices hit page limit (${MAX_PAGES}). Total fetched: ${allInvoices.length}`)
  }

  return allInvoices
}

export async function getInvoice(invoiceId: string): Promise<XeroInvoice> {
  assertValidXeroId(invoiceId, 'Invoice ID')
  const data = await xeroFetch<{ Invoices: XeroInvoice[] }>(`/Invoices/${invoiceId}`)
  if (!data.Invoices?.length) throw new Error('Invoice not found')
  return data.Invoices[0]
}

// Valid Xero invoice statuses — whitelist to prevent query injection
const VALID_INVOICE_STATUSES = ['DRAFT', 'SUBMITTED', 'AUTHORISED', 'PAID', 'VOIDED', 'DELETED']

export async function getInvoicesByStatus(status: string, page = 1): Promise<XeroInvoice[]> {
  const normalised = status.toUpperCase()
  if (!VALID_INVOICE_STATUSES.includes(normalised)) {
    throw new Error(`Invalid invoice status: ${status}`)
  }
  const where = encodeURIComponent(`Status=="${normalised}"&&Type=="ACCREC"`)
  const data = await xeroFetch<{ Invoices: XeroInvoice[] }>(
    `/Invoices?where=${where}&order=DueDate%20DESC&page=${page}`
  )
  return data.Invoices || []
}

// ── Contact Methods ──

// NOTE: Contact data is cached for 1 hour. If a contact's email or details change in Xero,
// the old data will be used for up to 1 hour. Use force-refresh for critical lookups.
export async function getContact(contactId: string): Promise<XeroContact> {
  assertValidXeroId(contactId, 'Contact ID')
  const redis = getRedis()

  // Check cache first (1hr TTL — see note above)
  const cached = await redis.get(REDIS_KEYS.contactCache(contactId)) as XeroContact | null
  if (cached) return cached

  const data = await xeroFetch<{ Contacts: XeroContact[] }>(`/Contacts/${contactId}`)
  if (!data.Contacts?.length) throw new Error('Contact not found')

  const contact = data.Contacts[0]

  // Cache for 1 hour
  await redis.set(REDIS_KEYS.contactCache(contactId), contact, { ex: 3600 })

  return contact
}

// Batch fetch contact emails for a list of contact IDs
export async function batchGetContactEmails(
  contactIds: string[]
): Promise<Map<string, { email: string; phone?: string }>> {
  const result = new Map<string, { email: string; phone?: string }>()
  const redis = getRedis()

  // Check cache for all contacts first
  const uncachedIds: string[] = []
  for (const id of contactIds) {
    const cached = await redis.get(REDIS_KEYS.contactCache(id)) as XeroContact | null
    if (cached) {
      result.set(id, {
        email: cached.EmailAddress || cached.ContactPersons?.[0]?.EmailAddress || '',
        phone: cached.Phones?.find(p => p.PhoneType === 'DEFAULT')?.PhoneNumber,
      })
    } else {
      uncachedIds.push(id)
    }
  }

  // Fetch uncached contacts (max 5 concurrent to respect rate limits)
  const chunks: string[][] = []
  for (let i = 0; i < uncachedIds.length; i += 5) {
    chunks.push(uncachedIds.slice(i, i + 5))
  }

  for (const chunk of chunks) {
    const results = await Promise.allSettled(
      chunk.map(async (id) => {
        const contact = await getContact(id)
        return { id, contact }
      })
    )

    for (const res of results) {
      if (res.status === 'fulfilled') {
        const { id, contact } = res.value
        result.set(id, {
          email: contact.EmailAddress || contact.ContactPersons?.[0]?.EmailAddress || '',
          phone: contact.Phones?.find(p => p.PhoneType === 'DEFAULT')?.PhoneNumber,
        })
      }
    }
  }

  return result
}

// ── Payment Methods ──

export async function recordPayment(
  invoiceId: string,
  amount: number,
  bankAccountId: string,
  date: string
): Promise<void> {
  assertValidXeroId(invoiceId, 'Invoice ID')
  assertValidXeroId(bankAccountId, 'Bank Account ID')
  await xeroFetch('/Payments', {
    method: 'POST',
    body: {
      Invoice: { InvoiceID: invoiceId },
      Account: { AccountID: bankAccountId },
      Amount: amount,
      Date: date,
    },
  })
}

export async function getBankAccounts(): Promise<XeroBankAccount[]> {
  const redis = getRedis()

  // Check cache (24hr TTL)
  const cached = await redis.get(REDIS_KEYS.bankAccounts) as XeroBankAccount[] | null
  if (cached) return cached

  const where = encodeURIComponent('Type=="BANK"&&Status=="ACTIVE"')
  const data = await xeroFetch<{ Accounts: XeroBankAccount[] }>(`/Accounts?where=${where}`)
  const accounts = data.Accounts || []

  await redis.set(REDIS_KEYS.bankAccounts, accounts, { ex: 86400 })

  return accounts
}

// ── History / Notes Methods ──

export async function getInvoiceHistory(invoiceId: string): Promise<XeroHistoryRecord[]> {
  assertValidXeroId(invoiceId, 'Invoice ID')
  const data = await xeroFetch<{ HistoryRecords: XeroHistoryRecord[] }>(
    `/Invoices/${invoiceId}/History`
  )
  return data.HistoryRecords || []
}

export async function addInvoiceNote(invoiceId: string, note: string): Promise<void> {
  assertValidXeroId(invoiceId, 'Invoice ID')
  await xeroFetch(`/Invoices/${invoiceId}/History`, {
    method: 'PUT',
    body: {
      HistoryRecords: [{ Details: note }],
    },
  })
}

export async function sendInvoiceEmail(invoiceId: string): Promise<void> {
  assertValidXeroId(invoiceId, 'Invoice ID')
  await xeroFetch(`/Invoices/${invoiceId}/Email`, {
    method: 'POST',
    body: {},
  })
}

// ── Chase Stage Methods (Redis) ──

export async function getAllChaseStages(): Promise<Record<string, ChaseStageData>> {
  const redis = getRedis()
  const raw = await redis.hgetall(REDIS_KEYS.chaseStages) as Record<string, string | ChaseStageData> | null
  if (!raw) return {}

  const result: Record<string, ChaseStageData> = {}
  for (const [invoiceId, val] of Object.entries(raw)) {
    if (typeof val === 'string') {
      try { result[invoiceId] = JSON.parse(val) } catch { /* skip */ }
    } else {
      result[invoiceId] = val as ChaseStageData
    }
  }
  return result
}

export async function getChaseStage(invoiceId: string): Promise<ChaseStageData | null> {
  const redis = getRedis()
  const raw = await redis.hget(REDIS_KEYS.chaseStages, invoiceId) as string | ChaseStageData | null
  if (!raw) return null
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) } catch { return null }
  }
  return raw as ChaseStageData
}

export async function setChaseStage(
  invoiceId: string,
  stage: ChaseStageKey,
  userEmail: string
): Promise<void> {
  const redis = getRedis()
  const data: ChaseStageData = {
    stage,
    updatedAt: new Date().toISOString(),
    updatedBy: userEmail,
  }

  await redis.hset(REDIS_KEYS.chaseStages, { [invoiceId]: JSON.stringify(data) })

  // Log activity
  const stageConfig = CHASE_STAGES.find(s => s.key === stage)
  await addChaseActivity(invoiceId, {
    action: 'stage_change',
    detail: `Stage changed to "${stageConfig?.label || stage}"`,
    user: userEmail,
  })

  // Also add note to Xero History for audit trail
  try {
    await addInvoiceNote(invoiceId, `Chase stage: ${stageConfig?.label || stage}`)
  } catch (err) {
    console.error('Failed to add Xero history note for stage change:', err)
  }
}

// ── Chase Activity Log (Redis) ──

export async function addChaseActivity(
  invoiceId: string,
  activity: Omit<ChaseActivity, 'id' | 'invoiceId' | 'timestamp'>
): Promise<void> {
  const redis = getRedis()
  const entry: ChaseActivity = {
    id: crypto.randomUUID(),
    invoiceId,
    timestamp: new Date().toISOString(),
    ...activity,
  }

  // Push to front of list (most recent first), trim to 100 entries
  // Use pipeline for atomicity — prevents unbounded list growth if process crashes between ops
  const key = REDIS_KEYS.chaseActivity(invoiceId)
  const pipeline = redis.pipeline()
  pipeline.lpush(key, JSON.stringify(entry))
  pipeline.ltrim(key, 0, 99)
  await pipeline.exec()
}

export async function getChaseActivities(invoiceId: string, limit = 50): Promise<ChaseActivity[]> {
  const redis = getRedis()
  const raw = await redis.lrange(REDIS_KEYS.chaseActivity(invoiceId), 0, limit - 1)
  return raw.map(item => {
    if (typeof item === 'string') {
      try { return JSON.parse(item) } catch { return null }
    }
    return item
  }).filter(Boolean) as ChaseActivity[]
}

// ── Salesforce Event Data (for urgency flags) ──

async function getEventDataForContacts(
  contactNames: string[]
): Promise<Map<string, { eventName: string; eventDate: string; weeksToEvent: number }>> {
  const redis = getRedis()
  const cacheKey = 'xero:event_data_cache'
  const result = new Map<string, { eventName: string; eventDate: string; weeksToEvent: number }>()

  // Check cache first (15 min TTL)
  const cached = await redis.get(cacheKey) as Record<string, { eventName: string; eventDate: string; weeksToEvent: number }> | null
  if (cached) return new Map(Object.entries(cached))

  try {
    // Dynamic import to avoid circular dependency
    const { getOpportunitiesForAccounts } = await import('./salesforce')
    const accountEventMap = await getOpportunitiesForAccounts()

    const now = new Date()
    for (const [accountName, events] of accountEventMap.entries()) {
      // Find nearest upcoming event
      let nearest: { name: string; date: string; weeks: number } | null = null
      for (const evt of events) {
        if (!evt.startDate) continue
        const evtDate = new Date(evt.startDate)
        if (evtDate <= now) continue
        const weeks = Math.floor((evtDate.getTime() - now.getTime()) / (7 * 24 * 60 * 60 * 1000))
        if (!nearest || weeks < nearest.weeks) {
          nearest = { name: evt.name, date: evt.startDate, weeks }
        }
      }
      if (nearest) {
        result.set(accountName.toLowerCase(), {
          eventName: nearest.name,
          eventDate: nearest.date,
          weeksToEvent: nearest.weeks,
        })
      }
    }

    // Cache for 15 minutes
    await redis.set(cacheKey, Object.fromEntries(result), { ex: 900 })
  } catch {
    // Salesforce may not be available — non-blocking
  }

  return result
}

// ── Enriched Invoices (combines Xero + Redis chase data, with caching) ──
// NOTE on serverless: The in-memory cachedTokens (line ~80) is per-instance.
// In serverless environments (Vercel), each cold start gets its own copy.
// Token refresh is protected by a per-instance mutex, but cross-instance races
// are handled by always falling back to Redis as source of truth.

export interface EnrichedInvoicesResult {
  invoices: EnrichedInvoice[]
  stale: boolean       // true when serving from cache after Xero API failure
  cachedAt?: string    // ISO timestamp of when data was cached (if serving cached data)
}

export async function getEnrichedOverdueInvoices(forceRefresh = false): Promise<EnrichedInvoicesResult> {
  const redis = getRedis()

  // Check cache first (5 min TTL) — prevents rate limiting on page revisits
  if (!forceRefresh) {
    const cached = await redis.get(REDIS_KEYS.invoicesCache) as EnrichedInvoice[] | null
    if (cached) {
      // Re-apply chase stages from Redis (always fresh) on top of cached invoice data
      const chaseStages = await getAllChaseStages()
      return {
        invoices: cached.map(inv => ({
          ...inv,
          chaseStage: chaseStages[inv.InvoiceID] || undefined,
        })),
        stale: false,
      }
    }
  }

  // Fetch invoices and chase stages (credit summary is cache-only to save rate limit)
  let invoices: XeroInvoice[]
  const isStale = false
  try {
    invoices = await getAllOverdueInvoices()
  } catch (err) {
    // If Xero fails (rate limit, etc), try to serve stale cache with warning
    const staleCache = await redis.get(REDIS_KEYS.invoicesCache) as EnrichedInvoice[] | null
    if (staleCache && staleCache.length > 0) {
      console.warn('Xero API failed, serving stale cache:', err instanceof Error ? err.message : err)
      const chaseStages = await getAllChaseStages()
      return {
        invoices: staleCache.map(inv => ({ ...inv, chaseStage: chaseStages[inv.InvoiceID] || undefined })),
        stale: true,
        cachedAt: new Date().toISOString(), // approximate — we don't track exact cache time
      }
    }
    throw err // No cache at all, propagate the error
  }

  const chaseStages = await getAllChaseStages()

  // Credit summary — only use if already cached, don't make extra API calls
  let creditSummary = new Map<string, number>()
  try {
    const redis2 = getRedis()
    const cachedCredits = await redis2.get('xero:credit_summary_cache') as Record<string, number> | null
    if (cachedCredits) creditSummary = new Map(Object.entries(cachedCredits))
  } catch { /* ignore */ }

  // Collect unique contact IDs
  const contactIds = [...new Set(invoices.map(inv => inv.Contact.ContactID))]

  // Batch fetch contact emails
  const contactEmails = await batchGetContactEmails(contactIds)

  // Try to get event data from Salesforce (non-blocking)
  let eventMap = new Map<string, { eventName: string; eventDate: string; weeksToEvent: number }>()
  try {
    eventMap = await getEventDataForContacts(invoices.map(inv => inv.Contact.Name))
  } catch (err) {
    console.error('Failed to fetch Salesforce event data (non-blocking):', err)
  }

  // Enrich each invoice with parsed dates
  const now = new Date()
  const enriched: EnrichedInvoice[] = invoices.map(inv => {
    const parsedDueDate = parseXeroDate(inv.DueDate)
    const parsedDate = parseXeroDate(inv.Date)
    const dueDate = new Date(parsedDueDate)
    const daysOverdue = isNaN(dueDate.getTime()) ? 0 : Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)))
    const contactInfo = contactEmails.get(inv.Contact.ContactID)
    const creditAvailable = creditSummary.get(inv.Contact.ContactID) || 0
    const eventData = eventMap.get(inv.Contact.Name.toLowerCase())

    return {
      ...inv,
      DueDate: parsedDueDate,
      Date: parsedDate,
      contactEmail: contactInfo?.email || '',
      contactPhone: contactInfo?.phone,
      daysOverdue,
      chaseStage: chaseStages[inv.InvoiceID] || undefined,
      creditAvailable: creditAvailable > 0 ? creditAvailable : undefined,
      eventName: eventData?.eventName,
      eventDate: eventData?.eventDate,
      weeksToEvent: eventData?.weeksToEvent,
    }
  })

  // Sort by days overdue (most overdue first)
  enriched.sort((a, b) => b.daysOverdue - a.daysOverdue)

  // Cache for 5 minutes to avoid rate limiting (60 calls/min Xero limit)
  await redis.set(REDIS_KEYS.invoicesCache, enriched, { ex: 300 })

  return { invoices: enriched, stale: isStale }
}

// ── Overview / Summary (reuses cached enriched data — no extra API calls) ──

// Helper: round currency to 2 decimal places to avoid floating point drift
export function roundCurrency(n: number): number {
  return Math.round(n * 100) / 100
}

export async function getOverdueSummary(): Promise<{
  totalOverdue: number
  totalOutstanding: number
  invoiceCount: number
  stageBreakdown: Record<string, { count: number; total: number }>
  agingBuckets: { label: string; count: number; total: number }[]
}> {
  // Reuse the enriched invoices (cached) — avoids duplicate Xero API calls
  const { invoices } = await getEnrichedOverdueInvoices()

  let totalOverdue = 0
  let totalOutstanding = 0
  const stageBreakdown: Record<string, { count: number; total: number }> = {}
  const aging = { '1-7': { count: 0, total: 0 }, '8-14': { count: 0, total: 0 }, '15-30': { count: 0, total: 0 }, '30+': { count: 0, total: 0 } }

  for (const inv of invoices) {
    totalOverdue += inv.AmountDue
    totalOutstanding += inv.Total - inv.AmountPaid

    const daysOverdue = inv.daysOverdue
    if (daysOverdue <= 7) { aging['1-7'].count++; aging['1-7'].total += inv.AmountDue }
    else if (daysOverdue <= 14) { aging['8-14'].count++; aging['8-14'].total += inv.AmountDue }
    else if (daysOverdue <= 30) { aging['15-30'].count++; aging['15-30'].total += inv.AmountDue }
    else { aging['30+'].count++; aging['30+'].total += inv.AmountDue }

    const stage = inv.chaseStage?.stage || 'unassigned'
    if (!stageBreakdown[stage]) stageBreakdown[stage] = { count: 0, total: 0 }
    stageBreakdown[stage].count++
    stageBreakdown[stage].total += inv.AmountDue
  }

  // Round all accumulated currency values to avoid floating point drift
  totalOverdue = roundCurrency(totalOverdue)
  totalOutstanding = roundCurrency(totalOutstanding)
  for (const bucket of Object.values(aging)) bucket.total = roundCurrency(bucket.total)
  for (const stage of Object.values(stageBreakdown)) stage.total = roundCurrency(stage.total)

  return {
    totalOverdue,
    totalOutstanding,
    invoiceCount: invoices.length,
    stageBreakdown,
    agingBuckets: [
      { label: '1-7 days', ...aging['1-7'] },
      { label: '8-14 days', ...aging['8-14'] },
      { label: '15-30 days', ...aging['15-30'] },
      { label: '30+ days', ...aging['30+'] },
    ],
  }
}

// ── Credit Note Methods ──

export async function getCreditNotesForContact(contactId: string): Promise<XeroCreditNote[]> {
  assertValidXeroId(contactId, 'Contact ID')
  const where = encodeURIComponent(`Contact.ContactID==Guid("${contactId}")&&Status=="AUTHORISED"&&Type=="ACCRECCREDIT"`)
  const data = await xeroFetch<{ CreditNotes: XeroCreditNote[] }>(
    `/CreditNotes?where=${where}`
  )
  return (data.CreditNotes || []).filter(cn => cn.RemainingCredit > 0)
}

export async function getAllCreditNotes(): Promise<XeroCreditNote[]> {
  const where = encodeURIComponent('Status=="AUTHORISED"&&Type=="ACCRECCREDIT"&&RemainingCredit>0')
  const data = await xeroFetch<{ CreditNotes: XeroCreditNote[] }>(`/CreditNotes?where=${where}`)
  return data.CreditNotes || []
}

export async function allocateCreditToInvoice(
  creditNoteId: string,
  invoiceId: string,
  amount: number,
  date: string
): Promise<void> {
  assertValidXeroId(creditNoteId, 'Credit Note ID')
  assertValidXeroId(invoiceId, 'Invoice ID')
  await xeroFetch(`/CreditNotes/${creditNoteId}/Allocations`, {
    method: 'PUT',
    body: {
      Allocations: [{
        Amount: amount,
        Date: date,
        Invoice: { InvoiceID: invoiceId },
      }],
    },
  })
}

// ── Payment Plans (Partially Paid Invoices) ──

export async function getPaymentPlanInvoices(): Promise<PaymentPlanInvoice[]> {
  const redis = getRedis()
  const cacheKey = 'xero:payment_plans_cache'

  const cached = await redis.get(cacheKey) as PaymentPlanInvoice[] | null
  if (cached) return cached

  try {
    // Get AUTHORISED invoices with partial payments (AmountPaid > 0 AND AmountDue > 0)
    // Paginate to get all results (max 5 pages = 500 invoices)
    const where = encodeURIComponent('Status=="AUTHORISED"&&AmountPaid>0&&AmountDue>0&&Type=="ACCREC"')
    const allInvoices: XeroInvoice[] = []
    let page = 1
    const MAX_PAGES = 5

    while (page <= MAX_PAGES) {
      const data = await xeroFetch<{ Invoices: XeroInvoice[] }>(
        `/Invoices?where=${where}&order=DueDate&page=${page}`
      )
      const pageInvoices = data.Invoices || []
      allInvoices.push(...pageInvoices)
      if (pageInvoices.length < 100) break
      page++
    }

    const invoices = allInvoices

    // Batch fetch contact emails
    const contactIds = [...new Set(invoices.map(inv => inv.Contact.ContactID))]
    const contactEmails = await batchGetContactEmails(contactIds)

    const plans: PaymentPlanInvoice[] = invoices.map(inv => {
      const contactInfo = contactEmails.get(inv.Contact.ContactID)
      const parsedDueDate = parseXeroDate(inv.DueDate)
      const parsedDate = parseXeroDate(inv.Date)
      return {
        invoiceId: inv.InvoiceID,
        invoiceNumber: inv.InvoiceNumber,
        contactName: inv.Contact.Name,
        contactEmail: contactInfo?.email || '',
        total: inv.Total,
        amountPaid: inv.AmountPaid,
        amountDue: inv.AmountDue,
        percentagePaid: inv.Total > 0 ? Math.round((inv.AmountPaid / inv.Total) * 100) : 0,
        dueDate: parsedDueDate,
        date: parsedDate,
        reference: inv.Reference || '',
      }
    })

    plans.sort((a, b) => a.percentagePaid - b.percentagePaid)
    await redis.set(cacheKey, plans, { ex: 300 })
    return plans
  } catch {
    // If Xero fails, return empty rather than crashing
    return []
  }
}

// ── Credit Summary per Contact (for enrichment) ──

export async function getCreditSummaryByContact(): Promise<Map<string, number>> {
  const redis = getRedis()
  const cacheKey = 'xero:credit_summary_cache'

  const cached = await redis.get(cacheKey) as Record<string, number> | null
  if (cached) return new Map(Object.entries(cached))

  const creditNotes = await getAllCreditNotes()
  const summary = new Map<string, number>()

  for (const cn of creditNotes) {
    const contactId = cn.Contact.ContactID
    const existing = summary.get(contactId) || 0
    summary.set(contactId, existing + cn.RemainingCredit)
  }

  // Cache for 10 minutes (longer to reduce API calls)
  await redis.set(cacheKey, Object.fromEntries(summary), { ex: 600 })
  return summary
}

// Warm the credit cache in background — called from a separate endpoint, not on every page load
export async function warmCreditCache(): Promise<void> {
  await getCreditSummaryByContact()
}

// ── Connection Check ──

export async function isXeroConnected(): Promise<boolean> {
  const tokens = await getOrgTokens()
  return !!tokens?.refresh_token
}
