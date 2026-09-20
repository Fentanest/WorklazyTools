U4 PDF 마무리 v6 — Codex astra 5차 반박 (Codx, 2026-09-06)

**판정: [재왕복 필요]. 잔여 이견 4건 = D3·D4·D5·N3. D1·N1·N2는 [동의·해소]. Claude–Codex 간 이견 0에 도달하지 않았다.**

**D5의 공용 메인 스레드 폰트 그래프는 탐색 빌드 1회로 5종 예산을 통과했다.** D5의 남은 이견은 예산 해법이 아니라 실행 realm 설명·협력적 취소의 경계다. 상한·기준점 변경을 제안하지 않는다.

| 게이트 | 기준 gzip B | 탐색 gzip B | 총 Δ B | 게이트에 쓰는 Δ B | 상한 B | 판정 |
|---|---:|---:|---:|---:|---:|---|
| entry | 299,283 | 299,286 | +3 | +3 | 20,480 | PASS |
| 선택 PDF route | 171,864 | 184,858 | +12,994 | +12,994 | 61,440 | PASS |
| shared | 2,716,489 | 3,223,836 | +507,347 | **순증분 +80** | 30,720 | PASS |
| app JS | 5,456,199 | 5,469,463 | +13,264 | **순증분 +13,264** | 81,920 | PASS |
| CSS | 37,687 | 37,687 | 0 | 0 | 10,240 | PASS |

QR→shared 이동은 **507,267B**다. QR route 자체는 총 Δ **−507,103B**, 순증분 **+164B**다. 이동을 app에서 다시 빼지 않았다. multiplier=1, overrides={}.

**실행 범위·게이트**

- 첫 실행은 `cat PROJECT_RULES.md`. AGENTS, 지정 dispatch, PDF 계획 전문(최신 v6 우선), roadmap §2·S3·결정 10/11, 3·4차 REPORT 전문 및 관련 QR 폰트·번들 기각 이력을 읽었다. 열린 계획 16개를 스캔했다. U4 전체 OTF 유지와 S2b QR 전송 폰트 감량의 경계는 여전히 정합한다. S2b가 `qrLabelPdf.ts` 주변을 함께 만지므로 실제 구현 병합 시 U4 공용 import와 QR 선택 자산 로직을 둘 다 보존해야 한다.
- 시작 HEAD=origin/main=`1a04f2571109495a76b8468af95b2f4edcd862cf`, branch=main. 알려진 AGENTS·CLAUDE 변경 및 사용자 미추적 3파일을 관찰했다.
- 새 파일·수정·빌드·브라우저 프로필·PDF·PNG·로그는 **`/tmp/worklazy-u4-r5/`에만** 만들었다. 저장소에서 npm 설치, build/prebuild/generator, 파일 수정, 계획 편집, 커밋, push를 수행하지 않았다. node_modules는 읽기 symlink로 재사용했다. 3·4차 원자료도 읽기만 했다.
- **종료 시 외부 세션의 문서 커밋과 계획 갱신이 관측됐다. 전체 불변 검사는 실패를 그대로 기록했다.** 제품 소스·의존 입력·dist·PDF v6 계획의 불변과 실험 유효성은 별도 대조했다. 상세는 마지막 절.
- 제품 구현 완료 검수가 아니다. 아래는 실행한 탐색/probe/관련 unit의 결과이며, 아직 없는 U4 전체 build·브라우저·static·9게이트 통과를 주장하지 않는다. 후속 구현자나 외부 조사 에이전트는 소환하지 않았다.

**증거 색인 — 모든 경로는 `/tmp/worklazy-u4-r5/` 기준**

| ID | 실제 명령 | 결과·원자료 |
|---|---|---|
| E5-1 | `NODE_OPTIONS=--max-old-space-size=4096 node /tmp/worklazy-u4-r5/probes/build-shared.mjs` | exit 0. **새 탐색 빌드 정확히 1회**. `logs/build-shared.log`, `capture-shared-pdfFontEmbed.json`, `builds/shared-pdfFontEmbed/` |
| E5-2 | `node /tmp/worklazy-u4-r5/probes/measure-shared.mjs` | exit 0. 4차 계측/수식으로 baseline 재측정 및 새 그래프 5종 PASS. `bundle-result.json`, `logs/measure-shared.log` |
| E5-3 | `node /tmp/worklazy-u4-r5/probes/meter-checks.mjs` | exit 0. 5종 상한/상한+1 **10검사**, 잘못된 수치 **60거부**, 이동만/구 metadata 누락/정수 나머지 배분 단언 PASS. `meter-integration.json`, `logs/meter-checks.log` |
| E5-4 | `node /tmp/worklazy-u4-r5/probes/raster.mjs` | 최종 exit 0. 실제 Chrome Pixel 7 에뮬레이션의 PDF.js→canvas→PNG/JPEG→pdf-lib→최종 PDF→Poppler. `raster.json`, `raster/`, `logs/raster.log` |
| E5-5 | `node /tmp/worklazy-u4-r5/probes/text-cancel.mjs` | exit 0. 실제 pdf-lib/fontkit, 이벤트 루프 취소, N1/N2 산술 골든. `text-cancel.json`, `logs/text-cancel.log` |
| E5-6 | `node /tmp/worklazy-u4-r5/probes/structure.mjs`; `pdftoppm -r 72 -png -singlefile …ocg-*.pdf …`; `node /tmp/worklazy-u4-r5/probes/ocg-check.mjs` | 최종 각 exit 0. graph 보존/필터·OCG 렌더·PDF.js 경고. `structure.json`, `ocg-check.json`, `logs/structure.log`, `logs/ocg-poppler.json`, `logs/ocg-check.log` |
| E5-7 | `node /tmp/worklazy-u4-r5/probes/r2.mjs`; `node /tmp/worklazy-u4-r5/probes/r6.mjs` | 각각 exit 0. 4차 생성기를 출력 경로만 바꿔 재실행, 4개 PDF bytes/SHA 동일. 암호 입력·permissions·R6 Poppler 교차. `logs/r2.log`, `logs/r6.log`, `logs/source-summary.log` |
| E5-8 | `node --test --experimental-strip-types tests/unit/bundle-budget.test.ts tests/unit/visual-clock.test.ts tests/unit/visual-config.test.ts` | exit 0, **21/21**. `logs/current-unit.log` |
| E5-9 | `python3 /tmp/worklazy-u4-r5/probes/source-evidence.py` | 파일/줄/API/계획 원문 명령 14개 기록. `source-commands.json`, `logs/source-evidence.log` |
| E5-10 | `python3 /tmp/worklazy-u4-r5/probes/verify-unchanged.py` | **exit 1**: 외부 HEAD/문서/mtime 변경. `unchanged.json`, `logs/unchanged.log`, 보충 `concurrent-changes.json`, `scope-integrity.json` |

실패도 보존했다. E5-4 첫 시도는 Puppeteer에 `KnownDevices['Pixel 7']`가 없어 node exit 1(`logs/raster-attempt1.log`). 기존 설치된 Playwright의 Pixel 7 descriptor를 Puppeteer viewport/UA에 적용한 뒤 통과했다. 그때 남은 **이번 probe 전용** Chrome만 종료했다. E5-6 첫 시도는 재사용 코드의 `outline` 식별자 중복으로 node exit 1(`logs/structure-attempt1.log`); 중복명 수정 뒤 통과했다. 초기 wrapper의 뒤따른 cat exit 0을 node 성공으로 취급하지 않았다. 이후 clean AP와 dirty 한글 AP를 구분해 추가 검증했으며 앞 로그도 보존했다.

**7개 항목별 판정**

| ID | 판정 | 해소된 부분 | 남은 결정·실측 근거 |
|---|---|---|---|
| D1 | **[동의·해소]** | R2/R6별 `/P`와 permissions 4행이 E5-7과 일치. 제품 거부는 배열 길이와 무관한 `permissions !== null`. 생성 결정성도 재확인 | U4-0 생성 결과를 기준으로 SHA를 고정한다는 문안 유지. 이 라운드의 R2 891/892B와 과거 다른 생성기 915/916B를 혼용하지 않음 |
| D3 | **[이견 1]** | 지표 분리, 실기기 부재 표시, 150 기본값, 300DPI 모바일 포맷 셀, 반복·OPFS/부분 성공 방향에 동의 | x-height는 측정 가능하지만 **Poppler 재렌더 DPI 미고정으로 같은 출력이 PASS/FAIL**. B의 관측 지표만 있고 여전히 누적 예산 판정/사전 추정의 결정식이 닫히지 않음. E5-4/5, 아래 상세 |
| D4 | **[이견 1]** | 보존표의 주요 public API 실현성 확인. named/direct destination, form, CropBox와 선택적 attachment/metadata 제거를 동시에 구현 가능 | **OCG 구조 삭제의 content 처리·허용 시각 변화와 확정 25의 실제 파손 차단 경계**가 남음. E5-6에서 OFF 내용 0→6,400 red pixels, PDF.js missing property 경고. 단순 경고 후 제거를 불가능하다고 주장하는 것이 아니라 출력 의미를 고정해야 함 |
| D5 | **[예산·그래프 동의 / 실행 계약 이견 1]** | 공용 main 그래프 5종 PASS. 계산식·수집·상한·QR import·legacy worker 불변은 성립 | `await`만으로 입력 이벤트에 양보되지 않음. 단일 페이지 embed/draw/save 중에도 취소가 지연됨. PDF.js의 canvas 렌더·최종 pdf-lib 처리가 모두 worker라는 설명은 실제 코드와 다름. 양보 방식·단계별 abort/결과 확정·adapter 실제 적용 범위를 한 번 더 고정 필요 |
| N1 | **[동의·해소]** | 파일별 exact set, 썸네일 후 parity=all·canonical text, 별도 하한, 빈 set 비활성으로 주어진 전이 결정 가능. E5-5 `{2,3,4,6,8}` 재현 | 파일별 하나의 선택 정본이라는 v6 문안으로 읽는다. 뒤에서 기능별 독립 선택 상태를 추가해 의미를 다시 바꾸지 말 것 |
| N2 | **[동의·해소]** | 중심+상대 폭+고유 비율, 먼저 균등 축소 후 중심 clamp가 결정적. E5-5 80×60→120×90, 좁은 100×10에도 ratio=4/3 | clamp가 필요한 경우 정규화 중심이 이동하는 것은 v6가 정한 예외다. 기존 rectangle 표기는 정본화 시 파생 4모서리 표현으로 통합 |
| N3 | **[이견 1]** | CRLF/CR→LF·줄 분리 후 coverage는 다중 행 U+000A 오류 해소. U+2026은 두 폰트 모두 지원 | 제어문자 coverage 제외만으로 최종 draw 문자열이 안전해지지 않음. missing glyph 안내 뒤 차단/계속·잘린 꼬리의 coverage 우선순위, 말줄임조차 안 들어가는 폭·수직 overflow·타일 연산 유효성 표가 남음. E5-5 실제 encode/width 결과 |

**D5 — 한 번의 빌드로 확인한 것과 아직 확인하지 않은 것**

복제본의 `src/utils/pdfFontEmbed.ts`는 `fontkit`·`PDFDocument`를 공용 export한다. 기존 lazy `qrLabelPdf.ts`의 같은 API import를 그 경로로 바꾸었고, lazy `PdfFinishPanel.tsx`도 그 경로를 import하여 실제 등록·임베드 호출을 유지했다. 3차의 3,002줄 합성 연산 입력을 그대로 붙여 UI/엔진 코드 밀도 표본을 유지했다. Vite 설정은 /tmp에서 변환·읽고 configFile=false, cacheDir/outDir도 /tmp, publicDir=false로 실행했다. 필요한 기존 public JS/CSS만 /tmp 출력에 복사했다. 원본 dist를 출력 디렉터리로 쓰지 않았다.

4차 `generateBundle` 플러그인의 `chunk.modules[id].code` 수집을 재사용했다. 양수 renderedLength인데 code가 없는 module은 **0건**, main module entry **1,012개**. 독립 rendered gzip 가중치·정수 나머지 배분·같은 category 우선 소비·각 이전 바이트 1회·category net 합=app Δ를 그대로 적용했다. canonical root 정규화에 r5 복제 경로만 추가했다. baseline은 4차가 SHA 동일성을 확인한 **1a04f25의 r3 baseline 출력+r4 계측 자료**를 재측정했으며 새 HEAD로 리셋하지 않았다. worker/public은 합의대로 SHA opaque다.

최종 공유 청크는 **`assets/PDFButton-BFk3JjAB.js`, gzip 507,328B, owners=[pdf-editor, qr-studio]**다. `pdfFontEmbed`는 순수 re-export facade여서 Rollup이 없앴고 실제 파일명은 내부 대표 module에서 유래했다. 이는 소스 공용 경계와 lazy 도달성이 사라졌다는 뜻이 아니다. 두 lazy 소비자의 manifest imports와 module 그래프는 `bundle-result.json`에 있다. **물리 파일명을 pdfFontEmbed로 강제한 실험은 아니며**, 청크 이름을 제품 계약으로 삼을 근거도 없다. 기존 pdf.worker bytes/SHA는 동일하다. 미구현 최종 U4의 문구·스타일·모든 실제 알고리즘 비용까지 통과했다고 확대하지 않는다.

E5-5의 취소 반례는 다음과 같다. 0ms 타이머로 abort를 예약하고 페이지마다 3ms 작업 뒤 양보했다.

| 양보 | 처리된 페이지 | 종료 시 aborted | 관측 |
|---|---:|---|---|
| `await Promise.resolve()` | 12/12 | false | 36.70ms 동안 입력 task 실행 기회 없음 |
| `await new Promise(r => setTimeout(r, 0))` | 1/12 | true | 4.58ms 후 취소 관측 |

같은 설치본의 실제 Noto `embedFont → drawText → save` 1페이지는 **13.35 / 44.30 / 812.45ms**(시작부터 누적)에서 0ms 타이머가 전부 미실행이었다. **Node host 관측이며 실제 휴대폰 지연 상한이 아니다.** async API라는 표기만으로 메인 이벤트 처리가 보장되지 않는다는 증거다.

또한 `src/features/pdf-editor/pdfPreview.ts:362`가 메인에서 `page.render({canvas, canvasContext, …})`를 호출하고, 설치된 `pdfjs-dist/build/pdf.mjs:16923`의 `InternalRenderTask`가 `CanvasGraphics`를 만들어 `:16986`에서 operator list를 실행한다. PDF.js worker는 파싱/디코딩/목록 생성 등을 분담한다. **canvas 그리기·인코딩·pdf-lib embed/save 전체를 그 worker가 수행한다는 v6 문안은 정정해야 한다.** E5-4도 실제 이 메인 경로를 실행했다.

닫히는 문안 후보: (1) 이벤트 task에 실제 양보하는 helper를 명시하고 resolved Promise를 제외, (2) load/font/페이지·타일 loop/save/retain 단계 앞뒤 abort 검사와 **최종 결과 등록 전 task 양보+재검사**, 이미 완료된 파일만 보존, (3) 동기 임베드/압축 중 즉시 중단은 보장하지 않는 협력적 취소로 고정, (4) 기존 worker façade를 **실제 pdfWorkerClient 호출에 이관하는지, finish가 쓰지 않는 골격만 만들 것인지** 정리. v6의 “기존 4모드 호출 취소 전파”와 “실제로는 raster/PDF.js + adapter 골격”은 같은 구현이 아니다. 공용 helper/Excel 무변경·기존 4모드 프로토콜 골든은 유지한다. 상한 상향이나 worker fontkit 재도입을 요구하지 않는다.

**D3 — oracle probe 결과와 결정식의 잔여**

E5-4의 text-vector fixture는 A4 595.28×841.89pt, Helvetica 8pt `xxxxxxxxxx`를 (72,720)에 두고 색상 벡터 사각형을 추가했다. 실제 PDF.js로 150/200/300DPI에서 렌더하고 PNG/JPEG q85 각각을 **최종 PDF로 다시 저장**했다. Poppler PNG에서 알려진 글자 ROI를 검사했으며 RGB 각 채널 ≤127인 ink의 세로 bbox를 재었다(64/200도 원자료에 기록).

| flatten DPI | Poppler 재렌더 72DPI, PNG/JPEG | Poppler 150DPI, PNG/JPEG | flatten과 같은 DPI로 재렌더, PNG/JPEG |
|---:|---|---|---|
| 150 | **4/4px — FAIL** | **9/9px — PASS** | 9/9px — PASS |
| 200 | **4/4px — FAIL** | **9/9px — PASS** | 12/12px — PASS |
| 300 | **4/4px — FAIL** | **9/9px — PASS** | 17/18px — PASS |

따라서 **측정은 가능**, 현 문안만으로 **판정 재현성은 미완성**이다. “8pt≈16px”는 150DPI에서의 em 크기이며 x-height 자체가 아니다. Poppler 버전·`-r`·폰트/글자·ROI·threshold·bbox/ink-height의 정의·최종 PDF를 측정한다는 점을 U4-0 oracle에 고정해야 한다. DPI별 품질 비교라면 예컨대 `-r <실제 flatten DPI>`를 택할 수 있지만, 이 보고서가 Claude 대신 선택을 확정하지 않는다. threshold 5나 기존 자원 상한의 변경은 요구하지 않는다.

포맷 절차도 실제로 실행했다. **합성 photo-scan 대용 fixture**는 seed=0x54a781, 1241×1754의 gradient+noise를 lossless PDF 이미지로 넣은 것이다. 실제 사진 대표성이나 U4-0 정본 fixture를 주장하지 않는다. Chrome의 Pixel 7 에뮬레이션, 300DPI 1쪽, 동일 흰 배경·동일 canvas에서 PNG/JPEG 한 쌍, warm-up 1쌍 제외 후 3쌍을 기록했다.

- 최종 PNG PDF: **24,008,775B × 3**.
- 최종 JPEG PDF: **3,100,959B × 3**.
- paired ratios: **7.742370989 × 3** → 이 fixture에 v6 규칙을 적용하면 **JPEG q85**.
- 매 출력에서 save.byteLength=Blob.size 확인. 중간 이미지 bytes·시간은 별도 보존. 이 probe는 전체 매트릭스/메모리 교정이 아니다.

이 경우 중앙값 비율 계산은 일치했다. 일반 계약에는 `median(PNG_i/JPEG_i)`인지 `median(PNG_i)/median(JPEG_i)`인지 식을 써 두는 편이 정확하다. 원자료의 경계 반례 `(190,100),(201,100),(150,50)`은 각각 **2.01 / 1.90**으로 갈린다. “paired”를 전자의 뜻으로 고정하면 이 부분은 닫힌다. U4-0에서 fixture seed/크기/해시·브라우저와 배경·동일 쌍 입력을 고정하는 것도 필요하다.

**150 기본값 + 모바일 한계 미교정 기록 자체는 상위 로드맵과 충돌하지 않는다.** 사용자 기기에서 교정했다고 거짓 주장하지 않으며 C-B의 5종 JS/CSS 상한도 바꾸지 않는다. 다만 B를 여전히 “누적 자원 예산”이라고 부르면서 **B를 넘는지 판정할 식/값 또는 ‘이번에는 차단에 사용하지 않는다’는 폐기 결정이 없다.** A4 150DPI는 1쪽 2,176,714px로 A 통과, 16쪽 합 34,827,424px도 A만으로는 통과한다. 메모리 Blob fallback의 누적 보유와 마지막 save/ZIP 비용은 OPFS 우선·concurrency 1로 없어지지 않는다. v5 B 초과 지원 제외 규칙을 유지할지 대체하는지, photo-scan 보수 추정 계수를 어떤 집계로 만들고 미측정 입력에 어떻게 적용하는지, OPFS quota 실패 시 메모리 fallback/미완료 정리 범위를 명시해야 sol이 새 정책을 정하지 않는다. **임의 새 상한이나 상향 값을 제안하지 않는다.**

**D4 — 표 전 행의 API 실현성과 OCG 효과**

E5-6은 exported `PDFDict/Array/Ref/RawStream`, `context.nextRef/assign/register`, catalog/node get/set/delete로 새 문서의 page refs를 먼저 배정한 뒤 map을 공유했다. private `PDFObjectCopier.traversedObjects`를 사용하지 않았다. 4차 E4-4보다 한 걸음 더 나아가 페이지/링크/form graph를 함께 복사하면서 attachment·XMP·주석을 복사 전 필터했다.

| v6 표의 행 | API 실현성·이번 근거 | 구현/검증 주의 |
|---|---|---|
| 페이지 트리·Contents·Resources·Media/Crop/Rotate | **가능**. 공개 저수준 복사와 page map; CropBox `{25,40,350,520}` 보존 | Parent는 새 page tree, Resources/Media/Crop/Rotate는 inherited attribute도 해소. Contents/resources 내부 ref도 동일 map |
| Outlines·Names/Dests·Dests·PageLabels·ViewerPreferences | **가능**. named/outline 목적지 실제 index=1, labels `['i','7']` 보존. prefs는 E4-4 성공 재사용 | 다단 name/number tree와 링크 target을 실제 page tree로 검증. 검증 밖 action은 고지한 제거 정책으로 연결 |
| Info+XMP | **가능**. `updateMetadata:false` 새 문서 결과 Info 없음 | 미선택 시 trailer Info도 복사. page/resource metadata 경로까지 대상 필터. 최종 raster 문서에도 선택성 적용 |
| AcroForm·Widget | **가능**. formCount=1·값 Hello·Widget 유지. E4-4 flatten dangling prune 근거 유효 | 정상 AP를 쓰는 flatten은 `updateFieldAppearances:false` 명시. dirty 한글 값을 기본 flatten으로 재생성하면 실제 WinAnsi 오류. AP 없는/XFA/서명 필드의 flatten 지원 제외를 자동 ‘값 없는 성공’으로 바꾸지 않음 |
| 첨부 | **가능**. page AF 포함 복사 전 필터 후 전체 indirect streams payload sentinel 없음 | Filespec의 포함 파일 용도 구분과 공유 graph 경로 검사. 제거하지 않은 첨부 보존은 별도 fixture |
| Link URI·direct·named | **가능**. 3종 Link 유지, named/outline target=1. 4차 직접 목적지 ghost ref 반례 해법 동일 | 문자열 URL만 검증하지 않고 목적지 index·fit/좌표도 검증 |
| 기타 markup 주석 | **가능**. Dict subtype 필터, 이번 Text 제거·Widget/Link 유지 | Popup/IRT/Parent/AP 연결도 필터. Redact annotation 제거는 본문 redaction 아님. 임의 flatten 제외 유지 |
| OCProperties/OCG/OCMD·태그 | **객체 삭제 API는 가능; content/시각 효과 계약은 잔여** | 아래 OFF layer 반례. 태그도 StructParents/StructParent/ParentTree/MarkInfo 등 연결을 정리해야 함 |
| rich media·unknown subtype·기타 Names | **그래프 필터 가능** | 사전 목록/명시 삭제 고지와 연결 자원 제거를 함께 수행. 숨은 부속 graph를 남기지 않음 |
| 최종 raster | **가능**. E5-4 실제 렌더→최종 PDF, Link 재부착 없음 계약 동의 | raster 대상 페이지의 검색/태그/양식/링크 손실과 다른 보존 행의 적용 우선순위를 정본에 유지 |

이 표의 “가능”은 해당 public API로 구현 경로가 있다는 뜻이다. 이번 작은 fixture가 모든 subtype·임의 PDF·OCMD 표현식·tagged reading order를 완전 검증했다는 뜻이 아니다.

OCG probe는 원본에 파란 사각형과 **OFF인 빨간 레이어**를 두었다. `/OCProperties`, resource `/Properties`, OCG indirect object를 지우고 **Contents를 보존**하면 다음과 같았다.

| 상태 | Poppler 72DPI red pixels | blue pixels | PDF.js |
|---|---:|---:|---|
| 원본 OFF layer | 0 | 1,600 | 정상 OC ref |
| 구조/Properties 삭제, Contents 유지 | **6,400** | 1,600 | `ignoring beginMarkedContentProps: TypeError…reading 'get'`, OC argument=null |

두 PDF 모두 열리고 Poppler exit 0이다. **‘열기 성공’으로 실제 파손과 허용 손실을 나눌 수 없다.** v6의 지원 제외 효과가 경고 후 제거라는 결정에는 동의하나, 이를 확정 25와 “동일 원칙”이라고만 적으면 다음 선택이 남는다: **기본 가시성을 굳혀 레이어 기능만 제거할지, 숨겨진 draw까지 모두 보이도록 제거할지**, `/OC … BDC/EMC`·XObject `/OC`의 참조를 어떻게 없애고 어떤 렌더 변화는 허용할지. 특히 후자를 허용한다면 “레이어 정보 손실”보다 **숨겨진 내용이 보일 수 있음**까지 알려야 동작을 이해할 수 있다. content operators 정리가 필요하면 표의 Contents 보존에도 그 한정 예외를 써야 한다. 이 선택과 대응 fixture의 기대 픽셀을 Claude가 고정하면 D4는 닫힌다. 상한 변경 요구나 OCG 의미 완전 보존 요구가 아니다.

**N3 — 말줄임과 unsupported 문자 안내는 자동으로 충돌하지 않지만 순서/결과를 고정해야 한다**

`… U+2026` 자체는 Helvetica와 Noto 둘 다 지원했다. 따라서 말줄임 문자 때문에 확정 1④가 반드시 깨진다는 반박은 하지 않는다. 개행도 line separator로 빼면 `Line 1\r\nLine 2`는 Helvetica만으로 처리되고 `가\r나`의 LF 오류도 사라진다.

그러나 E5-5에서 `A\tB`, `A\0B`는 그대로 encode하면 Helvetica가 실패하고 Noto는 누락 scalar 9/0을 **glyph 0000**으로 내보냈다. 제어문자를 coverage에서만 제외하면 이 경로를 막지 못한다. 설치본 `cleanText`는 TAB을 네 공백, 일부 제어문자는 삭제 등으로 처리하지만 NUL까지 처리하지 않으며, width 계산 전처리와 실제 draw 전처리를 다르게 하면 정렬도 달라진다. **TAB/기타 제어문자를 실제 출력에서 정규화할지 입력 오류로 막을지** 같은 한 개의 순수 전처리 계약이 필요하다.

또한 `A×80 + 🙂`가 말줄임으로 화면 밖 꼬리에 놓이는 경우 v6의 순서대로면 **레이아웃 전에 missing glyph 안내**에 도달한다. 안내 후 중단인지, 입력 전체의 누락을 경고하고 생략 가능한지, 말줄임 뒤 최종 glyph만 다시 검사할지에 따라 폰트·출력·사용자 진행 동작이 달라진다. **원문 coverage를 우선해 누락 scalar가 있으면 필드 오류로 실행을 막는 정책**이라면 이를 명시하고 ‘실제 그릴 run’이라는 표현을 ‘개행/제어문자 정규화 후 전체 후보 run’으로 정리할 수 있다. 이 보고서가 무단 문자 삭제를 승인하지 않는다.

overflow도 수평 말줄임 한 줄로 전부 닫히지 않는다. E5-5 Helvetica 12pt `…` 폭은 **12pt**인데 허용 영역이 **5pt**면 말줄임조차 들어가지 않는다. margin/6영역 폭의 유효성, 줄 수가 페이지 밖으로 넘는 경우, unknown token/date-format의 오류/리터럴 처리, 타일 간격 0/너무 작은 양수에서의 유효성·최대 작업량 정책이 기존 4차 N3에 남아 있고 v6에서도 숫자/결과 표가 없다. 전부 입력을 무한 허용하거나 조용히 축소하라는 뜻으로 sol이 해석하게 두면 안 된다. 이 사항은 N3 한 건으로 집계한다.

**sol 인계 전 남은 네 가지**

1. **D3 (U4-0/1/7)**: 가독성 측정 recipe·포맷 식을 고정하고 B의 사전 추정/경고/차단 또는 차단 미적용 범위를 명시. 150 기본값은 번들 상한 변경이나 실기기 보장으로 쓰지 않음.
2. **D4 (U4-0/6/7/8)**: OCG 제거 후 표시 의미·content 참조 정리·사전 문구·확정 25의 허용 손실/검증 실패를 fixture 기대값으로 연결.
3. **D5 (U4-2~8)**: 예산 그래프는 유지하되 실제 realm을 정정, task 양보/단계별 취소/결과 등록 시점을 명시하고 PDF adapter 적용 범위를 하나로 정리.
4. **N3 (U4-1/3/4)**: 제어문자·누락 glyph·말줄임/수직 배치·token/date-format·타일 경계의 사용자 동작을 고정.

기존 D2·D6·D7·D8, 5개 route·canonical·recovery/ToolReady·a11y/rendering 등록·219캡처 예상·9단계/1회 배포·legacy oracle은 다시 이견으로 세지 않았다. 일반적인 파일명/컴포넌트 구성 선택도 이견으로 세지 않았다. **잔여 4건은 동일 문안을 구현해도 출력·지원 범위·취소·게이트 결과가 달라지는 부분이다. [재왕복 필요].**

**종료 무변경 검증 — 전체 실패와 범위별 확인을 분리**

초기 snapshot은 2,912파일(추적 파일, 열린 계획, 사용자 미추적 3파일, dist 531파일), 지정 제외는 AGENTS.md·CLAUDE.md 2개뿐이다. 원본 verifier를 완화하지 않고 실행했으며 **exit 1을 보존**했다.

- 종료 HEAD=`f29d249d5d57c5fa7b68b8d87b84a20b8af43e7e`, origin/main은 시작 `1a04f25` 그대로. `git diff 1a04f25 HEAD --name-status`는 **CLAUDE.md 한 파일**. 상위 roadmap의 새 진행 기록도 다른 세션의 22:59:44 문서 커밋을 명시한다. 이 라운드는 git 커밋 명령을 실행하지 않았다.
- SHA가 바뀐 것은 **CLAUDE.md + 오프라인 QR 계획 + roadmap 진행 기록**이다. AGENTS는 시작 그대로. GEMINI.md·docs/agent-dispatch-runbook.md는 SHA·크기 동일, **mtime만 변경**됐다. `concurrent-changes.json`에 전후 SHA/size/mtime를 모두 기록했다.
- **추적 파일은 지정 제외 2개를 빼면 내용 SHA 불일치 0**, 제품 src/scripts/config/package/lock 입력 내용·mtime 불일치 0, **dist 531파일 SHA/size/mtime/집합 불변·추가 0**, 사용자 3파일 불변. PDF v6 계획도 시작 SHA 그대로다. HEAD의 문서 이동으로 E5-1 기준 소스가 바뀌지 않았다.
- 전체 git status는 CLAUDE 변경이 커밋되면서 달라졌다. index diff는 시작/끝 모두 동일, 나머지 tracked worktree diff exit 0. 외부 변경을 되돌리거나 허용 목록에 몰래 추가하지 않았다.

따라서 **“저장소 전체가 시작과 같다”는 선언은 하지 않는다.** 실행한 작업의 실험 대상 소스·의존 입력·dist·사용자 파일 불변과 `/tmp` 한정 쓰기는 확인했다. 다음 정본/구현 디스패치는 현행 HEAD를 다시 대조하되, 이번 번들 기준점 1a04f25를 사후 변경하지 않는다.

**최종: D1·N1·N2 해소, 잔여 D3·D4·D5·N3 = 4건 · [재왕복 필요]. — Codx**
