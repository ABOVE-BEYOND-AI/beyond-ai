import { NextRequest, NextResponse } from 'next/server';
import { apiErrorResponse, requireItineraryAccess } from '@/lib/api-auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: itineraryId } = await params;

    if (!itineraryId) {
      return NextResponse.json({ error: 'Itinerary ID is required' }, { status: 400 });
    }

    console.log('🗄️ Server: Fetching individual itinerary:', itineraryId);
    const { itinerary } = await requireItineraryAccess(request, itineraryId)

    console.log('✅ Server: Found itinerary:', itinerary.id, 'for user:', itinerary.user_email);
    return NextResponse.json({ success: true, itinerary });
  } catch (error) {
    console.error('❌ Server: Error fetching itinerary:', error);
    return apiErrorResponse(error, 'Failed to fetch itinerary');
  }
}
