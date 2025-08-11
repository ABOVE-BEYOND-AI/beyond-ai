// Usage: BASE_URL=https://your-domain ADMIN_SECRET=... node scripts/import-event-images.js
const fetch = require('node-fetch')

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const ADMIN_SECRET = process.env.ADMIN_SECRET || ''

async function fetchEvents(page = 0, limit = 200) {
  const res = await fetch(`${BASE_URL}/api/events?limit=${limit}&offset=${page * limit}`)
  if (!res.ok) throw new Error(`Failed to fetch events: ${res.status}`)
  const json = await res.json()
  return json.items || []
}

async function fetchImageForQuery(query) {
  // Use server-side image search endpoint so it can leverage server env vars and caching
  const res = await fetch(`${BASE_URL}/api/images?hotel=${encodeURIComponent(query)}`)
  if (!res.ok) return null
  const data = await res.json()
  return data?.imageUrl || null
}

async function updateEvent(id, body) {
  const res = await fetch(`${BASE_URL}/api/events/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-admin-secret': ADMIN_SECRET },
    body: JSON.stringify(body),
  })
  return res.ok
}

async function main() {
  if (!ADMIN_SECRET) console.warn('⚠️ ADMIN_SECRET not set; updates will be unauthorized')
  const events = await fetchEvents()
  console.log(`Found ${events.length} events`)
  let updated = 0, skipped = 0
  for (const ev of events) {
    if (ev.imageUrl) { skipped++; continue }
    const baseQuery = `${ev.name} ${ev.location}`
    const link = await fetchImageForQuery(baseQuery)
    if (!link) { skipped++; continue }
    const ok = await updateEvent(ev.id, { imageUrl: link })
    if (ok) { updated++; console.log(`✅ Set image for ${ev.name}`) } else { console.log(`❌ Failed to update ${ev.name}`) }
    await new Promise(r => setTimeout(r, 120))
  }
  console.log(`Done. Updated: ${updated}, Skipped: ${skipped}`)
}

if (require.main === module) {
  main().catch(err => { console.error(err); process.exit(1) })
}


