# MVP Checklist – Above + Beyond AI Website

The goal of this checklist is to deliver a **Next.js dashboard site hosted on Vercel** whose only fully-functional page will eventually be the **“Itinerary Creator.”**  
**Phase 1** (design-only) focuses purely on UI/UX—no backend or API wiring. We will not proceed to Phase 2 until design is approved.

> Convention: Each task is prefixed with a checkbox. Mark as `[x]` when complete.

---

## Phase 1 – UI Design & Front-End Scaffolding (No Functionality)

### 1. Project Setup

- [ ] **Create repo & scaffold** with `npx create-next-app@latest above-beyond-ai --typescript --app`
- [ ] **Install & configure** Tailwind CSS, shadcn/ui, `next/font` (Jakarta Sans)
- [ ] **Add dev tooling**: ESLint, Prettier, Husky pre-commit

### 2. Design System & Styles

- [ ] Define colour palette (black background, gold/cream accents)
- [ ] Configure Tailwind theme tokens (colours, font family, spacing, rounded)
- [ ] Create reusable components: `Button`, `Card`, `Heading`, `Input`, `Sidebar`, `StatusStepper`
- [ ] Global CSS reset + dark premium theme

### 3. Global Layout & Navigation

- [ ] `/app/layout.tsx` with font provider + Tailwind imports
- [ ] **Sidebar UI**: logo, “Above + Beyond AI”, menu items (Itinerary Creator, Upcoming Events, Cases, Upgrades, Contact, Profile)
- [ ] Responsive behaviour: collapsible sidebar on ≤1024 px
- [ ] `/app/page.tsx` dashboard landing – placeholder hero/card grid

### 4. Itinerary Creator Page (Static Mock)

- [ ] `/app/itinerary/page.tsx` with static **Lead Brief Form** (inputs only—no submission)
- [ ] Mock **StatusStepper** showing stages: Researching → Populating → Exporting → Ready (disabled)
- [ ] Static **Itinerary Option Cards** with placeholder images/text
- [ ] Styling: grid layout, typography hierarchy, hover states, focus rings

### 5. Accessibility & QA

- [ ] Ensure colour contrast meets WCAG AA
- [ ] Keyboard-navigable components (Tab order, focus styles)
- [ ] Screen-reader labels for form fields & sidebar links

### 6. Design Sign-off

- [ ] Deploy static site preview to Vercel (no env vars needed)
- [ ] Collect feedback → iterate until **design approved** by stakeholder

> **Gate:** Phase 2 begins only after UI/UX sign-off.

---

## Phase 2 – Functionality & Integrations (Post-Approval)

### 7. Environment & Folder Structure

- [ ] Add `.env.example` (`CANVA_CLIENT_ID`, `CANVA_CLIENT_SECRET`, `CANVA_REDIRECT_URI`, `PERPLEXITY_API_KEY`, `SESSION_SECRET`)
- [ ] `/lib/` utilities: `perplexity.ts`, `canva.ts`, `prompt.ts`, `oauth.ts`
- [ ] API routes:  
  - `/app/api/create-itinerary/route.ts` (orchestrator)  
  - `/app/api/auth/canva/start` & `/callback`  
  - `/app/api/canva/apply`

### 8. Backend / Server Logic

- [ ] **Perplexity integration** – structured prompt, parse response
- [ ] **Canva OAuth & template autofill/export** – get PDF URL
- [ ] **Create-Itinerary orchestrator** – combine both, return `{pdfUrl, previews[]}`
- [ ] Error handling, retries, logging

### 9. Front-End Wiring

- [ ] Hook form submission → `POST /api/create-itinerary`
- [ ] Live StatusStepper updates via polling or SSE
- [ ] Replace static cards with real data & download links
- [ ] Basic history list (optional)

### 10. Testing & Deployment

- [ ] Cypress/Playwright smoke test: fill form → wait for Ready → assert PDF link
- [ ] Add environment vars in Vercel dashboard, protect `main` branch

---

### Phase 1 Acceptance Criteria

- Entire UI is responsive, on-brand, and passes a11y checks.  
- Static itinerary creator page accurately represents final look & feel.  
- Deployed preview on Vercel reviewed and approved.

### Phase 2 Acceptance Criteria (MVP)

- User generates itineraries and downloads PDF within ≈30 s.  
- Site passes Lighthouse & a11y (>90).  
- Non-implemented pages show “Coming Soon.”
