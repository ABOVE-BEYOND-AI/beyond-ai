// Usage: node scripts/import-events-2025.js
// Env (optional): BASE_URL=https://your-domain ADMIN_SECRET=...
// Defaults: BASE_URL=http://localhost:3000

const fs = require('fs')
const path = require('path')
const fetch = require('node-fetch')

const BASE_URL = process.env.BASE_URL || 'https://beyond-ai-zeta.vercel.app'
const ADMIN_SECRET = process.env.ADMIN_SECRET || ''

const CSV_PATH = path.resolve(
  __dirname,
  '..',
  '2025 Event Calendar - Copy of NEWER Event Calendar Programatic SEO.csv'
)

function slugifyCategory(s) {
  return (s || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\s+/g, '-')
}

function toIsoStart(dateStr) {
  // Supports dd/MM/yyyy or yyyy-MM-dd
  if (!dateStr) return ''
  const s = String(dateStr).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d, 0, 0, 0)).toISOString()
  }
  const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m1) {
    const d = Number(m1[1])
    const m = Number(m1[2])
    const y = Number(m1[3])
    return new Date(Date.UTC(y, m - 1, d, 0, 0, 0)).toISOString()
  }
  // Fallback: try Date.parse
  const t = Date.parse(s)
  if (!isNaN(t)) return new Date(t).toISOString()
  return ''
}

function toIsoEnd(dateStr) {
  const start = toIsoStart(dateStr)
  if (!start) return ''
  const dt = new Date(start)
  dt.setUTCHours(23, 59, 59, 0)
  return dt.toISOString()
}

function parseCsv(content) {
  const rows = []
  let i = 0
  let field = ''
  let inQuotes = false
  const pushField = () => {
    rows[rows.length - 1].push(field)
    field = ''
  }
  const newRow = () => rows.push([])

  newRow()
  while (i < content.length) {
    const ch = content[i]
    const next = content[i + 1]
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"'
        i += 2
        continue
      }
      if (ch === '"') {
        inQuotes = false
        i++
        continue
      }
      field += ch
      i++
      continue
    } else {
      if (ch === '"') {
        inQuotes = true
        i++
        continue
      }
      if (ch === ',') {
        pushField()
        i++
        continue
      }
      if (ch === '\n') {
        pushField()
        newRow()
        i++
        continue
      }
      if (ch === '\r') { i++; continue }
      field += ch
      i++
    }
  }
  // Last field
  rows[rows.length - 1].push(field)
  // Remove empty trailing row if any
  if (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') rows.pop()
  return rows
}

async function main() {
  if (!ADMIN_SECRET) {
    console.warn('⚠️ ADMIN_SECRET not set; the import request will likely be unauthorized.')
  }
  const csv = fs.readFileSync(CSV_PATH, 'utf8')
  const rows = parseCsv(csv)
  // Expect header: Name,Start Date,End Date,Event Location,Description,Category
  const items = []
  for (const row of rows) {
    if (!row || row.length < 6) continue
    const [Name, Start, End, Location, Description, Category] = row
    if (!Name || Name === 'Name') continue // skip header or empty
    const startDate = toIsoStart(Start)
    const endDate = toIsoEnd(End || Start)
    if (!startDate || !endDate) continue
    items.push({
      name: String(Name).trim(),
      startDate,
      endDate,
      location: String(Location || '').trim(),
      description: String(Description || '').trim(),
      category: slugifyCategory(Category)
    })
  }

  console.log(`📦 Prepared ${items.length} events to import`)
  const res = await fetch(`${BASE_URL}/api/events/import`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-secret': ADMIN_SECRET,
    },
    body: JSON.stringify({ items }),
  })
  if (!res.ok) {
    console.error('❌ Import failed', await res.text())
    process.exit(1)
  }
  const json = await res.json()
  console.log('✅ Import result:', json)
}

if (require.main === module) {
  main().catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
}


