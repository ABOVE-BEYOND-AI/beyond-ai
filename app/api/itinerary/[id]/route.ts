import { NextRequest, NextResponse } from 'next/server';
import { getItinerary } from '@/lib/redis-database';

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
    const itinerary = await getItinerary(itineraryId);
    
    if (!itinerary) {
      console.log('❌ Server: Itinerary not found:', itineraryId);
      return NextResponse.json({ error: 'Itinerary not found' }, { status: 404 });
    }

    console.log('✅ Server: Found itinerary:', itinerary.id, 'for user:', itinerary.user_email);
    return NextResponse.json({ success: true, itinerary });
  } catch (error) {
    console.error('❌ Server: Error fetching itinerary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch itinerary', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}