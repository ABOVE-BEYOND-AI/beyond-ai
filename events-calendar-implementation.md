# Events Calendar – Implementation Plan

## 1) Goals
- Build a visual, beautiful, captivating events calendar with strong UX and performance.
- Keep data up-to-date and easy to maintain via admin UI and/or CSV import.
- Reuse Tailwind + shadcn and Framer Motion for a cohesive look and feel.
- Wire the existing sidebar item "Upcoming Events" to the new calendar page.

## 2) Source of Truth and Data Flow
- Initial seed: the CSV `2025 Event Calendar - Copy of NEWER Event Calendar Programatic SEO.csv`.
- Normalized storage: Upstash Redis (same as Sales) for low-latency queries.
- Ongoing updates:
  - Admin UI: add/edit/delete events.
  - CSV Import API: upload CSVs to refresh/append data.
- Optional (Phase 2): Google Sheet or lightweight CMS integration.

## 3) Data Model
Fields from CSV:
- Name
- Start Date (mixed formats: DD/MM/YYYY or YYYY-MM-DD)
- End Date (mixed formats)
- Event Location
- Description
- Category (Theatre, Rugby, Formula 1, Concerts, etc.)

Normalized TypeScript interface:

```
export interface EventItem {
  id: string;            // event_<uuid>
  name: string;
  startDate: string;     // ISO (UTC) 00:00:00
  endDate: string;       // ISO (UTC) 23:59:59 inclusive
  location: string;
  description: string;
  category: string;      // normalized slug, e.g. formula-1
  created_at: string;
  updated_at: string;
}
```

Redis keys:
- `events:all` → set of all event IDs
- `event:<id>` → JSON for an event
- `events:category:<slug>` → set of event IDs in a category (optional index)
- `events:byDate:<YYYY-MM>` → set of event IDs in that month (optional index)

## 4) CSV Ingestion and Date Parsing
- Move CSV to `data/events-2025.csv` (rename to remove spaces to avoid path issues).
- Server import script parses CSV and POSTs to our API:
  - Use `csv-parse` or `papaparse` (Node).
  - Parse dates with `date-fns`, try formats: `dd/MM/yyyy`, `d/M/yyyy`, `yyyy-MM-dd`.
  - Normalize to ISO UTC: start at 00:00:00Z, end at 23:59:59Z (inclusive range for multi-day events).
  - Trim/sanitize fields; skip duplicate header lines found mid-file.
  - Category normalization: lower-case, spaces → hyphens (e.g. "Formula 1" → `formula-1`).
- API endpoint `POST /api/events/import` accepts CSV upload (multipart) or JSON list; admin-only via `x-admin-secret`.

## 5) Events API
- `GET /api/events` (list)
  - Query: `month=YYYY-MM`, `category=slug`, `q=search`, `limit`, `offset`
- `GET /api/events/:id`
- `POST /api/events` (admin)
- `PUT /api/events/:id` (admin)
- `DELETE /api/events/:id` (admin)
- `POST /api/events/import` (admin)
- `GET /api/events/ics` (Phase 2: ICS feed for calendar apps)

Security:
- Require Google auth + admin allowlist for writes; fallback `x-admin-secret` for scripts.

## 6) Calendar UI – `/events`
- Route: `app/events/page.tsx`
- Views:
  - Month grid (primary): category color accents, hover cards, gradients.
  - List view toggle: chronological list for accessibility and scanning.
  - Filters: category pill chips.
  - Search: fuzzy across name/location/description.
  - Date selector: month switcher and Today.
- Components:
  - `EventMonthGrid`: render weeks; span multi-day events across days.
  - `EventCard`: hover/focus popover with description + CTA.
  - `EventFilters`: categories, search, month controls.
- Visual polish: Framer Motion transitions, dark-mode aware, category legend.
- Responsive: mobile defaults to list; desktop supports grid + list toggle.

Accessibility:
- Keyboard nav for grid cells.
- ARIA labels; color is not the only indicator.

Performance:
- Paginate list view.
- Server fetch via `/api/events`; cache with short revalidation.

## 7) Sidebar Wiring
- Update `components/sidebar.tsx` navigation to link "Upcoming Events" to `/events` and set `active: true`.

## 8) Admin Management UI (Phase 1.5)
- Route: `app/events/admin/page.tsx` (restricted)
  - New Event form: name, dates, location, description, category.
  - CSV Import: upload to `/api/events/import`.
  - Table with edit/delete.

## 9) Implementation Steps
Phase 1 – Backend
1. Add `EventItem` to `lib/types.ts`. ✅
2. Create `lib/events-database.ts`: `saveEvent`, `getEvent`, `listEvents`, `deleteEvent`, `updateEvent`, list by month/category; build indexes. ✅
3. Implement API routes in `app/api/events/` per Section 5. ✅
   - `GET /api/events` ✅
   - `POST /api/events` (admin) ✅
   - `GET /api/events/[id]` ✅
   - `PUT /api/events/[id]` (admin) ✅
   - `DELETE /api/events/[id]` (admin) ✅
4. Implement `POST /api/events/import` (JSON for now; CSV multipart later); admin-only. ✅
5. Create `scripts/import-events-2025.js` to parse `data/events-2025.csv` and POST events. (pending)

Phase 2 – UI
6. Build `/events` page (grid + list + filters + search). – Basic list scaffold added ✅
7. Category legend and color mapping. (pending)
8. Hover/expand cards with CTAs. (pending)
9. Responsive layouts. (pending)
10. Wire sidebar entry to `/events`. ✅

## 10) CSV Notes from Provided File
- Mixed date formats present; must parse both.
- Duplicate header rows mid-file; skip.
- Fields contain commas/quotes; use a real CSV parser.
- Categories include: Theatre, Rugby, Formula 1, Concerts, Experiences, Dining, Golf, Fashion, Motorsport, Music, Tennis, Festival, Rowing & Sailing, American Football, Horse Racing, Football.

Parsing rules:
- Try formats: `dd/MM/yyyy`, `d/M/yyyy`, `yyyy-MM-dd`.
- If end date is missing or < start, set end = start.
- Normalize to ISO; store inclusive end at 23:59:59Z.

## 11) Category Colors
- formula-1: red-500
- football: emerald-500
- rugby: violet-500
- theatre: pink-500
- concerts: indigo-500
- motorsport: amber-500
- horse-racing: lime-500
- golf: teal-500
- dining: rose-500
- experiences: sky-500
- tennis: green-500
- festival: fuchsia-500
- fashion: cyan-500
- music: purple-500
- rowing-sailing: blue-500

## 12) QA and Testing
- Unit test CSV normalization and date parsing with examples from the file.
- Snapshot test Month grid and List views.
- Manual keyboard testing and screen reader checks.

## 13) Deliverables
- `lib/events-database.ts`
- `app/api/events/*`
- `scripts/import-events-2025.js`
- `app/events/page.tsx`
- `app/events/admin/page.tsx` (phase 1.5)
- Sidebar link updated to `/events`

## 14) Rollout Plan
1. Backend + DB helpers → deploy.
2. Import CSV in staging; spot-check.
3. Build `/events` UI behind feature flag; QA.
4. Enable sidebar link; launch.
5. Add admin CSV import and form for ongoing updates.
