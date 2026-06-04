#!/usr/bin/env node
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  getStockDetail,
  publicApi,
  resolveTicker,
  richgoGet,
  searchStock,
  serviceCatalog,
  summarizeStockDetail,
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

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
