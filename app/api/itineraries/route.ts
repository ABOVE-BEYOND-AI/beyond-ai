import { NextRequest, NextResponse } from 'next/server';
import { getItineraries } from '@/lib/redis-database';
import { apiErrorResponse, getScopedUserEmail, requireApiUser } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  try {
    const context = await requireApiUser(request)
    const { searchParams } = new URL(request.url);
    const userEmail = getScopedUserEmail(searchParams.get('userEmail'), context)
    const limitStr = searchParams.get('limit');
    const offsetStr = searchParams.get('offset');

    // Parse pagination parameters with safe defaults
    const limit = limitStr ? Math.min(parseInt(limitStr, 10), 100) : 50; // Max 100 per request
    const offset = offsetStr ? Math.max(parseInt(offsetStr, 10), 0) : 0;   // No negative offset

    console.log('🗄️ Server: Fetching itineraries for user:', userEmail, `(limit: ${limit}, offset: ${offset})`);
    const itineraries = await getItineraries(userEmail, limit, offset);
    console.log('✅ Server: Found', itineraries.length, 'itineraries');

    return NextResponse.json({ success: true, itineraries, pagination: { limit, offset } });
  } catch (error) {
    console.error('❌ Server: Error fetching itineraries:', error);
    return apiErrorResponse(error, 'Failed to fetch itineraries');
  }
}
