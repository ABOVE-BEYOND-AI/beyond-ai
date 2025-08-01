1. High-Level Flow
User fills out the lead brief on your Next.js “Above + Beyond AI” site.

Backend composes the structured prompt and calls Perplexity Labs API to get 3–5 itinerary options.

The response is parsed into a structured JSON that matches placeholder field names.

The app uses Canva Connect API:

OAuth to obtain/refresh access token.

Apply a prebuilt Brand Template with the JSON (autofill).

Export the resulting design to PDF.

PDF is stored/temporarily hosted and shown in the dashboard for download.

(Optional) You can retain history, allow edits, or regenerate.

2. Components You Need
A. Frontend (Next.js)
Lead brief form (client name, dates, preferences, budget, etc.).

Progress/status UI (“Researching”, “Populating template”, “Exporting”, “Ready”).

Preview of generated itineraries.

Download button for the exported PDF.

Typography/styles: Jakarta Sans (titles extra-bold with tight letter spacing; body regular/light). Dark premium theme.

B. Backend (Next.js API routes on Vercel)
Perplexity integration endpoint

Accepts the brief, builds the prompt, calls Perplexity API, gets itinerary data.

Sanitizes/parses into normalized JSON.

Canva OAuth handler

Route to initiate OAuth (redirect to Canva authorize).

Callback route to exchange code for access + refresh tokens.

Token storage (in-memory for prototype or persisted in a lightweight store).

Refresh logic when access token expires.

Template apply + export endpoint

Takes structured itinerary JSON, calls Canva’s “apply brand template” endpoint with matching field names.

Requests export to PDF, handles asynchronous job status if needed.

Returns final PDF URL or streams the file.

Download / history endpoint

Serves the generated PDF(s) to the user.

Optionally persists past itineraries per client.

3. Integration Details
Perplexity Labs
Use their API to send the exact structured prompt (with dynamic substitution for the user’s brief).

Expect a verbose output; parse into:

json
Copy
Edit
{
  "trip_options": [
    {
      "trip_title": "...",
      "destination": "...",
      "hotel_options": [ { "name": "...", "summary": "...", ... } ],
      "room_details": [...],
      "transport": {...},
      "flight_options": [...],
      "why_this_trip": ["...", "..."],
      "kids_club_highlights": [...],
      "total_cost_gbp": "...",
      "service_fee_note": "10% service fee",
      "images": { "hero": "...", "hotel_1": "...", ... }
    },
    ...
  ]
}
Canva Connect API
OAuth2:

Register your integration (private/team-restricted) in Canva Developer Portal.

Scopes: design:content:write, design:content:read, brandtemplate:content:read, brandtemplate:meta:read (plus assets if you upload images).

Redirect URI should point to your deployed callback (e.g., https://yourapp.vercel.app/auth/callback).

Brand Template:

In Canva, create the template with named placeholders matching your JSON keys (e.g., trip_title, hotel_1_name, hero_image).

For images use image frames with identifiers.

Autofill:

POST to the apply endpoint with the mapped variables.

Receive a new design ID.

Export:

POST an export request for PDF.

Poll if asynchronous, then retrieve the downloadable asset.

4. UX & Design Requirements
Dashboard layout: Left sidebar (Itinerary Creator top item), main panel with brief form and generation results.

Typography: Jakarta Sans, titles extra-bold tight tracking, body light/regular.

Status indicator: Show each pipeline step.

Itinerary cards: Display each option, cost breakdown (copy left, price right), placeholders for images if not yet available.

Download: Single-click PDF download after export.

5. Security & Operational
Store Canva tokens securely (env vars / in-memory or DB with encryption).

Validate and sanitize all input.

Handle Perplexity API failures with retries/backoff and user-friendly error messages.

Gracefully handle Canva export delays (show spinner, update status).

Optionally protect routes (simple auth if multiple users later).

6. Environment Variables
ini
Copy
Edit
CANVA_CLIENT_ID=
CANVA_CLIENT_SECRET=
CANVA_REDIRECT_URI=https://your-deploy.vercel.app/auth/callback
PERPLEXITY_API_KEY=
SESSION_SECRET= (if using session/state for OAuth)
7. Example Minimal Endpoint Flow
POST /api/create-itinerary

Receives brief → calls Perplexity → gets structured JSON → calls /api/canva/apply → triggers export → returns PDF URL.

GET /api/auth/canva/start

Redirects to Canva consent.

GET /api/auth/canva/callback

Exchanges code for tokens, stores them.

POST /api/canva/apply

Applies template, exports PDF.

8. Optional Enhancements
Preview filled design inside iframe or thumbnail.

Allow user edits to the parsed JSON before sending to Canva.

Save versions of itineraries per client.

Add a “Regenerate” button with updated parameters.

Summary
Yes—you can and should do it all in the web app. Build a thin backend (Next.js API routes) to orchestrate:

Prompting Perplexity,

Managing Canva OAuth + template autofill/export,

Serving the resulting PDF.

No Zapier required. If you want, I can now scaffold:

The Next.js API route templates (OAuth + Canva apply/export),

The Perplexity prompt integration module,

A sample mapping between the JSON and a Canva template.

Which scaffold do you want first: Canva OAuth + template fill/export or Perplexity prompt + JSON parser?