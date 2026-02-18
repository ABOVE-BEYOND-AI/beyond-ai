import { getDashboardData, type SalesPeriod } from "@/lib/salesforce";

export const dynamic = "force-dynamic";

// ── Helpers ──

function formatCurrency(amount: number): string {
  return `£${amount.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatCompact(amount: number): string {
  return `£${amount.toLocaleString("en-GB", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function clientName(oppName: string): string {
  const parts = oppName.split(" - ");
  return parts[0] || oppName;
}

function periodLabel(period: SalesPeriod): string {
  switch (period) {
    case "today": return "today";
    case "week": return "this week";
    case "month": return "this month";
    case "year": return "this year";
  }
}

const PERIOD_ORDER: SalesPeriod[] = ["today", "week", "month", "year"];

export default async function TVSalesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const key = typeof params.key === "string" ? params.key : undefined;
  const tvKey = process.env.TV_ACCESS_KEY;

  // ── Auth check ──
  if (!tvKey || !key || key !== tvKey) {
    return (
      <html lang="en">
        <body style={{ margin: 0, background: "#09090b", color: "#fafafa", fontFamily: "system-ui, -apple-system, sans-serif", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <h1 style={{ fontSize: "3rem", fontWeight: "bold", marginBottom: "12px" }}>Access Denied</h1>
            <p style={{ color: "#71717a", fontSize: "1.5rem" }}>Invalid or missing access key.</p>
          </div>
        </body>
      </html>
    );
  }

  // ── Determine which period to show (cycles based on time) ──
  const cycleSeconds = 10;
  const now = Math.floor(Date.now() / 1000);
  const periodIndex = Math.floor(now / cycleSeconds) % PERIOD_ORDER.length;
  const currentPeriod = PERIOD_ORDER[periodIndex];

  // ── Fetch data ──
  let data = null;
  let error = null;
  try {
    data = await getDashboardData(currentPeriod);
  } catch (err) {
    console.error("TV: failed to fetch data:", err);
    error = err instanceof Error ? err.message : "Failed to load data";
  }

  const totals = data?.all_totals?.[currentPeriod] ?? data?.totals ?? { total_amount: 0, total_deals: 0, average_deal: 0 };
  const leaderboard = data?.leaderboard ?? [];
  const deals = data?.deals ?? [];
  const allTotals = data?.all_totals;

  // Rank colors
  const rankColors = [
    { bg: "linear-gradient(135deg, #fde047, #eab308)", text: "#713f12" },
    { bg: "linear-gradient(135deg, #e5e7eb, #9ca3af)", text: "#374151" },
    { bg: "linear-gradient(135deg, #f59e0b, #b45309)", text: "#fffbeb" },
  ];

  return (
    <html lang="en">
      <head>
        <meta httpEquiv="refresh" content="10" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Above + Beyond — Sales TV</title>
        <style dangerouslySetInnerHTML={{ __html: `
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            background: #09090b;
            color: #fafafa;
            font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
            height: 100vh;
            overflow: hidden;
            padding: 2vh 3vw;
            -webkit-font-smoothing: antialiased;
            display: flex;
            flex-direction: column;
          }

          /* Period tabs */
          .period-tabs {
            display: flex;
            justify-content: center;
            margin-bottom: 1.5vh;
            flex-shrink: 0;
          }
          .period-tabs-inner {
            display: flex;
            background: rgba(255,255,255,0.04);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 9999px;
            padding: 8px;
          }
          .period-tab {
            padding: 10px 28px;
            font-size: 1.1vw;
            font-weight: 500;
            border-radius: 9999px;
            color: #52525b;
          }
          .period-tab.active {
            background: #fafafa;
            color: #09090b;
            font-weight: 700;
          }

          /* Hero */
          .hero {
            text-align: center;
            margin-bottom: 2.5vh;
            flex-shrink: 0;
          }
          .hero-amount {
            font-size: 10vw;
            font-weight: 900;
            letter-spacing: -0.04em;
            line-height: 1;
            background: linear-gradient(180deg, #fafafa 60%, rgba(250,250,250,0.25) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }
          .hero-subtitle {
            font-size: 1.8vw;
            color: #71717a;
            margin-top: 0.5vh;
          }
          .live-row {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            margin-top: 1vh;
          }
          .live-dot {
            width: 10px; height: 10px;
            background: #22c55e;
            border-radius: 50%;
            display: inline-block;
          }
          .live-text { font-size: 0.9vw; color: #71717a; }

          /* Grid */
          .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 2vw;
            flex: 1;
            min-height: 0;
          }

          /* Panel */
          .panel {
            background: rgba(255,255,255,0.04);
            border: 1px solid rgba(255,255,255,0.06);
            border-radius: 20px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }
          .panel-header {
            display: flex;
            align-items: center;
            gap: 14px;
            padding: 1.5vh 1.5vw;
            border-bottom: 1px solid rgba(255,255,255,0.06);
            font-size: 1.4vw;
            font-weight: 600;
            flex-shrink: 0;
          }
          .panel-header .icon { font-size: 1.5vw; }
          .panel-header .period { font-size: 1vw; color: #71717a; font-weight: 400; }
          .panel-body {
            padding: 1vh 1vw;
            flex: 1;
            overflow-y: auto;
          }

          /* Leaderboard row */
          .lb-row {
            display: flex;
            align-items: center;
            gap: 1vw;
            padding: 1.2vh 1vw;
            border-radius: 14px;
            margin-bottom: 0.6vh;
          }
          .lb-row.top3 {
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.05);
          }
          .lb-rank {
            width: 3vw; height: 3vw;
            max-width: 52px; max-height: 52px;
            min-width: 36px; min-height: 36px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 1.1vw;
            flex-shrink: 0;
          }
          .lb-rank.default {
            background: rgba(255,255,255,0.06);
            color: #71717a;
          }
          .lb-info { flex: 1; min-width: 0; }
          .lb-name {
            font-weight: 600;
            font-size: 1.2vw;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .lb-name.top { font-size: 1.4vw; }
          .lb-deals { font-size: 0.85vw; color: #71717a; margin-top: 2px; }
          .lb-amount {
            font-weight: 700;
            font-variant-numeric: tabular-nums;
            flex-shrink: 0;
          }
          .lb-amount.top { font-size: 1.5vw; }
          .lb-amount.other { font-size: 1.2vw; color: rgba(250,250,250,0.7); }

          /* Deal row */
          .deal-row {
            display: flex;
            align-items: center;
            gap: 1vw;
            padding: 1.2vh 1vw;
            border-radius: 14px;
            background: rgba(255,255,255,0.02);
            border: 1px solid rgba(255,255,255,0.03);
            margin-bottom: 0.6vh;
          }
          .deal-info { flex: 1; min-width: 0; }
          .deal-client {
            font-weight: 600;
            font-size: 1.15vw;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .deal-meta { font-size: 0.85vw; color: #71717a; margin-top: 2px; }
          .deal-amount {
            font-weight: 700;
            font-size: 1.3vw;
            font-variant-numeric: tabular-nums;
            flex-shrink: 0;
          }

          /* Bottom stats */
          .bottom-stats {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 3vw;
            padding: 1.5vh 0 0.5vh;
            border-top: 1px solid rgba(255,255,255,0.06);
            flex-shrink: 0;
          }
          .stat-item {
            display: flex;
            align-items: center;
            gap: 10px;
            color: rgba(255,255,255,0.4);
          }
          .stat-label { font-size: 0.8vw; text-transform: uppercase; letter-spacing: 0.05em; }
          .stat-value { font-size: 1vw; font-weight: 600; color: rgba(255,255,255,0.5); }
          .stat-deals { font-size: 0.8vw; color: rgba(255,255,255,0.25); }

          .empty-state {
            text-align: center;
            padding: 6vh 0;
            color: #71717a;
            font-size: 1.2vw;
          }
        `}} />
      </head>
      <body>

        {/* Period tabs */}
        <div className="period-tabs">
          <div className="period-tabs-inner">
            {PERIOD_ORDER.map((p) => (
              <div key={p} className={`period-tab ${p === currentPeriod ? "active" : ""}`}>
                {p === "today" ? "Today" : p === "week" ? "Week" : p === "month" ? "Month" : "Year"}
              </div>
            ))}
          </div>
        </div>

        {/* Hero amount */}
        <div className="hero">
          <div className="hero-amount">
            {error ? "—" : formatCurrency(totals.total_amount)}
          </div>
          <div className="hero-subtitle">
            {error
              ? error
              : `${totals.total_deals} deal${totals.total_deals !== 1 ? "s" : ""} closed ${periodLabel(currentPeriod)}`}
          </div>
          <div className="live-row">
            <span className="live-dot" />
            <span className="live-text">Live</span>
            <span className="live-text" style={{ color: "rgba(255,255,255,0.25)" }}>
              {new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>

        {/* Leaderboard + Deals grid */}
        <div className="grid">
          {/* LEADERBOARD */}
          <div className="panel">
            <div className="panel-header">
              <span className="icon">🏆</span>
              Leaderboard
              <span className="period">{periodLabel(currentPeriod)}</span>
            </div>
            <div className="panel-body">
              {leaderboard.length === 0 ? (
                <div className="empty-state">No deals closed {periodLabel(currentPeriod)}</div>
              ) : (
                leaderboard.map((rep, i) => {
                  const rc = rankColors[i];
                  return (
                    <div key={rep.email || rep.name} className={`lb-row ${i < 3 ? "top3" : ""}`}>
                      <div
                        className={`lb-rank ${i >= 3 ? "default" : ""}`}
                        style={rc ? { background: rc.bg, color: rc.text } : undefined}
                      >
                        {i + 1}
                      </div>
                      <div className="lb-info">
                        <div className={`lb-name ${i < 3 ? "top" : ""}`}>{rep.name}</div>
                        <div className="lb-deals">{rep.deal_count} deal{rep.deal_count !== 1 ? "s" : ""}</div>
                      </div>
                      <div className={`lb-amount ${i < 3 ? "top" : "other"}`}>
                        {formatCurrency(rep.total_amount)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RECENT DEALS */}
          <div className="panel">
            <div className="panel-header">
              <span className="icon">💷</span>
              Recent Deals
              <span className="period">{periodLabel(currentPeriod)}</span>
            </div>
            <div className="panel-body">
              {deals.length === 0 ? (
                <div className="empty-state">No deals closed {periodLabel(currentPeriod)}</div>
              ) : (
                deals.map((deal) => {
                  const amount = deal.Gross_Amount__c ?? deal.Amount ?? 0;
                  const owner = deal.Owner?.Name || "Unknown";
                  const event = deal.Event__r?.Name;
                  return (
                    <div key={deal.Id} className="deal-row">
                      <div className="deal-info">
                        <div className="deal-client">{clientName(deal.Name)}</div>
                        <div className="deal-meta">
                          {owner}{event ? ` · ${event}` : ""}
                        </div>
                      </div>
                      <div className="deal-amount">{formatCurrency(amount)}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Bottom stats */}
        {allTotals && (
          <div className="bottom-stats">
            {PERIOD_ORDER.filter((p) => p !== currentPeriod).map((p) => {
              const t = allTotals[p];
              return (
                <div key={p} className="stat-item">
                  <span className="stat-label">
                    {p === "today" ? "Today" : p === "week" ? "Week" : p === "month" ? "Month" : "Year"}
                  </span>
                  <span className="stat-value">{formatCompact(t?.total_amount || 0)}</span>
                  <span className="stat-deals">{t?.total_deals || 0} deals</span>
                </div>
              );
            })}
            {totals.average_deal > 0 && (
              <div className="stat-item" style={{ paddingLeft: "1.5vw", borderLeft: "1px solid rgba(255,255,255,0.06)" }}>
                <span className="stat-label">Avg deal</span>
                <span className="stat-value">{formatCompact(totals.average_deal)}</span>
              </div>
            )}
          </div>
        )}

      </body>
    </html>
  );
}
