import { NextRequest, NextResponse } from "next/server";
import { getDriveClient } from "@/lib/googleSlides";

interface PDFRequestBody {
  presentationId: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: PDFRequestBody = await req.json();
    
    if (!body.presentationId) {
      return NextResponse.json(
        { error: "Presentation ID is required" },
        { status: 400 }
      );
    }

    console.log("📥 Starting PDF export for presentation:", body.presentationId);

    // Initialize Google Drive client
    const drive = await getDriveClient();

    // Export the presentation as PDF using Google Drive API
    const response = await drive.files.export({
      fileId: body.presentationId,
      mimeType: 'application/pdf'
    }, {
      responseType: 'stream'
    });

    if (!response.data) {
      throw new Error('No data received from Drive API export');
    }

    console.log("✅ PDF export successful");

    // Convert the stream to buffer
    const chunks: Uint8Array[] = [];
    
    // Handle the stream data
    return new Promise((resolve, reject) => {
      response.data.on('data', (chunk: Uint8Array) => {
        chunks.push(chunk);
      });

      response.data.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        
        // Create response with PDF data
        const pdfResponse = new NextResponse(pdfBuffer, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="luxury-itinerary-${Date.now()}.pdf"`,
            'Content-Length': pdfBuffer.length.toString(),
            'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
          },
        });

        console.log("🎉 PDF download response created");
        resolve(pdfResponse);
      });

      response.data.on('error', (error: Error) => {
        console.error("❌ Stream error:", error);
        reject(error);
      });
    });

  } catch (error) {
    console.error("❌ Error exporting PDF:", error);
    
    // Handle specific Google API errors
    if (error && typeof error === 'object' && 'code' in error) {
      const apiError = error as { code: number; message: string };
      
      if (apiError.code === 404) {
        return NextResponse.json(
          { error: "Presentation not found" },
          { status: 404 }
        );
      }
      
      if (apiError.code === 403) {
        return NextResponse.json(
          { error: "Access denied to presentation" },
          { status: 403 }
        );
      }
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to export PDF",
      },
      { status: 500 }
    );
  }
}