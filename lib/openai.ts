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
  
  const prompt = `You are a luxury travel copywriter creating content for a premium travel package presentation. Your task is to transform the raw itinerary into compelling, professional slide content that sells the luxury experience.

WRITING STYLE:
- Professional yet warm and inspiring tone
- Focus on luxury, exclusivity, and unique experiences
- Use sophisticated language that appeals to affluent travelers
- Highlight specific details and benefits from the raw content
- Be informative and detailed, not brief or generic
- Include line breaks (\n) where specified for better readability

CONTENT REQUIREMENTS:
- Extract ALL specific details from the raw itinerary (hotel names, amenities, costs, etc.)
- Don't invent information - use what's provided in the raw content
- Make the content compelling and sales-focused
- Use bullet points for room_details and structured formatting
- Remove "TOTAL:" prefix from total_cost - just show the price range
- Format dates elegantly: use "7th - 21st November 2025" instead of "2025-11-07 – 2025-11-21"

CHARACTER LIMITS & FORMATTING:
- title_main: ≤ 60 chars
- facts: ≤ 400 chars (6-7 lines, each ≤ 80 chars)
- overview: ≤ 1000 chars (use \n for paragraph break in middle)
- why_trip: ≤ 1100 chars (use \n for paragraph break in middle)
- room_details: ≤ 700 chars (use bullet points with • prefix)
- room_details2: ≤ 500 chars (detailed room description)
- extra1: ≤ 800 chars (detailed optional activities)
- extra2: ≤ 800 chars (additional experiences and services)
- cost_list: ≤ 300 chars (bullet points, each ≤ 60 chars)
- total_cost: ≤ 30 chars (just the price range, no "TOTAL:" prefix)

DATE FORMATTING:
- Convert date ranges to elegant format: "7th - 21st November 2025" 
- Use ordinal numbers (1st, 2nd, 3rd, 4th, etc.) and full month names
- Apply this format to both trip_dates and facts sections

DESTINATION: ${destination}
DATES: ${dates}

RAW ITINERARY CONTENT:
${rawItinerary}

Return JSON in this exact format:
{
  "trip_destination": "${destination}",
  "trip_dates": "7th - 21st November 2025",
  "option1": {
    "title_main": "Hotel/Resort Name (≤60 chars)",
    "facts": "Location: Place\\nDates: 7th - 21st November 2025\\nHotel: Name\\nRoom: Type\\nFlights: Airline Route\\nGround: Transport type",
    "overview": "Compelling first paragraph about the destination and experience.\\n\\nSecond paragraph highlighting luxury amenities and unique features that make this special.",
    "why_trip": "First paragraph explaining the destination's appeal and unique qualities.\\n\\nSecond paragraph detailing the specific luxury experience, service quality, and value proposition.",
    "room_details": "• Private infinity pool and direct beach access\\n• Garden courtyard bathroom with outdoor rain shower\\n• Spacious living area with ocean views\\n• Premium amenities and luxury furnishings\\n• Size: XXX m² with specific room features",
    "room_details2": "Detailed description of the accommodation experience, highlighting the premium features, views, comfort level, and special touches that make this room category exceptional.",
    "extra1": "Comprehensive description of family-friendly activities and services. Include specific age groups, activities available, and professional services. Detail the kids' clubs, marine education programs, and supervised activities.",
    "extra2": "Detailed description of adult experiences, spa services, dining options, excursions, and premium services. Include specific activities like manta ray snorkeling, sunset cruises, private dining, and wellness experiences.",
    "cost_list": "• Flights: £X,XXX–X,XXX\\n• Accommodation: £X,XXX–X,XXX\\n• Transfers: £XXX–XXX\\n• Service Fee: £XXX–XXX",
    "total_cost": "£XX,XXX – £XX,XXX"
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
      max_tokens: 3000,
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