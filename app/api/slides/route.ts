import { NextRequest, NextResponse } from "next/server";
import { getSlidesClient, getDriveClient, TEMPLATE_IDS, DRIVE_FOLDERS } from "@/lib/googleSlides";
import { refineItineraryWithGPT } from "@/lib/openai";

interface SlidesRequestBody {
  rawItinerary: string;
  destination: string;
  dates: string;
  imageUrl: string | null;
}

export async function POST(req: NextRequest) {
  try {
    const body: SlidesRequestBody = await req.json();
    
    console.log("📊 Creating slides for:", body.destination);

    // Step 1: Refine the itinerary text with ChatGPT-4o
    console.log("🤖 Refining itinerary text with ChatGPT-4o...");
    const refinedData = await refineItineraryWithGPT(
      body.rawItinerary,
      body.destination,
      body.dates
    );

    // Initialize Google clients
    const slides = await getSlidesClient();
    const drive = await getDriveClient();

    // Step 2: Copy the template (Option 1 only for now)
    const templateId = TEMPLATE_IDS[1];
    console.log("📋 Copying template:", templateId);
    
    const copy = await drive.files.copy({
      fileId: templateId,
      requestBody: {
        name: `Luxury Itinerary – ${body.destination} (${new Date().toLocaleDateString()})`,
        parents: [DRIVE_FOLDERS.ITINERARIES], // Save to the Itineraries folder
      },
    });

    const presentationId = copy.data.id!;
    console.log("✅ Created presentation:", presentationId);

    // Step 3: Prepare all text replacements using refined data
    const textReplacements = [
      { containsText: { text: "<<Trip_Destination>>" }, replaceText: refinedData.trip_destination },
      { containsText: { text: "<<Trip_Dates>>" }, replaceText: refinedData.trip_dates },
      { containsText: { text: "<<Option1_Title_Main>>" }, replaceText: refinedData.option1.title_main },
      { containsText: { text: "<<Option1_Facts>>" }, replaceText: refinedData.option1.facts },
      { containsText: { text: "<<Option1_Overview>>" }, replaceText: refinedData.option1.overview },
      { containsText: { text: "<<Option1_DetailedNarrative>>" }, replaceText: refinedData.option1.why_trip },
      { containsText: { text: "<<Option1_RoomDetails>>" }, replaceText: refinedData.option1.room_details },
      { containsText: { text: "<<Option1_RoomDetails2>>" }, replaceText: refinedData.option1.room_details2 },
      { containsText: { text: "<<Option1_Extra1>>" }, replaceText: refinedData.option1.extra1 },
      { containsText: { text: "<<Option1_Extra2>>" }, replaceText: refinedData.option1.extra2 },
      { containsText: { text: "<<Option1_CostList>>" }, replaceText: refinedData.option1.cost_list },
      { containsText: { text: "<<Option1_TotalCost>>" }, replaceText: refinedData.option1.total_cost },
    ];

    console.log("🔄 Replacing text tokens...");

    // Step 4: Prepare batch update requests
    const requests: {
      replaceAllText?: {
        containsText: { text: string };
        replaceText: string;
      };
      replaceImage?: {
        imageObjectId: string;
        url: string;
      };
    }[] = [];

    // Add all text replacements
    textReplacements.forEach(replacement => {
      requests.push({
        replaceAllText: {
          containsText: replacement.containsText,
          replaceText: replacement.replaceText,
        },
      });
    });

    // Step 5: Add image replacement if we have an image URL
    if (body.imageUrl) {
      console.log("🖼️ Adding image replacement for:", body.imageUrl);
      
      // First, find the image with alt-text "Option1_Image"
      const presentation = await slides.presentations.get({ presentationId });
      
      let imageObjectId: string | null = null;
      
      // Search through all slides for an image with the correct alt-text
      if (presentation.data.slides) {
        for (const slide of presentation.data.slides) {
          if (slide.pageElements) {
            for (const element of slide.pageElements) {
              if (element.image && element.description === "Option1_Image") {
                imageObjectId = element.objectId!;
                break;
              }
            }
          }
          if (imageObjectId) break;
        }
      }

      if (imageObjectId) {
        requests.push({
          replaceImage: {
            imageObjectId,
            url: body.imageUrl,
          },
        });
        console.log("✅ Found image placeholder, will replace with:", body.imageUrl);
      } else {
        console.log("⚠️ No image placeholder found with alt-text 'Option1_Image'");
      }
    }

    // Step 6: Execute all updates in a single batch
    if (requests.length > 0) {
      await slides.presentations.batchUpdate({
        presentationId,
        requestBody: { requests },
      });
      console.log(`✅ Applied ${requests.length} updates to presentation`);
    }

    // Step 7: Generate shareable URL
    const presentationUrl = `https://docs.google.com/presentation/d/${presentationId}/edit`;
    
    console.log("🎉 Slides creation complete:", presentationUrl);

    return NextResponse.json({
      success: true,
      presentationId,
      presentationUrl,
      message: "Slides created successfully!",
    });

  } catch (error) {
    console.error("❌ Error creating slides:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}