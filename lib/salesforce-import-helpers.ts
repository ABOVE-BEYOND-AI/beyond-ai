// Salesforce helper functions for data import operations
// Separated to avoid circular imports with notes-import.ts

// Re-use the same auth and query mechanism
// We duplicate the minimal needed functions here to avoid import issues

interface SalesforceTokenResponse {
  access_token: string
  instance_url: string
}

let cachedToken: { access_token: string; instance_url: string; expires_at: number } | null = null

async function authenticate(): Promise<{ access_token: string; instance_url: string }> {
  if (cachedToken && Date.now() < cachedToken.expires_at - 5 * 60 * 1000) {
    return { access_token: cachedToken.access_token, instance_url: cachedToken.instance_url }
  }

  const clientId = process.env.SALESFORCE_CLIENT_ID
  const clientSecret = process.env.SALESFORCE_CLIENT_SECRET
  const loginUrl = process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com'

  if (!clientId || !clientSecret) {
    throw new Error('Missing SALESFORCE_CLIENT_ID or SALESFORCE_CLIENT_SECRET')
  }

  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  })

  const response = await fetch(`${loginUrl}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (!response.ok) {
    throw new Error(`Salesforce auth failed: ${response.status}`)
  }

  const data: SalesforceTokenResponse = await response.json()
  cachedToken = {
    access_token: data.access_token,
    instance_url: data.instance_url,
    expires_at: Date.now() + 60 * 60 * 1000,
  }

  return { access_token: data.access_token, instance_url: data.instance_url }
}

/**
 * Look up Salesforce Contacts by a batch of email addresses
 */
export async function getContactsByEmails(
  emails: string[]
): Promise<{ Id: string; Name: string; Email: string | null }[]> {
  if (emails.length === 0) return []

  const { access_token, instance_url } = await authenticate()

  const emailList = emails.map(e => `'${e.replace(/'/g, "\\'")}'`).join(', ')
  const soql = `SELECT Id, Name, Email FROM Contact WHERE Email IN (${emailList}) LIMIT 200`

  const response = await fetch(
    `${instance_url}/services/data/v59.0/query?q=${encodeURIComponent(soql)}`,
    {
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
    }
  )

  if (!response.ok) {
    throw new Error(`Contact lookup failed: ${response.status}`)
  }

  const data = await response.json()
  return data.records || []
}
