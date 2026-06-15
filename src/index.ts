#!/usr/bin/env node
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  annotateMarketTickerFreshness,
  buildPortfolio,
  getStockDetail,
  getConsensusPicks,
  portfolioToMarkdown,
  publicApi,
  resolveTicker,
  richgoGet,
  savePortfolioReport,
  searchStock,
  serviceCatalog,
  summarizeStockDetail,
  type RiskProfile,
} from "./richgo.js";

const server = new McpServer({
  name: "richgo-finance-mcp",
  version: "1.0.0",
});

function jsonText(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

function withNotice(payload: unknown) {
  return {
    notice:
      "Information from Richgo Finance is for reference only and is not investment advice.",
    payload,
  };
}

server.registerResource(
  "service_catalog",
  "richgo://service-catalog",
  {
    title: "Richgo Finance MCP Service Catalog",
    description: "Public Richgo Finance services exposed by this MCP server.",
    mimeType: "application/json",
  },
  async (uri) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(serviceCatalog, null, 2),
      },
    ],
  }),
);

server.registerResource(
  "stock_detail",
  new ResourceTemplate("richgo://stocks/{ticker}", { list: undefined }),
  {
    title: "Richgo Stock Detail",
    description: "Read public Richgo stock details by six-digit ticker.",
    mimeType: "application/json",
  },
  async (uri, variables) => {
    const ticker = String(variables.ticker);
    const detail = await getStockDetail(ticker);
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(withNotice(detail), null, 2),
        },
      ],
    };
  },
);

server.registerTool(
  "richgo_service_catalog",
  {
    title: "List Richgo MCP services",
    description: "Show all Richgo Finance services currently exposed by this MCP server.",
    inputSchema: z.object({}),
  },
  async () => jsonText(serviceCatalog),
);

server.registerTool(
  "richgo_search_stock",
  {
    title: "Search Richgo stocks",
    description:
      "Search Richgo Finance for a stock by Korean name, partial name, or code. Returns matching stock candidates.",
    inputSchema: z.object({
      query: z.string().min(1).describe("Stock name or ticker, e.g. 삼성전자, 아이티센글로벌, 005930."),
      limit: z.number().int().min(1).max(50).default(8),
    }),
  },
  async ({ query, limit }) => jsonText(withNotice(await searchStock(query, limit))),
);

server.registerTool(
  "richgo_get_stock_detail",
  {
    title: "Get Richgo stock detail",
    description:
      "Fetch public Richgo Finance detail for a stock ticker, including valuation, cash flow, safety, percentiles, and reports when available.",
    inputSchema: z.object({
      ticker: z.string().regex(/^[A-Za-z0-9.\\-]{1,16}$/).describe("Ticker code, e.g. 005930 or 124500."),
      compact: z.boolean().default(false).describe("Return a compact summary instead of the full Richgo JSON payload."),
    }),
  },
  async ({ ticker, compact }) => {
    const detail = await getStockDetail(ticker);
    return jsonText(withNotice(compact ? { ...detail, data: summarizeStockDetail(detail.data) } : detail));
  },
);

server.registerTool(
  "richgo_analyze_stock",
  {
    title: "Resolve and analyze stock",
    description:
      "Resolve a user stock query through Richgo search/local aliases, fetch detail, and return a compact analysis payload.",
    inputSchema: z.object({
      query: z.string().min(1).describe("Stock name or ticker, e.g. 네이버, NAVER, 아이티센글로벌, 124500."),
      includeRaw: z.boolean().default(false).describe("Include the full raw Richgo detail payload."),
    }),
  },
  async ({ query, includeRaw }) => {
    const resolved = await resolveTicker(query);
    const detail = await getStockDetail(resolved.ticker);
    return jsonText(
      withNotice({
        resolved,
        summary: summarizeStockDetail(detail.data),
        raw: includeRaw ? detail : undefined,
      }),
    );
  },
);

server.registerTool(
  "richgo_get_scores",
  {
    title: "Get Richgo score ranking",
    description: "Fetch the Richgo score/screener table with optional market, sort, tier, period, and limit filters.",
    inputSchema: z.object({
      market: z.enum(["all", "kospi", "kosdaq", "us"]).default("all"),
      sort: z.string().default("score").describe("Sort key accepted by Richgo, commonly score, undervalue, per, marketCap."),
      tier: z.string().optional().describe("Richgo tier filter such as 대형주, 중형주, 소형주."),
      period: z.string().default("1y").describe("Period key accepted by Richgo, e.g. 1m, 3m, 6m, 1y."),
      limit: z.number().int().min(1).max(500).default(50),
    }),
  },
  async ({ market, sort, tier, period, limit }) =>
    jsonText(
      withNotice(
        await richgoGet("/api/scores", {
          market,
          sort,
          tier,
          period,
          limit,
        }),
      ),
    ),
);

server.registerTool(
  "richgo_get_undervalued",
  {
    title: "Get Richgo undervalued stocks",
    description:
      "Fetch Richgo undervalued-stock service. Modes mirror the site tabs: total, ttm, gap, composite, analyst, risky.",
    inputSchema: z.object({
      mode: z.enum(["total", "ttm", "gap", "composite", "analyst", "risky"]).default("total"),
      limit: z.number().int().min(1).max(500).default(100),
    }),
  },
  async ({ mode, limit }) => jsonText(withNotice(await richgoGet("/api/undervalued", { mode, limit }))),
);

server.registerTool(
  "richgo_get_ai_rankings",
  {
    title: "Get Richgo AI rankings",
    description: "Fetch Richgo AI ranking tab with country, market, sort, top, and tier filters.",
    inputSchema: z.object({
      country: z.enum(["KR", "US", "all"]).default("KR"),
      market: z.string().default("all").describe("Market filter, e.g. all, kospi, kosdaq, us."),
      sort: z.string().default("total").describe("Sort key accepted by Richgo, e.g. total or health."),
      top: z.number().int().min(1).max(500).default(100),
      tiers: z.array(z.string()).default([]).describe("Optional tier labels joined for Richgo's tiers parameter."),
    }),
  },
  async ({ country, market, sort, top, tiers }) =>
    jsonText(
      withNotice(
        await richgoGet("/api/rankings/ai", {
          country,
          market,
          sort,
          top,
          tiers: tiers.length > 0 ? tiers.join(",") : undefined,
        }),
      ),
    ),
);

server.registerTool(
  "richgo_get_curation",
  {
    title: "Get Richgo curation",
    description:
      "Fetch a Richgo curated screener bucket such as compound_quality, income_safe, chart_breakout, health_quality, industrial_growth, it_stability, or consumer_margin.",
    inputSchema: z.object({
      key: z
        .string()
        .default("compound_quality")
        .describe("Curation key from the Richgo screener UI."),
    }),
  },
  async ({ key }) => {
    if (!/^[A-Za-z0-9_-]+$/.test(key)) throw new Error("Invalid curation key.");
    return jsonText(withNotice(await richgoGet(`/api/screener/curation/${key}`)));
  },
);

server.registerTool(
  "richgo_get_breakout",
  {
    title: "Get Richgo breakout/special signals",
    description:
      "Fetch Richgo breakout/special-signal results. The site may return empty arrays for some signal types.",
    inputSchema: z.object({
      type: z.string().default("all").describe("Signal type accepted by Richgo, e.g. all, breakout, confluence."),
      limit: z.number().int().min(1).max(500).default(300),
    }),
  },
  async ({ type, limit }) => jsonText(withNotice(await richgoGet("/api/breakout", { type, limit }))),
);

server.registerTool(
  "richgo_get_exports_overview",
  {
    title: "Get Richgo Korea export overview",
    description:
      "Fetch the refreshed Richgo Korea export overview. Use for 한국 수출 데이터, export-driven investment ideas, export/import/trade-balance history, sector-to-stock export mappings, and export/employment momentum quadrants.",
    inputSchema: z.object({}),
  },
  async () => jsonText(withNotice(await richgoGet("/api/exports/overview"))),
);

server.registerTool(
  "richgo_get_exports_nations",
  {
    title: "Get Richgo export nations data",
    description:
      "Fetch country-level Korea export/import series from Richgo's export section, including top nation trade balances and recent monthly values.",
    inputSchema: z.object({}),
  },
  async () => jsonText(withNotice(await richgoGet("/api/exports/nations"))),
);

server.registerTool(
  "richgo_get_exports_region_ranking",
  {
    title: "Get Richgo export region ranking",
    description:
      "Fetch regional export ranking data from Richgo's Korea export section, including local export totals and change rates.",
    inputSchema: z.object({}),
  },
  async () => jsonText(withNotice(await richgoGet("/api/exports/region-ranking"))),
);

server.registerTool(
  "richgo_get_market_ticker",
  {
    title: "Get Richgo market ticker snapshot",
    description:
      "Fetch headline market ticker values from the refreshed Richgo start/market page, such as KOSPI, KOSDAQ, USD/KRW, WTI, and US indices. The response includes freshness metadata and warnings when Korean index dates look stale.",
    inputSchema: z.object({}),
  },
  async () => jsonText(withNotice(annotateMarketTickerFreshness(await richgoGet("/api/market/ticker")))),
);

const marketSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,32}$/)
  .default("kospi")
  .describe("Market key accepted by Richgo, commonly kospi or kosdaq.");

server.registerTool(
  "richgo_get_market_score_history",
  {
    title: "Get Richgo market score history",
    description:
      "Fetch Richgo market environment score history for the market page. Useful for 시장 위험도, 환경 점수, and market timing context.",
    inputSchema: z.object({
      market: marketSchema,
      timeframe: z.string().regex(/^[A-Za-z0-9_-]{1,16}$/).default("W").describe("Timeframe accepted by Richgo, e.g. D, W, M."),
    }),
  },
  async ({ market, timeframe }) => jsonText(withNotice(await richgoGet(`/api/market/${market}/score-history`, { timeframe }))),
);

server.registerTool(
  "richgo_get_market_investor_trend",
  {
    title: "Get Richgo market investor trend",
    description:
      "Fetch investor flow trend from Richgo's market page. Use for 수급 현황, 외국인/기관/연기금/개인 누적 수급, and market participation analysis.",
    inputSchema: z.object({
      market: marketSchema,
      period: z.string().regex(/^[A-Za-z0-9_-]{1,16}$/).default("6m").describe("Period accepted by Richgo, commonly 1m, 3m, 6m, or 1y."),
    }),
  },
  async ({ market, period }) => jsonText(withNotice(await richgoGet(`/api/market/${market}/investor-trend`, { period }))),
);

server.registerTool(
  "richgo_get_market_valuation_history",
  {
    title: "Get Richgo market valuation history",
    description:
      "Fetch market valuation history from Richgo, such as PER or PBR series. Useful for market dashboard valuation bands and timing analysis.",
    inputSchema: z.object({
      market: marketSchema,
      type: z.enum(["per", "pbr"]).default("per"),
      freq: z.string().regex(/^[A-Za-z0-9_-]{1,16}$/).default("W"),
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default("2019-01-01"),
      mode: z.string().regex(/^[A-Za-z0-9_-]{1,32}$/).default("forward"),
    }),
  },
  async ({ market, type, freq, from, mode }) =>
    jsonText(withNotice(await richgoGet(`/api/market/${market}/valuation-history`, { type, freq, from, mode }))),
);

server.registerTool(
  "richgo_get_market_seasonality",
  {
    title: "Get Richgo market seasonality",
    description:
      "Fetch Richgo seasonality distribution and trajectory. Use for 계절성 점수, 월별 통계, Halloween effect style context, and current-year market comparison.",
    inputSchema: z.object({
      market: z.string().regex(/^[A-Za-z0-9_-]{1,32}$/).default("kospi"),
      ref: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Reference date, YYYY-MM-DD. Defaults to Richgo's server-side latest reference when omitted."),
      mode: z.string().regex(/^[A-Za-z0-9_-]{1,32}$/).default("month").describe("Mode accepted by Richgo, e.g. month or year."),
    }),
  },
  async ({ market, ref, mode }) => jsonText(withNotice(await richgoGet("/api/market/seasonality", { market, ref, mode }))),
);

server.registerTool(
  "richgo_get_market_global_compare",
  {
    title: "Get Richgo global market comparison",
    description:
      "Fetch global market comparison trajectories used by the refreshed Richgo market dashboard. Useful for comparing KOSPI with US and global markets.",
    inputSchema: z.object({
      granularity: z.string().regex(/^[A-Za-z0-9_-]{1,32}$/).default("yearly"),
      ref: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Reference date, YYYY-MM-DD."),
    }),
  },
  async ({ granularity, ref }) => jsonText(withNotice(await richgoGet("/api/market/global-compare", { granularity, ref }))),
);

server.registerTool(
  "richgo_get_market_dashboard",
  {
    title: "Get refreshed Richgo market dashboard bundle",
    description:
      "Fetch a compact bundle of the new Richgo start/market page data: market ticker, score history, investor trend, valuation history, seasonality, and global comparison.",
    inputSchema: z.object({
      market: marketSchema,
      timeframe: z.string().regex(/^[A-Za-z0-9_-]{1,16}$/).default("W"),
      period: z.string().regex(/^[A-Za-z0-9_-]{1,16}$/).default("6m"),
      ref: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }),
  },
  async ({ market, timeframe, period, ref }) => {
    const [ticker, scoreHistory, investorTrend, valuationHistory, seasonality, globalCompare] = await Promise.all([
      richgoGet("/api/market/ticker"),
      richgoGet(`/api/market/${market}/score-history`, { timeframe }),
      richgoGet(`/api/market/${market}/investor-trend`, { period }),
      richgoGet(`/api/market/${market}/valuation-history`, { type: "per", freq: timeframe, from: "2019-01-01", mode: "forward" }),
      richgoGet("/api/market/seasonality", { market, ref, mode: "month" }),
      richgoGet("/api/market/global-compare", { granularity: "yearly", ref }),
    ]);
    return jsonText(
      withNotice({
        generatedAt: new Date().toISOString(),
        market,
        sources: {
          ticker: ticker.url,
          scoreHistory: scoreHistory.url,
          investorTrend: investorTrend.url,
          valuationHistory: valuationHistory.url,
          seasonality: seasonality.url,
          globalCompare: globalCompare.url,
        },
        data: {
          ticker: annotateMarketTickerFreshness(ticker).data,
          scoreHistory: scoreHistory.data,
          investorTrend: investorTrend.data,
          valuationHistory: valuationHistory.data,
          seasonality: seasonality.data,
          globalCompare: globalCompare.data,
        },
      }),
    );
  },
);

server.registerTool(
  "richgo_get_market_api",
  {
    title: "Get Richgo market API path",
    description:
      "Generic wrapper for public /api/market/{path} endpoints discovered in the app bundle. Use for market status endpoints not yet promoted to a first-class tool.",
    inputSchema: z.object({
      path: z.string().min(1).describe("Path after /api/market/, e.g. KR/combined-score."),
      params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
    }),
  },
  async ({ path, params }) => {
    const safePath = path.replace(/^\/+/, "");
    if (safePath.includes("..")) throw new Error("Path traversal is not allowed.");
    return jsonText(withNotice(await richgoGet(`/api/market/${safePath}`, params)));
  },
);

server.registerTool(
  "richgo_get_public_api",
  {
    title: "Get constrained Richgo public API",
    description:
      "Constrained GET wrapper for public /api/... Richgo endpoints. This is useful while mapping newly discovered site services.",
    inputSchema: z.object({
      path: z.string().min(1).describe("A /api/... path on finance.richgo.ai."),
      params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
    }),
  },
  async ({ path, params }) => jsonText(withNotice(await publicApi(path, params))),
);

server.registerTool(
  "richgo_get_consensus_picks",
  {
    title: "Pick attractive stocks from Richgo consensus signals",
    description:
      "Use this when the user asks in natural language for today's attractive stocks, best Korean stocks, Richgo recommendations, 투자 매력 높은 종목, 오늘의 추천, 컨센서스 픽, 저평가+AI 랭킹 종합, or '뭐가 좋아?'. It synthesizes Richgo scores, undervalued tabs, gap signals, and AI rankings into one ranked candidate list.",
    inputSchema: z.object({
      market: z.enum(["all", "kospi", "kosdaq", "us"]).default("all"),
      riskProfile: z.enum(["conservative", "balanced", "aggressive"]).default("balanced"),
      limit: z.number().int().min(1).max(50).default(10),
      includePreferred: z.boolean().default(false),
    }),
  },
  async ({ market, riskProfile, limit, includePreferred }) =>
    jsonText(withNotice(await getConsensusPicks({ market, riskProfile, limit, includePreferred }))),
);

server.registerTool(
  "richgo_build_portfolio",
  {
    title: "Build a budget-based Richgo stock portfolio",
    description:
      "Use this when the user says things like '500만원 투자 전략 짜줘', '예산으로 포트폴리오 만들어줘', '몇 주씩 살까?', '초보자 포트폴리오', or asks for a KRW budget-based strategy. It builds an integer-share portfolio from Richgo consensus signals for a budget, risk profile, and position constraints.",
    inputSchema: z.object({
      budget: z.number().positive().default(5_000_000).describe("Portfolio budget in KRW or the selected market currency."),
      riskProfile: z.enum(["conservative", "balanced", "aggressive"]).default("balanced"),
      market: z.enum(["all", "kospi", "kosdaq", "us"]).default("all"),
      maxStocks: z.number().int().min(1).max(10).default(3),
      maxPositionPct: z.number().min(10).max(100).optional(),
      includePreferred: z.boolean().default(false),
      markdown: z.boolean().default(false).describe("Also include an Obsidian-ready Markdown report string."),
    }),
  },
  async ({ budget, riskProfile, market, maxStocks, maxPositionPct, includePreferred, markdown }) => {
    const portfolio = await buildPortfolio({
      budget,
      riskProfile,
      market,
      maxStocks,
      maxPositionPct,
      includePreferred,
    });
    return jsonText(
      withNotice({
        ...portfolio,
        markdown: markdown ? portfolioToMarkdown(portfolio) : undefined,
      }),
    );
  },
);

server.registerTool(
  "richgo_save_obsidian_report",
  {
    title: "Save a Richgo portfolio report to a user-provided Obsidian vault",
    description:
      "Use this when the user asks to save a Richgo report to Obsidian, a vault, or a note. It builds a portfolio report and saves it inside a user-provided Obsidian vault path. No personal vault path is hardcoded; provide vaultPath or set RICHGO_OBSIDIAN_VAULT_PATH locally.",
    inputSchema: z.object({
      budget: z.number().positive().default(5_000_000),
      riskProfile: z.enum(["conservative", "balanced", "aggressive"]).default("balanced"),
      market: z.enum(["all", "kospi", "kosdaq", "us"]).default("all"),
      maxStocks: z.number().int().min(1).max(10).default(3),
      maxPositionPct: z.number().min(10).max(100).optional(),
      includePreferred: z.boolean().default(false),
      vaultPath: z
        .string()
        .optional()
        .describe("Absolute local Obsidian vault path. Omit only when RICHGO_OBSIDIAN_VAULT_PATH is set."),
      noteDir: z.string().default("Richgo").describe("Folder inside the vault. Defaults to a generic Richgo folder."),
      title: z.string().default("리치고 파이낸스 포트폴리오"),
    }),
  },
  async ({ budget, riskProfile, market, maxStocks, maxPositionPct, includePreferred, vaultPath, noteDir, title }) => {
    const portfolio = await buildPortfolio({
      budget,
      riskProfile,
      market,
      maxStocks,
      maxPositionPct,
      includePreferred,
    });
    const saved = await savePortfolioReport({ portfolio, vaultPath, noteDir, title });
    return jsonText(
      withNotice({
        saved,
        portfolio,
      }),
    );
  },
);

server.registerTool(
  "richgo_guided_portfolio",
  {
    title: "Ask beginner-friendly questions before building a Richgo portfolio",
    description:
      "Use this when the user says '초보자용으로 해줘', '질문하면서 도와줘', '마법사 시작', '잘 모르겠으니 물어봐줘', or asks for AskUserQuestion/form-style guidance. It uses MCP form elicitation when the client supports it, then builds and optionally saves a Richgo portfolio report.",
    inputSchema: z.object({
      useElicitation: z.boolean().default(true),
    }),
  },
  async ({ useElicitation }) => {
    if (!useElicitation) {
      return jsonText(
        withNotice({
          status: "needs_input",
          message:
            "Call richgo_build_portfolio with budget, riskProfile, and maxStocks. To save a note, call richgo_save_obsidian_report with vaultPath or set RICHGO_OBSIDIAN_VAULT_PATH locally.",
          suggestedDefaults: {
            budget: 5_000_000,
            riskProfile: "balanced",
            market: "all",
            maxStocks: 3,
            saveToObsidian: false,
          },
        }),
      );
    }

    let content: Record<string, unknown>;
    try {
      const result = await server.server.elicitInput({
        mode: "form",
        message: "리치고 포트폴리오를 만들기 위한 기본 조건을 선택해 주세요.",
        requestedSchema: {
          type: "object",
          properties: {
            budget: {
              type: "number",
              title: "투자 예산",
              description: "예: 5000000",
              minimum: 100000,
              default: 5000000,
            },
            riskProfile: {
              type: "string",
              title: "투자 성향",
              description: "보수형은 건강도/대형주, 공격형은 괴리율/회복 가능성 가중치가 커집니다.",
              oneOf: [
                { const: "balanced", title: "중립형" },
                { const: "conservative", title: "보수형" },
                { const: "aggressive", title: "공격형" },
              ],
              default: "balanced",
            },
            maxStocks: {
              type: "number",
              title: "종목 수",
              minimum: 1,
              maximum: 10,
              default: 3,
            },
            saveToObsidian: {
              type: "boolean",
              title: "Obsidian 저장",
              description: "저장하려면 다음 단계에서 vaultPath 또는 로컬 환경변수가 필요합니다.",
              default: false,
            },
            vaultPath: {
              type: "string",
              title: "Obsidian 볼트 경로",
              description: "선택 사항. 코드에는 저장되지 않습니다.",
            },
            noteDir: {
              type: "string",
              title: "볼트 안 폴더",
              default: "Richgo",
            },
          },
          required: ["budget", "riskProfile", "maxStocks"],
        },
      });

      if (result.action !== "accept" || !result.content) {
        return jsonText(withNotice({ status: "cancelled", message: "포트폴리오 생성을 취소했습니다." }));
      }
      content = result.content as Record<string, unknown>;
    } catch (error) {
      return jsonText(
        withNotice({
          status: "elicitation_unavailable",
          message:
            "현재 MCP 클라이언트가 form elicitation을 지원하지 않습니다. richgo_build_portfolio 또는 richgo_save_obsidian_report를 직접 호출해 주세요.",
          suggestedDefaults: {
            budget: 5_000_000,
            riskProfile: "balanced",
            market: "all",
            maxStocks: 3,
          },
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }

    const budget = Number(content.budget ?? 5_000_000);
    const riskProfile = String(content.riskProfile ?? "balanced") as RiskProfile;
    const maxStocks = Number(content.maxStocks ?? 3);
    const saveToObsidian = Boolean(content.saveToObsidian);
    const vaultPath = typeof content.vaultPath === "string" && content.vaultPath.trim() ? content.vaultPath : undefined;
    const noteDir = typeof content.noteDir === "string" && content.noteDir.trim() ? content.noteDir : "Richgo";
    const portfolio = await buildPortfolio({ budget, riskProfile, maxStocks });

    if (!saveToObsidian) {
      return jsonText(withNotice({ status: "built", portfolio, markdown: portfolioToMarkdown(portfolio) }));
    }

    const saved = await savePortfolioReport({ portfolio, vaultPath, noteDir });
    return jsonText(withNotice({ status: "saved", saved, portfolio }));
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
