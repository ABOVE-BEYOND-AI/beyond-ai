import OpenAI from 'openai';

export function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

export interface RefinedItineraryOption {
  title_main: string;
  facts: string;
  overview: string;
  why_trip: string;
  room_details: string;
  room_details2: string;
  extra1: string;
  extra2: string;
  cost_list: string;
  total_cost: string;
}

export interface RefinedItineraryData {
  trip_destination: string;
  trip_dates: string;
  option1: RefinedItineraryOption;
}

export async function refineItineraryWithGPT(rawItinerary: string, destination: string, dates: string): Promise<RefinedItineraryData> {
  const openai = getOpenAIClient();
  
  const prompt = `You are a luxury travel copywriter. Your task is to rewrite the following raw itinerary content into polished, professional presentation text that fits within specific character limits.

IMPORTANT REQUIREMENTS:
- Keep text concise and impactful
- Use warm, inspiring, professional tone
- Focus on luxury and exclusivity
- Follow character limits strictly
- Return valid JSON only

CHARACTER LIMITS:
- title_main: ≤ 60 chars
- facts: ≤ 400 chars (6-7 lines, each ≤ 80 chars)
- overview: ≤ 800 chars
- why_trip: ≤ 900 chars  
- room_details: ≤ 500 chars
- room_details2: ≤ 350 chars
- extra1: ≤ 600 chars
- extra2: ≤ 600 chars
- cost_list: ≤ 300 chars (bullet points, each ≤ 60 chars)
- total_cost: ≤ 45 chars

DESTINATION: ${destination}
DATES: ${dates}

RAW ITINERARY CONTENT:
${rawItinerary}

Return JSON in this exact format:
{
  "trip_destination": "${destination}",
  "trip_dates": "${dates}",
  "option1": {
    "title_main": "Hotel/Resort Name",
    "facts": "Location: Place\\nDates: ${dates}\\nHotel: Name\\nRoom: Type\\nFlights: Airline Route\\nGround: Transport type",
    "overview": "Compelling overview paragraph highlighting the key experience...",
    "why_trip": "Detailed explanation of why this destination and hotel are perfect...",
    "room_details": "Description of accommodation features and amenities...",
    "room_details2": "Additional room details and special features...",
    "extra1": "Optional activities, experiences, or services available...",
    "extra2": "Additional extras, dining, spa, or unique experiences...",
    "cost_list": "• Flights: £X,XXX–X,XXX\\n• Accommodation: £X,XXX–X,XXX\\n• Transfers: £XXX–XXX\\n• Service Fee: £XXX–XXX",
    "total_cost": "TOTAL: £XX,XXX – £XX,XXX"
  }
}`;

  try {
    console.log('🤖 Calling ChatGPT-4o for text refinement...');
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a professional luxury travel copywriter. Always return valid JSON matching the exact schema provided.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: 'json_object' }
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content received from ChatGPT-4o');
    }

    console.log('✅ ChatGPT-4o refinement complete');
    
    // Parse and validate the JSON response
    const refinedData: RefinedItineraryData = JSON.parse(content);
    
    // Basic validation
    if (!refinedData.option1 || !refinedData.trip_destination) {
      throw new Error('Invalid JSON structure from ChatGPT-4o');
    }
    
    return refinedData;
    
  } catch (error) {
    console.error('❌ Error refining itinerary with ChatGPT-4o:', error);
    throw new Error(`GPT refinement failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}