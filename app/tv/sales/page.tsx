import { getDashboardData } from "@/lib/salesforce";
import TVSalesClient from "./tv-client";

export const dynamic = "force-dynamic";

export default async function TVSalesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const key = typeof params.key === "string" ? params.key : undefined;
  const tvKey = process.env.TV_ACCESS_KEY;

  // ── Auth check (server-side — no JS needed) ──
  if (!tvKey || !key || key !== tvKey) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#09090b",
          color: "#fafafa",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: "2rem", fontWeight: "bold", marginBottom: "0.75rem" }}>
            Access Denied
          </h1>
          <p style={{ color: "#a1a1aa", fontSize: "1.125rem" }}>
            Invalid or missing access key.
          </p>
        </div>
      </div>
    );
  }

  // ── Fetch initial data server-side ──
  let initialData = null;
  try {
    initialData = await getDashboardData("month");
  } catch (err) {
    console.error("TV: failed to fetch initial data:", err);
  }

  return <TVSalesClient initialData={initialData} />;
}
