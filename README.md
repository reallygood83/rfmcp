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
- `richgo_get_consensus_picks`: merge Richgo scores, undervaluation, gap, and AI rankings into one ranked candidate list.
- `richgo_build_portfolio`: build an integer-share portfolio from Richgo consensus signals for a budget and risk profile.
- `richgo_save_obsidian_report`: save a generated portfolio report to a user-provided Obsidian vault path.
- `richgo_guided_portfolio`: beginner-friendly portfolio wizard that uses MCP form elicitation when the client supports it.
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

You do not need to know the MCP tool names. Ask naturally:

- `아이티센글로벌 리치고 데이터로 분석해줘`
- `/rf 셀트리온 분석해줘`
- `삼성전자와 SK하이닉스 리치고 상세 지표 비교해줘`
- `리치고 저평가 total 상위 10개 보여줘`
- `AI 랭킹 상위 종목을 요약해줘`
- `리치고 컨센서스 기준으로 오늘 투자 매력 높은 종목 10개 뽑아줘`
- `500만원 중립형 포트폴리오 만들어줘`
- `초보자용 리치고 포트폴리오 마법사 시작해줘`
- `나는 잘 모르니까 질문하면서 300만원 투자 전략 만들어줘`
- `오늘 리치고 기준으로 뭐가 제일 좋아?`
- `1000만원이면 몇 종목을 몇 주씩 사면 좋을까?`
- `이 결과를 내 Obsidian 볼트에 보고서로 저장해줘`

## Natural Language Routing

Most MCP clients choose tools from the descriptions below. These are the
intended natural-language routes:

| User says | Preferred tool | What happens |
| --- | --- | --- |
| `삼성전자 분석해줘`, `005930 리치고로 봐줘` | `richgo_analyze_stock` | Resolves the stock and returns compact Richgo detail. |
| `저평가 상위 10개`, `AI 랭킹 보여줘` | `richgo_get_undervalued` / `richgo_get_ai_rankings` | Returns the requested screen. |
| `오늘 투자 매력 높은 종목`, `뭐가 좋아?`, `컨센서스 픽` | `richgo_get_consensus_picks` | Combines scores, undervaluation, gap, and AI ranking into one candidate list. |
| `500만원 포트폴리오`, `몇 주씩 살까?`, `예산으로 전략 짜줘` | `richgo_build_portfolio` | Builds an integer-share portfolio with cash balance and risks. |
| `초보자용`, `질문하면서 도와줘`, `마법사 시작` | `richgo_guided_portfolio` | Uses form elicitation when supported, then builds the portfolio. |
| `Obsidian에 저장`, `볼트에 보고서로 저장` | `richgo_save_obsidian_report` | Saves only when a vault path is provided or configured privately. |

## Optional Slash Command

This repo includes a Claude-style slash command template at `commands/rf.md`.
Install it as `/rf` with:

```bash
mkdir -p ~/.claude/commands
cp commands/rf.md ~/.claude/commands/rf.md
```

After that, use prompts like:

```text
/rf 셀트리온 분석해줘
```

The `/rf` command is tuned to produce data-backed Korean reports, not just a
metric dump. It should connect revenue, profitability, cash flow, financial
safety, valuation, and Richgo percentile signals into a concrete story that is
easy to understand.

## Portfolio and Obsidian reports

The portfolio tools intentionally do not hardcode a personal vault path. This
keeps the published MCP reusable for other users.

Recommended natural-language flow:

```text
초보자용 리치고 포트폴리오 마법사 시작해줘
```

If your MCP client supports form elicitation, the server asks for budget, risk
profile, number of stocks, and whether to save to Obsidian. If the client does
not support elicitation, call:

```text
500만원 중립형 포트폴리오 만들어줘
```

To save Obsidian reports, either pass `vaultPath` in the tool call:

```json
{
  "budget": 5000000,
  "riskProfile": "balanced",
  "vaultPath": "/absolute/path/to/your/vault",
  "noteDir": "Richgo"
}
```

Or keep the path in your private shell/MCP environment:

```bash
export RICHGO_OBSIDIAN_VAULT_PATH='/absolute/path/to/your/vault'
```

Do not commit personal vault paths to this repository.

## Optional auth

Public endpoints work without auth. If you legitimately need login-only Richgo features, set your own cookie:

```bash
export RICHGO_COOKIE='...'
```

This server does not bypass authentication.

## Disclaimer

Richgo Finance data is informational only and is not investment advice. Final
investment decisions and responsibility belong to the user.
