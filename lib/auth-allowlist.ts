// Login allowlist — controls who can sign in via Google OAuth.
//
// Configure with environment variables:
//   ALLOWED_EMAILS    — comma-separated list of exact emails (case-insensitive)
//   ALLOWED_DOMAINS   — comma-separated list of domains (case-insensitive). Email
//                       must match one of these domains.
//
// At least one of ALLOWED_EMAILS or ALLOWED_DOMAINS MUST be set in production.
// If neither is set, all sign-ins are rejected (fail-closed).

export type AllowlistResult =
  | { allowed: true }
  | { allowed: false; reason: 'not_authorized' | 'misconfigured' | 'unverified_email' | 'invalid_workspace' }

function parseList(value: string | undefined): string[] {
  if (!value) return []
  return value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
}

function getAllowedEmails(): string[] {
  return parseList(process.env.ALLOWED_EMAILS)
}

function getAllowedDomains(): string[] {
  return parseList(process.env.ALLOWED_DOMAINS)
}

export interface AllowlistInput {
  email: string
  emailVerified: boolean
  hd?: string
}

export function checkLoginAllowed(input: AllowlistInput): AllowlistResult {
  const allowedEmails = getAllowedEmails()
  const allowedDomains = getAllowedDomains()

  // Fail-closed: if no allowlist is configured, deny all sign-ins.
  if (allowedEmails.length === 0 && allowedDomains.length === 0) {
    return { allowed: false, reason: 'misconfigured' }
  }

  // Google must have verified the email. Without this an attacker controlling
  // a Workspace can mint arbitrary unverified addresses.
  if (!input.emailVerified) {
    return { allowed: false, reason: 'unverified_email' }
  }

  const email = input.email.trim().toLowerCase()
  const domain = email.split('@')[1] || ''

  if (allowedEmails.includes(email)) {
    return { allowed: true }
  }

  if (allowedDomains.length > 0 && allowedDomains.includes(domain)) {
    // Belt-and-braces: if the email's domain is on the workspace allowlist, the
    // Google `hd` claim must match. The `hd` URL hint can be ignored by Google,
    // so the server-side claim is the authoritative check.
    if (input.hd && input.hd.toLowerCase() !== domain) {
      return { allowed: false, reason: 'invalid_workspace' }
    }
    if (!input.hd) {
      // Personal Gmail addresses on a Workspace domain are rejected — without
      // an `hd` claim we can't trust the workspace association.
      return { allowed: false, reason: 'invalid_workspace' }
    }
    return { allowed: true }
  }

  return { allowed: false, reason: 'not_authorized' }
}

export function isAllowlistConfigured(): boolean {
  return getAllowedEmails().length > 0 || getAllowedDomains().length > 0
}
