import { NextRequest } from "next/server";

// Removed edge runtime - using Node.js runtime for longer timeout (5 minutes vs 25 seconds)
// export const runtime = "edge"; // enables streaming on Vercel Edge

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

async function extractHotelNames(content: string, body: ItineraryRequest): Promise<string[]> {
  try {
    console.log("Content preview for hotel extraction:", content.substring(0, 500) + "...");
    
    // Extract hotel names using multiple patterns to match the new AI output format
    const hotelNames: string[] = [];
    
    // Pattern 1: From accommodation details - "Hotel: [Name]"
    const hotelPattern1 = /\*\*Hotel\*\*:\s*([^\n]+)/g;
    let match;
    
    while ((match = hotelPattern1.exec(content)) !== null) {
      let name = match[1]?.trim();
      if (name) {
        name = name
          .replace(/\s*[\-–]\s*[Aa]\s+(luxury|premier|five[- ]star|renowned|award[- ]winning|flagship).*$/, '')
          .replace(/\s*[,;]\s*.*$/, '')
          .replace(/\s+/g, ' ')
          .trim();
        
        if (name.length >= 5 && name.length <= 100 && /[A-Za-z]/.test(name)) {
          hotelNames.push(name);
        }
      }
    }
    
    // Pattern 2: From trip overview - "**Hotel/Resort**: [Name]"
    const hotelPattern2 = /\*\*Hotel\/Resort\*\*:\s*([^—\n]+)/g;
    while ((match = hotelPattern2.exec(content)) !== null) {
      let name = match[1]?.trim();
      if (name) {
        name = name
          .replace(/\s*[\-–]\s*[Aa]\s+(luxury|premier|five[- ]star|renowned|award[- ]winning|flagship).*$/, '')
          .replace(/\s*[,;]\s*.*$/, '')
          .replace(/\s+/g, ' ')
          .trim();
        
        if (name.length >= 5 && name.length <= 100 && /[A-Za-z]/.test(name)) {
          hotelNames.push(name);
        }
      }
    }
    
    // Pattern 3: Extract from option titles - "Option X: [Hotel Name], [Location]"
    const titlePattern = /Option \d+:\s*([^,\n]+)/g;
    while ((match = titlePattern.exec(content)) !== null) {
      let name = match[1]?.trim();
      if (name) {
        name = name
          .replace(/\s*[\-–]\s*[Aa]\s+(luxury|premier|five[- ]star|renowned|award[- ]winning|flagship).*$/, '')
          .replace(/\s+/g, ' ')
          .trim();
        
        if (name.length >= 5 && name.length <= 100 && /[A-Za-z]/.test(name)) {
          hotelNames.push(name);
        }
      }
    }

    // Remove duplicates and return unique hotel names
    const uniqueNames = [...new Set(hotelNames)];
    console.log("Extracted hotel names:", uniqueNames);
    console.log("Total unique hotel names found:", uniqueNames.length);
    
    return uniqueNames;
  } catch (error) {
    console.error("Error extracting hotel names:", error);
    return [];
  }
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

  return `You are an expert luxury travel planner. Create ${numberOfOptions} detailed travel itinerary ${numberOfOptions === 1 ? 'option' : 'options'} for the following request:

**Client Request:**
- Destination: ${destination}
- From: ${departureCity}
- Travel dates: ${dateRange}
- Number of guests: ${guests}
- Budget: £${budgetFrom}–£${budgetTo}
- Special requirements: ${optionsList}

**CRITICAL FORMATTING RULES:**
1. Use clear, proper markdown formatting throughout
2. Use bullet points with bold labels for structured information
3. Write in complete, coherent sentences
4. No truncated or garbled text
5. Each section must be complete and well-formatted

Follow this EXACT structure for ${numberOfOptions === 1 ? 'the itinerary' : 'EACH option'}:

## Trip Overview
Write a clear overview with these elements:
- **Title**: [Destination Name], [Full Date Range]
- **Location**: Specific area/region within the destination
- **Hotel/Resort**: Name and brief description of the recommended hotel
- **Room Type**: Specific room category recommended
- **Travel Dates**: ${dateRange}
- **Ground Transportation**: Describe private transfer options
- **Kids Clubs**: Available children's programs (if family travel)
- **Flights**: Specific airlines and routes from ${departureCity}

## Why This Trip
Write 3-4 complete bullet points explaining why this destination and hotel are perfect for the client. Focus on:
- Unique destination features
- Hotel luxury amenities
- Family-friendly aspects (if applicable)
- Value for money within budget

## Accommodation Details
Present accommodation information in a clear bullet-point format:
- **Hotel**: [Full hotel name]
- **Room Type**: [Specific room type]
- **Size**: [Size] m²
- **Key Features**: [List 3-4 key features separated by commas]
- **Views**: [View type]

## Optional Extras / Kids Club Highlights
For family trips, list age-appropriate activities:
- **Ages 3-6**: [Specific activities]
- **Ages 7-12**: [Specific activities]  
- **Ages 13-17**: [Teen programs]
- **Additional Services**: [List services like babysitting, tours, etc.]

## Total Cost (GBP) + 10% Service Fee
Present costs in a clean, readable format:

**Cost Breakdown:**
- **Flights (Business Class):** £[amount] - £[amount]
- **Accommodation ([nights] nights):** £[amount] - £[amount] 
- **Transfers:** £[amount] - £[amount]
- **10% Service Fee:** £[amount] - £[amount]
- **TOTAL:** £[amount] - £[amount]

**ADDITIONAL REQUIREMENTS:**
1. Write in clear, professional English with no truncated words
2. Ensure all content is complete - no cut-off sentences
3. Use consistent bullet-point formatting for structured information
4. Use real hotel names and accurate pricing for ${destination}
5. All costs should be realistic and add up correctly
6. Business class options should be included where budget allows
7. Images will be automatically sourced for hotels - do not include any image-related content or sections

${numberOfOptions > 1 ? `
**FOR MULTIPLE OPTIONS:**
When creating ${numberOfOptions} options, ensure each one is:
- Distinctly different (different hotels/areas)
- Complete with all sections
- Clearly separated with proper headings
- Numbered as Option 1, Option 2, etc.
` : ''}

Remember: The client is looking for luxury travel options from ${departureCity} to ${destination} for ${guests} guests with a budget of £${budgetFrom}-£${budgetTo}.`;
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
    console.log("Model: sonar-pro (advanced search with enhanced results)");
    console.log("Runtime: Node.js (5 minute timeout)");
    
    const startTime = Date.now();
    const perplexityRes = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "sonar-pro",
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
          error: `Perplexity API error: ${perplexityRes.status} ${perplexityRes.statusText}`,
          details: errorText 
        }),
        { status: perplexityRes.status, headers: { "Content-Type": "application/json" } }
      );
    }

    // Parse the JSON response from Perplexity Sonar Pro
    let responseData;
    try {
      responseData = await perplexityRes.json();
    } catch (parseError) {
      console.error("Failed to parse JSON response:", parseError);
      return new Response(
        JSON.stringify({ error: "Invalid JSON response from Perplexity API" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`Perplexity API response received in ${duration}ms (${(duration/1000).toFixed(1)}s)`);
    console.log("Usage:", responseData.usage);
    
    // Extract content from the response
    const content = responseData.choices?.[0]?.message?.content || '';
    const searchResults = responseData.search_results || [];
    const images = responseData.images || [];
    
    if (!content) {
      console.error("No content in response:", responseData);
      return new Response(
        JSON.stringify({ error: "No content received from Perplexity API" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    
    console.log(`Generated ${content.length} characters of content`);
    console.log(`Found ${searchResults.length} search results`);
    console.log(`Found ${images.length} images from Perplexity`);
    
    // Extract hotel names from content and fetch images
    const hotelNames = await extractHotelNames(content, body);
    console.log(`Extracted ${hotelNames.length} hotel names for image search`);
    
    // Fetch images for each hotel directly from Google API
    const hotelImages = await Promise.all(
      hotelNames.map(async (hotelName) => {
        try {
          // Get API credentials from environment
          const apiKey = process.env.GOOGLE_API_KEY;
          const searchEngineId = process.env.GOOGLE_CSE_ID;

          if (!apiKey || !searchEngineId) {
            console.error(`❌ Missing Google API credentials for ${hotelName}`);
            return {
              hotelName,
              imageUrl: null,
              contextLink: null
            };
          }

          // Build the Google Custom Search API URL with just hotel name and location
          const query = encodeURIComponent(`${hotelName} ${body.destination}`);
          const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${query}&searchType=image&num=1&safe=active`;

          console.log(`🌐 Calling Google Custom Search API for: "${hotelName}"`);

          // Call Google Custom Search API directly
          const response = await fetch(searchUrl);
          
          if (!response.ok) {
            console.error(`❌ Google API error for ${hotelName}: ${response.status} ${response.statusText}`);
            return {
              hotelName,
              imageUrl: null,
              contextLink: null
            };
          }

          const data = await response.json();
          
          // Extract the first image URL if available
          let imageUrl: string | null = null;
          let contextLink: string | null = null;
          
          if (data.items && data.items.length > 0) {
            imageUrl = data.items[0].link;
            contextLink = data.items[0].image?.contextLink || null;
            console.log(`✅ Found image for "${hotelName}": ${imageUrl}`);
          } else {
            console.log(`❌ No images found for "${hotelName}"`);
          }

          return {
            hotelName,
            imageUrl,
            contextLink
          };
        } catch (error) {
          console.error(`Error fetching image for ${hotelName}:`, error);
          return {
            hotelName,
            imageUrl: null,
            contextLink: null
          };
        }
      })
    );
    
    console.log(`Successfully fetched ${hotelImages.filter(img => img.imageUrl).length}/${hotelImages.length} hotel images`);
    
    // Return the content and hotel images for frontend processing
    return new Response(JSON.stringify({ 
      content,
      searchResults,
      images: hotelImages,  // Send hotel images array with URLs from Google
      usage: responseData.usage 
    }), {
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