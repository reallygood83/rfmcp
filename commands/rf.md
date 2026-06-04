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

Make the report data-driven, concrete, and easy to follow. Do not list numbers
as a table only; turn the numbers into a short story about the company.

Preferred structure:

1. 한 줄 결론: "이 회사는 지금 어떤 상태인가?"
2. 기본 정보: 종목명, 코드, 시장, 기준일, 현재가, 시가총액.
3. 데이터 스토리:
   - 매출/이익: "얼마나 벌고 있고, 좋아지는 중인가?"
   - 수익성: "돈을 남기는 힘이 강한가?"
   - 현금흐름: "회계상 이익이 실제 현금으로 이어지는가?"
   - 재무안전성: "무리해서 성장하는 중인가, 버틸 힘이 있는가?"
   - 밸류에이션: "좋은 회사라는 점이 가격에 얼마나 반영됐는가?"
4. 쉬운 해석: 어려운 지표는 한 문장으로 풀어쓴다. Example: "PER 32.8은 투자자가 현재 이익의 32.8년치를 미리 지불하는 수준으로 볼 수 있습니다."
5. 투자 포인트와 리스크를 분리.
6. 다음에 확인할 질문 2-3개를 제안.
7. End with: "리치고 데이터는 참고용이며 투자 조언이 아닙니다."

When percentiles are available, explain them plainly. Example: "영업이익률 상위 5%는 코스피 기업 중 이익을 남기는 힘이 매우 강한 편이라는 뜻입니다."

If MCP tools are unavailable, say that the `richgo-finance` MCP server may need to be registered or restarted.
