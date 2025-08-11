// Import August 2025 deals with exact dates (no exact times provided, using spaced times per day)
// Run with: node scripts/import-august-deals-precise.js

const DEALS = [
  // Friday, August 1st, 2025
  { rep_name: 'Max Heighton', deal_name: 'Venice Masked Ball 2026', amount: 6419.88, created_at: '2025-08-01T09:00:00.000Z' },
  { rep_name: "Leon O'Connor", deal_name: 'Belgian GP 2026', amount: 7123.27, created_at: '2025-08-01T09:20:00.000Z' },
  { rep_name: 'Sam Harrop', deal_name: 'Venice Masked Ball 2027', amount: 6017.94, created_at: '2025-08-01T09:40:00.000Z' },
  { rep_name: 'Jeremy Merlo', deal_name: 'England Vs New Zealand Cricket 2026', amount: 1524.69, created_at: '2025-08-01T10:00:00.000Z' },
  { rep_name: 'Sam Harrop', deal_name: 'Monte-Carlo Christmas Michelin Tour 2025', amount: 5571.34, created_at: '2025-08-01T10:20:00.000Z' },
  { rep_name: 'Sam Harrop', deal_name: 'Monaco GP 2026', amount: 11142.67, created_at: '2025-08-01T10:40:00.000Z' },
  { rep_name: 'Alec Macdonald', deal_name: 'Richard Ashcroft 2026', amount: 14021.01, created_at: '2025-08-01T11:00:00.000Z' },

  // Saturday, August 2nd, 2025
  { rep_name: 'Jack Mautterer', deal_name: 'Lion King in theatre 2025', amount: 1227.26, created_at: '2025-08-02T09:00:00.000Z' },

  // Monday, August 4th, 2025
  { rep_name: 'Sam Renals', deal_name: 'Premier League Darts 2026', amount: 9148.15, created_at: '2025-08-04T09:00:00.000Z' },
  { rep_name: "Leon O'Connor", deal_name: 'Belgian GP 2026', amount: 3561.64, created_at: '2025-08-04T09:20:00.000Z' },
  { rep_name: 'Billy Prowse', deal_name: 'Oasis 2025', amount: 35317.13, created_at: '2025-08-04T09:40:00.000Z' },
  { rep_name: 'Chelsey Dunbar', deal_name: 'Oasis 2025', amount: 4800.0, created_at: '2025-08-04T10:00:00.000Z' },
  { rep_name: 'Daniel Parker', deal_name: 'Coldplay 2025', amount: 15608.67, created_at: '2025-08-04T10:20:00.000Z' },

  // Tuesday, August 5th, 2025
  { rep_name: 'Daniel Parker', deal_name: 'Coldplay 2025', amount: 18730.4, created_at: '2025-08-05T09:00:00.000Z' },
  { rep_name: 'Tom Culpin', deal_name: 'Hungarian Grand Prix 2026', amount: 4454.84, created_at: '2025-08-05T09:20:00.000Z' },
  { rep_name: 'Tom Culpin', deal_name: 'Hungarian Grand Prix 2026', amount: 4454.84, created_at: '2025-08-05T09:40:00.000Z' },
  { rep_name: 'Alec Macdonald', deal_name: 'Post Malone 2025', amount: 1739.06, created_at: '2025-08-05T10:00:00.000Z' },
  { rep_name: 'Sam Harrop', deal_name: 'US Masters 2026', amount: 138847.94, created_at: '2025-08-05T10:20:00.000Z' },

  // Wednesday, August 6th, 2025
  { rep_name: 'James Walters', deal_name: 'Hungarian Grand Prix 2026', amount: 10015.01, created_at: '2025-08-06T09:00:00.000Z' },
  { rep_name: 'Daniel Parker', deal_name: 'Sao Paulo Grand Prix 2025', amount: 66934.18, created_at: '2025-08-06T09:20:00.000Z' },

  // Thursday, August 7th, 2025
  { rep_name: 'Ashley Hayes', deal_name: 'British GP 2026', amount: 4273.96, created_at: '2025-08-07T09:00:00.000Z' },
  { rep_name: 'Conner Millar', deal_name: 'Baftas 2026', amount: 42846.8, created_at: '2025-08-07T09:20:00.000Z' },
  { rep_name: 'Toby Davies', deal_name: 'Baftas 2026', amount: 42213.6, created_at: '2025-08-07T09:40:00.000Z' },
  { rep_name: 'Max Heighton', deal_name: 'Hungarian Grand Prix 2026', amount: 8909.67, created_at: '2025-08-07T10:00:00.000Z' },
  { rep_name: 'Conner Millar', deal_name: 'Baftas 2026', amount: 6685.6, created_at: '2025-08-07T10:20:00.000Z' },
  { rep_name: 'Daniel Parker', deal_name: 'Monaco GP 2026', amount: 87844.44, created_at: '2025-08-07T10:40:00.000Z' },
  { rep_name: 'Sam Harrop', deal_name: 'Hungarian Grand Prix 2026', amount: 4454.84, created_at: '2025-08-07T11:00:00.000Z' },

  // Friday, August 8th, 2025
  { rep_name: 'Toby Davies', deal_name: 'EL CLASICO 2026', amount: 3338.34, created_at: '2025-08-08T09:00:00.000Z' },
  { rep_name: 'Max Heighton', deal_name: 'EL CLASICO 2026', amount: 10015.01, created_at: '2025-08-08T09:20:00.000Z' },
  { rep_name: 'Alex Kirby', deal_name: 'MOULIN ROUGE 2026', amount: 2221.84, created_at: '2025-08-08T09:40:00.000Z' },
  { rep_name: 'Billy Prowse', deal_name: 'EL CLASICO 2026', amount: 3338.34, created_at: '2025-08-08T10:00:00.000Z' },
  { rep_name: 'Billy Prowse', deal_name: 'CHRIS EUBANK VS CONOR BENN 2025', amount: 1524.69, created_at: '2025-08-08T10:20:00.000Z' },
  { rep_name: 'Max Heighton', deal_name: 'MADRID GRAND PRIX 2026', amount: 4454.84, created_at: '2025-08-08T10:40:00.000Z' },

  // Sunday, August 10th, 2025
  { rep_name: 'Max Heighton', deal_name: 'VIP TURKEY GOLF TRIP 2026', amount: 11142.67, created_at: '2025-08-10T09:00:00.000Z' },
  { rep_name: 'Aaron Swaby', deal_name: 'Hungarian Grand Prix 2026', amount: 8909.67, created_at: '2025-08-10T09:20:00.000Z' },
  { rep_name: 'Tom Culpin', deal_name: 'Baftas 2026', amount: 21423.4, created_at: '2025-08-10T09:40:00.000Z' },

  // Monday, August 11th, 2025
  { rep_name: 'Sam Harrop', deal_name: 'EL CLASICO 2026', amount: 3338.34, created_at: '2025-08-11T09:00:00.000Z' },
]

const repEmailMap = {
  'Max Heighton': 'max@aboveandbeyond.co.uk',
  "Leon O'Connor": 'leon@aboveandbeyond.co.uk',
  'Sam Harrop': 'sam@aboveandbeyond.co.uk',
  'Jeremy Merlo': 'jeremy@aboveandbeyond.co.uk',
  'Alec Macdonald': 'alec@aboveandbeyond.co.uk',
  'Jack Mautterer': 'jack@aboveandbeyond.co.uk',
  'Sam Renals': 'samrenals@aboveandbeyond.co.uk',
  'Billy Prowse': 'billy@aboveandbeyond.co.uk',
  'Chelsey Dunbar': 'chelsey@aboveandbeyond.co.uk',
  'Daniel Parker': 'daniel@aboveandbeyond.co.uk',
  'Tom Culpin': 'tom@aboveandbeyond.co.uk',
  'Alex Kirby': 'alexkirby@aboveandbeyond.co.uk',
  'Ashley Hayes': 'ashley@aboveandbeyond.co.uk',
  'Conner Millar': 'conner@aboveandbeyond.co.uk',
  'James Walters': 'james@aboveandbeyond.co.uk',
  'Aaron Swaby': 'aaron@aboveandbeyond.co.uk',
}

async function run() {
  const fetch = require('node-fetch')
  let total = 0

  console.log('📅 Importing 37 August deals with exact dates...')

  for (let i = 0; i < DEALS.length; i++) {
    const d = DEALS[i]
    const rep_email = repEmailMap[d.rep_name] || `${d.rep_name.toLowerCase().replace(/[^a-z]/g, '')}@aboveandbeyond.co.uk`
    total += d.amount

    const payload = {
      rep_name: d.rep_name,
      rep_email,
      deal_name: d.deal_name,
      amount: d.amount,
      currency: 'GBP',
      created_at: d.created_at,
    }

    try {
      const res = await fetch('https://beyond-ai-zeta.vercel.app/api/sales/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const text = await res.text()
        console.error(`❌ ${i + 1}/${DEALS.length} Failed: ${d.deal_name} (${d.rep_name}) => ${text}`)
      } else {
        console.log(`✅ ${i + 1}/${DEALS.length} ${d.created_at} - ${d.deal_name} (${d.rep_name}) - £${d.amount.toFixed(2)}`)
      }
    } catch (e) {
      console.error(`❌ ${i + 1}/${DEALS.length} Error: ${d.deal_name} (${d.rep_name})`, e.message)
    }

    // small delay
    await new Promise(r => setTimeout(r, 120))
  }

  console.log(`\n💰 Total: £${total.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`)
}

run().catch(console.error)


