import { NextRequest, NextResponse } from 'next/server';
import { saveItinerary } from '@/lib/redis-database';
import { apiErrorResponse, getScopedUserEmail, requireApiUser } from '@/lib/api-auth'

export async function POST(request: NextRequest) {
  try {
    const context = await requireApiUser(request)
    const body = await request.json();
    const { userEmail, itineraryData } = body;
    const scopedEmail = getScopedUserEmail(userEmail, context)

    if (!itineraryData) {
      return NextResponse.json(
        { error: 'Itinerary data is required' },
        { status: 400 }
      );
    }

    console.log('🗄️ Server: Saving itinerary to database for user:', scopedEmail);
    
    // Save itinerary to Redis database (server-side)
    const itineraryId = await saveItinerary(scopedEmail, itineraryData);
    
    console.log('✅ Server: Itinerary saved with ID:', itineraryId);

    return NextResponse.json({
      success: true,
      itineraryId,
      message: 'Itinerary saved successfully'
    });

  } catch (error) {
    console.error('❌ Server: Error saving itinerary:', error);
    return apiErrorResponse(error, 'Failed to save itinerary');
  }
}
