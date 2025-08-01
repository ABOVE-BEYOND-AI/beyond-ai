1. Overview
Product Name: Above + Beyond AI
Primary Feature: Itinerary Creator
Goal: Enable travel consultants to input a lead brief and automatically generate high-end, research-backed travel itineraries, populate a predesigned Canva template, export it as a polished PDF, and make it downloadable/savable with minimal friction.

2. Objectives
Turn a client/lead’s brief into 3–5 rich trip options with deep research (destinations, accommodations, transportation, extras) via Perplexity Labs API.

Map that structured output into a Canva Brand Template using the Canva Connect API (Autofill).

Export the filled Canva design to PDF and surface it on the dashboard for download.

Provide a beautiful, usable dashboard UI with sidebar, branding, and streamlined input flow.

Support automation (optionally via Zapier) to store final PDFs into Google Drive.

3. Key User Stories
As a travel consultant, I want to input a client’s brief so the system can generate itinerary options automatically.

As a user, I want the app to perform deep research (locations, flights, hotels, kids clubs, costs) so I don’t have to manually gather it.

As a user, I want the research output fed into a Canva template so the final presentation looks branded and professional.

As a user, I want to download the final itinerary PDF from the dashboard.

As an operations user, I want the generated PDF saved to Google Drive automatically for recordkeeping/delivery.

As a designer, I want the UI to use the specified typography and look premium with a dashboard and sidebar.

4. Features & Functional Requirements
4.1. Input & Prompting
Lead Brief Form:
Fields: Client name, travel interests, dates (or range), party composition (adults/kids), budget tier, preferred destinations or constraints, special requirements (e.g., ski, family-friendly, luxury), departure location (e.g., UK), number of options (3–5).

Prompt Composition:
Construct and send to Perplexity Labs Deep Research API using the exact structured prompt template (below). Insert dynamic placeholders from the form.

4.2. Research Prompt Template (to Perplexity)
Use this exact structure:

vbnet
Copy
Edit
Perplexity Labs Danny Itinerary Creation Prompt
Personal Travel/Holiday Packages

GOAL
Create a presentation using a leads brief with wants, needs, extra requirements etc
Automate as much as possible especially the research

Create a complete presentation of the Itinerary with deep research on different locations, x hour flight from UK / flight options, luxury family resorts, kid club offerings, luxury villas and chalets, luxury and intermediate ski destinations suitable 

3-5 Options. For each option, follow this structure:

1. Trip Overview
- Title: [Destination, Dates]
- Location
- 3-5 Hotel/Resort options with overview and amenities.
- Room Types
- Travel Dates, private ground transportation options, transfers to and from hotel, kids clubs/creche kids clubs 
- Flights (Airline, Departure + Arrival Times), give options for different times and dates
- Economy Class to start with, quote upgrades for business class etc

2. Why This Trip
- 2–4 bullet points highlighting the best features of the destination and hotel (based on the description). Focus on what's exciting or luxurious for families.

3. Accommodation Details
- For each room: room type, size in m², key features, and views.

4. Optional Extras / Kids Club Highlights
- Bullet-point breakdown of available clubs by age group with key activities.
- Any extra childcare or special service options.

5. Images
- placeholder image URLs or descriptors

- Total Cost (in GBP) + note 10% service fee
- breakdown of the entire package in bullet copy on the left, price on the right

Think deeply and use your full capabilities to make this to the highest quality standard as possible. Make sure all of the information is correct and up to date.
4.3. Data Parsing & Structuring
Parse Perplexity response into structured JSON matching fields used in the Canva template:
Example keys: trip_title, destination, hotel_options (array), room_details, transport_options, flight_options, why_this_trip (bullets), kids_club_highlights, total_cost_gbp, service_fee_note, images (URLs).

4.4. Canva Integration
Authentication: OAuth2 with Canva via Connect API (manage access token + refresh token).

Brand Template: Prebuilt Canva template with named placeholders corresponding to JSON keys.

Text fields: e.g., trip_title, overview_paragraph, hotel_1_name, hotel_1_summary, etc.

Image frames: named (e.g., hero_image, hotel_1_image).

Autofill Job: Submit JSON to Canva’s apply/autofill endpoint to create a filled design.

Export: Trigger export to PDF and retrieve the result.

Fallback: If any field is missing, use sensible defaults or placeholders so design still renders.

4.5. Dashboard/UI
Layout:

Left sidebar with branded “Above + Beyond AI” logo.

Menu items (top to bottom):

Itinerary Creator (primary)

Upcoming Events

Cases

Upgrades

Contact

User/Profile

Placeholder text under each menu item until real content exists.

Main Panel for Itinerary Creator:

Lead brief input form (as above).

“Generate Itinerary” button triggers research → Canva pipeline.

Progress/status indicator (researching, populating template, exporting, done).

Display generated options with thumbnails/previews.

Download button for final PDF.

Option to re-run/update per client feedback.

4.6. Typography / Design
Font: Jakarta Sans (use variable weights).

Titles: Extra Bold, reduced letter spacing (tight).

Body: Regular / Light, normal spacing for readability.

Color Scheme & Style: Dark premium theme (as per provided screenshots: blacks, gold accents), soft shadows, rounded cards.

Responsiveness: Desktop-first, but degrade gracefully on smaller screens.

4.7. Automation & Storage
Zapier Integration (optional/parallel):

Trigger: New generated PDF → save into designated Google Drive folder.

Or: New Google Drive file (e.g., lead brief) can kick off the itinerary generation via webhook to this app.

Downloadable Output: Serve final PDF from the app with a user-friendly download link.

Storage: Optionally store past itineraries per client (in lightweight DB or object store).

4.8. Error Handling & Notifications
Surface human-readable errors at each stage (research failure, Canva API error, export timeout).

Allow retry.

Log all pipeline steps for diagnostics.

5. Technical Architecture
5.1. Stack
Frontend: Next.js (React)

Hosting: Vercel

APIs:

Perplexity Labs Deep Research API (structured prompt & JSON response)

Canva Connect API (OAuth, Brand Template autofill, export)

Zapier Webhooks (optional orchestration with Google Drive)

Persistence (optional):

Lightweight DB (e.g., SQLite, Supabase, or Vercel KV) for token storage, client briefs, generated itinerary metadata.

Authentication (internal): Minimal—could be single user or simple JWT/session if multi-user later.

5.2. Data Flow
User submits lead brief on dashboard.

App assembles prompt, sends to Perplexity API.

Response parsed into structured JSON.

JSON mapped to Canva template placeholders; Canva autofill API called.

Canva design exported to PDF.

PDF returned to dashboard; optionally a Zapier webhook triggers upload to Drive.

User downloads or shares.

6. Integration Details
6.1. Canva
Manage OAuth tokens (store and refresh).

Endpoint examples (use official docs for current URLs):

POST /oauth/token (exchange + refresh)

POST /v1/brand-templates/{template_id}/apply (autofill)

POST /v1/designs/{design_id}/export (PDF export)

Map JSON keys to template field names exactly.

6.2. Perplexity
Use their API (if available) to send the structured prompt.

Receive and sanitize the response.

Extract images (could be placeholder URLs or call out to an image service if needed).

7. UI/UX Requirements
Dashboard: Overview of recent itineraries, status, quick “New Itinerary” button.

Sidebar: Fixed, collapsible, with clear active state. Icons like in mock (home, calendar, shield/cases, upgrade, contact, profile).

Forms: Inline validation, auto-save draft of client brief.

Visual polish: Carded layout for each trip option, cost breakdown displayed side-by-side (copy left, price right).

Accessibility: Reasonable contrast, alt text for images, keyboard navigable.

8. Branding
Title on top: “Above + Beyond AI”

Logo placeholder (can replace later).

Use coherent brand colors (black/dark background, gold/cream highlights, white text).

Smooth transitions/hover states (subtle).

9. Non-Functional Requirements
Performance: Generation + export pipeline should complete within ~30 seconds for user-perceived speed; show progress.

Security:

Securely store Canva access tokens.

Validate any incoming webhook (if using Zapier triggers) with a secret.

Sanitize all input.

Scalability: Designed as single-tenant now but structured for later multi-client onboarding.

10. Milestones / Phases
Phase 1: Basic dashboard + lead brief form + Perplexity prompt + display raw structured output.

Phase 2: Canva integration: apply template + export PDF; show downloadable result.

Phase 3: Zapier/Drive automation + error handling + storing history.

Phase 4: Design polish, typography, responsive tweaks, user settings.

Phase 5: Optional multi-client support, branding refinements.

11. Acceptance Criteria
User can submit a brief and get 3–5 itinerary options with structured research.

Output is mapped into a Canva template and exported as a PDF.

PDF is downloadable from the dashboard.

Sidebar and dashboard UI match the branded spec (Jakarta Sans, hierarchy, premium feel).

Tokens and integrations work without exposing secrets.

The workflow can optionally push the PDF to Google Drive via Zapier.

12. Deliverables for Cursor
Next.js codebase with:

Lead brief form component

Perplexity API integration module

Canva OAuth + autofill + export module

Dashboard with itinerary previews and download

Sidebar UI with placeholder menu items

Design system: typography, colors, card components

README / setup instructions (how to configure Canva credentials, environment variables, deploy to Vercel)

Sample Canva Brand Template with documented placeholder field names

Zapier recipe (instructions or exported Zap) to push PDF to Google Drive

13. Environment Variables (example)
ini
Copy
Edit
CANVA_CLIENT_ID=
CANVA_CLIENT_SECRET=
CANVA_REDIRECT_URI=https://your-deploy.vercel.app/auth/callback
PERPLEXITY_API_KEY=
ZAPIER_SECRET= (if validating inbound webhooks)
GOOGLE_DRIVE_WEBHOOK_URL= (if pushing)
Would you like me to convert this into a shareable markdown file or scaffold the initial Next.js project structure and sample API routes for Canva + Perplexity integration?