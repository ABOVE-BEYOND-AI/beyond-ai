import { google } from "googleapis";
import fs from "fs";
import path from "path";

export async function getSlidesClient() {
  // Force using the local credentials file for now since the base64 env var is corrupted
  const creds = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "config/credentials.json"), "utf8")
  );

  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/drive", "https://www.googleapis.com/auth/presentations"],
  });

  return google.slides({ version: "v1", auth });
}

export async function getDriveClient() {
  // Force using the local credentials file for now since the base64 env var is corrupted
  const creds = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "config/credentials.json"), "utf8")
  );

  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/drive", "https://www.googleapis.com/auth/presentations"],
  });

  return google.drive({ version: "v3", auth });
}

// Google Drive Folder IDs
export const DRIVE_FOLDERS = {
  MAIN: "1HFHEMUiPKRnKz2NMftVeg__xXfcsV1s5",
  TEMPLATES: "1xe6aI9hBczHcxLzrFqjBOBn28UKLyHD-", 
  ITINERARIES: "1yxVbHPxFWKrtpuNql8hbeJQIzFkqlS3f"
};

// Template IDs - we'll start with just Option 1
export const TEMPLATE_IDS = {
  1: "1hyNyTr57hoCEMHBvK3uqvw_5vXGw3akoLaVNIVkkZKs", // Option 1 template
  // TODO: Add more template IDs when we create 2-5 option templates
  // 2: "template_id_for_2_options",
  // 3: "template_id_for_3_options", 
  // 4: "template_id_for_4_options",
  // 5: "template_id_for_5_options"
};

export interface ItineraryData {
  destination: string;
  dates: string;
  option1: {
    title: string;
    facts: string;
    overview: string;
    detailedNarrative: string;
    roomDetails: string;
    roomDetails2: string;
    extra1: string;
    extra2: string;
    costList: string;
    totalCost: string;
    imageUrl: string | null;
  };
  // TODO: Add option2, option3, etc. when we scale
}

/**
 * Publishes a Google Slides presentation to the web and returns the embed URL
 */
export async function publishToWebAndGetEmbedUrl(presentationId: string): Promise<string> {
  try {
    console.log("🌐 Publishing presentation to web:", presentationId);
    
    const drive = await getDriveClient();
    
    // Step 1: Make the file publicly viewable
    await drive.permissions.create({
      fileId: presentationId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });
    
    console.log("✅ Made presentation publicly viewable");
    
    // Step 2: Get the file metadata to construct embed URL
    const fileMetadata = await drive.files.get({
      fileId: presentationId,
      fields: 'webViewLink',
    });
    
    // Step 3: Convert the webViewLink to embed URL format
    // Google Slides webViewLink format: https://docs.google.com/presentation/d/[ID]/edit
    // Embed URL format: https://docs.google.com/presentation/d/[ID]/embed?start=false&loop=false&delayms=3000
    
    const embedUrl = `https://docs.google.com/presentation/d/${presentationId}/embed?start=false&loop=false&delayms=3000`;
    
    console.log("🎯 Generated embed URL:", embedUrl);
    
    return embedUrl;
    
  } catch (error) {
    console.error("❌ Error publishing presentation to web:", error);
    throw new Error(`Failed to publish presentation: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}