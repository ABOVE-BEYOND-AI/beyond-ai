import { NextRequest, NextResponse } from 'next/server';
import { saveItinerary } from '@/lib/redis-database';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userEmail, itineraryData } = body;

    if (!userEmail) {
      return NextResponse.json(
        { error: 'User email is required' },
        { status: 400 }
      );
    }

    if (!itineraryData) {
      return NextResponse.json(
        { error: 'Itinerary data is required' },
        { status: 400 }
      );
    }

    console.log('🗄️ Server: Saving itinerary to database for user:', userEmail);
    
    // Save itinerary to Redis database (server-side)
    const itineraryId = await saveItinerary(userEmail, itineraryData);
    
    console.log('✅ Server: Itinerary saved with ID:', itineraryId);

    return NextResponse.json({
      success: true,
      itineraryId,
      message: 'Itinerary saved successfully'
    });

  } catch (error) {
    console.error('❌ Server: Error saving itinerary:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to save itinerary',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}