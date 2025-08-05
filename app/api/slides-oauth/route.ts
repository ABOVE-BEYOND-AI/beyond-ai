import { NextRequest, NextResponse } from "next/server";
import { getSlidesClientOAuth, getDriveClientOAuth, PERSONAL_DRIVE_FOLDERS, OAUTH_TEMPLATE_IDS } from "@/lib/googleOAuth";
import { refineItineraryWithGPT } from "@/lib/openai";
import { validateAccessToken, getUserInfo } from "@/lib/google-auth";
import { publishToWebAndGetEmbedUrl } from "@/lib/googleSlides";

interface SlidesRequestBody {
  rawItinerary: string;
  destination: string;
  dates: string;
  imageUrl: string | null;
}

export async function POST(req: NextRequest) {
  try {
    console.log("🚀 Starting slides creation request");

    // Get authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: "No authorization header" },
        { status: 401 }
      );
    }

    console.log("🔑 Auth header received");

    // Extract Google access token
    const googleAccessToken = authHeader.replace('Bearer ', '');
    
    // Validate the Google access token
    const isTokenValid = await validateAccessToken(googleAccessToken);
    if (!isTokenValid) {
      console.log("❌ Invalid Google access token");
      return NextResponse.json(
        { success: false, error: "Invalid or expired Google access token" },
        { status: 401 }
      );
    }

    // Get user info from Google
    const googleUser = await getUserInfo(googleAccessToken);
    console.log("✅ Google Auth: User authenticated:", googleUser.email);

    const body: SlidesRequestBody = await req.json();
    
    console.log("📊 Creating slides for:", body.destination);
    console.log("👤 User:", googleUser.email);

    // Step 1: Refine the itinerary text with ChatGPT-4o
    console.log("🤖 Refining itinerary text with ChatGPT-4o...");
    const refinedData = await refineItineraryWithGPT(
      body.rawItinerary,
      body.destination,
      body.dates
    );

    // Initialize Google clients with user's OAuth token
    const slides = await getSlidesClientOAuth(googleAccessToken);
    const drive = await getDriveClientOAuth(googleAccessToken);

    // Step 2: Copy the template (Option 1 only for now)
    const templateId = OAUTH_TEMPLATE_IDS[1];
    console.log("📋 Copying template:", templateId);
    
    const copy = await drive.files.copy({
      fileId: templateId,
      requestBody: {
        name: `Luxury Itinerary – ${body.destination} (${new Date().toLocaleDateString()})`,
        parents: [PERSONAL_DRIVE_FOLDERS.ITINERARIES], // Save to your personal itineraries folder
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

    // Step 7: Generate shareable URL and embed URL
    const presentationUrl = `https://docs.google.com/presentation/d/${presentationId}/edit`;
    
    // Step 8: Publish to web and get embed URL for iframe integration
    console.log("🌐 Publishing presentation to web for embedding...");
    const embedUrl = await publishToWebAndGetEmbedUrl(presentationId);
    
    console.log("🎉 Slides creation complete:", presentationUrl);
    console.log("🎯 Embed URL generated:", embedUrl);

    return NextResponse.json({
      success: true,
      presentationId,
      presentationUrl,
      embedUrl,
      message: "Slides created successfully!",
      userEmail: googleUser.email,
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