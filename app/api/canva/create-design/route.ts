import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

export const runtime = 'edge'

export async function POST(request: NextRequest) {
  try {
    const { userId, itineraryData } = await request.json()

    if (!userId || !itineraryData) {
      return NextResponse.json({ error: 'Missing required data' }, { status: 400 })
    }

    // Get user's Canva token from Redis
    const tokenKey = `canva_token:${userId}`
    const tokenData = await redis.get(tokenKey) as { 
      access_token: string; 
      expires_at: string; 
      refresh_token: string; 
      scope: string; 
      user_id: string 
    } | null

    if (!tokenData) {
      return NextResponse.json({ 
        error: 'Canva not connected', 
        needsAuth: true 
      }, { status: 401 })
    }

    // Check if token is expired
    const now = new Date()
    const expiresAt = new Date(tokenData.expires_at)
    if (now >= expiresAt) {
      return NextResponse.json({ 
        error: 'Token expired', 
        needsAuth: true 
      }, { status: 401 })
    }

    // Create a simple design using Canva API
    const designResponse = await fetch('https://api.canva.com/rest/v1/designs', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        design_type: 'Poster',
        title: `Travel Itinerary - ${new Date().toLocaleDateString()}`,
      }),
    })

    if (!designResponse.ok) {
      const errorData = await designResponse.text()
      console.error('Design creation failed:', errorData)
      return NextResponse.json({ error: 'Failed to create design' }, { status: 500 })
    }

    const designData = await designResponse.json()

    // For now, we'll return the design info
    // In a full implementation, you'd populate the design with itinerary content
    // using Canva's content API
    
    return NextResponse.json({
      success: true,
      designId: designData.design.id,
      editUrl: designData.design.urls.edit_url,
      // Note: For PDF export, you'd need to implement additional API calls
      // to populate content and then export the design
    })

  } catch (error) {
    console.error('Error creating Canva design:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}