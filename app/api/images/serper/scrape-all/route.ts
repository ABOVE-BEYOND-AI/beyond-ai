import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { getEventsWithInventory } from "@/lib/salesforce";
import { resolveEventImage } from "@/lib/event-images";

const SERPER_API_KEY = process.env.SERPER_API_KEY;
const ENDPOINT = "https://google.serper.dev/images";
const CACHE_TTL = 60 * 60 * 24 * 90; // 90 days

const STOCK_DOMAINS = [
  "shutterstock.com", "gettyimages.com", "istockphoto.com", "alamy.com",
  "dreamstime.com", "123rf.com", "depositphotos.com", "stock.adobe.com",
  "bigstockphoto.com", "canstockphoto.com", "pond5.com", "dissolve.com",
];

function isBlockedDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return STOCK_DOMAINS.some((d) => hostname.includes(d));
  } catch {
    return false;
  }
}

let redis: Redis | null = null;
function getRedis() {
  if (!redis) redis = Redis.fromEnv();
  return redis;
}

function cacheKey(eventName: string) {
  return `serper:img:${eventName.toLowerCase().trim()}`;
}

async function searchSerperImage(query: string): Promise<string | null> {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "X-API-KEY": SERPER_API_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify({ q: `${query} event`, gl: "uk", num: 10 }),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) return null;

  const data = (await response.json()) as {
    images?: Array<{ imageUrl: string; imageWidth: number; imageHeight: number }>;
  };

  const best = (data.images || [])
    .filter((img) => img.imageUrl && !isBlockedDomain(img.imageUrl))
    .filter((img) => img.imageWidth >= 400 && img.imageHeight >= 300);

  return best.length > 0 ? best[0].imageUrl : null;
}

/**
 * POST /api/images/serper/scrape-all
 *
 * Bulk-scrapes images for all events that don't have a Salesforce image
 * or a library match. Results are cached in Redis for 90 days.
 *
 * Run this once manually (or via cron) to populate all event images.
 */
export async function POST(req: NextRequest) {
  if (!SERPER_API_KEY) {
    return NextResponse.json({ error: "SERPER_API_KEY not configured" }, { status: 500 });
  }

  try {
    const events = await getEventsWithInventory();
    const r = getRedis();

    // Find events that need images
    const needsImage = events.filter(
      (e) => !e.Event_Image_1__c && !resolveEventImage(e.Name),
    );

    // Check which ones already have a cached Serper image
    const uncached: typeof needsImage = [];
    for (const e of needsImage) {
      const cached = await r.get<string>(cacheKey(e.Name));
      if (cached === null || cached === undefined) {
        uncached.push(e);
      }
    }

    const results: { name: string; imageUrl: string | null; cached: boolean }[] = [];

    // Scrape in sequence with a small delay to be respectful to the API
    for (const event of uncached) {
      try {
        const imageUrl = await searchSerperImage(event.Name);
        // Cache result (even empty string for misses)
        await r.set(cacheKey(event.Name), imageUrl || "", { ex: CACHE_TTL });
        results.push({ name: event.Name, imageUrl, cached: false });

        // Small delay between requests
        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (err) {
        results.push({ name: event.Name, imageUrl: null, cached: false });
      }
    }

    return NextResponse.json({
      success: true,
      totalEvents: events.length,
      alreadyHaveImage: events.length - needsImage.length,
      alreadyCached: needsImage.length - uncached.length,
      scraped: results.length,
      found: results.filter((r) => r.imageUrl).length,
      results,
    });
  } catch (error) {
    console.error("Bulk scrape failed:", error);
    return NextResponse.json({ error: "Bulk scrape failed" }, { status: 500 });
  }
}
