const BASE_URL = process.env.RICHGO_BASE_URL ?? "https://finance.richgo.ai";
const DEFAULT_TIMEOUT_MS = Number(process.env.RICHGO_TIMEOUT_MS ?? 15000);

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
      service: "market_api",
      endpoint: "/api/market/{path}",
      tool: "richgo_get_market_api",
      notes: "Generic wrapper for discovered public market endpoints, such as KR/combined-score when available.",
    },
    {
      service: "raw_public_api",
      endpoint: "/api/{path}",
      tool: "richgo_get_public_api",
      notes: "Constrained generic GET wrapper for public Richgo API paths not yet promoted to a first-class tool.",
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
