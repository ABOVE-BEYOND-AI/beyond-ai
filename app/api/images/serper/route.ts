import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const SERPER_API_KEY = process.env.SERPER_API_KEY;
const ENDPOINT = "https://google.serper.dev/images";
const CACHE_TTL = 60 * 60 * 24 * 30; // 30 days

// Stock image domains to filter out
const STOCK_DOMAINS = [
  "shutterstock.com",
  "gettyimages.com",
  "istockphoto.com",
  "alamy.com",
  "dreamstime.com",
  "123rf.com",
  "depositphotos.com",
  "stock.adobe.com",
  "bigstockphoto.com",
  "canstockphoto.com",
  "pond5.com",
  "dissolve.com",
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
  if (!redis) {
    redis = Redis.fromEnv();
  }
  return redis;
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q");
  if (!query) {
    return NextResponse.json({ error: "Missing ?q= parameter" }, { status: 400 });
  }

  if (!SERPER_API_KEY) {
    return NextResponse.json({ error: "SERPER_API_KEY not configured" }, { status: 500 });
  }

  // Check cache first
  const cacheKey = `serper:img:${query.toLowerCase().trim()}`;
  try {
    const cached = await getRedis().get<string>(cacheKey);
    if (cached) {
      return NextResponse.json({ imageUrl: cached, cached: true });
    }
  } catch {
    // Cache miss or Redis error — continue to fetch
  }

  // Search Serper
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "X-API-KEY": SERPER_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: `${query} event`,
        gl: "uk",
        num: 10,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Serper API error: ${response.status}` },
        { status: 502 },
      );
    }

    const data = (await response.json()) as {
      images?: Array<{
        imageUrl: string;
        imageWidth: number;
        imageHeight: number;
      }>;
    };

    // Find the best image: not from stock sites, decent resolution
    const candidates = (data.images || [])
      .filter((img) => img.imageUrl && !isBlockedDomain(img.imageUrl))
      .filter((img) => img.imageWidth >= 400 && img.imageHeight >= 300);

    if (candidates.length === 0) {
      // Cache the miss so we don't keep hitting the API
      try {
        await getRedis().set(cacheKey, "", { ex: CACHE_TTL });
      } catch {}
      return NextResponse.json({ imageUrl: null });
    }

    const bestImage = candidates[0].imageUrl;

    // Cache for 30 days
    try {
      await getRedis().set(cacheKey, bestImage, { ex: CACHE_TTL });
    } catch {}

    return NextResponse.json({ imageUrl: bestImage, cached: false });
  } catch (error) {
    console.error("Serper image search failed:", error);
    return NextResponse.json(
      { error: "Image search failed" },
      { status: 500 },
    );
  }
}
