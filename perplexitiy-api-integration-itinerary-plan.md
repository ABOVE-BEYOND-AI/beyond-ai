# 📑 Perplexity API Integration – Itinerary Creator (Phase-2 Functionality)

> Goal: When a user clicks **“Create itinerary”** the form data is sent to Perplexity AI, an AI-assistant with live-search, to generate a day-by-day luxury travel plan.  
> The response is streamed back and rendered in the UI (right-hand side panel).

---

## 1. Architecture Overview

```
[Client] ──►  /api/itinerary  ──►  Perplexity API
  │                 │                   │
  │   (SSE Stream)  ◄────────────────────┘
  ▼
 UI updates in real-time (React / SWR / useEffect)
```

1. **Client (Itinerary page)** – Collects form data, calls our own Next.js API route via `fetch()` with `POST`.
2. **Next.js Route Handler** `/api/itinerary` – Server code running on Vercel:
   * Builds a rich prompt from form fields.
   * Sends the request to Perplexity API with the secret key (env var).
   * Streams the response back to the browser using Server-Sent Events (SSE).
3. **Perplexity API** – Processes the query and returns markdown / JSON text describing the trip.
4. **Client Stream Consumer** – Renders chunks into the _results_ panel with typing animation + progress stepper.

---

## 2. Perplexity API Basics

| Item | Value |
|------|-------|
| Base URL | `https://api.perplexity.ai` |
| Endpoint | `v1/chat/completions` |
| Method | `POST` |
| Auth | `Authorization: Bearer <PPLX_API_KEY>` |
| Content-Type | `application/json` |
| Model | `sonar-reasoning-pro` (advanced multi-step reasoning, 128K ctx) |
| Streaming | `stream: true` |

**Minimal body**
```jsonc
{
  "model": "sonar-reasoning-pro",
  "stream": true,
  "messages": [
    { "role": "system", "content": "You are a world-class luxury travel planner..." },
    { "role": "user",   "content": "<composed prompt from form>" }
  ]
}
```

Perplexity streams data as **Server-Sent Events** chunks ending with `[DONE]`.

### 2.1 Special Notes for `sonar-reasoning-pro`

* This model prepends a `<think>` section containing chain-of-thought reasoning tokens **before** the actual answer.
* The JSON or markdown we need comes **after** the `<think>` block. On the client we will:
  * Buffer stream chunks until we detect the first `</think>` newline.
  * Discard the `<think>` content (or optionally keep for debugging).
  * Append the remaining tokens to the visible output area.
* We set `response_format` normally, but Perplexity docs state it will **not** remove `<think>` for this model, so the custom parser is mandatory.
* Example cURL:
  ```bash
  curl -X POST https://api.perplexity.ai/chat/completions \
       -H 'Authorization: Bearer $PPLX_KEY' \
       -H 'Content-Type: application/json' \
       -d '{
         "model": "sonar-reasoning-pro",
         "stream": true,
         "messages": [{"role":"user","content":"Your prompt..."}]
       }'
  ```
* Pricing (@ 2025-08): $2 /1M input tokens, $8 /1M output tokens. Keep prompts concise.

---

## 3. Prompt Construction

Template (filled server-side):
```
3-5 Options. For each option, follow this structure:

Trip Overview
- Title: [Destination, Dates]
- Location
- 3-5 Hotel/Resort options with overview and amenities.
- Room Types
- Travel Dates, private ground transportation options, transfers to and from hotel, kids clubs/creche kids clubs
- Flights (Airline, Departure + Arrival Times), give options for different times and dates
- Economy Class to start with, quote upgrades for business class etc

Why This Trip
- 2–4 bullet points highlighting the best features of the destination and hotel (based on the description). Focus on what's exciting or luxurious for families.

Accommodation Details
- For each room: room type, size in m², key features, and views.

Optional Extras / Kids Club Highlights
- Bullet-point breakdown of available clubs by age group with key activities.
- Any extra childcare or special service options.

Images
- placeholder images

Total Cost (in GBP) + note 10% service fee
- breakdown of the entire package in bullet copy on the left, price on the right

---

Think deeply and use your full capabilities to make this to the highest quality standard as possible. Make sure all of the information is correct and up to date.

Use this exact format to generate the research for the following request:

Destination: <DESTINATION>
Departure City: <FROM>
Travel Dates: <START_DATE> – <END_DATE>
Guests: <GUESTS>
Budget Range: £<FROM_BUDGET> – £<TO_BUDGET>
Additional Options / Amenities: <OPTION_LIST>
```

The server will interpolate the `<...>` placeholders with the user’s form input before sending the prompt to Perplexity.

---

## 4. Backend Implementation (Next.js 14 / App Router)

### 4.1 Route Handler – `/app/api/itinerary/route.ts`
```ts
import { NextRequest } from "next/server";
export const runtime = "edge"; // enables streaming on Vercel Edge

export async function POST(req: NextRequest) {
  const body = await req.json();
  // TODO: validate & sanitize
  const prompt = buildPrompt(body);

  const perplexityRes = await fetch("https://api.perplexity.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.PPLX_KEY}`,
    },
    body: JSON.stringify({
      model: "sonar-reasoning-pro",
      stream: true,
      messages: [
        { role: "system", content: "You are a world-class luxury travel planner." },
        { role: "user", content: prompt },
      ],
    }),
  });

  return new Response(perplexityRes.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}
```
*Edge runtime gives us low-latency streaming.*

### 4.2 Environment Variable
```
# .env.local (never commit)
PPLX_KEY=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
```

---

## 5. Front-End Consumption

1. On **form submit** disable the button and call `/api/itinerary` with `fetch()` and `EventSource`-like streaming helper.
2. Append chunks to React state: `setOutput(prev => prev + chunk)`.
3. Display inside a scrollable card on the right (reuse existing status-stepper for visual progress).
4. When `[DONE]` received, mark stepper as "Ready" and enable **Download PDF**.

**Hook skeleton**
```ts
const useItinerary = (payload) => {
  const [data, setData] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/itinerary", { method: "POST", body: JSON.stringify(payload), signal: controller.signal })
      .then(res => {
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        async function read() {
          const {done, value} = await reader.read();
          if (done) return setDone(true);
          setData(prev => prev + decoder.decode(value));
          read();
        }
        read();
      });
    return () => controller.abort();
  }, [payload]);

  return { data, done };
};
```

---

## 6. Security & Rate Limits

* **NEVER expose** the raw API key to the browser – only server route uses env var.
* Consider a minimal allow-list of domains in Perplexity dashboard.
* Add basic per-IP rate limiting (Next.js middleware or Vercel KV).

---

## 7. Error Handling

| Layer | Action |
|-------|--------|
| API Route | Return `500` with JSON `{error}`; stream `event: error` for SSE |
| Client | Show toast notification + reset button |
| Stepper | Highlight failed step in red |

---

## 8. Future Enhancements

1. **Caching** – Redis/Vercel KV for identical requests within 24h.
2. **Vector store** – Chunk the response & store for quick re-render.
3. **Multi-city** support – iterate multiple prompts & merge.
4. **PDF generation** – Use `@vercel/og` + `pdf-lib` once content is ready.

---

## 9. Milestones

1. ✅ Write integration plan (this doc).
2. 🔄 Scaffold `/api/itinerary` route & env handling.
3. 🔄 Streaming hook + right-panel UI.
4. 🔄 End-to-end test with real API key.
5. 🔄 Deploy to Vercel & monitor logs.
