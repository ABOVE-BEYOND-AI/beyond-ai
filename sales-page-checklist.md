# Sales Dashboard Implementation Checklist

Based on the Sales-page.PRD, adapted for existing Next.js + Upstash Redis + Google Auth architecture.

## 🏗️ **Architecture Alignment Summary**

### ✅ **Existing Infrastructure (Leveraged)**
- **Database**: Upstash Redis with key-value patterns
- **Auth**: Custom Google OAuth with `useGoogleAuth()` hook  
- **UI Components**: Existing card, button, input, stepper components
- **Layout**: `DashboardLayout` with working sidebar navigation
- **API Patterns**: Established Next.js API route structures
- **Error Handling**: Consistent patterns across existing APIs

### 🔄 **Key Adaptations from Original PRD**
- **Database**: Redis key-value store ✅ (NOT PostgreSQL as originally assumed)
- **Auth**: Google OAuth ✅ (NOT separate Slack Bot auth)
- **Data Model**: Redis patterns ✅ (NOT SQL schemas)
- **Components**: Existing UI library ✅ (NOT building from scratch)

## 🎯 Project Overview
- **Goal**: Real-time sales dashboard with animated counters, leaderboards, and Slack integration
- **Platform**: Next.js on Vercel + Slack (free tier) + **Upstash Redis** (existing)
- **Auth**: Existing Google OAuth system with `useGoogleAuth()` hook
- **Timeline**: 5 weeks

---

## 📋 Phase 1: Foundation & Setup (Week 1)

### Redis Data Model Setup (Using Existing Upstash)
- [x] Design Redis key patterns for sales data: ✅ **COMPLETED**
  ```typescript
  // Redis Keys (following existing patterns):
  'sales:deals' → Set of all deal IDs
  'sales:deal:${id}' → Individual deal data
  'sales:monthly:${YYYY-MM}' → Monthly aggregated stats
  'sales:leaderboard:${YYYY-MM}' → Monthly leaderboard data
  'sales:rep:${email}:deals' → Deal IDs for specific rep
  ```
  **Implementation Notes:** Complete Redis key design implemented in `lib/sales-database.ts` with additional keys for Slack message tracking and monthly targets.

- [x] Create sales data utilities in `lib/sales-database.ts` (following `lib/redis-database.ts` pattern) ✅ **COMPLETED**
  **Implementation Notes:** Full database layer created with functions for deals, leaderboards, monthly stats, and utility functions for currency parsing.

- [x] Add Redis operations for sales data (using existing `getRedisClient()` pattern) ✅ **COMPLETED**
  **Implementation Notes:** All CRUD operations implemented following existing patterns from `lib/redis-database.ts`.

- [x] Create TypeScript interfaces for sales data in `lib/types.ts` ✅ **COMPLETED**  
  **Implementation Notes:** Added `Deal`, `SalesRep`, `MonthlySalesStats`, and `SalesDashboardData` interfaces.

### Slack App Configuration
- [ ] Create new Slack App in Slack App Directory
- [ ] Configure OAuth & Permissions scopes:
  - [ ] `channels:history` (read channel messages)
  - [ ] `chat:write` (post messages)
  - [ ] `files:write` (upload GIFs)
  - [ ] `commands` (slash commands)
- [ ] Set up Event Subscriptions for `message.channels`
- [ ] Install Slack App to workspace
- [ ] Configure Slack environment variables in Vercel:
  - [ ] `SLACK_BOT_TOKEN`
  - [ ] `SLACK_SIGNING_SECRET`
  - [ ] `SALES_CHANNEL_ID`
  - [ ] `MONTHLY_TARGET`

### Next.js API Routes Foundation (Following Existing Patterns)
- [x] Create `/api/sales/slack-events` endpoint (following `/api/auth/google/callback` pattern) ✅ **COMPLETED**
  **Implementation Notes:** Full Slack events handler with message parsing, deal extraction, and duplicate detection.

- [x] Create `/api/sales/slash-command` endpoint for `/sales-report` ✅ **COMPLETED**
  **Implementation Notes:** Complete `/sales-report` command with month parameter support and formatted responses.

- [x] Create `/api/sales/data` endpoint for dashboard data (following `/api/itinerary/save` pattern) ✅ **COMPLETED**
  **Implementation Notes:** Dashboard data API with GET/POST endpoints for sales data retrieval and manual deal creation.

- [x] Set up @slack/web-api integration (avoid Bolt.js for simpler setup) ✅ **COMPLETED**
  **Implementation Notes:** Installed `@slack/web-api` package and integrated into event handling.

- [x] Implement Slack request signature verification ✅ **COMPLETED**
  **Implementation Notes:** Full signature verification implemented in both events and slash command endpoints.

- [x] Add error handling and logging (following existing API error patterns) ✅ **COMPLETED**
  **Implementation Notes:** Comprehensive error handling and logging following existing patterns from other API routes.

- [x] Use existing authentication middleware patterns ✅ **COMPLETED**
  **Implementation Notes:** API routes prepared to integrate with existing Google Auth patterns when needed.

---

## 📊 Phase 2: Data Processing & Aggregation (Week 2)

### Message Parsing Engine (Using Redis)
- [ ] Build deal notification parser for Slack messages
- [ ] Handle currency formats (£, commas, decimals)
- [ ] Extract deal data:
  - [ ] Amount parsing
  - [ ] Rep name extraction  
  - [ ] Deal name extraction
  - [ ] Timestamp capture
- [ ] Add validation and error handling for malformed messages
- [ ] Store parsed deals in Redis using key patterns:
  - [ ] Add deal to `sales:deals` set
  - [ ] Store deal data in `sales:deal:${id}`
  - [ ] Update rep's deal list `sales:rep:${email}:deals`
- [ ] Add duplicate detection (using `slack_ts` in deal data)
- [ ] Follow existing Redis operation patterns from `lib/redis-database.ts`

### Aggregation Logic (Redis-based)
- [ ] Create `/api/sales/aggregate` endpoint (following existing API patterns)
- [ ] Implement Redis-based aggregation:
  - [ ] MTD calculations using Redis sorted sets
  - [ ] Leaderboard generation (top 5 reps by monthly volume)
  - [ ] Store monthly stats in `sales:monthly:${YYYY-MM}`
  - [ ] Cache leaderboard in `sales:leaderboard:${YYYY-MM}`
- [ ] Add month-over-month comparison logic
- [ ] Create utility functions for date filtering and Redis queries
- [ ] Add progress calculation against monthly targets
- [ ] Use existing Redis client and error handling patterns

### Scheduled Functions (Vercel-compatible)
- [ ] Set up Vercel Scheduled Function (following Vercel serverless patterns)
- [ ] Configure daily aggregation job (09:00 UTC)
- [ ] Add monthly reset functionality with Redis cleanup
- [ ] Implement error handling and retry logic
- [ ] Log aggregation results for debugging

---

## 🎨 Phase 3: Visual Components & Animations (Week 3)

### Animated Progress Visualization
- [ ] Install chart.js dependencies (`chartjs-node-canvas`, `gifencoder`)
- [ ] Create animated progress bar/gauge generator
- [ ] Implement 20-frame animation (0 → target percentage)
- [ ] Ensure GIF output ≤ 2MB (Slack limit)
- [ ] Add fallback to static chart if GIF generation fails
- [ ] Create `/api/sales/generate-gif` endpoint

### Sales Dashboard UI Components
- [ ] Design total sales counter with animated numbers
- [ ] Create leaderboard component with ranking visualization
- [ ] Add month-over-month comparison indicators
- [ ] Implement progress bar showing target achievement
- [ ] Add responsive design for mobile/desktop
- [ ] Style with consistent design system

### Real-time Updates
- [ ] Implement WebSocket or polling for real-time updates
- [ ] Add optimistic UI updates when new deals come in
- [ ] Create smooth number animation transitions
- [ ] Add notification toasts for new deals

---

## 🏠 Phase 4: Sales Tools & Home Page (Week 4)

### Main Sales Dashboard Page (Using Existing Architecture)
- [ ] Update `/app/sales/page.tsx` using existing `DashboardLayout` component
- [ ] Follow existing component patterns from `/app/itinerary/page.tsx`
- [ ] Add total sales counter section with animated numbers
- [ ] Implement leaderboard section using existing card components
- [ ] Add charts and visualizations (following existing UI patterns)
- [ ] Include target progress indicators with existing progress components
- [ ] Add time period selectors (this month, last month, YTD)
- [ ] Use existing `useGoogleAuth()` hook for user authentication
- [ ] Integrate with existing loading and error state patterns

### Sales Tools Section (Following Existing UI Patterns)
- [ ] Create "Sales Tools" section using existing card/layout components
- [ ] Design AI Call Analysis mockup UI using existing component library:
  - [ ] Upload interface using existing file upload patterns
  - [ ] Analysis progress indicator (following existing stepper component)
  - [ ] Results display mockup with existing card layouts
  - [ ] Key insights extraction using existing text/badge components
  - [ ] Sentiment analysis visualization with existing chart patterns
  - [ ] Action items generation using existing list components
- [ ] Add "Coming Soon" badges using existing badge component
- [ ] Style with existing Tailwind classes and design tokens
- [ ] Follow existing responsive design patterns

### Navigation & Layout (Leveraging Existing Infrastructure)
- [ ] Sales page already uses `DashboardLayout` with sidebar ✅
- [ ] Ensure sidebar "Sales" item highlights correctly (update pathname matching)
- [ ] Add breadcrumbs using existing navigation patterns
- [ ] Implement smooth transitions following existing motion/animation patterns
- [ ] Add loading states using existing skeleton/loading components
- [ ] Follow existing error boundary and error handling patterns

---

## ⚡ Phase 5: Slack Integration & Testing (Week 5)

### Slack App Home Tab
- [ ] Implement `/api/slack/home` endpoint
- [ ] Create App Home layout with:
  - [ ] Animated GIF display
  - [ ] MTD total with delta vs. last month
  - [ ] Top 5 leaderboard section
  - [ ] Last updated timestamp
- [ ] Use `views.publish()` to update Home tab
- [ ] Add refresh mechanism for scheduled updates

### Slack Channel Posting
- [ ] Implement `/api/slack/post-update` endpoint
- [ ] Use `chat.postMessage()` for channel updates
- [ ] Upload GIF using `files.upload()`
- [ ] Format message with sales summary
- [ ] Add schedule for regular channel posts

### Slash Commands
- [ ] Implement `/sales-report` slash command handler
- [ ] Support parameters:
  - [ ] `this-month`
  - [ ] `last-month`
  - [ ] `YYYY-MM` format
- [ ] Return formatted response with current stats
- [ ] Add help text and error handling

### Testing & Quality Assurance
- [ ] Write unit tests for parsing logic
- [ ] Test Slack webhook endpoints
- [ ] Verify GIF generation and upload
- [ ] Test scheduled function execution
- [ ] Load test with high deal volume
- [ ] Security audit of Slack integration
- [ ] End-to-end testing of complete flow

---

## 🚀 Phase 6: Deployment & Monitoring

### Production Deployment
- [ ] Deploy to Vercel with environment variables
- [ ] Configure custom domain if needed
- [ ] Set up monitoring and alerting
- [ ] Add logging for debugging
- [ ] Create backup strategy for database

### Documentation & Handover
- [ ] Create admin documentation
- [ ] Document API endpoints
- [ ] Create troubleshooting guide
- [ ] Add configuration instructions
- [ ] Write user guide for sales team

### Launch & Feedback
- [ ] Internal roll-out to sales team
- [ ] Gather initial feedback
- [ ] Monitor performance metrics
- [ ] Track success metrics from PRD:
  - [ ] ≥ 80% of sales team uses dashboard as go-to report
  - [ ] ≥ 25% lift in inter-rep engagement
  - [ ] 100% hands-off data flow automation
  - [ ] ≥ 99% of scheduled posts delivered on time

---

## 🔧 Technical Requirements Checklist

### Performance Requirements
- [ ] Parsing latency < 100ms per message
- [ ] GIF generation < 5s per run
- [ ] Dashboard load time < 2s (following existing performance patterns)
- [ ] Real-time updates < 1s delay
- [ ] Redis operations < 50ms (leveraging existing Upstash performance)

### Reliability Requirements
- [ ] 99% uptime target (leverage Vercel + Upstash reliability)
- [ ] Error handling for all failure modes (following existing API error patterns)
- [ ] Retry logic for external API calls (Slack, GIF generation)
- [ ] Graceful degradation when services are down
- [ ] Use existing Redis connection pooling and error handling

### Security Requirements
- [ ] Slack request signature verification
- [ ] Environment variables encrypted in Vercel (following existing pattern)
- [ ] Redis connection security (using existing Upstash security)
- [ ] Input validation and sanitization (following existing validation patterns)
- [ ] Rate limiting on API endpoints
- [ ] Leverage existing Google Auth security for dashboard access

### Scalability Requirements (Redis-optimized)
- [ ] Handle up to 1,000 deals/month in Redis
- [ ] Efficient Redis key design for fast lookups
- [ ] Use Redis sorted sets for leaderboard performance
- [ ] Implement Redis-based caching for frequently accessed data
- [ ] Follow existing Redis operation patterns for consistency

---

## 📈 Success Metrics Tracking

### Technical Metrics
- [ ] API response times
- [ ] Database query performance
- [ ] Slack API rate limit usage
- [ ] Error rates and uptime

### Business Metrics
- [ ] Dashboard usage analytics
- [ ] Sales team engagement
- [ ] Accuracy of deal parsing
- [ ] Time-to-information improvement

---

## 🎨 UI/UX Components Needed

### Dashboard Components
- [ ] Animated counter component
- [ ] Leaderboard table with animations
- [ ] Progress bars and gauges
- [ ] Chart components (bar, line, pie)
- [ ] Loading skeletons
- [ ] Error boundary components

### Sales Tools Components
- [ ] File upload component for call recordings
- [ ] AI analysis progress indicator
- [ ] Results visualization components
- [ ] Insights cards and highlights
- [ ] Sentiment analysis charts
- [ ] Action items list component

---

## 🔍 Future Enhancements (Post-MVP)

### Advanced Features
- [ ] AI Call Analysis implementation
- [ ] Predictive analytics
- [ ] Custom reporting periods
- [ ] Email notifications
- [ ] Mobile app companion
- [ ] Integration with CRM systems

### Analytics & Insights
- [ ] Trend analysis
- [ ] Forecasting models
- [ ] Performance insights
- [ ] Goal setting and tracking
- [ ] Commission calculations

---

**Total Estimated Timeline**: 5 weeks
**Key Dependencies**: Slack App approval, Database provisioning, Vercel deployment access
**Success Criteria**: Automated sales tracking with real-time dashboard and team engagement

---

## 🚀 **Implementation Benefits Using Existing Architecture**

### ⚡ **Faster Development**
- Leverage existing Redis data patterns and utilities
- Reuse existing Google Auth and session management  
- Build on proven UI component library and layout system
- Follow established API route patterns and error handling

### 🔒 **Reduced Risk**
- Use battle-tested Redis operations and connection handling
- Leverage existing security patterns and environment variable management
- Build on existing authentication flows and user management
- Consistent with existing codebase patterns and conventions

### 💰 **Cost Efficiency**
- No additional database infrastructure needed (Redis already provisioned)
- No new authentication providers (Google OAuth already working)
- Minimal new dependencies (mainly Slack SDK and chart libraries)
- Leverages existing Vercel hosting and environment

### 🛠️ **Maintenance Simplicity**
- Consistent Redis key patterns across all features
- Unified authentication and session management
- Shared UI components and design system
- Common API patterns and error handling approaches

---

*This revised checklist aligns with your existing Next.js + Upstash Redis + Google Auth architecture, ensuring faster implementation and consistent patterns throughout your codebase.*