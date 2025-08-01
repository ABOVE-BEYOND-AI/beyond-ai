import { NextRequest } from "next/server";

export const runtime = "edge"; // enables streaming on Vercel Edge

interface ItineraryRequest {
  destination: string;
  departureCity: string;
  guests: string;
  startDate?: string;
  endDate?: string;
  budgetFrom: string;
  budgetTo: string;
  additionalOptions: string[];
  numberOfOptions?: number;
}

function buildPrompt(data: ItineraryRequest): string {
  const {
    destination,
    departureCity,
    guests,
    startDate,
    endDate,
    budgetFrom,
    budgetTo,
    additionalOptions,
    numberOfOptions = 3
  } = data;

  const dateRange = startDate && endDate 
    ? `${startDate} – ${endDate}` 
    : "Flexible dates";

  const optionsList = additionalOptions.length > 0 
    ? additionalOptions.join(", ") 
    : "None specified";

  return `Create ${numberOfOptions} detailed, realistic, luxury travel itinerary ${numberOfOptions === 1 ? 'option' : 'options'} for: Destination: ${destination}, From: ${departureCity}, Dates: ${dateRange}, Budget: £${budgetFrom}–£${budgetTo}, ${guests} guests. Format as an expert travel planner with actual hotels, real-world pricing, and detailed summaries. Follow this EXACT structure:

## Trip Overview
- **Title**: [Destination, Dates]
- **Location**: [Specific location details]
- **Hotel/Resort Options**: ${numberOfOptions} luxury family-friendly hotels with overview and amenities
- **Room Types**: Different accommodation options
- **Travel Dates**: ${dateRange}
- **Ground Transportation**: Private transfers and local transport options
- **Kids Clubs**: Age-specific supervised programs
- **Flights**: Airlines, departure/arrival times, economy and business class options

## Why This Trip
- 2-4 bullet points highlighting the best features of the destination and hotels
- Focus on what's exciting or luxurious for families

## Accommodation Details
Present this as a proper markdown table:

| Resort | Room Type | Size (m²) | Key Features | Views |
|--------|-----------|-----------|--------------|-------|
| Hotel Name 1 | Room Type | Size | Features | View Type |
| Hotel Name 2 | Room Type | Size | Features | View Type |

## Optional Extras / Kids Club Highlights
- **Ages 3-6**: Specific activities and programs
- **Ages 7-12**: Activities and programs  
- **Ages 13-17**: Teen programs
- **Additional Services**: Babysitting, private tours, etc.

## Images
- [Placeholder: Resort exterior]
- [Placeholder: Family room interior]
- [Placeholder: Kids club activities]

## Total Cost (GBP) + 10% Service Fee
Present this as a proper markdown table:

| Component | Cost Range |
|-----------|------------|
| Flights (Economy) | £X,XXX - £X,XXX |
| Accommodation | £X,XXX - £X,XXX |
| Transfers | £XXX - £XXX |
| 10% Service Fee | £XXX - £XXX |
| **Total** | **£X,XXX - £X,XXX** |

IMPORTANT: 
- Research the SPECIFIC destination requested: ${destination}
- Use real, current hotel and pricing information for ${destination}
- Ensure all tables use proper markdown formatting with | separators
- Do NOT mention other destinations unless specifically relevant
- Do NOT mention search results, citations, or sources in the final answer

Request Details:

Destination: ${destination}
Departure City: ${departureCity}
Travel Dates: ${dateRange}
Guests: ${guests}
Budget Range: £${budgetFrom} – £${budgetTo}
Additional Options / Amenities: ${optionsList}`;
}

export async function POST(req: NextRequest) {
  try {
    const body: ItineraryRequest = await req.json();
    
    // Basic validation
    if (!body.destination || !body.departureCity || !body.guests) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: destination, departureCity, or guests" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const prompt = buildPrompt(body);
    
    console.log("Generated prompt for destination:", body.destination);
    console.log("Prompt preview:", prompt.substring(0, 200) + "...");
    
    // Check for API key
    const apiKey = process.env.PPLX_KEY;
    if (!apiKey) {
      console.error("Missing PPLX_KEY environment variable");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log("Sending request to Perplexity API...");
    console.log("Model: sonar-deep-research (expecting 30-90 second response time)");
    
    const perplexityRes = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "sonar-deep-research",
        messages: [
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!perplexityRes.ok) {
      console.error("Perplexity API error:", perplexityRes.status, perplexityRes.statusText);
      const errorText = await perplexityRes.text();
      console.error("Error details:", errorText);
      
      return new Response(
        JSON.stringify({ 
          error: `Perplexity API error: ${perplexityRes.status} ${perplexityRes.statusText}` 
        }),
        { status: perplexityRes.status, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get the full response from Perplexity
    const responseData = await perplexityRes.json();
    const content = responseData.choices[0]?.message?.content || '';
    
    // Return the content as a simple JSON response
    return new Response(JSON.stringify({ content }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });

  } catch (error) {
    console.error("API route error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Handle preflight requests
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}