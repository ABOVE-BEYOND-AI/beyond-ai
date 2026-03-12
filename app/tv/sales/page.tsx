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

  if (!tvKey || !key || key !== tvKey) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-5xl font-bold mb-3">Access Denied</h1>
          <p className="text-xl text-muted-foreground">
            Invalid or missing access key.
          </p>
        </div>
      </div>
    );
  }

  let data = null;
  try {
    data = await getDashboardData("month");
  } catch (err) {
    console.error("TV: failed to fetch initial data:", err);
  }

  return <TVSalesClient initialData={data} />;
}
