// Server-side session security using Web Crypto API
// Works in both Edge (middleware) and Node.js (API routes) runtimes.
// Session payload contains ONLY email + expiry — no tokens, no secrets.

export interface SecureSessionPayload {
  email: string
  exp: number
}

const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000 // 24 hours

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET environment variable is required in production')
    }
    return 'dev-only-session-secret-not-for-production'
  }
  return secret
}

async function getHmacKey(usage: KeyUsage): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getSessionSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    [usage]
  )
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

function hexToBytes(hex: string): Uint8Array {
  const matches = hex.match(/.{2}/g)
  if (!matches) return new Uint8Array(0)
  return new Uint8Array(matches.map(b => parseInt(b, 16)))
}

/** Create a signed, expiring session token: base64(json).hmac-hex */
export async function createSecureSession(email: string): Promise<string> {
  const payload: SecureSessionPayload = { email, exp: Date.now() + SESSION_EXPIRY_MS }
  const payloadB64 = btoa(JSON.stringify(payload))

  const key = await getHmacKey('sign')
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64))

  return `${payloadB64}.${bytesToHex(new Uint8Array(sig))}`
}

/** Verify HMAC signature and expiry. Returns payload if valid, null otherwise. */
export async function verifySecureSession(token: string): Promise<SecureSessionPayload | null> {
  try {
    const decoded = decodeURIComponent(token)
    const dotIndex = decoded.lastIndexOf('.')
    if (dotIndex === -1) return null // Unsigned legacy token

    const payloadB64 = decoded.substring(0, dotIndex)
    const sigHex = decoded.substring(dotIndex + 1)
    if (!sigHex || sigHex.length !== 64) return null // SHA-256 HMAC = 32 bytes = 64 hex chars

    const key = await getHmacKey('verify')
    const sigBytes = hexToBytes(sigHex)
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes.buffer as ArrayBuffer,
      new TextEncoder().encode(payloadB64)
    )
    if (!valid) return null

    const data = JSON.parse(atob(payloadB64)) as SecureSessionPayload
    if (!data.email || !data.exp) return null
    if (Date.now() > data.exp) return null

    return data
  } catch {
    return null
  }
}
