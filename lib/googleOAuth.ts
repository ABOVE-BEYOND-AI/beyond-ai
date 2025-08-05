import { google } from "googleapis";

export async function getSlidesClientOAuth(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  
  return google.slides({ version: "v1", auth });
}

export async function getDriveClientOAuth(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  
  return google.drive({ version: "v3", auth });
}

// Personal Drive folder IDs (your personal Google Drive)
export const PERSONAL_DRIVE_FOLDERS = {
  MAIN: "1HFHEMUiPKRnKz2NMftVeg__xXfcsV1s5",
  TEMPLATES: "1xe6aI9hBczHcxLzrFqjBOBn28UKLyHD-", 
  ITINERARIES: "1yxVbHPxFWKrtpuNql8hbeJQIzFkqlS3f"
};

// Template IDs remain the same
export const OAUTH_TEMPLATE_IDS = {
  1: "1hyNyTr57hoCEMHBvK3uqvw_5vXGw3akoLaVNIVkkZKs", // Option 1 template
};