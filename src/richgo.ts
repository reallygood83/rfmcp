import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.RICHGO_BASE_URL ?? "https://finance.richgo.ai";
const DEFAULT_TIMEOUT_MS = Number(process.env.RICHGO_TIMEOUT_MS ?? 15000);
const DEFAULT_OBSIDIAN_SUBDIR = "Richgo";

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type StockSearchResult = {
  code: string;
  name: string;
  market: string;
};

export type RichgoResponse = {
  url: string;
  fetchedAt: string;
  data: unknown;
};

type ScreenRow = Record<string, any>;

export type RiskProfile = "conservative" | "balanced" | "aggressive";

export type ConsensusPick = {
  code: string;
  name: string;
  market?: string;
  sector?: string;
  price?: number;
  marketCap?: number;
  tier?: string;
  priceDate?: string;
  consensusScore: number;
  sourceCount: number;
  verdict?: string;
  confidence?: number;
  ai?: {
    rank?: number;
    totalScore?: number;
    healthGrade?: string;
    healthScore?: number;
  };
  score?: number;
  undervalueIndex?: number | null;
  niGrowth?: number | null;
  mcapGrowth?: number | null;
  reasons: string[];
  risks: string[];
  sourceHits: string[];
};

export type ConsensusResult = RichgoResponse & {
  data: {
    market: string;
    riskProfile: RiskProfile;
    generatedAt: string;
    sources: string[];
    picks: ConsensusPick[];
  };
};

export type PortfolioPosition = {
  code: string;
  name: string;
  price: number;
  shares: number;
  amount: number;
  weightPct: number;
  targetWeightPct: number;
  consensusScore: number;
  reasons: string[];
  risks: string[];
};

export type PortfolioResult = RichgoResponse & {
  data: {
    budget: number;
    invested: number;
    cash: number;
    cashPct: number;
    riskProfile: RiskProfile;
    maxStocks: number;
    maxPositionPct: number;
    generatedAt: string;
    positions: PortfolioPosition[];
    watchlist: ConsensusPick[];
    strategy: string[];
    caveats: string[];
  };
};

export const serviceCatalog = {
  baseUrl: BASE_URL,
  disclaimer:
    "Richgo Finance data is informational only and is not investment advice. Final investment decisions and responsibility belong to the user.",
  publicServices: [
    {
      service: "stock_search",
      endpoint: "/api/stocks/search",
      tool: "richgo_search_stock",
      notes: "Search by Korean stock name or Korean stock code. Some English aliases may not match.",
    },
    {
      service: "stock_detail",
      endpoint: "/api/stocks/{ticker}",
      tool: "richgo_get_stock_detail",
      notes: "Returns valuation, price, market cap, cash flow, safety, percentiles, and related data when public.",
    },
    {
      service: "stock_analysis",
      endpoint: "/api/stocks/search + /api/stocks/{ticker}",
      tool: "richgo_analyze_stock",
      notes: "Convenience workflow that resolves a query to a ticker and summarizes the detail payload.",
    },
    {
      service: "scores",
      endpoint: "/api/scores",
      tool: "richgo_get_scores",
      notes: "Ranking/screener score table with filters such as market, sort, tier, period, and limit.",
    },
    {
      service: "undervalued",
      endpoint: "/api/undervalued",
      tool: "richgo_get_undervalued",
      notes: "Modes: total, ttm, gap, composite, analyst, risky.",
    },
    {
      service: "ai_rankings",
      endpoint: "/api/rankings/ai",
      tool: "richgo_get_ai_rankings",
      notes: "AI ranking tab. Supports country, market, sort, top, and tiers.",
    },
    {
      service: "curation",
      endpoint: "/api/screener/curation/{key}",
      tool: "richgo_get_curation",
      notes:
        "Curation keys include compound_quality, income_safe, chart_breakout, health_quality, industrial_growth, it_stability, consumer_margin.",
    },
    {
      service: "breakout",
      endpoint: "/api/breakout",
      tool: "richgo_get_breakout",
      notes: "Special signal/breakout API. Some type values can return empty result sets.",
    },
    {
      service: "exports_overview",
      endpoint: "/api/exports/overview",
      tool: "richgo_get_exports_overview",
      notes:
        "Korea export overview: monthly export/import/trade balance history, FX snapshot, sector-to-ticker mappings, and export/employment momentum quadrants.",
    },
    {
      service: "exports_nations",
      endpoint: "/api/exports/nations",
      tool: "richgo_get_exports_nations",
      notes: "Top country export/import series and current trade balances.",
    },
    {
      service: "exports_region_ranking",
      endpoint: "/api/exports/region-ranking",
      tool: "richgo_get_exports_region_ranking",
      notes: "Regional export rankings and change rates used by the Korea export data section.",
    },
    {
      service: "market_ticker",
      endpoint: "/api/market/ticker",
      tool: "richgo_get_market_ticker",
      notes:
        "Headline market ticker values such as KOSPI, KOSDAQ, USD/KRW, WTI, and US indices. Adds freshness metadata so stale Korean index dates are not mistaken for current market levels.",
    },
    {
      service: "market_score_history",
      endpoint: "/api/market/{market}/score-history",
      tool: "richgo_get_market_score_history",
      notes: "Market environment score time series for markets such as kospi and kosdaq.",
    },
    {
      service: "market_investor_trend",
      endpoint: "/api/market/{market}/investor-trend",
      tool: "richgo_get_market_investor_trend",
      notes: "Investor flow trend by foreign, institution, financial investment, pension, trust, and individual groups.",
    },
    {
      service: "market_valuation_history",
      endpoint: "/api/market/{market}/valuation-history",
      tool: "richgo_get_market_valuation_history",
      notes: "Market valuation history such as PER and PBR by frequency and valuation mode.",
    },
    {
      service: "market_seasonality",
      endpoint: "/api/market/seasonality",
      tool: "richgo_get_market_seasonality",
      notes: "Seasonality distribution and current-year trajectory for a selected market and reference date.",
    },
    {
      service: "market_global_compare",
      endpoint: "/api/market/global-compare",
      tool: "richgo_get_market_global_compare",
      notes: "Global market comparison trajectories used by the refreshed market dashboard.",
    },
    {
      service: "market_dashboard",
      endpoint: "/api/market/ticker + /api/market/*",
      tool: "richgo_get_market_dashboard",
      notes:
        "Convenience bundle for the refreshed Richgo start/market page: ticker, score history, investor trend, valuation history, seasonality, and global comparison. The ticker section includes freshness metadata.",
    },
    {
      service: "market_api",
      endpoint: "/api/market/{path}",
      tool: "richgo_get_market_api",
      notes: "Generic wrapper for discovered public market endpoints not yet promoted to a first-class tool.",
    },
    {
      service: "raw_public_api",
      endpoint: "/api/{path}",
      tool: "richgo_get_public_api",
      notes: "Constrained generic GET wrapper for public Richgo API paths not yet promoted to a first-class tool.",
    },
    {
      service: "consensus_picks",
      endpoint: "/api/scores + /api/undervalued + /api/rankings/ai",
      tool: "richgo_get_consensus_picks",
      notes: "Synthesizes repeated Richgo signals into a single ranked list with plain-Korean reasons and risks.",
    },
    {
      service: "portfolio_builder",
      endpoint: "/api/scores + /api/undervalued + /api/rankings/ai",
      tool: "richgo_build_portfolio",
      notes: "Builds an integer-share portfolio for a user budget, risk profile, and position constraints.",
    },
    {
      service: "obsidian_note_export",
      endpoint: "local filesystem only",
      tool: "richgo_save_obsidian_report",
      notes:
        "Saves a generated report only when vaultPath or RICHGO_OBSIDIAN_VAULT_PATH is provided. No personal vault path is hardcoded.",
    },
  ],
  optionalAuth: {
    env: "RICHGO_COOKIE",
    notes:
      "If the user has legitimate access to login-only features, set RICHGO_COOKIE to their own Cookie header. This server does not bypass authentication.",
  },
};

const aliasToTicker: Record<string, string> = {
  네이버: "035420",
  naver: "035420",
  NAVER: "035420",
  현대차: "005380",
  현대자동차: "005380",
  삼성전자: "005930",
  삼성전자우: "005935",
  SK하이닉스: "000660",
  sk하이닉스: "000660",
  아이티센글로벌: "124500",
};

function toUrl(path: string, params?: Record<string, string | number | boolean | undefined>) {
  const url = new URL(path.startsWith("http") ? path : `${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

function cleanApiPath(path: string) {
  const trimmed = path.trim();
  if (!trimmed) throw new Error("API path is required.");
  if (/^https?:\/\//i.test(trimmed)) {
    const url = new URL(trimmed);
    if (url.origin !== BASE_URL) throw new Error("Only finance.richgo.ai URLs are allowed.");
    return `${url.pathname}${url.search}`;
  }
  const withoutLeading = trimmed.replace(/^\/+/, "");
  if (!withoutLeading.startsWith("api/")) {
    throw new Error("Only /api/... paths are allowed.");
  }
  if (withoutLeading.includes("..")) {
    throw new Error("Path traversal is not allowed.");
  }
  return `/${withoutLeading}`;
}

export async function richgoGet(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<RichgoResponse> {
  const url = toUrl(path, params);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {
      accept: "application/json, text/plain, */*",
      "user-agent": "richgo-finance-mcp/1.0",
    };
    if (process.env.RICHGO_COOKIE) {
      headers.cookie = process.env.RICHGO_COOKIE;
    }

    const response = await fetch(url, { headers, signal: controller.signal });
    const contentType = response.headers.get("content-type") ?? "";
    const body = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      throw new Error(`Richgo request failed: ${response.status} ${response.statusText} ${JSON.stringify(body).slice(0, 500)}`);
    }

    return {
      url: url.toString(),
      fetchedAt: new Date().toISOString(),
      data: body,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatUtcDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function previousBusinessDay(date: Date) {
  const candidate = new Date(date);
  do {
    candidate.setUTCDate(candidate.getUTCDate() - 1);
  } while (candidate.getUTCDay() === 0 || candidate.getUTCDay() === 6);
  return candidate;
}

function estimatedLatestKoreaCloseDate(now: Date) {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const day = kst.getUTCDay();
  const hour = kst.getUTCHours();
  const todayKst = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()));

  let latest = new Date(todayKst);
  if (day === 0) {
    latest.setUTCDate(latest.getUTCDate() - 2);
  } else if (day === 6) {
    latest.setUTCDate(latest.getUTCDate() - 1);
  } else if (hour < 16) {
    latest = previousBusinessDay(latest);
  }

  while (latest.getUTCDay() === 0 || latest.getUTCDay() === 6) {
    latest.setUTCDate(latest.getUTCDate() - 1);
  }
  return formatUtcDate(latest);
}

function isKoreanIndexTicker(item: Record<string, unknown>) {
  const indicator = String(item.indicator ?? "");
  const label = String(item.label ?? "");
  return indicator === "KOSPI_CLOSE" || indicator === "KOSDAQ_CLOSE" || label === "코스피" || label === "코스닥";
}

function isoDate(value: unknown) {
  if (typeof value !== "string") return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

export function annotateMarketTickerFreshness(response: RichgoResponse, now = new Date()): RichgoResponse {
  if (!isRecord(response.data)) return response;

  const items = Array.isArray(response.data.items) ? response.data.items.filter(isRecord) : [];
  const koreanIndexItems = items.filter(isKoreanIndexTicker);
  const expectedLatestCloseDate = estimatedLatestKoreaCloseDate(now);
  const datedKoreanItems = koreanIndexItems
    .map((item) => ({
      indicator: String(item.indicator ?? ""),
      label: String(item.label ?? ""),
      value: item.value,
      changePct: item.changePct,
      date: isoDate(item.date),
    }))
    .filter((item) => item.date !== undefined);
  const staleItems = datedKoreanItems.filter((item) => item.date !== undefined && item.date < expectedLatestCloseDate);
  const mixedItemDates = Array.from(new Set(items.map((item) => isoDate(item.date)).filter((date): date is string => Boolean(date)))).sort();
  const warnings: string[] = [];

  if (staleItems.length > 0) {
    warnings.push(
      `KOSPI/KOSDAQ ticker date is older than the estimated latest Korea close date (${expectedLatestCloseDate}). Do not present these index values as current market levels without external verification.`,
    );
  }
  if (mixedItemDates.length > 1) {
    warnings.push(`Ticker payload mixes multiple item dates: ${mixedItemDates.join(", ")}.`);
  }
  if (datedKoreanItems.length !== koreanIndexItems.length) {
    warnings.push("Some Korean index ticker items do not include a YYYY-MM-DD date.");
  }

  return {
    ...response,
    data: {
      ...response.data,
      freshness: {
        checkedAt: new Date(now).toISOString(),
        timezone: "Asia/Seoul",
        status: warnings.length > 0 ? "verify_before_current_use" : "fresh_enough_for_latest_close_estimate",
        expectedLatestKoreaCloseDate: expectedLatestCloseDate,
        rule: "For Korea close data, this MCP estimates the latest available regular-session close as today after 16:00 KST, otherwise the previous weekday; weekends roll back to Friday. Korean public holidays are not modeled.",
        koreanIndexItems: datedKoreanItems,
        payloadItemDates: mixedItemDates,
        warnings,
      },
    },
  };
}

export async function searchStock(query: string, limit = 8): Promise<RichgoResponse> {
  return richgoGet("/api/stocks/search", { q: query, limit });
}

export async function resolveTicker(query: string): Promise<{ ticker: string; candidates: StockSearchResult[]; source: string }> {
  const normalized = query.trim();
  if (/^\d{6}$/.test(normalized)) {
    return { ticker: normalized, candidates: [], source: "direct_code" };
  }
  if (aliasToTicker[normalized]) {
    return { ticker: aliasToTicker[normalized], candidates: [], source: "local_alias" };
  }

  const search = await searchStock(normalized, 8);
  const candidates = Array.isArray((search.data as { data?: unknown }).data)
    ? ((search.data as { data: StockSearchResult[] }).data)
    : [];
  if (candidates.length === 0) {
    throw new Error(`No Richgo stock search result for "${query}". Try a six-digit ticker code.`);
  }
  return { ticker: candidates[0].code, candidates, source: "richgo_search" };
}

export async function getStockDetail(ticker: string): Promise<RichgoResponse> {
  return richgoGet(`/api/stocks/${encodeURIComponent(ticker)}`);
}

export function summarizeStockDetail(detail: unknown) {
  const d = detail as Record<string, any>;
  const valuation = d.valuation ?? {};
  const cashflow = d.cashflow ?? {};
  return {
    code: d.code,
    name: d.name,
    market: d.market,
    currency: d.currency,
    price: d.price,
    changePct: d.changePct,
    marketCap: d.marketCap,
    priceDate: d.priceDate,
    latestActualPeriod: d.latestActualPeriod,
    valuation: {
      perTtm: valuation.perTtm,
      porTtm: valuation.porTtm,
      psrTtm: valuation.psrTtm,
      pbr: valuation.pbr,
      roe: valuation.roe,
      debtRatio: valuation.debtRatio,
      opMargin: valuation.opMargin,
      eps: valuation.eps,
      ttmRevenue: valuation.ttmRevenue,
      ttmOp: valuation.ttmOp,
      ttmNi: valuation.ttmNi,
      latestQuarter: valuation.latestQuarter,
    },
    gap: d.gap,
    cashflow: {
      ttmOpCf: cashflow.ttmOpCf,
      ttmFcf: cashflow.ttmFcf,
      latestOpCf: cashflow.latestOpCf,
      interestCoverage: cashflow.interestCoverage,
    },
    safety: d.safety,
    percentiles: d.percentiles,
    reportCount: Array.isArray(d.reports) ? d.reports.length : undefined,
  };
}

export function publicApi(path: string, params?: Record<string, string | number | boolean | undefined>) {
  return richgoGet(cleanApiPath(path), params);
}

function arrayFromPayload(response: RichgoResponse): ScreenRow[] {
  const data = response.data as Record<string, any>;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.ranking)) return data.ranking;
  return [];
}

function tickerOf(row: ScreenRow) {
  return String(row.code ?? row.ticker ?? "").trim();
}

function numberOrUndefined(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function addUnique(target: string[], values: unknown[]) {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const clean = value.trim();
    if (clean && !target.includes(clean)) target.push(clean);
  }
}

function rankBoost(rank: number, maxRank: number, maxBoost: number) {
  return Math.max(0, ((maxRank - rank + 1) / maxRank) * maxBoost);
}

function riskMultiplier(pick: ConsensusPick, riskProfile: RiskProfile) {
  const tier = pick.tier ?? "";
  const healthScore = pick.ai?.healthScore ?? 0;
  const gap = pick.undervalueIndex ?? 0;
  const marketCap = pick.marketCap ?? 0;

  if (riskProfile === "conservative") {
    let value = 1;
    if (healthScore >= 85) value += 0.16;
    if (tier.includes("초대형") || tier.includes("대형")) value += 0.1;
    if (gap > 250) value -= 0.08;
    if (marketCap > 50000) value += 0.04;
    return value;
  }

  if (riskProfile === "aggressive") {
    let value = 1;
    if (gap >= 80) value += 0.16;
    if (pick.market === "kosdaq") value += 0.06;
    if (healthScore >= 85) value -= 0.04;
    return value;
  }

  return 1;
}

function sortConsensus(a: ConsensusPick, b: ConsensusPick) {
  if (b.consensusScore !== a.consensusScore) return b.consensusScore - a.consensusScore;
  if (b.sourceCount !== a.sourceCount) return b.sourceCount - a.sourceCount;
  return (b.ai?.totalScore ?? 0) - (a.ai?.totalScore ?? 0);
}

export async function getConsensusPicks({
  market = "all",
  riskProfile = "balanced",
  limit = 20,
  includePreferred = false,
}: {
  market?: "all" | "kospi" | "kosdaq" | "us";
  riskProfile?: RiskProfile;
  limit?: number;
  includePreferred?: boolean;
} = {}): Promise<ConsensusResult> {
  const [scores, undervaluedTotal, undervaluedComposite, undervaluedGap, aiRankings] = await Promise.all([
    richgoGet("/api/scores", { market, sort: "score", period: "1y", limit: 100 }),
    richgoGet("/api/undervalued", { mode: "total", limit: 100 }),
    richgoGet("/api/undervalued", { mode: "composite", limit: 100 }),
    richgoGet("/api/undervalued", { mode: "gap", limit: 100 }),
    richgoGet("/api/rankings/ai", {
      country: market === "us" ? "US" : "KR",
      market,
      sort: "total",
      top: 100,
    }),
  ]);

  const picks = new Map<string, ConsensusPick>();

  const ensurePick = (row: ScreenRow): ConsensusPick | undefined => {
    const code = tickerOf(row);
    if (!code) return undefined;
    const existing = picks.get(code);
    if (existing) return existing;
    const pick: ConsensusPick = {
      code,
      name: String(row.name ?? code),
      market: row.market,
      sector: row.sector,
      price: numberOrUndefined(row.price),
      marketCap: numberOrUndefined(row.marketCap),
      tier: row.tier,
      priceDate: row.priceDate,
      consensusScore: 0,
      sourceCount: 0,
      verdict: row.verdict,
      confidence: numberOrUndefined(row.confidence),
      score: numberOrUndefined(row.score),
      undervalueIndex: typeof row.undervalueIndex === "number" ? row.undervalueIndex : null,
      niGrowth: typeof row.niGrowth === "number" ? row.niGrowth : null,
      mcapGrowth: typeof row.mcapGrowth === "number" ? row.mcapGrowth : null,
      reasons: [],
      risks: [],
      sourceHits: [],
    };
    picks.set(code, pick);
    return pick;
  };

  const mergeRow = (pick: ConsensusPick, row: ScreenRow) => {
    pick.name = pick.name || String(row.name ?? pick.code);
    pick.market = pick.market ?? row.market;
    pick.sector = pick.sector ?? row.sector;
    pick.price = pick.price ?? numberOrUndefined(row.price);
    pick.marketCap = pick.marketCap ?? numberOrUndefined(row.marketCap);
    pick.tier = pick.tier ?? row.tier;
    pick.priceDate = pick.priceDate ?? row.priceDate;
    pick.verdict = pick.verdict ?? row.verdict;
    pick.confidence = pick.confidence ?? numberOrUndefined(row.confidence);
    pick.score = Math.max(pick.score ?? 0, numberOrUndefined(row.score) ?? 0) || pick.score;
    pick.undervalueIndex =
      typeof row.undervalueIndex === "number"
        ? Math.max(pick.undervalueIndex ?? Number.NEGATIVE_INFINITY, row.undervalueIndex)
        : pick.undervalueIndex;
    pick.niGrowth = typeof row.niGrowth === "number" ? row.niGrowth : pick.niGrowth;
    pick.mcapGrowth = typeof row.mcapGrowth === "number" ? row.mcapGrowth : pick.mcapGrowth;
    addUnique(pick.reasons, Array.isArray(row.reasons) ? row.reasons : []);
    addUnique(pick.risks, Array.isArray(row.risks) ? row.risks : []);
  };

  arrayFromPayload(scores).forEach((row, index) => {
    const pick = ensurePick(row);
    if (!pick) return;
    mergeRow(pick, row);
    pick.sourceCount += 1;
    pick.sourceHits.push(`scores#${index + 1}`);
    pick.consensusScore += rankBoost(index + 1, 100, 26);
    pick.consensusScore += Math.min(20, (numberOrUndefined(row.score) ?? 0) / 4);
    if (row.verdict === "strong_buy") pick.consensusScore += 7;
    if (row.verdict === "buy") pick.consensusScore += 3;
    if ((numberOrUndefined(row.confidence) ?? 0) >= 78) pick.consensusScore += 4;
  });

  const addUndervalued = (response: RichgoResponse, label: string, baseBoost: number) => {
    arrayFromPayload(response).forEach((row, index) => {
      const pick = ensurePick(row);
      if (!pick) return;
      mergeRow(pick, row);
      pick.sourceCount += 1;
      pick.sourceHits.push(`${label}#${index + 1}`);
      pick.consensusScore += baseBoost + rankBoost(index + 1, 100, 16);
      const gap = numberOrUndefined(row.undervalueIndex ?? row.niGapRatio);
      if (gap !== undefined && gap >= 50) pick.consensusScore += Math.min(10, gap / 100);
      if (Array.isArray(row.reasons) && row.reasons.some((reason: string) => reason.includes("고품질"))) {
        pick.consensusScore += 5;
      }
    });
  };

  addUndervalued(undervaluedTotal, "undervalued_total", 5);
  addUndervalued(undervaluedComposite, "undervalued_composite", 7);
  addUndervalued(undervaluedGap, "undervalued_gap", 4);

  arrayFromPayload(aiRankings).forEach((row, index) => {
    const pick = ensurePick(row);
    if (!pick) return;
    mergeRow(pick, row);
    pick.sourceCount += 1;
    pick.sourceHits.push(`ai#${index + 1}`);
    pick.ai = {
      rank: index + 1,
      totalScore: numberOrUndefined(row.totalScore),
      healthGrade: row.healthGrade,
      healthScore: numberOrUndefined(row.healthScore),
    };
    pick.consensusScore += rankBoost(index + 1, 100, 28);
    pick.consensusScore += Math.min(14, (numberOrUndefined(row.totalScore) ?? 0) / 6);
    const healthScore = numberOrUndefined(row.healthScore) ?? 0;
    if (healthScore >= 85) pick.consensusScore += 6;
    else if (healthScore >= 70) pick.consensusScore += 3;
  });

  const filtered = [...picks.values()]
    .filter((pick) => includePreferred || !/[우][A-Z0-9]*$/.test(pick.name))
    .map((pick) => ({
      ...pick,
      consensusScore: Number((pick.consensusScore * riskMultiplier(pick, riskProfile)).toFixed(1)),
      sourceCount: new Set(pick.sourceHits.map((hit) => hit.split("#")[0])).size,
      reasons: pick.reasons.slice(0, 5),
      risks: pick.risks.length > 0 ? pick.risks.slice(0, 4) : ["추가 모니터링 필요"],
    }))
    .sort(sortConsensus)
    .slice(0, limit);

  return {
    url: `${BASE_URL}/api/consensus-picks`,
    fetchedAt: new Date().toISOString(),
    data: {
      market,
      riskProfile,
      generatedAt: new Date().toISOString(),
      sources: [scores.url, undervaluedTotal.url, undervaluedComposite.url, undervaluedGap.url, aiRankings.url],
      picks: filtered,
    },
  };
}

function defaultMaxPositionPct(riskProfile: RiskProfile) {
  if (riskProfile === "conservative") return 35;
  if (riskProfile === "aggressive") return 50;
  return 45;
}

function allocateTargetWeights(picks: ConsensusPick[], riskProfile: RiskProfile, maxPositionPct: number) {
  const scoreSum = picks.reduce((sum, pick) => sum + Math.max(1, pick.consensusScore), 0);
  const uncapped = picks.map((pick) => ({
    code: pick.code,
    target: (Math.max(1, pick.consensusScore) / scoreSum) * 100,
  }));
  const capped = uncapped.map((item) => ({ ...item, target: Math.min(item.target, maxPositionPct) }));
  const remaining = 100 - capped.reduce((sum, item) => sum + item.target, 0);
  if (remaining <= 0) return capped;

  const uncappedItems = capped.filter((item) => item.target < maxPositionPct);
  const uncappedTotal = uncappedItems.reduce((sum, item) => sum + item.target, 0);
  if (uncappedTotal <= 0) return capped;

  return capped.map((item) => {
    if (item.target >= maxPositionPct) return item;
    return {
      ...item,
      target: item.target + remaining * (item.target / uncappedTotal),
    };
  });
}

export async function buildPortfolio({
  budget,
  riskProfile = "balanced",
  market = "all",
  maxStocks = 3,
  maxPositionPct,
  includePreferred = false,
}: {
  budget: number;
  riskProfile?: RiskProfile;
  market?: "all" | "kospi" | "kosdaq" | "us";
  maxStocks?: number;
  maxPositionPct?: number;
  includePreferred?: boolean;
}): Promise<PortfolioResult> {
  if (!Number.isFinite(budget) || budget <= 0) throw new Error("Budget must be a positive number.");

  const resolvedMaxPositionPct = maxPositionPct ?? defaultMaxPositionPct(riskProfile);
  const consensus = await getConsensusPicks({
    market,
    riskProfile,
    limit: Math.max(maxStocks * 4, 12),
    includePreferred,
  });
  const candidates = consensus.data.picks.filter((pick) => typeof pick.price === "number" && pick.price > 0);
  if (candidates.length === 0) throw new Error("No candidates with valid prices were returned by Richgo.");

  const selected = candidates.slice(0, maxStocks);
  const targetWeights = allocateTargetWeights(selected, riskProfile, resolvedMaxPositionPct);
  const positions = selected.map((pick) => {
    const targetWeightPct = targetWeights.find((item) => item.code === pick.code)?.target ?? 100 / selected.length;
    const targetAmount = budget * (targetWeightPct / 100);
    const shares = Math.floor(targetAmount / (pick.price ?? Infinity));
    return {
      pick,
      targetWeightPct,
      shares,
    };
  });

  let invested = positions.reduce((sum, position) => sum + position.shares * (position.pick.price ?? 0), 0);
  let cash = budget - invested;

  let guard = 0;
  while (guard < 10000) {
    guard += 1;
    const affordable = positions
      .filter((position) => (position.pick.price ?? Infinity) <= cash)
      .map((position) => {
        const price = position.pick.price ?? 0;
        const currentWeightPct = ((position.shares * price) / budget) * 100;
        return {
          position,
          underweight: position.targetWeightPct - currentWeightPct,
        };
      })
      .sort((a, b) => b.underweight - a.underweight);

    if (affordable.length === 0 || affordable[0].underweight < -2) break;
    affordable[0].position.shares += 1;
    invested += affordable[0].position.pick.price ?? 0;
    cash = budget - invested;
  }

  const finalPositions = positions
    .filter((position) => position.shares > 0)
    .map((position): PortfolioPosition => {
      const price = position.pick.price ?? 0;
      const amount = position.shares * price;
      return {
        code: position.pick.code,
        name: position.pick.name,
        price,
        shares: position.shares,
        amount,
        weightPct: Number(((amount / budget) * 100).toFixed(1)),
        targetWeightPct: Number(position.targetWeightPct.toFixed(1)),
        consensusScore: position.pick.consensusScore,
        reasons: position.pick.reasons,
        risks: position.pick.risks,
      };
    });

  return {
    url: `${BASE_URL}/api/portfolio-builder`,
    fetchedAt: new Date().toISOString(),
    data: {
      budget,
      invested,
      cash,
      cashPct: Number(((cash / budget) * 100).toFixed(1)),
      riskProfile,
      maxStocks,
      maxPositionPct: resolvedMaxPositionPct,
      generatedAt: new Date().toISOString(),
      positions: finalPositions,
      watchlist: candidates.slice(maxStocks, maxStocks + 5),
      strategy: [
        "정수 주 단위로 예산에 맞춘 참고 포트폴리오입니다.",
        "초기 진입은 50~60%만 집행하고, 리치고 신호가 유지될 때 나머지를 분할 매수하는 방식을 권장합니다.",
        "한 종목의 실제 비중이 제한선을 넘으면 신규 매수를 보류하고 다음 후보를 검토하세요.",
      ],
      caveats: [
        "리치고 데이터는 참고용이며 투자 조언이 아닙니다.",
        "일부 지표는 Richgo 화면의 사유 문구에만 포함되고 원천 필드는 비어 있을 수 있습니다.",
        "실제 매수 전 현재 호가, 거래량, 최근 공시, 실적 발표 일정을 별도로 확인하세요.",
      ],
    },
  };
}

function sanitizeFilename(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, " ").trim();
}

export function portfolioToMarkdown(portfolio: PortfolioResult, title = "리치고 파이낸스 포트폴리오") {
  const lines = [
    "---",
    `title: "${title.replace(/"/g, '\\"')}"`,
    `created: ${new Date().toISOString().slice(0, 10)}`,
    "source: Richgo Finance MCP",
    "status: reference",
    "tags:",
    "  - 투자분석",
    "  - 리치고",
    "  - 포트폴리오",
    "---",
    "",
    `# ${title}`,
    "",
    `> 기준 데이터: Richgo Finance MCP, ${new Date().toISOString().slice(0, 10)} 조회`,
    "> 성격: 참고용 투자 리서치. 실제 매수/매도 추천이 아닙니다.",
    "",
    "## 요약",
    "",
    `- 예산: ${portfolio.data.budget.toLocaleString("ko-KR")}원`,
    `- 투자금: ${portfolio.data.invested.toLocaleString("ko-KR")}원`,
    `- 현금 잔액: ${portfolio.data.cash.toLocaleString("ko-KR")}원 (${portfolio.data.cashPct}%)`,
    `- 리스크 성향: ${portfolio.data.riskProfile}`,
    "",
    "## 매수안",
    "",
    "| 종목 | 코드 | 기준가 | 수량 | 투자금 | 비중 | 컨센서스 |",
    "|---|---:|---:|---:|---:|---:|---:|",
    ...portfolio.data.positions.map(
      (position) =>
        `| ${position.name} | ${position.code} | ${position.price.toLocaleString("ko-KR")}원 | ${position.shares}주 | ${position.amount.toLocaleString("ko-KR")}원 | ${position.weightPct}% | ${position.consensusScore} |`,
    ),
    "",
    "## 종목별 근거",
    "",
    ...portfolio.data.positions.flatMap((position) => [
      `### ${position.name} (${position.code})`,
      "",
      `- 기준가: ${position.price.toLocaleString("ko-KR")}원`,
      `- 수량/비중: ${position.shares}주, ${position.weightPct}%`,
      `- 핵심 근거: ${position.reasons.length > 0 ? position.reasons.join("; ") : "리치고 복수 화면에서 상위권 신호 확인"}`,
      `- 주의점: ${position.risks.join("; ")}`,
      "",
    ]),
    "## 실행 원칙",
    "",
    ...portfolio.data.strategy.map((item) => `- ${item}`),
    "",
    "## 주의",
    "",
    ...portfolio.data.caveats.map((item) => `- ${item}`),
  ];
  return `${lines.join("\n")}\n`;
}

export async function savePortfolioReport({
  portfolio,
  vaultPath,
  noteDir = DEFAULT_OBSIDIAN_SUBDIR,
  title = "리치고 파이낸스 포트폴리오",
}: {
  portfolio: PortfolioResult;
  vaultPath?: string;
  noteDir?: string;
  title?: string;
}) {
  const resolvedVault = vaultPath || process.env.RICHGO_OBSIDIAN_VAULT_PATH;
  if (!resolvedVault) {
    throw new Error("vaultPath or RICHGO_OBSIDIAN_VAULT_PATH is required. No default personal path is embedded.");
  }

  const root = path.resolve(resolvedVault);
  const safeNoteDir = noteDir
    .split(/[\\/]+/)
    .filter(Boolean)
    .map(sanitizeFilename)
    .join(path.sep);
  const outputDir = path.resolve(root, safeNoteDir);
  if (!outputDir.startsWith(root)) throw new Error("noteDir must stay inside the vault path.");

  await mkdir(outputDir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const fileName = `${date}_${sanitizeFilename(title)}.md`;
  const filePath = path.join(outputDir, fileName);
  await writeFile(filePath, portfolioToMarkdown(portfolio, title), "utf8");
  return {
    filePath,
    noteDir: safeNoteDir,
    title,
  };
}
