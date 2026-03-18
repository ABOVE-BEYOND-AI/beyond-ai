// Finance operation idempotency and locking layer.
// Prevents duplicate Xero payments, credit allocations, and Stripe+Xero combos.

import { Redis } from '@upstash/redis'

const LOCK_TTL_SECONDS = 30      // max time to hold a lock
const RESULT_TTL_SECONDS = 86400 // 24h — how long to remember completed operations

function getRedis(): Redis {
  return Redis.fromEnv()
}

// ── Per-invoice Operation Lock ──

/**
 * Acquire an exclusive lock for a finance operation on a specific invoice.
 * Uses SET NX (atomic) — only one caller wins.
 * Returns true if lock acquired, false if another operation is in progress.
 */
export async function acquireOperationLock(
  operationType: string,
  invoiceId: string
): Promise<boolean> {
  const redis = getRedis()
  const key = `op:lock:${operationType}:${invoiceId}`
  const result = await redis.set(key, Date.now().toString(), { nx: true, ex: LOCK_TTL_SECONDS })
  return result === 'OK'
}

export async function releaseOperationLock(
  operationType: string,
  invoiceId: string
): Promise<void> {
  const redis = getRedis()
  await redis.del(`op:lock:${operationType}:${invoiceId}`)
}

// ── Idempotency Records ──

export interface OperationResult {
  success: boolean
  completedAt: string
  data?: Record<string, unknown>
}

/**
 * Check if an operation with this key has already been completed.
 * Returns the cached result if found, null if this is a new operation.
 */
export async function getCompletedOperation(
  idempotencyKey: string
): Promise<OperationResult | null> {
  const redis = getRedis()
  return await redis.get(`op:result:${idempotencyKey}`) as OperationResult | null
}

/**
 * Record a completed operation for idempotency.
 * Future requests with the same key will get this result instead of re-executing.
 */
export async function recordCompletedOperation(
  idempotencyKey: string,
  result: OperationResult
): Promise<void> {
  const redis = getRedis()
  await redis.set(`op:result:${idempotencyKey}`, result, { ex: RESULT_TTL_SECONDS })
}

// ── Email Reminder Cooldown ──

const REMINDER_COOLDOWN_SECONDS = 3600 // 1 hour between reminders per invoice

/**
 * Check if a reminder was recently sent for this invoice.
 * Returns true if sending is allowed, false if in cooldown.
 * Atomically sets the cooldown on success (SET NX).
 */
export async function checkReminderCooldown(invoiceId: string): Promise<boolean> {
  const redis = getRedis()
  const key = `email:cooldown:${invoiceId}`
  const result = await redis.set(key, Date.now().toString(), { nx: true, ex: REMINDER_COOLDOWN_SECONDS })
  return result === 'OK'
}

// ── Stripe ↔ Xero Contact Mapping ──

const CONTACT_MAP_TTL_SECONDS = 86400 * 30 // 30 days

/**
 * Get the stored Stripe customer ID for a Xero contact.
 * Returns null if no mapping exists yet.
 */
export async function getStripeContactMapping(
  xeroContactId: string
): Promise<string | null> {
  const redis = getRedis()
  return await redis.get(`stripe:contact_map:${xeroContactId}`) as string | null
}

/**
 * Store a verified Stripe ↔ Xero contact mapping.
 */
export async function setStripeContactMapping(
  xeroContactId: string,
  stripeCustomerId: string
): Promise<void> {
  const redis = getRedis()
  await redis.set(`stripe:contact_map:${xeroContactId}`, stripeCustomerId, { ex: CONTACT_MAP_TTL_SECONDS })
}
