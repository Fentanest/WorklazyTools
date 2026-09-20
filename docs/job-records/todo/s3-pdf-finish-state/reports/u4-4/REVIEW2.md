**U4-4 fix-1 재검수 2b — [수정 후 재검수]**

대상 `s3-pdf-finish`, `15bad33cfb569ee032ba90c4fe42b75c1c48cf73`. 2026-09-08, Codx. `PROJECT_RULES.md`와 지정 선독 문서·두 재검수 지시서를 읽고 수행했다. 구현·커밋·push·브랜치 전환은 하지 않았다. 검증 대상은 `/tmp/worklazy-u4-4-review2/repo`의 `git archive 15bad33` 사본이다.

**최우선 결론: 65,820B 정상 PDF의 약 52초 연속 응답 정지를 재현했다(P2).** 3회 모두 처리가 끝났으므로 기존 566B 입력의 무한 정지와 구분한다. 같은 이미지 폭에서 디코딩 데이터 16→32→64MiB 증가에 최대 heartbeat 간격은 3.328→13.083→52.293초로 증가했다. 주 병목은 PDF.js의 미리보기 RGB→RGBA 변환이며, 위험 검사에도 별도의 수초짜리 동기 구간이 남는다. 업로드 중 취소 버튼이 없고, 파일 제거 클릭도 변환 완료까지 약 50초 대기했다.

그 외 잔여는 정상 PDF의 출력 검증 오탐(P2), 표시되지 않는 워터마크의 성공 다운로드(P2), 접근성 귀속 게이트 누락(P2), 다중 줄 타일의 Poppler 상단 경계 손실(P3), 안내문 내부 구현 명칭(P3)이다. 기존 검증 명령 통과가 이 반례들을 덮지는 않는다.

**1. 증거 보존·재사용·실행 조건**

- 직전 잡의 실행 원장·원시 로그·PDF/PNG/JSON을 재사용했다. sol 보고의 수치를 복사해 판정하지 않고, 검수 사본의 코드·로그·원시 픽셀 재집계·실제 DOM 증거와 대조했다. 이번 이어받기에서 추가 실행한 것은 응답성 33회, 구간 계측 33회, 변환 함수 대조, 실제 제거 클릭, 접근성 귀속 음성 대조, 정상성 독립 렌더 및 곡선 집계다.
- [시작 검사](evidence/review2b-start-check.json): 추적 파일 2,602개, 직전 잡 시작 SHA와 차이 0, archive 원본과 차이 0. 열린 계획서 19개를 검사했다. 이번 직접 위임은 저장소 불변 검수이며 구현 정본화·착수로 해석하지 않았다. [계획 충돌 확인](evidence/review2b-open-plan-scan.json).
- 종료 증거는 [불변 검사](evidence/review2b-invariance.json), 시작·종료 `review2b-*-status.txt`, `review2b-*-head.txt`, `review2b-*-branch.txt`, `review2b-*-sha.json`이다. 검사 명령은 `python3 probes/review2b-invariance.py`. 저장소 추적 파일 및 archive 파일 차이 0, HEAD·브랜치·status 동일. 사용자 미추적 4항목은 내용을 읽거나 변경하지 않았다. 금지된 다른 작업 디렉터리는 접근하지 않았다.
- 빌드·브라우저·시각 회귀는 직렬, `NODE_OPTIONS=--max-old-space-size=4096`. 포트는 기존 4270 QA 서버와 이전 검증의 4271/4279만 사용했다. Vite 서버는 `--strictPort`; legacy oracle의 임시 포트는 [4279 고정 shim](probes/strict-legacy-port.cjs)을 사용했다. 타 작업 서버는 사용하지 않았다.
- Chrome `152.0.7977.64`, Node `v22.17.1`, Poppler `24.02.0`. 브라우저 성능 표는 1280×900, DPR 1, CPU 제한 없는 데스크톱, 케이스마다 새 context, 3회 중앙값이다. 모바일 성능이나 다른 장치의 절대시간을 주장하지 않는다. 로컬 QA 빌드에서 측정했으며 광고 네트워크를 성능 곡선에 섞지 않았다.

**2. 정상 PDF 응답성: 크기별 곡선과 병목**

표준 `pdf-lib`의 PDF/stream 생성 API로 만든 1페이지 PDF를 제품의 `/en/tools/pdf-editor/watermark` 파일 입력으로 올렸다. pageCount 1, 8bit grayscale inline image, raw 계열 폭 1024, Flate 계열 폭 8192다. [생성 probe](probes/resume-performance.mjs) 및 기존 32/64MiB 생성·계측 probe와 PDF 자체를 보존했다. 큰 이미지를 포함하지만 문법을 잘라내거나 오류를 주입한 성능 입력이 아니다. 아래의 A1 문법 견고성 표본과는 구분한다.

11개 입력 모두 제품에서 `ready` 및 미리보기 표시까지 완료했다. 독립 `pdfinfo`와 `pdftoppm`도 각 11/11 exit 0이다. 상세 명령·출력·SHA는 [정상성 검사](performance/validity/results.json), 독립 렌더 PNG는 `performance/validity/`에 있다. 65,820B 입력은 [large-square-64.pdf](adversarial/large-square-64.pdf), SHA-256 `552aef6484246f312f8e7793c21f6f0fd7363e91c8d0d2e2b610158101076915`다.

계측은 20ms 주기 `setInterval`의 실제 간격, Long Tasks, 미리보기 `putImageData` 호출 시각, preflight/overlay DOM 변화를 함께 기록했다. “최대 간격”에는 정상 20ms와 스케줄링 오차가 포함된다. 완료시간에는 업로드 처리·UI 지연도 포함된다. “변환 구간”은 첫 `putImageData` 시작부터 마지막 호출 종료까지이므로 첫 chunk 준비 비용은 제외된다. 독립 CPU 프로파일로 그 구간의 실제 실행 함수를 확인했다.

| PDF | 실제 파일 B | 디코딩 stream B | 완료 ms | 최대 heartbeat 간격 ms (중앙값; 최소–최대) | 픽셀 변환 구간 ms |
|---|---:|---:|---:|---:|---:|
| raw-1024 | 1,579 | 1,085 | 420 | 47.87; 46.64–48.64 | 0.10 |
| raw-10240 | 10,799 | 10,302 | 429 | 55.03; 39.67–57.52 | 0.09 |
| raw-65536 | 66,095 | 65,598 | 433 | 45.99; 42.00–50.41 | 1.56 |
| raw-204800 | 205,364 | 204,863 | 431 | 39.70; 37.52–46.09 | 6.45 |
| raw-1048576 | 1,049,141 | 1,048,640 | 515 | 114.79; 113.60–126.18 | 104.32 |
| flate-1MiB | 1,614 | 1,048,639 | 511 | 84.72; 81.67–87.89 | 19.57 |
| flate-4MiB | 4,663 | 4,194,367 | 801 | 239.81; 231.17–244.97 | 211.41 |
| flate-8MiB | 8,744 | 8,388,672 | 1681 | 871.34; 865.82–893.76 | 830.47 |
| flate-16MiB | 16,899 | 16,777,280 | 4536 | 3327.64; 3308.59–3366.70 | 3279.51 |
| large-square-32 | 33,206 | 33,554,496 | 15037 | 13083.38; 13075.87–13157.62 | 12997.78 |
| large-square-64 | 65,820 | 67,108,928 | 55701 | 52293.00; 51879.92–52629.82 | 52136.77 |

![정상 PDF 크기별 응답 곡선](performance/responsiveness-curves.png)

[SVG](performance/responsiveness-curves.svg) · [CSV](performance/curve-summary.csv) · [33회 원시 heartbeat/상태](performance/browser-timings.json) · [회귀 계수](performance/curve-summary.json).

**판정: 해당 미리보기 경로는 제곱 증가다.** Flate 계열의 디코딩 이미지 크기를 M(MiB)로 두고 6개 중앙값에 절편 포함 2계수 모형을 비교했다. 선형 적합 R²=0.936434, RMSE=4,720.50ms; 제곱 적합 `gap_ms = 51.2384 + 12.7529 × M²`, R²=0.99999925, RMSE=16.20ms. 16→32→64MiB의 배수는 3.932배·3.997배, log-log 지수 1.987이다. 측정 범위와 아래 반복문 구조가 서로 지지한다.

파일 바이트 수만으로 모든 PDF에 적용되는 단일 복잡도 곡선을 만들 수는 없다. 66,095B raw PDF는 최대 간격 약 46ms인데, 더 작은 65,820B Flate PDF는 52,293ms다. 같은 압축·폭 조건에서 파일 크기와 디코딩 양이 함께 증가할 때 제곱성이 드러난다. 200KB·1MB raw 입력도 실제로 측정했지만, 이를 200KB·1MB 고압축 대형 이미지의 측정치로 취급하지 않았다. 미측정 크기로 외삽한 시간을 실측으로 기재하지 않는다.

| 구간 | 64MiB 입력의 증거 | 판정 |
|---|---|---|
| 브라우저 전체 | 프로파일한 1회 완료 56,174ms, 최대 간격 52,629.815ms, 최대 Long Task 52,619ms. 별도 간격 3,103.36ms도 존재 | 한 가지 검사만 느린 것이 아님 |
| 미리보기 변환 | CPU profile의 `Vw`(원본 `convertRGBToRGBA`) 샘플 52,289.884ms / 전체 56,245.48ms(약 93%). `putImageData` 512회 실제 호출 합계 약 156ms | 주 병목은 픽셀 변환의 JS 반복. canvas native 전송이나 lexer가 52초를 쓴 것이 아님 |
| 스트림 문자열화 | 브라우저 `Oe`(원본 `decodedStreamText`) 2,374.845ms 샘플 | 별도 주 스레드 정지 원인 |
| lexer | 브라우저 `Ge`(원본 `scanContent`) 240.538ms 샘플 | 종료성 수정은 유효하나 큰 입력에서 협력적 실행 없음 |
| Node 독립 구간 | load 0.498ms, decode 264.396ms, 문자열화 4,008.878ms, lexer 344.114ms, 실제 risk 검사 4,591.257ms, 실제 preflight 4,618.006ms(각 3회 중앙값) | 동일 입력·함수의 분리 계측. 다른 런타임이므로 브라우저 시간과 합산하지 않음 |
| 동기 검사 중 타이머 | 실제 `inspectWatermarkRisks` 직전 예약한 0ms 타이머가 4,591.650ms 뒤 실행 | 페이지 밖에서 한 번 yield하는 것으로 페이지 내부 큰 stream 검사의 취소 응답을 보장할 수 없음 |

증거: [브라우저 CPU profile](performance/browser-64MiB.cpuprofile), [상위 함수](performance/browser-profile-summary.json), [구간 33회](performance/segment-timings.json). 실제 위험 검사 시간은 같은 Flate 계열에서 거의 선형(R²=0.999951), lexer도 선형(R²=0.999897)이다. 위험 검사 자체가 52초 제곱 정지의 원인이라는 주장은 기각한다. 반대로 lexer만 빠르게 만들면 응답 문제가 해결된다는 주장도 기각한다.

**코드 위치와 원인:** `src/features/pdf-editor/pdfPreview.ts:50`의 공용 loader는 `isOffscreenCanvasSupported:false`, `isImageDecoderSupported:false`로 호출하며 `:141`의 `renderPdfThumbnail`이 렌더한다. 이 조건의 실제 호출 경로에서 설치된 `pdfjs-dist/build/pdf.mjs:10589`의 `putBinaryImageData`가 16행 chunk마다 `:9576`의 `convertRGBToRGBA`를 호출한다. 빠른 루프는 `srcPos`를 반영하지만 `:9602`, `:9615`의 잔여 루프 시작은 `j = i * 4`, 끝은 `srcPos + len`이다. 뒤 chunk일수록 이미 처리한 범위를 다시 돈다. 반복마다 짧은 destination 배열 범위 밖 쓰기도 이어져 연산이 낭비된다. 폭 W·높이 H에서 이 경로의 반복량은 대략 O(W·H²/16), 폭 고정 시 디코딩 픽셀 수의 제곱이다. 이 공용 loader 플래그는 fix-1에서 새로 도입한 변경이 아니지만 F2의 정상 업로드로 직접 도달한다.

원 함수를 추출한 독립 진단에서 잔여 루프의 시작만 `srcPos + i * 4`로 바꾼 후보를 **메모리 안에서만** 비교했다. 제품·의존 파일은 변경하지 않았다. 색이 변하는 RGB 데이터 1/4/8/16MiB의 결과 RGBA SHA가 모두 같았다. 16MiB에서는 기존 3,741.294ms→후보 72.226ms, destination 진행 합계 1,082,130,432→16,777,216. 4→8→16MiB 후보는 18.884→36.294→72.226ms였다. [진단](performance/conversion-diagnostic.json). little-endian 환경의 해당 함수 검증이며, 후보 적용 브라우저 전체·다른 endian·렌더 회귀 검증까지 통과했다는 뜻은 아니다. 이 결과는 수정 방향을 좁히는 증거다.

**취소 재현:** 33회 모든 업로드에서 `pdf-finish-cancel`이 나타나지 않았다. 별도 실제 입력 실험에서 업로드 약 5,186ms에 파일 제거 버튼 좌표로 CDP mouse down/up을 보냈으나 응답은 55,387ms, 파일 제거 확인은 55,408ms였다. click 핸들러도 업로드 약 55,372ms 뒤 기록됐고, 그 전에 512개 chunk가 모두 처리됐다. 제거 후 결과 다운로드 0. 따라서 “취소 버튼이 눌려 처리 중단”은 성립하지 않는다. 제거는 가능하지만 이 입력의 무거운 변환을 중단하지 못했다. [DOM·클릭 원시 기록](performance/browser-boundaries.json), [제거 뒤 화면](performance/after-delayed-remove.png).

**응답성 수정 지시 문안(다음 구현 계획에 정본화할 내용):**

1. 미리보기 RGB 변환의 `srcPos` 누락으로 발생하는 chunk 재처리를 제거한다. 위 두 잔여 루프를 고친 재현 가능한 의존 패치/생성 입력 경로를 정본화하고 원본 hash·버전·적용 검증을 고정한다. `node_modules`·`public/vendor`·dist를 손으로 고치는 방식은 사용하지 않는다. 이 리뷰에서 의존 버전 갱신이나 브라우저 호환 플래그 해제까지 승인한 것은 아니다. 기존 흰 canvas 문제 및 legacy 4모드 검증을 재실행해야 한다.
2. `watermark.ts:63`에서 이미지 바이너리를 포함한 decoded stream 전체를 문자열로 만드는 비용을 없애거나 줄인다. byte 단위로 필요한 토큰을 읽고 inline payload를 건너뛰는 경로를 사용하되 A3의 EI 오탐을 함께 고친다. 위험 검사·결과 검사 호출 경로 모두 같은 문제를 점검한다. 단순 파일 바이트 제한으로 정상 65KB PDF를 거부하거나 위험 검사 전체를 생략하지 않는다.
3. 속도 개선과 별개로 큰 stream 내부에도 작업량/시간 단위 macrotask 양보와 AbortSignal 검사를 넣는다. 페이지 경계 검사만으로 부족하다. `Promise.resolve()`만 추가하는 것은 사용자 이벤트 처리 양보가 아니다. 단일 라이브러리 decode 같은 분할 불가 구간은 시작·끝 abort 및 결과 등록 방지 계약을 유지하고, 실제 최장 동기 구간을 다시 측정한다. fontkit를 worker로 옮기는 범위 확대는 요구하지 않는다.
4. 업로드의 사전 검사·미리보기도 취소/파일 제거 수명주기에 묶고 이전 파일 결과·늦은 canvas 갱신을 막는다. 실제 브라우저 외부 이벤트로 검사 중 및 변환 중 취소를 보내고 이벤트 처리 시점·중단 시점·미등록·재시도 성공을 각각 기록한다.
5. 회귀 입력에 이 11개 유효 PDF와 동일 데이터의 압축/비압축·이미지 폭 변형을 남긴다. 총 처리시간과 최대 heartbeat/Long Task를 분리하고 3회 이상 재측정한다. 다음 정본에는 예를 들어 해당 데스크톱 QA 표본의 최대 heartbeat 200ms 이하·외부 취소 이벤트 후 UI 처리 250ms 이하 같은 명시적 목표를 확정한다(이 숫자는 **제안**, 기존 정본의 확정 숫자가 아님). 곡선의 제곱 증가 제거와 결과 렌더 보존을 동시에 완료 기준으로 둔다.

**3. A — R1~R9 해소 판정**

아래 재현 명령의 작업 디렉터리는 별도 표시가 없으면 산출물 루트다. 원본 probe의 하드코딩 경로는 bwrap으로 사본에 매핑했으며 probe 본문은 변경하지 않았다. [원본 SHA 비교](evidence/copied-probe-sha.json), [경로 어댑터](evidence/original-probe-adapter.json), 전체 명령은 [실행표](command-table.md)에 있다.

| 항목 | 판정 | 재현 명령·출력 | 수정 지시 문안 |
|---|---|---|---|
| A1 / R1 기존 566B 무한 정지 | 기존 P1 해소. 응답성 P2는 위 2절 별도 잔여 | 무수정 `engine-boundaries.mjs`·`browser-inline-hang.mjs`. [브라우저](browser-inline-hang.json) `status:ready`, heartbeat 21. `node --experimental-strip-types probes/adversarial-engine.mjs`: 주석·중첩/이스케이프 literal·hex·구분자·EI 유사 bytes·잘린 literal/hex·BI only/no EI·큰 inline 25개 child 모두 종료. `node --experimental-strip-types probes/cancel-fuzz.mjs`: 1,256개 스캔 모두 종료, 최장 1.916ms. | 종료성 수정 유지. 이것이 모든 입력의 시간 상한 증명은 아님. 큰 정상 입력은 2절 수리. 문법 견고성용 잘린/불균형 표본은 성능 정상 입력과 구분. |
| A2 / R2 descender | 원래 `gypqj` 손실 해소·글자 축소 없음. 다중 줄 타일 상단에 P3 잔여 | 무수정 `render-boundaries.mjs`의 뒤 항목은 동일 로직 continuation으로 재현. 현재 `gypqj` PDF.js 650, Poppler 741; 과거 baseline 위치가 다른 직접 대조는 659/741. 동일 위치의 BBox 확대 대조는 651/741로 PDF.js 1픽셀 AA 차이. [32개 추가+128개 재집계](golden-recount-all.json) 160/160 기대 수치 일치. `/WatermarkFont 36 Tf`, Helvetica baseline 7.452, Noto 10.368 확인. `render-new.mjs`·`bbox-controls.mjs`의 4회전·single/tile·마지막 줄 대조. | 폰트 크기를 줄이지 않고 실제 glyph 경계와 BBox 여유를 정리. Helvetica `MARK\ngypqj` tile의 Poppler 상단 손실(아래 설명)을 포함해 글자 상하 경계를 검증. |
| A3 / R3 배치·출력 검증 | 기존 완전 이탈 차단은 해소. **정상 입력 오탐 P2 및 빈 성공 P2 잔여** | `adversarial-engine.mjs`, `render-new.mjs`, `browser-new.mjs`, `browser-focused.mjs`. ko/en offset 300의 200pt 페이지는 `empty-placement`, 버튼 disabled. 독립 signed-axis 열거 384개 mismatch 0. 4회전×2layer×2pattern×3offset=48 기본 정상 출력 성공. 정상 clip/음수 rect도 성공. 반면 아래 597B inline 및 회전 이미지·공백 반례가 실제 UI로 도달. | EI 경계 분석·실제 가시 교차·공백 입력 검증을 보완. 구조상 `Do`와 XObject 존재를 실제 표시의 충분조건으로 취급하지 말 것. 정상 결과의 포괄 차단 금지. |
| A4 / R4 내부 3탭 | 해소 | [browser-new.nav](browser-new.json), 320/390 ko/en 네 조합. 탭 폭 93.33/116.66px·높이 56px, 내용 bbox 수용, 인접 겹침 0. 전후 4장 직접 열어 확인. 상위 navigation active/fade 단언 유지, start/end 8 blob 동일. | 현 수리 유지. |
| A5 / R5 F1 여러 줄 | 해소 | ko/en `FIRST\nSECOND`: white-space pre-wrap, max-width 60%, weight 500, opacity .9, line-height 12px(1.2); 두 줄 y차 12px. break-words 소스 확인. F2는 별도 배치·크기 overlay. | F1/F2 의미 분리 유지. |
| A6 / R6 tile 미리보기 | 해소(근사 범위) | 실제 공용 배치 함수·PDF.js source viewport·이미지 100×50 비율 사용. 크기/간격/x/y 각각 변경 시 ko/en preview count 18→12→8→4→4, 출력 count 동일. offsetY는 수가 같아도 위치 변경. 400×600 페이지 60% 이미지 실제 240×120, preview width 60%/height 20%. [원시 UI/출력 위치](browser-new.json). | 고정 18개가 아님. DOM 텍스트와 PDF font metric의 픽셀 완전 동일성은 주장하지 말고 근사 안내를 유지. |
| A7 / R7 확정 범위·취소 | 확정 범위·overflow·tile 취소 해소. 업로드 취소는 2절 잔여 | [ranges 21·regions 21·tiles](adversarial-engine.json): .01/1 통과, .009/1.01 오류; 1% 범위 허용(좁은 text는 별개 narrow-region), 이미지 1% 성공; 0/101% 오류; gap 0/2000 통과·2001 오류; 양축 ±2000 허용·±2001 오류. 400 placements 허용·401 tile-limit. 6영역 수평 말줄임/수직 제거 경고·ellipsis보다 좁은 영역 오류·중앙 전체 유효폭. [cancel-fuzz](cancel-fuzz.json) 실제 400 tile AbortError 26.077ms, 취소 후 응답 .345ms, contentAdded false; full-engine AbortError 52.521ms, 응답 .128ms, 재시도 2,221B. | 수치와 cap 400 유지. 페이지/tile 양보를 stream 내부 협력 취소와 혼동하지 말 것. UserUnit 지원은 PDF.js viewport 해석 범위로 한정. |
| A8 / R8 incomplete 귀속 | 보존·JSON 음성 게이트는 해소, **DOM 귀속 P2 잔여** | 원 감사 12페이지 violations 0, incomplete 925, F2 0/shared 925 재현. [6개 음성 변조](a11y-aggregation-negative.json)는 모두 실패. 실제 F2 이미지 입력·문구는 marker 밖이어서 shared로 분류. 추가 gradient로 그 실제 문구에 incomplete 2개를 유도하면 **F2 0/shared 2로 통과**. [실제 DOM 대조](performance/browser-boundaries.json). | 모든 F2 고유 동적 문구의 소유 marker를 빠짐없이 지정. selector 미발견/해석 불가를 shared로 자동 처리하지 말고 오류로 처리. 실제 DOM을 이용한 text/image/risk/error 상태 회귀 필요. |
| A9 / R9 사용자 안내 | 기존 stream/internal structure 제거·예외 경계 유지. **새 내부 명칭 P3 잔여** | 바뀐 locale 14키 ko/en·placeholder 일치, finish keyset 동일. `browser-new.json`의 양 언어 실제 오류는 행동·결과 중심이며 원시 예외 없음. 그러나 `pdf.finish.previewDisclaimer`에 `PDF.js`·`UserUnit viewport coordinates` 노출. [locale 전수](evidence/locale-audit.json). | 사용자 안내는 회전·보이는 페이지 기준 근사 위치와 저장 파일 확인으로 표현. 구현/지원 한계의 기술적 자세한 설명은 문서에 남긴다. 아래 ko/en 문안 사용 가능. |

A1 원본 engine probe는 새로 올바르게 차단된 배치에 대해 과거의 “성공해야 한다” 전제로 종료했다. 원본 render probe도 이제 생성되지 않는 그 출력 PDF에서 멈췄다. 이 실패를 숨기거나 원본 probe를 고쳐 통과로 기록하지 않았다. 후속 동일 렌더 코드와 별도 반례로 미실행 부분을 채웠다. `adversarial-engine.json`의 최초 cancel 항목은 `decorate`라는 틀린 phase를 기다려 abort를 요청하지 않은 실험이므로 취소 판정에서 제외했다. 위 표의 수치는 이를 교정한 독립 `cancel-fuzz` 실행이다.

A2 잔여의 범위: `bbox-controls.json`에서 Helvetica 두 줄 tile 원본 Poppler red 16,023/12,144(회전별 반복) → BBox 상단만 +20pt인 진단 대조 16,137/12,208. 하단만 확장하면 수치가 변하지 않는다. PDF.js는 상단 확장에서 14,520/10,972로 동일하다. Noto의 해당 상단 대조는 동일하다. 원본·상단 대조 PNG를 직접 열었으며 큰 descender 절단이 재발한 것은 아니다. 제한된 raster 경계 손실(P3)로 판정하며 renderer 간 무조건 동일 수치, 또는 모든 glyph 경계가 해결됐다고 확대 해석하지 않는다.

**A3 잔여의 제품 입력 도달성 및 수정 문안**

| 반례 | 실제 관찰·대조 | 다음 수정 지시 |
|---|---|---|
| 정상 inline payload 안의 EI 유사 bytes | [597B PDF](adversarial/inline-ei-delimiter.pdf)는 폭이 payload 길이인 정상 1행 grayscale inline image다. ` EI) Q Q 0 0 0 0 re W n `이 이미지 bytes에 포함된다. 원본 렌더 PDF.js/Poppler dark 5,600/5,751로 이미지 표시. 현재 scanner는 중간 EI를 끝으로 읽어 위험 경고를 만들고, 동의 뒤 foreground 완료도 `output-validation`/원인 `watermark-clipped`로 거절한다. ko/en UI 다운로드 0. 결과 validator만 생략한 **진단 전용** 출력은 두 renderer에서 red 288/308로 정상 워터마크가 보인다. | `watermark.ts:86`의 inline 경계를 dictionary·data encoding에 맞게 판별하고 데이터 bytes를 연산자로 읽지 않는다. 불확실한 스캔을 “확실한 empty clip”의 근거로 사용하지 않는다. 경고/동의 계약은 유지하고 정상 후보 결과의 잘못된 차단을 막는다. EI 뒤가 whitespace인 다른 표본은 이미 두 renderer의 원본 표시가 달라 이 오탐의 주 증거로 삼지 않았다. |
| 정상 blank PDF + 회전한 이미지의 완전 이탈 | 200×200 PDF, 빨강 100×50 PNG, tile·60%·45°·offsetX/Y 180. preflight 오류 0, UI 성공 1,104B 다운로드. 양 renderer red/dark 0. 0°·180 대조 red 400/400, 0°·199는 1/1로 실제 극소 교차를 구분한다. [입력/출력 실험](render-new.json), [실화면](browser-focused.json). | 배치의 축 정렬 외접 상자 교차를 실제 회전 영역 교차로 오인하지 않는다. 회전 사각형과 유효 페이지 영역의 면적 교차가 0인 경우 필드 오류. 실제로 1픽셀 보이는 양성 대조를 과잉 차단하지 않는다. |
| 공백·줄바꿈만 입력 | UI에서 `"   "`와 `"\n\n"`이 오류 없이 다운로드(1,256/1,271B). 엔진 대조도 양 renderer 표시 0. | 템플릿 확장 뒤 가시 문자열이 없는 입력을 사전 필드 오류로 처리하고 ko/en 행동 안내. `Do` 존재 검사만으로 빈 glyph 결과를 성공시키지 않는다. |
| 위험 문서에 대한 “가시 clip/path” 검사의 한계 | 기존 견고성 fixture `underflow-line/disjoint/evenodd`에서 동의 후 foreground 출력의 양 renderer red 0, background는 311/314. zero rectangle만 검사하면 일반 path/clip 면적·교집합은 보장하지 못한다. 이 문법/graphics-state 견고성 입력은 정상 65KB 성능 입력의 근거가 아니다. | 검증을 완전한 가시성 판정이라고 문서화하지 않는다. 위험 경고+동의 계약을 유지하면서 확실히 판정 가능한 비표시를 실패시키고, 불확실한 경우의 결과 확인 안내/추가 검증 정책을 정본화한다. 단순히 모든 위험 문서를 거부하거나 자동 다른 layer로 바꾸지 않는다. |

A9 제안 문구: ko “미리보기는 페이지의 회전과 보이는 영역을 기준으로 위치를 대략 보여 줍니다. 저장한 PDF의 글자와 이미지가 조금 다를 수 있으니 다운로드 후 확인해 주세요.” en “The preview shows approximate placement using the page rotation and visible area. Text and images may look slightly different in the saved PDF, so check it after downloading.” 기술 문서의 UserUnit 범위 제한은 삭제하지 않는다.

**4. 접근성 수동 판정과 UI 계획 귀속**

정규 12페이지 실행의 925개는 color-contrast 922 + ARIA 관련 3이다. `a11y-glyph-contrast.json`의 실제 glyph 배경 픽셀과 스크롤 후 `a11y-visible-recheck.json`을 대조한 [수동 집계](evidence/resume-a11y-adjudication.json)는 다음과 같다. “기준 이상”은 측정 표본에 대한 판정이며 사이트 전체 접근성 통과가 아니다. 일부 글자 배경만 기준 미달이면 미달로 계산했다.

| 페이지 | 대비 노드 | 기준 이상 | 미달 | 미측정 잔여 | ARIA 보류 |
|---|---:|---:|---:|---:|---:|
| home | 5 | 5 | 0 | 0 | 0 |
| document-compare | 43 | 28 | 15 | 0 | 0 |
| tools | 198 | 169 | 28 | 1 | 1 |
| excel-compare | 64 | 53 | 11 | 0 | 0 |
| pdf-editor | 47 | 30 | 16 | 1 | 0 |
| pdf-finish-ko | 47 | 31 | 16 | 0 | 0 |
| pdf-finish-mobile-ko | 31 | 19 | 12 | 0 | 0 |
| pdf-finish-en | 47 | 31 | 16 | 0 | 0 |
| pdf-watermark-ko | 47 | 31 | 16 | 0 | 0 |
| hwp-editor | 43 | 29 | 14 | 0 | 1 |
| home-mobile-ko | 171 | 162 | 9 | 0 | 0 |
| tools-mobile-ko | 179 | 155 | 23 | 1 | 1 |
| 합계 | 922 | 743 | 176 | 3 | 3 |

1차의 tools 미달 28·pdf-editor 미달 16은 그대로다. 이월 노드는 현재 925개로 기록되어 있고, `docs/backlog.md` 「공용 UI 접근성 incomplete 정리」가 `docs/jobs/todo/ui-theme-redesign-20260907.md`를 대상으로 지정한다. 해당 계획이 참조하는 `ui-redesign-rounds/probes-r2/GATES.md`의 W2·W5는 axe 0뿐 아니라 **미판정 incomplete 0**, 4테마 DOM 최소 대비, selector 0건 FAIL을 요구한다. 따라서 부채를 감당할 게이트는 이미 존재한다. 계획 부재 때문에 보완 승인을 기다릴 사항은 없다.

다만 F2의 이번 분류 누락을 그 공용 부채에 합쳐 넘길 수는 없다. `tests/accessibility-audit.mjs:43,145`는 marker 밖 또는 `querySelector` 실패를 모두 shared-existing으로 처리한다. 실제 watermark 이미지 label/hint가 이 경로에 있다. 추가 gradient는 분류 실험용이며 기본 화면에 F2 contrast violation 2개가 발견됐다는 뜻이 아니다. 실제 기본 화면의 F2 incomplete 0과 **분류기가 미래의 F2 incomplete를 놓친다는 증거**를 구분한다. watermark에서 공유하는 region 선택기도 blanket marker 부재가 확인됐으나, 공용 위젯의 모든 문구를 F2 신규 소유로 단정하지 않는다. 확실한 고유 반례는 이미지 입력 label/hint다.

**5. B — 되돌림·부작용·번들·시각 검수**

| 항목 | 판정 | 재현 명령·출력 | 수정 지시 문안 |
|---|---|---|---|
| B10 배경 stream·중복 ref | 유지 | `node --experimental-strip-types probes/contracts-new.mjs`: background→q 보호→기존 stream→Q 순서, 기존 중복 `4 0 R` 2회 보존, foreground/background 별도 호출 원본 보호. [구조 증거](contracts-new.json). | 없음 |
| B10 리소스 재사용 | 유지 | 같은 probe의 single/tile/300tile 이미지 XObject 각 1, `Do` 1/18/300, 출력 1,063/1,137/1,826B. Noto font load 1·descriptor 1. | 없음 |
| B10 골든·이미지 배율 | 유지, UserUnit 한정 | 원본 128 이미지 + 추가 descender 32 = 160 독립 재집계, mismatch 0. 이미지 원비율/페이지 대비 크기 확인. UserUnit=2의 PDF.js·Poppler 표시 차이는 기존 제한으로 명시. | 모든 renderer의 UserUnit 동일성으로 확대하지 말 것 |
| B10 legacy·기존 4모드·도구 수 | 유지 | `fixtures:pdf-legacy-oracle` diff 0. scope PDF 및 전체 browser, recovery 기존 4모드 성공. `tool-registry-routes` 도구 20. 기존 4모드 소스 blob 차이 0. | 없음 |
| B11 기준선 28장 | 변경 타당, 안내 P3 별도 | [28개 개별 판정·전후 원해상도 링크](visual-diff/INSPECTION.md). header-footer 8, page-numbers 8, watermark 8, navigation 4 모두 직접 열어 판정. R4 세로 탭·R5 F1 glyph/여러 줄 복원 타당. start/end navigation 8개 blob 동일. | 내부 안내 수리 뒤 영향 있는 기준선만 실제 화면과 대조 |
| B12 scoped 번들 | 통과 | `BUNDLE_BASELINE=/tmp/s3-bundle-baseline.json BUNDLE_ROUTES=pdf-editor npm run bundle:measure`: exit 0, [scoped](bundle-scoped.json). 아래 수치 일치. | 없음 |
| B12 무범위 표준 비교 | **실패를 그대로 인정** | `BUNDLE_ROUTES='' npm run bundle:measure`: exit 1, `baseline.perRouteJsGzip.audio-studio must be a finite non-negative integer (bytes).` [원시 로그](logs/bundle-full.log). | 이 명령 자체를 PASS로 바꾸어 기록하지 말 것 |
| B12 전체 재집계 | 대체 계산 타당 | 기존 baseline files의 route 귀속·gzip을 보존하고 집계 대상만 19개로 확장. missing owner 0, 기존 PDF 171,864B 동일, scoped/global files inventory 동일. [독립 19경로 표](evidence/resume-bundle-recount.json) 및 [비교·이동 항목](bundle-full-comparison.json). 총 2,450,827→1,962,228B, −488,599B. baseline 수정·0 가정·budget override 없음. | 다음 기준선은 전체 귀속을 포함하되 기존 파일을 이번 검수에서 덮어쓰지 않음 |
| B10 CLS | 유지 | `test:rendering` 7대상×3. watermark max CLS 0.0001480366. [원시 측정](rendering.json). | 없음 |
| B10 광고·정적 경로 | 유지 | production ko/en ads ready/script/request 각 1; 외부 요청은 검사에서 stub하여 호출 여부만 확인. QA는 script/request 0. [production 검사](production-ads.json), QA a11y/rendering externalRequests 0. build 69 정적 페이지·static 116 recovery 문서 확인. | 실제 광고 인벤토리 송출까지 검증했다는 뜻은 아님 |

| 번들 항목 | 증가 B | 한도 B | 잔여 B |
|---|---:|---:|---:|
| entry JS gzip | 7,128 | 20,480 | 13,352 |
| PDF route JS gzip | 20,415 | 61,440 | 41,025 |
| shared JS gzip 순증 | 2,171 | 30,720 | 28,549 |
| app JS gzip | 30,494 | 81,920 | 51,426 |
| CSS gzip | 235 | 10,240 | 10,005 |

shared gross 511,965B에서 이동 509,794B를 분리했다. 이동은 QR 509,380B + image-studio 414B다. 음수 전체 route delta를 새 PDF 기능의 예산 여유로 상계하지 않았고 PDF route +20,415B를 따로 유지했다. 전수 route 목록은 audio-studio, data-converter, document-compare, excel-cleaner, excel-compare, hwp-editor, image-privacy, image-studio, office-editor, payroll-calculator, pdf-editor, qr-studio, security-tools, text-formatter, text-merger, text-tools, timezone-calculator, video-studio, work-calculator이다. tools registry 20과 bundle owner 19는 서로 다른 집계 단위이며 누락을 0으로 메운 것이 아니다.

**6. C — 기록·범위**

| 항목 | 판정 | 재현 명령·출력 | 수정 지시 문안 |
|---|---|---|---|
| C13 기록 정정 5건 | 반영 | `docs/review-notes.md` fix-1 정정에 시각 20개 실제 이유(F1 glyph·안내·하단 흐름 및 내부 탭), glyph coverage 기준 font 선택, QR/image 이동량, UserUnit 제한, R1~R9 및 Claude 확정 opacity/size/gap/offset·cap 근거 명시. CHANGELOG는 Codx 서명·간결 기록. | 다음 수리 기록에는 이 보고의 실제 잔여와 재측정 값을 반영. 기존 “가시 출력 검증”을 완전 보장으로 표현하지 않음 |
| C14 공용 접근성 부채 | 귀속·게이트 존재 | backlog의 925/shared·F2 0 측정 및 UI 계획 링크, W2/W5 판정 기준 확인(4절). | F2 귀속 결함은 별도 수리. 공용 미달·보류 수동 표를 UI 계획의 후속 측정 입력으로 전달 |
| C15 변경 범위 | 준수 | `git diff --stat 5767f13..15bad33`: 46파일=코드/locale/하네스/기록 18 + PNG 28. [목록·금지 그룹 검사](evidence/scope.json). dependencies/vendorGenerated/office/legacyPdf 모두 빈 배열. `pdfPreview.ts`는 sourceWidth/sourceHeight 정보 추가(+3/−1)만. 기존 4모드·새 폰트·새 의존 0. | 후속 성능 수리가 공용 preview에 닿으므로 legacy oracle 및 기존 흰 canvas 회귀를 다시 완료 기준에 포함 |

원시 예외 노출 검색은 확장자 `.cjs/.css/.html/.js/.mjs/.ts/.tsx`의 추적 실행 파일 387개를 대상으로 했다. [source hits 및 파일 단위 예외](evidence/raw-error-scan.json)에 생성물·vendor·검증 문자열을 구분해 보존했다. F2 UI 오류 매핑 경계의 원시 예외 신규 노출은 발견하지 않았다. 공용 thumbnail 등 기존 source hit를 사이트 전체 해소로 간주하거나 이 검수에서 수정하지 않았다. 전체 locale keyset의 기존 불일치 6개는 finish 변경 키가 아니며 14개 변경 키 및 finish 영역은 일치한다.

**7. D — 완료 기준 실행 결과와 실패 보존**

직전 잡이 이 archive에서 실제 수행한 아래 결과를 재사용한다. [실제 명령·exit·소요시간·로그 전수](command-table.md), [기계 판독 실행 원장](commands.jsonl), [공통 환경](environment.json). 초기 서버 부재/infra 실패와 성공 재시도를 함께 보존했다. 복구 뒤 원본 browser/a11y 측정은 exit 0으로 다시 생성됐으며 초기 실패 산출물을 최종 측정으로 쓰지 않았다.

| 완료 기준 | 실제 결과 |
|---|---|
| `npx tsc -b --pretty false` | exit 0 |
| `npm run test:unit` | exit 0, 312/312 |
| `npm run build` | exit 0, 2,847 modules, 정적 69 |
| `npm run test:static` | exit 0, recovery 문서 116 |
| `npm run test:pdf-finish` | exit 0, 141.871초, F2 단계 direct 진입 16 검증 |
| `TEST_SCOPE=pdf npm run test:browser` 및 전체 | 각각 exit 0 |
| `test:new-tools`, `test:utilities`, `test:office` | 각각 exit 0 |
| `test:qr-bulk`, `test:qr-font-render` | 각각 exit 0 |
| `test:recovery` | exit 0, 147 |
| `fixtures:pdf-legacy-oracle` | exit 0, diff 0 |
| `test:excel-cleaner`, `test:excel-compare` | 각각 exit 0 |
| ko/en 환경의 `test:visual` | 각각 exit 0, 211/211. 456.231초+457.529초=15.229분. 두 실행 모두 자체 ko/en matrix를 포함하므로 211개의 별도 언어 전용 테스트로 표현하지 않음 |
| `VITE_LOCAL_QA=1 npm run build` | exit 0 |
| `A11Y_MAX_TOTAL=0 npm run test:a11y` | exit 0, violations 0/incomplete 925. 귀속 결함 때문에 이것만으로 F2 게이트의 완전성 보장 불가 |
| `test:rendering` | exit 0, 7대상×3 |
| `bundle:measure` | scoped exit 0, 무범위 exit 1 유지, 전체 파일 기반 재집계 exit 0(5절) |
| `css:orphans`, `legacy:manifest`, `tool-registry-routes`, `git diff --check 5767f13..15bad33` | 각각 exit 0. legacy 규칙 155개(removed 153/split 0/active 2), registry 20 |

이번 추가 재현 명령은 아래와 같으며 세 Node 실험은 각각 exit 0으로 원시 결과를 썼다. fixture 정상성 검사는 같은 본문을 먼저 inline Python으로 실행했고 재현용 파일로도 보존했다. plot용 Python 라이브러리는 `/tmp/.../tmp/plotdeps`에만 설치했으며 제품 의존성을 바꾸지 않았다.

```bash
cd /tmp/worklazy-u4-4-review2
NODE_OPTIONS=--max-old-space-size=4096 node probes/review2b-browser-performance.mjs
NODE_OPTIONS=--max-old-space-size=4096 node --experimental-strip-types probes/review2b-segments.mjs
NODE_OPTIONS=--max-old-space-size=4096 node probes/review2b-browser-boundaries.mjs
python3 probes/review2b-validity.py
PYTHONPATH=/tmp/worklazy-u4-4-review2/tmp/plotdeps MPLCONFIGDIR=/tmp/worklazy-u4-4-review2/tmp/matplotlib python3 probes/review2b-curves.py
python3 probes/review2b-invariance.py
```

로그: `logs/review2b-browser-performance.log`, `logs/review2b-segments.log`, `logs/review2b-browser-boundaries.log`, `logs/review2b-curves.log`, `performance/validity/results.json`, `logs/review2b-invariance.log`. 반례 탐색 probe의 exit 0은 “반례 없음”이 아니라 측정 완료를 뜻한다.

**종결: [수정 후 재검수].** U4-5 착수 통과 선언은 하지 않는다. Claude가 위 P2/P3 잔여와 수정 문안을 정본화하고, 구현 후 정상 입력 응답성·취소·오탐/빈 성공·귀속 분류 및 영향 회귀를 통과시킨 뒤 게이트를 판정해야 한다. 번들 잔여는 위 표의 13,352/41,025/28,549/51,426/10,005B로 확인됐다.

지정 main `597a92ff56ed9c3eb23755a58df2580b0269b8bd` 동기화는 수행하지 않았다. 공통 조상 `5bc6854` 기준 양쪽 변경 공통 파일은 CHANGELOG·review-notes·package.json이고, 격리 git-data의 merge-tree 예측상 기록 두 파일은 충돌, package.json은 자동 병합이다. [공동 표면](evidence/main-sync-common-surfaces.json), [실제 merge-tree 출력](evidence/main-sync-merge-tree.log). locale `features.json`·SEO/정적 입력·a11y/visual/browser 하네스는 이후 동기화 때 재확인할 공동 표면이지만, 이 특정 두 HEAD에서 이미 충돌했다고 꾸며 기록하지 않는다.
