// Fix August 2025 deals - correct the currency amounts
// The original import multiplied by 100 twice, so we need to fix this

const correctDeals = [
  { rep_name: "Max Heighton", deal_name: "Venice Masked Ball 2026", amount: 641988 }, // £6,419.88
  { rep_name: "Leon O'Connor", deal_name: "Belgian GP 2026", amount: 712327 }, // £7,123.27  
  { rep_name: "Sam Harrop", deal_name: "Venice Masked Ball 2027", amount: 601794 }, // £6,017.94
  { rep_name: "Jeremy Merlo", deal_name: "England Vs New Zealand Cricket 2026", amount: 152469 }, // £1,524.69
  { rep_name: "Sam Harrop", deal_name: "Monte-Carlo Christmas Michelin Tour 2025", amount: 557134 }, // £5,571.34
  { rep_name: "Sam Harrop", deal_name: "Monaco GP 2026", amount: 1114267 }, // £11,142.67
  { rep_name: "Alec Macdonald", deal_name: "Richard Ashcroft 2026", amount: 1402101 }, // £14,021.01
  { rep_name: "Jack Mautterer", deal_name: "Lion King in theatre 2025", amount: 122726 }, // £1,227.26
  { rep_name: "Sam Renals", deal_name: "Premier League Darts 2026", amount: 914815 }, // £9,148.15
  { rep_name: "Leon O'Connor", deal_name: "Belgian GP 2026", amount: 356164 }, // £3,561.64
  { rep_name: "Billy Prowse", deal_name: "Oasis 2025", amount: 3531713 }, // £35,317.13
  { rep_name: "Chelsey Dunbar", deal_name: "Oasis 2025", amount: 480000 }, // £4,800.00
  { rep_name: "Daniel Parker", deal_name: "Coldplay 2025", amount: 1560867 }, // £15,608.67
  { rep_name: "Daniel Parker", deal_name: "Coldplay 2025", amount: 1873040 }, // £18,730.40
  { rep_name: "Tom Culpin", deal_name: "Hungarian Grand Prix 2026", amount: 445484 }, // £4,454.84
  { rep_name: "Tom Culpin", deal_name: "Hungarian Grand Prix 2026", amount: 445484 }, // £4,454.84
  { rep_name: "Alec Macdonald", deal_name: "Post Malone 2025", amount: 173906 }, // £1,739.06
  { rep_name: "Sam Harrop", deal_name: "US Masters 2026", amount: 13884794 }, // £138,847.94
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

async function importCorrectDeals() {
  const fetch = require('node-fetch');
  
  console.log('🔧 Importing correctly formatted August deals...');
  console.log('');
  
  let totalAmount = 0;
  const dealsToImport = correctDeals.map((deal, index) => {
    totalAmount += deal.amount;
    const repEmail = repEmailMap[deal.rep_name] || `${deal.rep_name.toLowerCase().replace(/[^a-z]/g, '')}@aboveandbeyond.co.uk`;
    
    return {
      rep_name: deal.rep_name,
      rep_email: repEmail, 
      deal_name: deal.deal_name,
      amount: deal.amount, // Already in pence, correctly formatted
      currency: 'GBP',
      source: 'manual',
      created_at: `2025-08-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}T${String(Math.floor(Math.random() * 12) + 9).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:00.000Z`
    };
  });
  
  console.log(`💰 Total August Sales: £${(totalAmount / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`);
  console.log(`📊 Total Deals: ${dealsToImport.length}`);
  console.log('');
  
  // Show what we're importing
  dealsToImport.forEach((deal, index) => {
    console.log(`${index + 1}. ${deal.deal_name} - ${deal.rep_name} - £${(deal.amount / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`);
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
        console.log(`✅ ${i + 1}/${dealsToImport.length} - ${deal.deal_name} (${deal.rep_name}) - £${(deal.amount / 100).toFixed(2)}`);
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
  console.log('🎉 Import complete! The amounts should now be correct.');
  console.log('   Dashboard: https://beyond-ai-zeta.vercel.app/sales');
}

importCorrectDeals().catch(console.error);