import { NextRequest, NextResponse } from 'next/server';
import { updateItinerary } from '@/lib/redis-database';
import { apiErrorResponse, requireItineraryAccess } from '@/lib/api-auth'

interface UpdateSlidesRequest {
  itineraryId: string;
  slidesData: {
    slides_presentation_id: string;
    slides_embed_url: string;
    slides_edit_url: string;
    slides_created_at: string;
    pdf_ready?: boolean;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: UpdateSlidesRequest = await request.json();
    const { itineraryId, slidesData } = body;

    if (!itineraryId) {
      return NextResponse.json(
        { error: 'Itinerary ID is required' },
        { status: 400 }
      );
    }

    if (!slidesData || !slidesData.slides_presentation_id) {
      return NextResponse.json(
        { error: 'Slides data with presentation ID is required' },
        { status: 400 }
      );
    }

    console.log('🔄 Server: Updating itinerary with slides data:', itineraryId);
    await requireItineraryAccess(request, itineraryId)
    
    // Update the itinerary with slides information
    const updatedItinerary = await updateItinerary(itineraryId, {
      ...slidesData,
      status: 'generated' // Ensure status reflects completion
    });
    
    console.log('✅ Server: Itinerary updated with slides data');

    return NextResponse.json({
      success: true,
      itinerary: updatedItinerary,
      message: 'Itinerary updated with slides data successfully'
    });

  } catch (error) {
    console.error('❌ Server: Error updating itinerary with slides data:', error);
    return apiErrorResponse(error, 'Failed to update itinerary with slides data');
  }
}
