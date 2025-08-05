import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis'

function getRedisClient(): Redis {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || process.env.KV_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (!redisUrl || !redisToken) {
    throw new Error('Redis configuration is incomplete. Check environment variables.');
  }

  return new Redis({
    url: redisUrl,
    token: redisToken,
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get('userEmail');
    const action = searchParams.get('action');

    if (!userEmail) {
      return NextResponse.json({ error: 'User email is required' }, { status: 400 });
    }

    const redis = getRedisClient();
    
    if (action === 'inspect') {
      // Get user's itinerary IDs list
      const itineraryIds = await redis.get(`user:${userEmail}:itineraries`);
      
      console.log('🔍 Debug: Raw itinerary IDs data:', typeof itineraryIds, Array.isArray(itineraryIds));
      console.log('🔍 Debug: Itinerary IDs length:', Array.isArray(itineraryIds) ? itineraryIds.length : 'Not an array');
      console.log('🔍 Debug: First 10 IDs:', Array.isArray(itineraryIds) ? itineraryIds.slice(0, 10) : itineraryIds);
      
      // Check for duplicates
      if (Array.isArray(itineraryIds)) {
        const uniqueIds = [...new Set(itineraryIds)];
        const duplicateCount = itineraryIds.length - uniqueIds.length;
        
        return NextResponse.json({
          userEmail,
          totalIds: itineraryIds.length,
          uniqueIds: uniqueIds.length,
          duplicates: duplicateCount,
          firstTenIds: itineraryIds.slice(0, 10),
          lastTenIds: itineraryIds.slice(-10),
          hasDuplicates: duplicateCount > 0
        });
      } else {
        return NextResponse.json({
          userEmail,
          rawData: itineraryIds,
          dataType: typeof itineraryIds,
          error: 'Data is not an array as expected'
        });
      }
    }
    
    if (action === 'cleanup') {
      // Get user's itinerary IDs list
      const itineraryIds = await redis.get(`user:${userEmail}:itineraries`) as string[];
      
      if (!Array.isArray(itineraryIds)) {
        return NextResponse.json({ error: 'No itinerary data found or data is corrupted' }, { status: 404 });
      }
      
      // Remove duplicates
      const uniqueIds = [...new Set(itineraryIds)];
      const removedDuplicates = itineraryIds.length - uniqueIds.length;
      
      // Update Redis with deduplicated list
      await redis.set(`user:${userEmail}:itineraries`, uniqueIds);
      
      console.log(`🧹 Cleanup: Removed ${removedDuplicates} duplicate IDs for ${userEmail}`);
      
      return NextResponse.json({
        success: true,
        userEmail,
        originalCount: itineraryIds.length,
        newCount: uniqueIds.length,
        removedDuplicates
      });
    }

    return NextResponse.json({ error: 'Invalid action. Use ?action=inspect or ?action=cleanup' }, { status: 400 });

  } catch (error) {
    console.error('❌ Debug API Error:', error);
    return NextResponse.json(
      { error: 'Debug operation failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}