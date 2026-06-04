# /rf

Use the `richgo-finance` MCP server to search and analyze stocks through Richgo Finance public data.

## Input

Treat the user's arguments after `/rf` as a Korean stock name, ticker, or Richgo Finance screening request.

Examples:

- `/rf 셀트리온 분석해줘`
- `/rf 068270 분석`
- `/rf 저평가 total 상위 10개`
- `/rf AI 랭킹 상위 종목 요약`

## Workflow

1. Prefer MCP tools from the `richgo-finance` server.
2. For a single stock, call `richgo_search_stock` first when the input is a name.
3. If the name is ambiguous, show candidates briefly and choose the most likely main listed company when the user clearly meant it. For example, "셀트리온" usually means `068270` on KOSPI, not `068760` 셀트리온제약.
4. For analysis, call `richgo_analyze_stock` with the resolved ticker and use `richgo_get_stock_detail` when richer trend, score, or health data is needed.
5. For screens, use the matching tool:
   - `richgo_get_undervalued`
   - `richgo_get_ai_rankings`
   - `richgo_get_curation`
   - `richgo_get_scores`
6. Answer in Korean unless the user asks otherwise.

## Output

Keep the result practical:

- 종목명, 코드, 시장, 기준일
- 현재가, 시가총액, 핵심 밸류에이션
- 성장성, 수익성, 현금흐름, 재무안전성
- Richgo percentile or score signals when available
- 투자 포인트와 리스크를 분리
- End with: "리치고 데이터는 참고용이며 투자 조언이 아닙니다."

If MCP tools are unavailable, say that the `richgo-finance` MCP server may need to be registered or restarted.
