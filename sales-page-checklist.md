# Sales Dashboard Implementation Checklist

**SIMPLIFIED**: Just listen to "New Signed Deals" Slack channel → Parse deals → Show on website

## 🎯 **What We're Actually Building**
- **Listen** to existing "New Signed Deals" Slack channel 
- **Parse** deal messages automatically (from Salesforce posts)
- **Display** on website with nice counter + leaderboard
- **Filter** by Today/This Week/This Month
- **Architecture**: Next.js + Upstash Redis + existing Google Auth

**We DON'T need**: Slash commands, new channels, targets, complex Slack features

---

## 📋 Phase 1: Foundation & Setup ✅ **MOSTLY COMPLETED**

### Redis Data Model & API Routes
- [x] Design Redis key patterns for sales data ✅ **COMPLETED**
- [x] Create sales data utilities in `lib/sales-database.ts` ✅ **COMPLETED**
- [x] Create TypeScript interfaces for sales data in `lib/types.ts` ✅ **COMPLETED**
- [x] Create `/api/sales/slack-events` endpoint ✅ **COMPLETED**
- [x] Create `/api/sales/data` endpoint ✅ **COMPLETED**
- [x] Deploy and test all endpoints ✅ **COMPLETED**

### Slack App Configuration (SIMPLIFIED)
- [x] Create Slack App ✅ **COMPLETED** (Sales Dashboard BeyondAI)
- [x] Configure OAuth & Permissions: `channels:history` ✅ **COMPLETED**
- [x] Set up Event Subscriptions for `message.channels` ✅ **COMPLETED**
- [x] Install Slack App to workspace ✅ **COMPLETED**
- [ ] Get your "New Signed Deals" channel ID
- [ ] Configure environment variables in Vercel:
  - [x] `SLACK_BOT_TOKEN` ✅ **COMPLETED**
  - [ ] `SLACK_SIGNING_SECRET=73e08c127358f021058e5fb7cceb4618`
  - [ ] `SALES_CHANNEL_ID=YOUR_ACTUAL_CHANNEL_ID` (we need the real channel ID)

---

## 📊 Phase 2: Channel Listening & Data Processing

### Get Channel ID & Start Listening
- [ ] **YOU NEED TO**: Find your "New Signed Deals" channel ID 
  - Go to Slack → Right-click channel → Copy link
  - Channel ID is in URL: `https://app.slack.com/client/T.../C1234567890` → `C1234567890`
- [ ] Add `SLACK_SIGNING_SECRET` and `SALES_CHANNEL_ID` to Vercel env vars
- [ ] Test message parsing with real Salesforce deal messages

### Message Parsing (Already Implemented)
- [x] Deal message parser built ✅ **COMPLETED**
- [x] Currency parsing (£, commas, decimals) ✅ **COMPLETED**  
- [x] Extract deal data (amount, rep name, deal name) ✅ **COMPLETED**
- [x] Store in Redis with duplicate detection ✅ **COMPLETED**

### Testing Real Messages
- [ ] Test with actual Salesforce deal notifications
- [ ] Verify deal data is being stored correctly
- [ ] Check Redis data using `/api/sales/data` endpoint

---

## 🎨 Phase 3: Website Dashboard UI

### Sales Counter with Time Filters  
- [ ] Update `/app/sales/page.tsx` with real dashboard
- [ ] Add time filter buttons: "Today" | "This Week" | "This Month"
- [ ] Create animated total sales counter component
- [ ] Style with existing components and Tailwind classes

### Leaderboard Component
- [ ] Create leaderboard table showing top sales reps
- [ ] Show rep name, deal count, total amount for selected time period
- [ ] Add ranking indicators and nice styling

### API Integration
- [ ] Connect frontend to `/api/sales/data` endpoint
- [ ] Implement filtering logic in API for time periods
- [ ] Add loading states and error handling

### Polish & Design
- [ ] Make it look nice with animations and cards
- [ ] Responsive design for mobile/desktop
- [ ] Add empty states when no deals exist yet

---

## 📝 **Next Steps (Simplified)**

### Immediate Actions Needed
1. **Get your "New Signed Deals" channel ID** and add to Vercel env vars
2. **Add `SLACK_SIGNING_SECRET`** to Vercel env vars  
3. **Test with real deal messages** from Salesforce
4. **Build the website dashboard UI** with time filters

### Future Enhancements (Optional)
- [ ] AI Call Analysis mockup (Sales Tools section) 
- [ ] More advanced filtering and analytics
- [ ] Mobile optimizations
- [ ] Real-time notifications

---

**Total Timeline**: ~1-2 weeks (much simpler!)
**Success Criteria**: Nice dashboard showing deals from Slack with time filtering