import { NextRequest, NextResponse } from 'next/server';
import { updateItinerary } from '@/lib/redis-database';

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
    
    if (error instanceof Error && error.message === 'Itinerary not found') {
      return NextResponse.json(
        { error: 'Itinerary not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to update itinerary with slides data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}