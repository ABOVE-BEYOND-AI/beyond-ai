import { NextRequest, NextResponse } from 'next/server';
import { getItineraries } from '@/lib/redis-database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get('userEmail');

    if (!userEmail) {
      return NextResponse.json({ error: 'User email is required' }, { status: 400 });
    }

    console.log('🗄️ Server: Fetching itineraries for user:', userEmail);
    const itineraries = await getItineraries(userEmail);
    console.log('✅ Server: Found', itineraries.length, 'itineraries');

    return NextResponse.json({ success: true, itineraries });
  } catch (error) {
    console.error('❌ Server: Error fetching itineraries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch itineraries', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}