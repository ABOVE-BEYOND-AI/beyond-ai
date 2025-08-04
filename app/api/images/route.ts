import { NextRequest, NextResponse } from 'next/server';

// In-memory cache to avoid repeated API calls for the same hotel
const imageCache = new Map<string, string | null>();

export async function GET(request: NextRequest) {
  try {
    const hotelName = request.nextUrl.searchParams.get('hotel');
    
    if (!hotelName) {
      return NextResponse.json({ error: 'Missing hotel parameter' }, { status: 400 });
    }

    console.log(`🔍 Searching for image: "${hotelName}"`);

    // Check cache first
    if (imageCache.has(hotelName)) {
      const cachedUrl = imageCache.get(hotelName);
      console.log(`📋 Cache hit for "${hotelName}": ${cachedUrl ? 'Found' : 'No image'}`);
      return NextResponse.json({ 
        imageUrl: cachedUrl,
        source: 'cache',
        hotelName 
      });
    }

    // Get API credentials from environment
    const apiKey = process.env.GOOGLE_API_KEY;
    const searchEngineId = process.env.GOOGLE_CSE_ID;

    if (!apiKey || !searchEngineId) {
      console.error('❌ Missing Google API credentials');
      return NextResponse.json({ 
        error: 'Server configuration error' 
      }, { status: 500 });
    }

    // Build the Google Custom Search API URL
    const query = encodeURIComponent(hotelName);
    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${query}&searchType=image&num=1&safe=active`;

    console.log(`🌐 Calling Google Custom Search API for: "${hotelName}"`);

    // Call Google Custom Search API
    const response = await fetch(searchUrl);
    
    if (!response.ok) {
      console.error(`❌ Google API error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error('Error details:', errorText);
      
      // Cache the failure so we don't retry immediately
      imageCache.set(hotelName, null);
      
      return NextResponse.json({ 
        error: `Google API error: ${response.status}`,
        imageUrl: null,
        hotelName 
      }, { status: response.status });
    }

    const data = await response.json();
    
    // Extract the first image URL if available
    let imageUrl: string | null = null;
    if (data.items && data.items.length > 0) {
      imageUrl = data.items[0].link;
      console.log(`✅ Found image for "${hotelName}": ${imageUrl}`);
    } else {
      console.log(`❌ No images found for "${hotelName}"`);
    }

    // Cache the result (success or failure)
    imageCache.set(hotelName, imageUrl);

    return NextResponse.json({
      imageUrl,
      source: 'google',
      hotelName,
      // Optional: include context link for attribution
      contextLink: data.items?.[0]?.image?.contextLink
    });

  } catch (error) {
    console.error('❌ Image search error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      imageUrl: null 
    }, { status: 500 });
  }
}

// Handle preflight requests
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}