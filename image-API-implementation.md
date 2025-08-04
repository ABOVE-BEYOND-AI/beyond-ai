# ✅ Dynamic Hotel Image API - Implementation Plan

## 🎯 Goal

To dynamically fetch and display a relevant, high-quality image for each hotel generated in an itinerary. This will be achieved in real-time by querying **Google's Programmable Search Engine API** every time a new, unseen hotel is recommended by the AI.

This approach replaces the previous "offline scraper" and "static image library" method, creating a fully dynamic system that can handle any hotel worldwide without manual intervention.

## 🧐 Why This Method?

- **Scalability**: Can find an image for **any hotel**, not just ones we've pre-scraped.
- **Reliability**: Uses an official Google API, which is stable, fast, and legal. It's designed for exactly this purpose.
- **Cost-Effectiveness**: Provides a generous **free tier of 100 queries per day**, which is perfect for our current scale. With smart caching, we can serve thousands of user requests while making very few actual API calls.
- **Production-Ready**: This is the industry-standard way to integrate real-time search results into an application without the pitfalls of direct web scraping (which is unreliable and often against terms of service).

---

## 📋 Implementation Checklist

This checklist breaks down the entire process into clear, sequential steps.

### **Phase 1: Google Cloud & Search Engine Setup (Manual Steps)**

*   [x] **1.1: Create a Programmable Search Engine**:
    *   Go to [programmablesearchengine.google.com](https://programmablesearchengine.google.com/controlpanel/create).
    *   Set it up to **"Search the entire web"**.
    *   Go to the Control Panel, select the "Basics" tab, and ensure **"Image search"** is turned **ON**.
    *   Copy the **Search engine ID** and save it. ✅ **COMPLETED: ID `7469b14f297514bd9`**

*   [x] **1.2: Get a Google Cloud API Key**:
    *   Go to the [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
    *   Create or select a project.
    *   Click "+ ENABLE APIS AND SERVICES", search for `Custom Search API`, and enable it.
    *   Navigate back to "Credentials", click "+ CREATE CREDENTIALS", and select "API key".
    *   Copy the **API Key** and save it. **Important:** Restrict this key to only be usable by the Custom Search API for security. ✅ **COMPLETED: Key restricted and stored**

### **Phase 2: Backend Integration (Code Changes)**

*   [x] **2.1: Securely Store API Keys**:
    *   Add the following to the `.env.local` file. This file is not committed to git and keeps your keys safe.
        ```
        GOOGLE_CSE_ID="YOUR_SEARCH_ENGINE_ID"
        GOOGLE_API_KEY="YOUR_API_KEY"
        ```
        ✅ **COMPLETED: Keys stored in .env.local**

*   [x] **2.2: Create a New API Route for Image Search**:
    *   Create a new file: `app/api/images/route.ts`.
    *   This route will act as a secure proxy. Our frontend will call this route, and this route will then securely call the Google API.
    *   It will accept a `hotelName` query parameter.
    *   It will implement an in-memory cache to avoid repeated Google API calls for the same hotel within the same session.
    ✅ **COMPLETED: Route created with caching and error handling**

*   [x] **2.3: Modify the Main Itinerary API Route**:
    *   In `app/api/itinerary/route.ts`, after extracting the `hotelNames`, it will loop through them.
    *   For each `hotelName`, it will call our new `/api/images` endpoint.
    *   It will collect the image URLs and return them to the frontend in a new `images` array. The `hotelNames` array will be removed from the response as it's no longer needed by the client.
    ✅ **COMPLETED: Modified to fetch and return images array**

### **Phase 3: Frontend Integration (Code Changes)**

*   [x] **3.1: Update the Frontend Hook**:
    *   In `hooks/useItineraryStream.ts`, update the `StreamState` to handle an array of image objects (`{ imageUrl: string, hotelName: string }`) instead of just `hotelNames`.
    *   Update the `streamItinerary` function to process this new `images` array from the API response.
    ✅ **COMPLETED: Hook updated to handle images array**

*   [x] **3.2: Simplify and Update the Itinerary Page**:
    *   In `app/itinerary/page.tsx`, remove the dependency on `SimpleHotelImage` and the local `/public/hotels` directory.
    *   The "Featured Hotels" section will now directly render the images from the `images` array received from the hook.
    *   This will use a standard `<img>` tag, as the URLs will be absolute URLs from Google.
    ✅ **COMPLETED: Page updated with direct image rendering and error handling**

### **Phase 4: Cleanup & Finalization**

*   [x] **4.1: Delete Obsolete Components and Directories**:
    *   Delete the `components/HotelImage.tsx` component.
    *   Delete the `public/hotels` directory and all its contents.
    ✅ **COMPLETED: Cleaned up old static image system**

*   [ ] **4.2: Verify and Test**:
    *   Run the application and generate an itinerary for a hotel that was not in our old static list (e.g., a unique hotel in a new city).
    *   Confirm that the correct image appears.
    *   Check the browser's network tab to confirm that the frontend is calling our `/api/images` route, not Google directly.
    *   Check the server logs to confirm that the `/api/images` route is successfully calling the Google Custom Search API.

---

## 🚀 **IMPLEMENTATION COMPLETE!**

All coding phases have been completed. The system is now ready for testing.

### **What to Expect:**

1. **Dynamic Image Search**: Every hotel mentioned in an itinerary will trigger a Google Custom Search API call (only once per hotel due to caching).

2. **Professional Images**: The first, most relevant Google Images result will be displayed for each hotel.

3. **Graceful Fallbacks**: If no image is found, a placeholder will be shown with the hotel name.

4. **Cost Management**: With the 100/day free tier and intelligent caching, you can serve many users before hitting limits.

5. **Debug Information**: In development mode, you'll see detailed logs showing which hotels had images found vs. not found.

### **Ready to Test:**

Please restart your development server and generate an itinerary. You should now see real, relevant images for each hotel sourced directly from Google!

