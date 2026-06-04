# Richgo Finance MCP

Model Context Protocol (MCP) server for public data exposed by
[`finance.richgo.ai`](https://finance.richgo.ai).

It lets MCP clients search Korean stocks, fetch Richgo stock detail data, and
use Richgo's ranking, undervaluation, AI ranking, and curation screens from an
assistant.

> This project only calls public Richgo Finance endpoints by default. It does
> not bypass authentication or scrape private account data.

## Tools

- `richgo_search_stock`: search by Korean stock name or ticker.
- `richgo_get_stock_detail`: fetch public detail for a ticker.
- `richgo_analyze_stock`: search/alias resolve, then fetch compact analysis.
- `richgo_get_scores`: score ranking table.
- `richgo_get_undervalued`: undervalued stock tabs.
- `richgo_get_ai_rankings`: AI ranking tab.
- `richgo_get_curation`: curated screener buckets.
- `richgo_get_breakout`: breakout/special signal endpoint.
- `richgo_get_market_api`: generic `/api/market/...` wrapper.
- `richgo_get_public_api`: constrained generic `/api/...` wrapper.
- `richgo_service_catalog`: list exposed services.

## Install

```bash
git clone https://github.com/reallygood83/rfmcp.git
cd rfmcp
npm install
npm run build
```

## Run Locally

```bash
npm start
```

On the original author's Mac, Homebrew Node was broken, so this bundled Node
path was used:

```bash
export PATH=/Users/moon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH
npm run build
npm start
```

## Codex or Claude MCP config

```json
{
  "mcpServers": {
    "richgo-finance": {
      "command": "node",
      "args": ["/absolute/path/to/rfmcp/dist/index.js"]
    }
  }
}
```

## Example Prompts

- `아이티센글로벌 리치고 데이터로 분석해줘`
- `삼성전자와 SK하이닉스 리치고 상세 지표 비교해줘`
- `리치고 저평가 total 상위 10개 보여줘`
- `AI 랭킹 상위 종목을 요약해줘`

## Optional auth

Public endpoints work without auth. If you legitimately need login-only Richgo features, set your own cookie:

```bash
export RICHGO_COOKIE='...'
```

This server does not bypass authentication.

## Disclaimer

Richgo Finance data is informational only and is not investment advice. Final
investment decisions and responsibility belong to the user.
