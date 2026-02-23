// FreshSales CSV notes import → Salesforce A_B_Note__c
// Parses CSV, matches contacts by email/name, batch creates in Salesforce

import { createRecordsBatch } from './salesforce'

interface FreshSalesNoteRow {
  contactName?: string
  contactEmail?: string
  noteBody: string
  createdDate?: string
}

interface ImportResult {
  totalRows: number
  successCount: number
  failedCount: number
  skippedCount: number
  unmatchedContacts: string[]
  errors: string[]
}

/**
 * Parse a CSV string into rows. Handles quoted fields with commas/newlines.
 */
function parseCSV(csv: string): Record<string, string>[] {
  const lines = csv.split('\n')
  if (lines.length < 2) return []

  // Parse header row
  const headers = parseCSVLine(lines[0])
  const rows: Record<string, string>[] = []

  let i = 1
  while (i < lines.length) {
    let line = lines[i]
    // Handle multi-line quoted fields
    while (countQuotes(line) % 2 !== 0 && i + 1 < lines.length) {
      i++
      line += '\n' + lines[i]
    }
    if (line.trim()) {
      const values = parseCSVLine(line)
      const row: Record<string, string> = {}
      headers.forEach((header, idx) => {
        row[header.trim()] = (values[idx] || '').trim()
      })
      rows.push(row)
    }
    i++
  }

  return rows
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"'
        i++ // skip next quote
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}

function countQuotes(str: string): number {
  return (str.match(/"/g) || []).length
}

/**
 * Auto-detect which CSV columns map to our needed fields
 */
function detectColumns(headers: string[]): {
  nameCol: string | null
  emailCol: string | null
  bodyCol: string | null
  dateCol: string | null
} {
  const lower = headers.map(h => h.toLowerCase().trim())

  const nameCol = headers[lower.findIndex(h =>
    h.includes('contact name') || h.includes('name') || h.includes('full name') || h === 'contact'
  )] || null

  const emailCol = headers[lower.findIndex(h =>
    h.includes('email') || h.includes('e-mail') || h.includes('contact email')
  )] || null

  const bodyCol = headers[lower.findIndex(h =>
    h.includes('note') || h.includes('body') || h.includes('content') || h.includes('description') || h.includes('text')
  )] || null

  const dateCol = headers[lower.findIndex(h =>
    h.includes('created') || h.includes('date') || h.includes('timestamp')
  )] || null

  return { nameCol, emailCol, bodyCol, dateCol }
}

/**
 * Import notes from a FreshSales CSV export into Salesforce
 */
export async function importNotesFromCSV(csvContent: string): Promise<ImportResult> {
  const rows = parseCSV(csvContent)

  if (rows.length === 0) {
    return {
      totalRows: 0,
      successCount: 0,
      failedCount: 0,
      skippedCount: 0,
      unmatchedContacts: [],
      errors: ['CSV file is empty or has no data rows'],
    }
  }

  const headers = Object.keys(rows[0])
  const columns = detectColumns(headers)

  if (!columns.bodyCol) {
    return {
      totalRows: rows.length,
      successCount: 0,
      failedCount: 0,
      skippedCount: rows.length,
      unmatchedContacts: [],
      errors: [`Could not detect a notes/body column. Found columns: ${headers.join(', ')}`],
    }
  }

  // Extract unique contact identifiers for lookup
  const contactIdentifiers = new Set<string>()
  const noteRows: FreshSalesNoteRow[] = []

  for (const row of rows) {
    const body = row[columns.bodyCol]
    if (!body || body.trim().length === 0) continue

    const name = columns.nameCol ? row[columns.nameCol] : undefined
    const email = columns.emailCol ? row[columns.emailCol] : undefined
    const date = columns.dateCol ? row[columns.dateCol] : undefined

    if (email) contactIdentifiers.add(email.toLowerCase())
    if (name) contactIdentifiers.add(name.toLowerCase())

    noteRows.push({
      contactName: name,
      contactEmail: email,
      noteBody: body,
      createdDate: date,
    })
  }

  // Batch lookup contacts in Salesforce by email
  const contactMap = new Map<string, string>() // email/name -> Contact ID
  if (contactIdentifiers.size > 0) {
    // Query contacts by email first (most reliable)
    const emails = [...contactIdentifiers].filter(id => id.includes('@'))
    if (emails.length > 0) {
      // Batch in groups of 50 for SOQL IN clause limits
      for (let i = 0; i < emails.length; i += 50) {
        const batch = emails.slice(i, i + 50)
        const emailList = batch.map(e => `'${e.replace(/'/g, "\\'")}'`).join(', ')

        // We need to import query from salesforce - but it's not exported. Use the Salesforce REST API directly.
        // For now, use a simpler approach: use the getContactsForPicker for each
        // Actually, let's use a SOQL approach by fetching via the API route pattern

        try {
          const { getContactsByEmails } = await import('./salesforce-import-helpers')
          const contacts = await getContactsByEmails(batch)
          for (const contact of contacts) {
            if (contact.Email) contactMap.set(contact.Email.toLowerCase(), contact.Id)
            contactMap.set(contact.Name.toLowerCase(), contact.Id)
          }
        } catch {
          // Fallback: skip contact matching, create notes without Contact__c
          console.warn('Could not look up contacts for import, notes will be created without contact links')
        }
      }
    }
  }

  // Build Salesforce records for batch creation
  const records: Record<string, unknown>[] = []
  const unmatchedContacts: string[] = []

  for (const noteRow of noteRows) {
    let contactId: string | null = null

    // Try to match by email first, then name
    if (noteRow.contactEmail) {
      contactId = contactMap.get(noteRow.contactEmail.toLowerCase()) || null
    }
    if (!contactId && noteRow.contactName) {
      contactId = contactMap.get(noteRow.contactName.toLowerCase()) || null
    }

    if (!contactId && (noteRow.contactEmail || noteRow.contactName)) {
      unmatchedContacts.push(noteRow.contactEmail || noteRow.contactName || 'Unknown')
    }

    const record: Record<string, unknown> = {
      Body__c: noteRow.noteBody,
    }
    if (contactId) record.Contact__c = contactId

    records.push(record)
  }

  if (records.length === 0) {
    return {
      totalRows: rows.length,
      successCount: 0,
      failedCount: 0,
      skippedCount: rows.length,
      unmatchedContacts: [...new Set(unmatchedContacts)],
      errors: ['No valid notes found to import'],
    }
  }

  // Batch create in Salesforce
  try {
    const results = await createRecordsBatch('A_B_Note__c', records)
    const successCount = results.filter(r => r.success).length
    const failedCount = results.filter(r => !r.success).length
    const errors = results
      .filter(r => !r.success)
      .flatMap(r => r.errors)
      .slice(0, 20) // Limit error messages

    return {
      totalRows: rows.length,
      successCount,
      failedCount,
      skippedCount: rows.length - noteRows.length,
      unmatchedContacts: [...new Set(unmatchedContacts)],
      errors,
    }
  } catch (error) {
    return {
      totalRows: rows.length,
      successCount: 0,
      failedCount: noteRows.length,
      skippedCount: rows.length - noteRows.length,
      unmatchedContacts: [...new Set(unmatchedContacts)],
      errors: [error instanceof Error ? error.message : 'Batch creation failed'],
    }
  }
}
