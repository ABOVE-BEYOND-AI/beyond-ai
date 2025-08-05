import { NextRequest, NextResponse } from 'next/server';
import { getItineraries } from '@/lib/redis-database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get('userEmail');
    const limitStr = searchParams.get('limit');
    const offsetStr = searchParams.get('offset');

    if (!userEmail) {
      return NextResponse.json({ error: 'User email is required' }, { status: 400 });
    }

    // Parse pagination parameters with safe defaults
    const limit = limitStr ? Math.min(parseInt(limitStr, 10), 100) : 50; // Max 100 per request
    const offset = offsetStr ? Math.max(parseInt(offsetStr, 10), 0) : 0;   // No negative offset

    console.log('🗄️ Server: Fetching itineraries for user:', userEmail, `(limit: ${limit}, offset: ${offset})`);
    const itineraries = await getItineraries(userEmail, limit, offset);
    console.log('✅ Server: Found', itineraries.length, 'itineraries');

    return NextResponse.json({ success: true, itineraries, pagination: { limit, offset } });
  } catch (error) {
    console.error('❌ Server: Error fetching itineraries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch itineraries', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}