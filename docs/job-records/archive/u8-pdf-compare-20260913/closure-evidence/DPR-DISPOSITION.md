# U8 DPR 한정 판정 — Codx, 2026-09-13

**차단 아님. root의 계약 해석을 수용하며 이 DPR 쟁점은 현재 증거로 종결 가능하다.** U8 전체·시각·UI 완료 판정은 아니다. 제품 수정이나 검사 재실행 없이 정본문장과 제출 원자료/측정 코드를 대조했다.

정본 `docs/jobs/todo/u8-pdf-compare-20260909.md:28`은 “동일 PDF.js 버전·동일 render 옵션 내 렌더 픽셀 차이”, “96dpi(scale=96/72), DPR 독립 offscreen canvas”와 RGB 최대차 >16을 정의한다. 37행은 DPR1/2를 검사 대상으로 지정한다. 이는 DPR을 비교 canvas의 크기/배율에 곱하지 않는 렌더링 계약으로 읽는 것이 타당하며, 서로 다른 DPR·기기·브라우저의 글꼴 래스터 결과가 byte 단위로 같다는 별도 보장은 명시하지 않는다. root의 더 넓은 ‘DPR 동등’ 탐색 기대는 이 정본의 출력 보장으로 승격하지 않는다.

대조한 원자료:
- `/tmp/worklazy-u8-stage3-core/results.json`: geometry→geometry-change는 DPR1/2 모두 534×1067, 공통 scaleFactor1, dpi96, threshold16, complete/different-pixels. pixelCount는 각각3913/3973으로 실제 다르다. huge-thin은 양쪽 DPR 모두4096×2048, scaleFactor0.192, dpi18.432, 동일 입력 pixel0이다.
- `dpr-analysis.json`, `dpr-focus.mjs`, `dpr-analyze.py`, `dpr-focus.log`: 새 context DPR1/2/1/2, 4종 16관측. 각 DPR 내 반복은 4종 모두 RGB 차이0. 동일 geometry의 내장 글꼴 crossDPR 차이0, 비내장 geometry는 >16인502픽셀, huge-thin4294픽셀. PDF.js를 거치지 않고 고정534×1067 canvas에 그린 Arial도 crossDPR >16인518픽셀이다. 이 native 반복·crossDPR는 유효한 환경 대조이며 native before/after는 같은 canvas라 독립 동일입력 oracle로 세지 않는다.

이 조합은 현재 관측이 단순 DPR 배율 적용 오류가 아니라 환경에 따른 글꼴 래스터 차이와 부합한다는 근거다. 브라우저 내부의 정확한 원인까지 확정한 것은 아니다. 양쪽 비교는 한 실행 환경 안에서 수행되고, 제시된 실제 동일입력 PDF 표본은 차이0을 유지한다. 따라서 crossDPR 숫자 불일치만으로 정본의 비교 기능 결함을 구성하지 않는다.

**기록/인계:** strict crossDPR pixel 동일 실험은 실패로 그대로 보존한다. ‘DPR1/2 픽셀 완전 동일 PASS’로 고쳐 쓰지 않는다. 제품 threshold·기대값·글꼴·렌더 옵션을 완화/강제 변경하지 않는다. UI의 현재 렌더 환경 한계 안내에 화면 배율·기기·브라우저·비내장 글꼴 환경에 따라 픽셀 결과가 달라질 수 있음을 반영하고, 최종 UI 검수에서 실제 문구를 확인한다. 이 후속 문구 이행은 이번 기록만으로 완료됐다고 주장하지 않는다. 새 측정 없이 DPR 쟁점 판정을 종료한다.

새 실행: 없음. 기존 결과: 위 파일만 읽어 재사용/해석. 제품/commit/push: 없음. 작성 산출물: 이 문서만.
