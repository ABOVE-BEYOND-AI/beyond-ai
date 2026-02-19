# Above + Beyond — Internal Sales Platform Technical Specification

## Overview

This document is the complete technical specification for Above + Beyond Group's internal sales intelligence platform. It is designed to be handed directly to Claude Code for implementation.

**Stack:** Next.js (App Router) on Vercel, Salesforce REST API, Aircall API, Claude API, Gmail API, Google Calendar API
**Existing App:** `beyond-ai-zeta.vercel.app` — currently has `/sales` (Salesforce revenue/leaderboard) and `/calls` (Aircall integration)
**Auth:** Google OAuth (existing)
**Database:** Salesforce is the single source of truth. The app reads and writes via REST API.

---

## Salesforce Connection Details

The app already has a working Salesforce API connection used by `/sales`. All new pages use the same authenticated connection.

### Person Accounts Are Enabled
Some Accounts are Person Accounts (individuals), not just business accounts. The Account object has both business fields (Name, Industry) and person fields (PersonEmail, PersonMobilePhone, FirstName, LastName). When querying contacts/clients, query BOTH Contact and Account (where IsPersonAccount = true).

### Key Custom Objects
| Object | API Name | Purpose |
|--------|----------|---------|
| Event | Event__c | Events (Monaco GP, Wimbledon, etc.) |
| A+B Payment | Payment__c | Payment tracking per opportunity |
| Booking | Booking__c | Fulfilment bookings |
| Booking Assignment | Booking_Assignment__c | Booking allocations |
| Commission | Commissions__c | Monthly commission per rep |
| Target | Target__c | Monthly revenue targets |
| Guest | Guest__c | Individual guest records |
| Project | Project__c | Fulfilment projects |
| Itinerary | Itinerary__c | Event itineraries |
| Itinerary Entry | Itinerary_Entry__c | Itinerary line items |
| Enquiry | Enquiry__c | Inbound enquiries |
| Interest | Interest__c | Interest categories |
| Interest Assignment | Interest_Assignments__c | Interest-to-record mapping |
| A+B Note | A_B_Note__c | Custom notes on contacts |
| Package Request | Package_Request__c | Package requests |

---

## User Roles & Access Control

The app must enforce role-based visibility:

### SLT (Senior Leadership) — sees everything
- Scarlett Franklin (scarlett@aboveandbeyond.group)
- Max Venville (max.venville@aboveandbeyond.group)
- Robert Robinson (robert@aboveandbeyond.group)
- Kaley Eaton (kaley.eaton@aboveandbeyond.group)

### Sales Management — sees their team's data + own
- Leon O'Connor (leon@aboveandbeyond.group) — Role: Sales Management
- Sam Harrop (sam.harrop@aboveandbeyond.group) — Role: Sales Management

### Sales Reps — sees own data only
- Aaron Swaby, Alec MacDonald, Alex Kirby, Billy Prowse, Conner Millar, Jack Mautterer, James Walters, Jeremy Merlo, Max Heighton (max@aboveandbeyond.group), Sam Renals, Toby Davies, Tom Culpin
- Daniel Parker (daniel.parker@aboveandbeyond.group) — Sales Users role, System Admin profile

### Operations — limited sales view, fulfilment focus (future)
- Lucy Wood, Molly Quelch, Rebecca Rayment

### System/Integration Users (exclude from all views)
- Marketing Logic, MC Connect-CRM, Integration User, Insights Integration, Security User, SalesforceIQ Integration

### Likely Inactive (exclude from active views)
- Joe Newport (last login Jan 2025)
- Billy Prowse (last login 16 Feb — monitor)

### Implementation
Match Google OAuth email to Salesforce Username. Store role mapping in app config or query Salesforce UserRole on login. Filter all queries by OwnerId for reps, show all for managers/SLT.

---

## Navigation Structure

```
🏠 /dashboard    — Daily overview (future)
👥 /leads        — Smart lead queue ← BUILD FIRST
💰 /sales        — Revenue, leaderboard, deals (EXISTS)
📊 /pipeline     — Kanban deal board
📞 /calls        — Call intelligence + AI (EXISTS)
📧 /outreach     — Lusha enrichment + sequences
🎪 /events       — Event inventory + intelligence
👤 /clients      — Client 360 view
📈 /analytics    — Performance + attribution
⚙️ /settings     — Configuration
```

---

## PAGE: /leads — Smart Lead Queue

### Purpose
Replace Salesforce list views entirely. AI-prioritised lead queue with inline actions and Salesforce write-back.

### Primary SOQL Query
```sql
SELECT Id, Name, FirstName, LastName, Email, Phone, MobilePhone,
  Company, Title, Status, LeadSource, Rating,
  Score__c, Event_of_Interest__c, Interests__c,
  No_of_Guests__c, Form_Comments__c, Form_Type__c,
  Recent_Note__c, Tags__c, Unqualified_Reason__c,
  Last_Event_Booked__c, Web_to_Lead_Created__c,
  Web_to_Lead_Page_Information__c,
  Formula_1__c, Football__c, Rugby__c, Tennis__c,
  Live_Music__c, Culinary__c, Luxury_Lifestyle_Celebrity__c,
  Unique_Experiences__c, Other__c,
  LinkedIn__c, Facebook__c, Twitter__c,
  CreatedDate, LastModifiedDate, LastActivityDate,
  FirstCallDateTime, LastCallDateTime__c,
  FirstEmailDateTime, LastEmailDateTime__c,
  OwnerId, Owner.Name,
  I_agree_to_be_emailed__c, HasOptedOutOfEmail,
  Newsletter_Subscribed__c
FROM Lead
WHERE IsConverted = false
ORDER BY LastActivityDate DESC NULLS LAST
LIMIT 200
```

Note: If `LastCallDateTime__c` errors, use the standard Activity fields or check the actual API name. The Aircall integration may log calls as Tasks.

### Lead Status Values & Visual Mapping
| Status | Type | App Badge Colour | App Group |
|--------|------|-----------------|-----------|
| New | Default | Blue | New |
| Working | Active | Yellow | In Progress |
| Prospect | Active | Yellow | In Progress |
| Interested | Active | Orange | In Progress |
| Nurturing | Active | Purple | In Progress |
| Qualified | Converted | Green | Ready to Convert |
| Unqualified | Dead | Red | Dead |

### Lead Source Values (37 active) — Grouped for Filtering
```javascript
const leadSourceGroups = {
  'Digital Ads': ['Google AdWords', 'LinkedIn', 'Linkedin Ads', 'Display Ads', 'Facebook Lead Form', 'Advertisement'],
  'Organic': ['Organic Search', 'Website', 'Web', 'Web Form', 'Social Media'],
  'Outbound': ['Cognism', 'Credit Safe', 'Lusha', 'Phone', 'Purchased List', 'Central London Residents - Cold'],
  'Referral': ['Employee Referral', 'External Referral', 'Referral', 'Partner', 'Trade Contact', 'Networking'],
  'Events': ['Trade Show', 'Customer Event', 'Events', 'Webinar'],
  'Database': ['KT database', 'LT database', 'RR database', 'Snowbomb database', 'v1.1 Premium database', 'V2.1 database', 'V3.1'],
  'Email': ['Email', 'Chat'],
  'Other': ['Marketing (Max)', 'Other']
};
```

### Interest Category Checkboxes → Filterable Tags
```javascript
const interestFields = {
  'Formula_1__c': { label: 'Formula 1', colour: '#FF1801', icon: '🏎️' },
  'Football__c': { label: 'Football', colour: '#00A651', icon: '⚽' },
  'Rugby__c': { label: 'Rugby', colour: '#4A2D73', icon: '🏉' },
  'Tennis__c': { label: 'Tennis', colour: '#2E7D32', icon: '🎾' },
  'Live_Music__c': { label: 'Live Music', colour: '#E91E63', icon: '🎵' },
  'Culinary__c': { label: 'Culinary', colour: '#FF9800', icon: '🍽️' },
  'Luxury_Lifestyle_Celebrity__c': { label: 'Luxury/Lifestyle', colour: '#9C27B0', icon: '✨' },
  'Unique_Experiences__c': { label: 'Unique Experiences', colour: '#00BCD4', icon: '🌟' },
  'Other__c': { label: 'Other', colour: '#607D8B', icon: '📌' }
};
```

### Calculated Lead Score (App-Side)
Salesforce Score__c is broken (all values are 99). Calculate a score in the app:

```javascript
function calculateLeadScore(lead) {
  let score = 0;

  // Recency of activity (max 30 points)
  const daysSinceActivity = daysSince(lead.LastActivityDate);
  if (daysSinceActivity === 0) score += 30;
  else if (daysSinceActivity <= 3) score += 25;
  else if (daysSinceActivity <= 7) score += 20;
  else if (daysSinceActivity <= 14) score += 15;
  else if (daysSinceActivity <= 30) score += 10;
  else if (daysSinceActivity <= 90) score += 5;
  // else 0

  // Has event of interest (20 points)
  if (lead.Event_of_Interest__c) score += 20;

  // Number of guests — bigger deal (max 15 points)
  if (lead.No_of_Guests__c >= 10) score += 15;
  else if (lead.No_of_Guests__c >= 5) score += 10;
  else if (lead.No_of_Guests__c >= 1) score += 5;

  // Lead source quality (max 15 points)
  const highQualitySources = ['Website', 'Web Form', 'Referral', 'External Referral', 'Employee Referral', 'Customer Event', 'Trade Show'];
  const mediumQualitySources = ['Google AdWords', 'LinkedIn', 'Linkedin Ads', 'Facebook Lead Form', 'Organic Search'];
  if (highQualitySources.includes(lead.LeadSource)) score += 15;
  else if (mediumQualitySources.includes(lead.LeadSource)) score += 10;
  else score += 5;

  // Status progression (max 10 points)
  if (lead.Status === 'Interested') score += 10;
  else if (lead.Status === 'Prospect') score += 7;
  else if (lead.Status === 'Working') score += 5;
  else if (lead.Status === 'Nurturing') score += 3;

  // Has been called (5 points)
  if (lead.FirstCallDateTime) score += 5;

  // Rating (max 5 points)
  if (lead.Rating === 'Hot') score += 5;
  else if (lead.Rating === 'Warm') score += 3;

  return Math.min(score, 100);
}
```

### UI Layout — Lead List View

**Header Bar:**
- Search box (searches Name, Company, Email, Phone)
- Filter dropdowns: Status group, Lead Source group, Interest category, Owner
- Sort: Score (desc), Last Activity (desc), Created Date (desc), Name (asc)
- View toggle: My Leads / All Leads / Unworked Leads

**Lead Table Columns:**
| # | Column | Field(s) | Width | Notes |
|---|--------|----------|-------|-------|
| 1 | Score | Calculated | 60px | Colour-coded circle: green (70+), yellow (40-69), red (<40) |
| 2 | Name | FirstName, LastName | 150px | Clickable → expands detail panel |
| 3 | Company | Company | 150px | |
| 4 | Status | Status | 100px | Colour badge |
| 5 | Event Interest | Event_of_Interest__c | 150px | Tag/badge with event colour |
| 6 | Interests | Interest checkboxes | 120px | Small coloured tags from interestFields mapping |
| 7 | Source | LeadSource | 120px | Grouped label |
| 8 | Phone | Phone or MobilePhone | 120px | Click-to-call via Aircall API |
| 9 | Guests | No_of_Guests__c | 60px | |
| 10 | Last Activity | LastActivityDate | 100px | Relative time: "2h ago", "3d ago", "2w ago" |
| 11 | Last Call | FirstCallDateTime or via Task query | 100px | Relative time |
| 12 | Created | CreatedDate | 100px | Date only |
| 13 | Owner | Owner.Name | 100px | First name only |
| 14 | Actions | — | 80px | Quick action buttons |

**Quick Actions (per row):**
- 📞 Click-to-call (triggers Aircall API)
- ✅ Quick status change (dropdown: Working → Prospect → Interested → Qualified → Unqualified)
- 📝 Add note (opens small modal, saves to Recent_Note__c or creates A_B_Note__c)
- 🔄 Convert (only for Interested/Qualified leads — triggers Salesforce lead conversion API)

### Lead Detail Panel (Slide-out on click)
When a rep clicks a lead name, a side panel slides out showing:

**Contact Info:** Name, email, phone, mobile, company, title, LinkedIn link
**Event Interest:** Event_of_Interest__c prominently displayed
**Interest Tags:** All checked interest categories as visual tags
**Form Data:** Form_Comments__c, Web_to_Lead_Page_Information__c
**Notes:** Recent_Note__c + any A_B_Note__c records
**Activity Timeline:** Recent calls (from Aircall), emails, tasks
**AI Pre-Call Brief:** (Phase 2) Generated summary with suggested talking points

### Write-Back API Endpoints

**Update Lead Status:**
```
PATCH /services/data/v59.0/sobjects/Lead/{leadId}
Body: { "Status": "Working" }
```

**Update Recent Note:**
```
PATCH /services/data/v59.0/sobjects/Lead/{leadId}
Body: { "Recent_Note__c": "Called, interested in Monaco GP, callback Thursday" }
```

**Convert Lead:**
```
POST /services/data/v59.0/sobjects/Lead/{leadId}/convert
```
Note: Lead conversion in REST API requires using the `LeadConvert` composite resource or a custom Apex endpoint. If Salesforce REST doesn't support direct conversion, use:
```
POST /services/data/v59.0/actions/standard/convertLead
Body: {
  "inputs": [{
    "leadId": "{leadId}",
    "convertedStatus": "Qualified",
    "createOpportunity": true
  }]
}
```

### Smart Filtered Views (Pre-built)
These are saved filter combinations accessible via tabs or a dropdown:

1. **🔥 Hot Leads** — Score >= 70, Status != Unqualified, sorted by score desc
2. **📱 Need Calling** — LastCallDateTime is null OR > 48 hours ago, Status = New/Working, sorted by score desc
3. **🆕 New This Week** — CreatedDate >= THIS_WEEK, sorted by created desc
4. **💀 Going Cold** — LastActivityDate > 14 days ago, Status != Unqualified, sorted by last activity asc
5. **🎯 Event Interested** — Event_of_Interest__c != null, sorted by score desc
6. **❌ Unqualified** — Status = Unqualified, sorted by last modified desc

---

## PAGE: /pipeline — Kanban Deal Board

### Purpose
Visual drag-and-drop pipeline showing all open opportunities. Replaces Salesforce opportunity list views.

### Primary SOQL Query
```sql
SELECT Id, Name, StageName, Amount, CloseDate,
  AccountId, Account.Name,
  Opportunity_Contact__c, Opportunity_Contact__r.Name,
  Event__c, Event__r.Name, Event__r.Category__c,
  Event__r.Start_Date__c,
  Package_Sold__c, Package_Sold__r.Name,
  Total_Number_of_Guests__c,
  Percentage_Paid__c, Payment_Progress__c,
  Total_Amount_Paid__c, Total_Balance__c, Total_Payments_Due__c,
  Gross_Amount__c, Service_Charge__c, Processing_Fee__c, Tax_Amount__c,
  Commission_Amount__c,
  Next_Step__c, Special_Requirements__c,
  Is_New_Business__c, LeadSource,
  Sign_Request_Complete__c,
  OwnerId, Owner.Name,
  CreatedDate, LastModifiedDate, LastActivityDate
FROM Opportunity
WHERE IsClosed = false
ORDER BY LastModifiedDate DESC
LIMIT 500
```

### Opportunity Stages → Kanban Columns
| Column | Stage API Name | Type | Probability | Visual |
|--------|---------------|------|-------------|--------|
| New | New | Open | 10% | Blue |
| Deposit Taken | Deposit_Taken | Open | 50% | Yellow |
| Agreement Sent | Agreement_Sent | Open | 85% | Orange |
| — Won summary panel — | Agreement_Signed, Amended, Amendment_Signed | Closed/Won | 100% | Green |
| — Lost summary panel — | Closed_Lost, Cancelled | Closed/Lost | 0% | Red |

Only the 3 open stages are draggable Kanban columns. Won and Lost are summary panels below.

### Kanban Card Layout
```
┌─────────────────────────────────┐
│ 🏎️ Monaco GP 2026              │  ← Event name + category icon
│ Sean Le Tissier                  │  ← Contact name
│ NETCORE INFRASTRUCTURE           │  ← Account name
│                                  │
│ £15,090        4 guests          │  ← Amount + guest count
│ ████████░░ 60% paid              │  ← Payment progress bar
│                                  │
│ 12 days in stage  ⚠️             │  ← Days in stage + health indicator
│ Next: Send hotel options         │  ← NextStep field
│                                  │
│ 👤 Tom Culpin                    │  ← Owner
└─────────────────────────────────┘
```

**Health Indicator Logic:**
- Green: Days in stage <= average for this stage
- Amber: Days in stage = 1.5x average
- Red: Days in stage >= 2x average

### Drag-and-Drop Write-Back
When a card is dragged to a new column:
```
PATCH /services/data/v59.0/sobjects/Opportunity/{oppId}
Body: { "StageName": "Deposit_Taken" }
```

### Pipeline Summary Bar (Top of Page)
```
| New: 12 deals (£145k) | Deposit Taken: 8 deals (£98k) | Agreement Sent: 5 deals (£67k) | Total Pipeline: £310k |
```

### Filters
- By Owner (My Pipeline / All / specific rep)
- By Event (dropdown of Event__c names)
- By Event Category (F1, Tennis, Music, etc.)
- By value range
- By health (show only red/amber)

---

## PAGE: /sales — Enhanced Leaderboard (UPDATE EXISTING)

### Additional Queries Needed

**Monthly Targets:**
```sql
SELECT Target_Amount__c, OwnerId, Owner.Name, Type__c, Month__c, Year__c
FROM Target__c
WHERE Year__c = '2026' AND Month__c = 'February' AND Type__c = 'Individual'
```

**Monthly Commission:**
```sql
SELECT Sales_Person__c, Sales_Person__r.Name,
  Total_Monthly_commission__c, Commission_Rate_Applicable__c,
  Gross_Amount_Moved_to_Agreement_Signed__c,
  KPI_Targets__c, KPI_Targets_Met__c,
  Clawback__c, Amount_Paid_to_Salesperson__c,
  New_Bus_Ops__c, AVG_Call_Time__c,
  Avg_Rolling_Commission__c
FROM Commissions__c
WHERE Year__c = '2026'
ORDER BY Month__c DESC
LIMIT 50
```

### Enhanced Leaderboard Card
Currently shows: Name, deals, revenue.
Should show:
```
┌─────────────────────────────────────────┐
│ 🥇 Toby Davies                          │
│                                          │
│ £67,602 / £80,000 target    84.5%        │
│ ████████████████░░░░                     │  ← Progress bar
│                                          │
│ 10 deals  •  Commission: £4,200          │
│ New business: 6  •  KPI: 92%             │
└─────────────────────────────────────────┘
```

---

## PAGE: /events — Event Inventory & Intelligence

### Primary SOQL Query
```sql
SELECT Id, Name, Category__c, Start_Date__c, End_Date__c,
  Start_Time__c, End_Time__c,
  Location__c, Location__r.Name,
  Revenue_Target__c, Sum_of_Closed_Won_Gross__c,
  Percentage_to_Target__c, Revenue_Progress__c,
  Margin_Percentage__c, Total_Margin_Value__c,
  Total_Booking_Cost__c, Total_Staff_Costs__c, Total_Payments_Received__c,
  Event_Tickets_Required__c, Event_Tickets_Booked__c, Event_Tickets_Remaining__c,
  Hospitality_Tickets_Required__c, Hospitality_Tickets_Booked__c, Hospitality_Tickets_Remaining__c,
  Hotel_Tickets_Required__c, Hotel_Tickets_Booked__c, Hotel_Tickets_Remaining__c,
  Dinner_Tickets_Required__c, Dinner_Tickets_Booked__c, Dinner_Tickets_Remaining__c,
  Drinks_Tickets_Required__c, Drinks_Tickets_Booked__c, Drinks_Tickets_Remaining__c,
  Party_Tickets_Required__c, Party_Tickets_Booked__c, Party_Tickets_Remaining__c,
  Inbound_Flight_Tickets_Required__c, Inbound_Flight_Tickets_Booked__c, Inbound_Flights_Tickets_Remaining__c,
  Outbound_Flight_Tickets_Required__c, Outbound_Flight_Tickets_Booked__c, Outbound_Flights_Tickets_Remaining__c,
  Inbound_Transfer_Tickets_Required__c, Inbound_Transfer_Tickets_Booked__c, Inbound_Transfer_Tickets_Remaining__c,
  Outbound_Transfer_Tickets_Required__c, Outbound_Transfer_Tickets_Booked__c, Outbound_Transfer_Tickets_Remaining__c,
  Total_Tickets_Required__c, Total_Tickets_Booked__c, Total_Tickets_Remaining__c,
  Percentage_Reservations_Completion__c,
  Total_Projects__c,
  A_B_On_Site_1__c, A_B_On_Site_2__c,
  Event_Image_1__c, Event_Image_2__c, Event_Image_3__c,
  Master_Package_Code__c
FROM Event__c
WHERE Start_Date__c >= TODAY
ORDER BY Start_Date__c ASC
```

### Related Opportunities per Event
```sql
SELECT Id, Name, StageName, Amount, Gross_Amount__c,
  Opportunity_Contact__r.Name, Account.Name,
  Total_Number_of_Guests__c, Percentage_Paid__c,
  OwnerId, Owner.Name
FROM Opportunity
WHERE Event__c = '{eventId}'
ORDER BY StageName ASC
```

### Event Card Layout
```
┌──────────────────────────────────────────────────┐
│ 🏎️ MONACO GRAND PRIX 2026                       │
│ Monte Carlo  •  23-25 May 2026  •  32 days away  │
│                                                    │
│ Revenue: £245,000 / £400,000 target    61%         │
│ █████████████░░░░░░░░░                             │
│                                                    │
│ Margin: 42%  •  £102,900                           │
│                                                    │
│ INVENTORY                                          │
│ Hospitality  ████████████░░░  28/35 booked (80%)   │
│ Hotels       █████████░░░░░  18/30 booked (60%)    │
│ Flights      ████░░░░░░░░░   8/25 booked (32%)     │
│ Transfers    ██░░░░░░░░░░░   5/25 booked (20%)     │
│                                                    │
│ Pipeline: 8 open deals worth £89,000               │
│ Staff: Tom Culpin, Lucy Wood                       │
└──────────────────────────────────────────────────┘
```

### Scarcity Alerts
- Event >= 80% sold on any ticket type → amber alert
- Event >= 90% sold → red alert → "Use scarcity messaging"
- Event < 30 days away with < 50% sold → red alert → "Push unsold inventory"

---

## PAGE: /clients — Client 360 View

### Contact/Account Query
```sql
SELECT Id, Name, FirstName, LastName, Email, Phone, MobilePhone,
  AccountId, Account.Name, Account.Type, Account.Industry,
  Title, LeadSource, LinkedIn__c, Facebook__c, Twitter__c,
  Total_Spend_to_Date__c, Total_Won_Opportunities__c,
  Tags__c, Interests__c, Recent_Note__c, Score__c,
  Work_Email__c, Secondary_Email__c,
  OwnerId, Owner.Name,
  CreatedDate, LastActivityDate
FROM Contact
WHERE Id = '{contactId}'
```

### Related Opportunities
```sql
SELECT Id, Name, StageName, Amount, Gross_Amount__c, CloseDate,
  Event__c, Event__r.Name, Event__r.Category__c, Event__r.Start_Date__c,
  Package_Sold__r.Name,
  Total_Number_of_Guests__c,
  Percentage_Paid__c, Total_Amount_Paid__c, Total_Balance__c,
  Is_New_Business__c, Special_Requirements__c,
  CreatedDate
FROM Opportunity
WHERE Opportunity_Contact__c = '{contactId}'
ORDER BY CloseDate DESC
```

### A+B Notes
```sql
SELECT Id, Name, Body__c, OwnerId, Owner.Alias, CreatedDate
FROM A_B_Note__c
WHERE Contact__c = '{contactId}'
ORDER BY CreatedDate DESC
```

### Guest Attendance
```sql
SELECT Id, Name, Event__c, Event__r.Name, CreatedDate
FROM Guest__c
WHERE Contact__c = '{contactId}'
ORDER BY CreatedDate DESC
```

### Client 360 Layout
```
┌──────────────────────────────────────────────────────────┐
│ Sean Le Tissier                                          │
│ NETCORE INFRASTRUCTURE LIMITED                            │
│ 07789657064  •  sean@example.com  •  LinkedIn             │
│                                                          │
│ LIFETIME VALUE: £114,490  •  10 bookings  •  Since 2024  │
│ Owner: Conner Millar                                      │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ PREFERENCES (from A+B Notes)                             │
│ 🏉 Rugby (ENG or WALES)  🍽️ Fine Dining (M* Food)       │
│ 🎵 Music  💍 Anniversary: April                          │
│                                                          │
│ EVENT HISTORY                                            │
│ ┌─────────────────────────────────────────────┐          │
│ │ 2026 │ Abu Dhabi GP (x3)     £37,165  ✅    │          │
│ │      │ Royal Variety          £4,780   ✅    │          │
│ │      │ BAFTAs (x2)           £36,970   ✅    │          │
│ │      │ Wimbledon             £21,990   ✅    │          │
│ │ 2025 │ Le Manoir Dinner      £5,970    ✅    │          │
│ └─────────────────────────────────────────────┘          │
│                                                          │
│ PAYMENT STATUS                                           │
│ Total invoiced: £114,490                                 │
│ Total paid: £XX,XXX                                      │
│ Outstanding: £XX,XXX                                     │
│                                                          │
│ AI CROSS-SELL SUGGESTION                                 │
│ "Anniversary in April — suggest Le Manoir or fine        │
│  dining experience. Previously attended rugby — offer    │
│  Six Nations 2027 (already bought Ireland v England).    │
│  High F1 spend — offer Monaco GP 2026."                  │
│                                                          │
│ ACTIVITY TIMELINE                                        │
│ [Merged view of Aircall calls + emails + tasks]          │
└──────────────────────────────────────────────────────────┘
```

---

## PAGE: /outreach — Lusha + Email Sequences

### Lusha API Integration
Lusha API endpoint: `https://api.lusha.com/person`
Requires: API key (check Lusha plan for API access)

**Enrichment Flow:**
1. Rep enters name + company OR LinkedIn URL
2. App calls Lusha API → returns direct mobile, personal email, work email, job title, company info
3. Rep clicks "Save to Salesforce" → creates new Lead via API with LeadSource = 'Lusha'

**Lusha Search:**
```
GET https://api.lusha.com/person?firstName=John&lastName=Smith&company=Barclays
Headers: { "api_key": "{LUSHA_API_KEY}" }
```

### Email Sequence Builder
**Templates per event type:**
- F1 Cold Outreach (4 emails over 14 days)
- Wimbledon Introduction (3 emails over 10 days)
- General Hospitality (3 emails over 10 days)
- Post-Event Follow-Up (2 emails over 7 days)
- Re-engagement (3 emails over 21 days)

**AI Personalisation:**
For each lead in a sequence, Claude API generates a personalised version based on: lead's company, title, industry, event interest, any previous interactions, and the template structure. The rep reviews and sends via Gmail API.

**Gmail API Integration:**
```
POST https://gmail.googleapis.com/gmail/v1/users/me/messages/send
```
After sending, log to Salesforce as a Task:
```
POST /services/data/v59.0/sobjects/Task
Body: {
  "Subject": "Email: Monaco GP 2026 Introduction",
  "WhoId": "{leadId}",
  "OwnerId": "{repUserId}",
  "Status": "Completed",
  "Type": "Email",
  "Description": "{emailBody}"
}
```

---

## PAGE: /analytics — Performance Intelligence

### Channel Attribution Query
```sql
SELECT LeadSource, COUNT(Id) totalLeads,
  SUM(Amount) totalRevenue, AVG(Amount) avgDealSize
FROM Opportunity
WHERE StageName IN ('Agreement Signed', 'Amended', 'Amendment Signed')
  AND CloseDate >= THIS_YEAR
GROUP BY LeadSource
ORDER BY SUM(Amount) DESC
```

### Rep Performance Query
```sql
SELECT OwnerId, Owner.Name,
  COUNT(Id) totalDeals,
  SUM(Amount) totalRevenue,
  AVG(Amount) avgDealSize,
  SUM(Total_Number_of_Guests__c) totalGuests
FROM Opportunity
WHERE StageName IN ('Agreement Signed', 'Amended', 'Amendment Signed')
  AND CloseDate >= THIS_YEAR
GROUP BY OwnerId, Owner.Name
ORDER BY SUM(Amount) DESC
```

### Event Performance Query
```sql
SELECT Event__r.Name, Event__r.Category__c,
  COUNT(Id) totalDeals,
  SUM(Amount) totalRevenue,
  SUM(Gross_Amount__c) totalGross
FROM Opportunity
WHERE StageName IN ('Agreement Signed', 'Amended', 'Amendment Signed')
  AND CloseDate >= THIS_YEAR
GROUP BY Event__r.Name, Event__r.Category__c
ORDER BY SUM(Amount) DESC
```

---

## TV Display Mode

### Route Structure
```
/tv/sales?key={TV_ACCESS_KEY}
/tv/calls?key={TV_ACCESS_KEY}
/tv/events?key={TV_ACCESS_KEY}
```

### Auth Bypass
In middleware, if route starts with `/tv/` and query param `key` matches `TV_ACCESS_KEY` env var, skip Google OAuth. These routes are read-only.

### TV Layout Requirements
- No navigation sidebar
- No interactive elements (buttons, inputs)
- Large fonts (minimum 18px body, 48px+ for hero numbers)
- High contrast (dark background, white/bright text — matching current design)
- Auto-refresh every 30-60 seconds
- No session timeout
- Optimised for 1920x1080 display

### Deal Celebration Animation
When a new deal hits Agreement Signed with Amount >= 5000:
- Full-screen confetti animation for 5 seconds
- Show deal details: client name, event, amount, rep name
- Sound effect (optional — configurable)
- Then return to normal dashboard view

---

## API Rate Limits & Caching

### Salesforce API Limits
- Enterprise Edition: 100,000 API calls per 24 hours
- Professional Edition: 15,000 API calls per 24 hours
- Check your edition. For a team of ~15 with the app refreshing every 60 seconds across multiple pages, you'll use roughly 20,000-30,000 calls/day. Enterprise is fine. Professional might need caching.

### Caching Strategy
- **Leads list:** Cache for 60 seconds. Invalidate on write-back.
- **Pipeline:** Cache for 60 seconds. Invalidate on stage change.
- **Events:** Cache for 5 minutes. Rarely changes.
- **Targets/Commission:** Cache for 15 minutes. Monthly data.
- **Client 360:** Cache for 2 minutes. Load on demand.

### Redis (Upstash)
Fix the existing Upstash Redis connection (currently ENOTFOUND). Check UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel env vars. Use for caching Salesforce responses and Aircall transcription results.

---

## Environment Variables Required

```env
# Existing
SALESFORCE_ACCESS_TOKEN=xxx
SALESFORCE_INSTANCE_URL=https://xxx.salesforce.com
AIRCALL_API_ID=xxx
AIRCALL_API_TOKEN=xxx
ANTHROPIC_API_KEY=xxx
OPENAI_API_KEY=xxx (for Whisper transcription)
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
UPSTASH_REDIS_REST_URL=xxx (FIX THIS)
UPSTASH_REDIS_REST_TOKEN=xxx

# New
LUSHA_API_KEY=xxx
TV_ACCESS_KEY=xxx (random string for TV auth bypass)
GMAIL_CLIENT_ID=xxx (if separate from Google OAuth)
GMAIL_CLIENT_SECRET=xxx
```

---

## Build Priority

| Phase | Page | Effort | Impact |
|-------|------|--------|--------|
| 1 | /leads | Medium | HIGH — Reps stop using Salesforce list views |
| 2 | /sales enhancement (targets + commission) | Small | HIGH — Leaderboard becomes motivating |
| 3 | /pipeline Kanban | Medium | HIGH — Visual deal management |
| 4 | TV mode (/tv/ routes) | Small | MEDIUM — Office visibility |
| 5 | /events enhancement | Medium | HIGH — Inventory tracking |
| 6 | /outreach (Lusha + sequences) | Large | MEDIUM — New capability |
| 7 | /clients 360 | Medium | MEDIUM — Relationship intelligence |
| 8 | /analytics | Medium | MEDIUM — Strategic insights |

---

## Design Guidelines

Match existing app aesthetic: dark theme, clean typography, generous spacing. Reference the current /sales and /calls pages for component patterns.

- Background: Dark (matching current)
- Cards: Dark elevated surfaces with subtle borders
- Accent colours: Use event category colours for visual coding
- Typography: Clean, modern sans-serif
- Data density: Show information without clutter — use progressive disclosure (click to expand)
- Mobile responsive: Reps may use this on phones between meetings
- Loading states: Skeleton loaders, not spinners
- Error states: Clear error messages with retry buttons
- Empty states: Helpful messages ("No leads match this filter. Try adjusting your criteria.")
