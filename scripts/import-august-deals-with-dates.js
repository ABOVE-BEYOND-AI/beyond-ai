// August 2025 deals import with EXACT dates from Slack
// Run with: node scripts/import-august-deals-with-dates.js

const dealsWithExactDates = [
  // August 1st
  { rep_name: "Max Heighton", deal_name: "Venice Masked Ball 2026", amount: 6419.88, created_at: "2025-08-01T12:25:00.000Z" },
  { rep_name: "Leon O'Connor", deal_name: "Belgian GP 2026", amount: 7123.27, created_at: "2025-08-01T15:11:00.000Z" },
  { rep_name: "Sam Harrop", deal_name: "Venice Masked Ball 2027", amount: 6017.94, created_at: "2025-08-01T15:13:00.000Z" },
  { rep_name: "Jeremy Merlo", deal_name: "England Vs New Zealand Cricket 2026", amount: 1524.69, created_at: "2025-08-01T15:16:00.000Z" },
  { rep_name: "Sam Harrop", deal_name: "Monte-Carlo Christmas Michelin Tour 2025", amount: 5571.34, created_at: "2025-08-01T16:08:00.000Z" },
  { rep_name: "Sam Harrop", deal_name: "Monaco GP 2026", amount: 11142.67, created_at: "2025-08-01T16:09:00.000Z" },
  { rep_name: "Alec Macdonald", deal_name: "Richard Ashcroft 2026", amount: 14021.01, created_at: "2025-08-01T17:11:00.000Z" },
  
  // August 2nd
  { rep_name: "Jack Mautterer", deal_name: "Lion King in theatre 2025", amount: 1227.26, created_at: "2025-08-02T04:29:00.000Z" },
  
  // August 4th
  { rep_name: "Sam Renals", deal_name: "Premier League Darts 2026", amount: 9148.15, created_at: "2025-08-04T14:35:00.000Z" },
  { rep_name: "Leon O'Connor", deal_name: "Belgian GP 2026", amount: 3561.64, created_at: "2025-08-04T14:42:00.000Z" },
  { rep_name: "Billy Prowse", deal_name: "Oasis 2025", amount: 35317.13, created_at: "2025-08-04T15:19:00.000Z" },
  { rep_name: "Chelsey Dunbar", deal_name: "Oasis 2025", amount: 4800.00, created_at: "2025-08-04T16:49:00.000Z" },
  { rep_name: "Daniel Parker", deal_name: "Coldplay 2025", amount: 15608.67, created_at: "2025-08-04T17:48:00.000Z" },
  
  // August 5th
  { rep_name: "Daniel Parker", deal_name: "Coldplay 2025", amount: 18730.40, created_at: "2025-08-05T12:06:00.000Z" },
  { rep_name: "Tom Culpin", deal_name: "Hungarian Grand Prix 2026", amount: 4454.84, created_at: "2025-08-05T14:07:00.000Z" },
  { rep_name: "Tom Culpin", deal_name: "Hungarian Grand Prix 2026", amount: 4454.84, created_at: "2025-08-05T14:12:00.000Z" },
  { rep_name: "Alec Macdonald", deal_name: "Post Malone 2025", amount: 1739.06, created_at: "2025-08-05T16:21:00.000Z" },
  { rep_name: "Sam Harrop", deal_name: "US Masters 2026", amount: 138847.94, created_at: "2025-08-05T17:05:00.000Z" },
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

async function importDealsWithExactDates() {
  const fetch = require('node-fetch');
  
  console.log('📅 Importing August deals with EXACT historical dates...');
  console.log('');
  
  let totalAmount = 0;
  const dealsToImport = dealsWithExactDates.map((deal, index) => {
    totalAmount += deal.amount;
    const repEmail = repEmailMap[deal.rep_name] || `${deal.rep_name.toLowerCase().replace(/[^a-z]/g, '')}@aboveandbeyond.co.uk`;
    
    return {
      rep_name: deal.rep_name,
      rep_email: repEmail, 
      deal_name: deal.deal_name,
      amount: deal.amount, // Already in pounds
      currency: 'GBP',
      source: 'manual',
      created_at: deal.created_at // Exact timestamp from Slack
    };
  });
  
  console.log(`💰 Total August Sales: £${totalAmount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`);
  console.log(`📊 Total Deals: ${dealsToImport.length}`);
  console.log('');
  
  // Group by date for display
  const dealsByDate = {};
  dealsToImport.forEach(deal => {
    const date = deal.created_at.split('T')[0];
    if (!dealsByDate[date]) dealsByDate[date] = [];
    dealsByDate[date].push(deal);
  });
  
  Object.keys(dealsByDate).sort().forEach(date => {
    console.log(`📅 ${date}:`);
    dealsByDate[date].forEach(deal => {
      const time = deal.created_at.split('T')[1].substring(0, 5);
      console.log(`  ${time} - ${deal.deal_name} (${deal.rep_name}) - £${deal.amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`);
    });
    console.log('');
  });
  
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
        const date = deal.created_at.split('T')[0];
        const time = deal.created_at.split('T')[1].substring(0, 5);
        console.log(`✅ ${i + 1}/${dealsToImport.length} - ${date} ${time} - ${deal.deal_name} (${deal.rep_name}) - £${deal.amount.toFixed(2)}`);
      } else {
        console.error(`❌ ${i + 1}/${dealsToImport.length} - Failed: ${deal.deal_name}`, await response.text());
      }
    } catch (error) {
      console.error(`❌ ${i + 1}/${dealsToImport.length} - Error: ${deal.deal_name}`, error.message);
    }
    
    // Small delay
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log('');
  console.log('🎉 Import complete with exact historical dates!');
  console.log('   Dashboard: https://beyond-ai-zeta.vercel.app/sales');
  console.log('');
  console.log('📊 Date Distribution:');
  console.log('   Aug 1: 7 deals');
  console.log('   Aug 2: 1 deal');
  console.log('   Aug 4: 5 deals');
  console.log('   Aug 5: 5 deals');
  console.log('   Aug 6: 0 deals (Today - perfect for testing!)');
}

importDealsWithExactDates().catch(console.error);