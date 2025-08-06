// Clean August 2025 deals import - store amounts in POUNDS (not pence)
// Run with: node scripts/import-august-deals-clean.js

const correctDeals = [
  { rep_name: "Max Heighton", deal_name: "Venice Masked Ball 2026", amount: 6419.88 },
  { rep_name: "Leon O'Connor", deal_name: "Belgian GP 2026", amount: 7123.27 },
  { rep_name: "Sam Harrop", deal_name: "Venice Masked Ball 2027", amount: 6017.94 },
  { rep_name: "Jeremy Merlo", deal_name: "England Vs New Zealand Cricket 2026", amount: 1524.69 },
  { rep_name: "Sam Harrop", deal_name: "Monte-Carlo Christmas Michelin Tour 2025", amount: 5571.34 },
  { rep_name: "Sam Harrop", deal_name: "Monaco GP 2026", amount: 11142.67 },
  { rep_name: "Alec Macdonald", deal_name: "Richard Ashcroft 2026", amount: 14021.01 },
  { rep_name: "Jack Mautterer", deal_name: "Lion King in theatre 2025", amount: 1227.26 },
  { rep_name: "Sam Renals", deal_name: "Premier League Darts 2026", amount: 9148.15 },
  { rep_name: "Leon O'Connor", deal_name: "Belgian GP 2026", amount: 3561.64 },
  { rep_name: "Billy Prowse", deal_name: "Oasis 2025", amount: 35317.13 },
  { rep_name: "Chelsey Dunbar", deal_name: "Oasis 2025", amount: 4800.00 },
  { rep_name: "Daniel Parker", deal_name: "Coldplay 2025", amount: 15608.67 },
  { rep_name: "Daniel Parker", deal_name: "Coldplay 2025", amount: 18730.40 },
  { rep_name: "Tom Culpin", deal_name: "Hungarian Grand Prix 2026", amount: 4454.84 },
  { rep_name: "Tom Culpin", deal_name: "Hungarian Grand Prix 2026", amount: 4454.84 },
  { rep_name: "Alec Macdonald", deal_name: "Post Malone 2025", amount: 1739.06 },
  { rep_name: "Sam Harrop", deal_name: "US Masters 2026", amount: 138847.94 },
];

const repEmailMap = {
  'Max Heighton': 'max@aboveandbeyond.co.uk',
  'Leon O\'Connor': 'leon@aboveandbeyond.co.uk', 
  'Sam Harrop': 'sam@aboveandbeyond.co.uk',
  'Jeremy Merlo': 'jeremy@aboveandbeyond.co.uk',
  'Alec Macdonald': 'alec@aboveandbeyond.co.uk',
  'Jack Mautterer': 'jack@aboveandbeyond.co.uk',
  'Sam Renals': 'samrenals@aboveandbeyond.co.uk',
  'Billy Prowse': 'billy@aboveandbeyond.co.uk',
  'Chelsey Dunbar': 'chelsey@aboveandbeyond.co.uk',
  'Daniel Parker': 'daniel@aboveandbeyond.co.uk',
  'Tom Culpin': 'tom@aboveandbeyond.co.uk'
};

async function importCleanDeals() {
  const fetch = require('node-fetch');
  
  console.log('🧹 Importing CLEAN August deals (amounts in POUNDS)...');
  console.log('');
  
  let totalAmount = 0;
  const dealsToImport = correctDeals.map((deal, index) => {
    totalAmount += deal.amount;
    const repEmail = repEmailMap[deal.rep_name] || `${deal.rep_name.toLowerCase().replace(/[^a-z]/g, '')}@aboveandbeyond.co.uk`;
    
    return {
      rep_name: deal.rep_name,
      rep_email: repEmail, 
      deal_name: deal.deal_name,
      amount: deal.amount, // Stored in POUNDS, no conversion
      currency: 'GBP',
      source: 'manual',
      created_at: `2025-08-${String(Math.floor(Math.random() * 5) + 1).padStart(2, '0')}T${String(Math.floor(Math.random() * 12) + 9).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:00.000Z`
    };
  });
  
  console.log(`💰 Total August Sales: £${totalAmount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`);
  console.log(`📊 Total Deals: ${dealsToImport.length}`);
  console.log('');
  
  // Show what we're importing
  dealsToImport.forEach((deal, index) => {
    console.log(`${index + 1}. ${deal.deal_name} - ${deal.rep_name} - £${deal.amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`);
  });
  
  console.log('');
  console.log('🚀 Starting import...');
  
  for (let i = 0; i < dealsToImport.length; i++) {
    const deal = dealsToImport[i];
    
    try {
      const response = await fetch('https://beyond-ai-zeta.vercel.app/api/sales/data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(deal)
      });
      
      if (response.ok) {
        console.log(`✅ ${i + 1}/${dealsToImport.length} - ${deal.deal_name} (${deal.rep_name}) - £${deal.amount.toFixed(2)}`);
      } else {
        console.error(`❌ ${i + 1}/${dealsToImport.length} - Failed: ${deal.deal_name}`, await response.text());
      }
    } catch (error) {
      console.error(`❌ ${i + 1}/${dealsToImport.length} - Error: ${deal.deal_name}`, error.message);
    }
    
    // Small delay
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('');
  console.log('🎉 Import complete! Amounts are now stored in POUNDS.');
  console.log('   Dashboard: https://beyond-ai-zeta.vercel.app/sales');
}

importCleanDeals().catch(console.error);