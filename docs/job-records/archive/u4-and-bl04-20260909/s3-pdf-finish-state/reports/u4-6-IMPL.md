# U4-6 구현 보고서 — F4a 구조 제거·양식 평면화·링크 보존 고지

- 판정: **구현·단계 검증 통과, 브랜치 커밋 후 astra 검수 대기**
- 브랜치 / 기준 HEAD: `s3-pdf-finish` / `79c20710b756d58d87fe2e0bdb9cc51782855c82`
- 구현 커밋: `cea060b65cd983bf3b2b3fdce698a4092e187169`
- main 병합·push·배포: **하지 않음**
- 기준선: schema-v3 `/tmp/worklazy-u4-4-review5/evidence/bundle-baseline.json`
- 기준선 SHA-256: `4caaa9c6c48df99dd740664d7991c995ffff7e8b6deaa7a1d87e982d302c30ea`

## 1. 실행 게이트와 사용자 결정

첫 행동으로 `PROJECT_RULES.md` 전문을 읽고 `AGENTS.md`, 정본 `pdf-finish-20260905.md`, U4-6 지시서, U4-5 2차 검수와 기각 이력을 대조했다. 시작 branch/head가 지시와 일치하고 열린 계획 충돌이 없음을 확인했다. 사용자 소유 `CLAUDE.md`·`PROJECT_RULES.md`, DOCX 2개·네이버 확인 HTML·`newui/`는 수정하거나 stage하지 않았고, 금지 worktree·main 병합·push·배포에도 접근하지 않았다. 브라우저 포트는 4281~4284를 모두 `--strictPort`로 사용했다.

1차 후보가 app **82,887B > 81,920B**로 **967B 초과**했을 때의 `SCOPE-OUT`은 옳았다. 967B만 줄이는 안은 정적 JSON 증가까지 합치면 순감량 20B뿐이고 F4b/F5 추정 3,411~10,188B를 감당하지 못한다. 후보 PDF route도 **69,435/72,000B**, 잔여 **2,565B**뿐이었다. 사용자 결정대로 측정 스크립트의 두 줄만 다음처럼 바꿨다.

| 지표 | 기존 | 최종 |
|---|---:|---:|
| `affectedRouteJsGzip` | 72,000B | **82,000B** |
| `appJsGzip` | `80 * 1024` = 81,920B | **96,000B** |

entry/shared/CSS, override `{}`, multiplier 1은 불변이다. 다른 route 감량으로 PDF 증가를 상쇄하지 않았고 측정 범위를 줄이지 않았다. **이번이 마지막 상향**이므로 U4-7·U4-8에서 다시 초과하면 추가 상향을 요청하지 않고 `SCOPE-OUT`으로 보고한다.

## 2. 구현 결과와 제거 보증 ①~⑦

참조만 끊어 orphan을 남기는 방식은 기각했다. 지원 OC를 고정 가시성으로 정규화하고 선택 제거를 적용한 뒤, 새 `PDFDocument`에 page ref를 선할당하고 `PDFObjectCopier`로 도달 가능한 페이지와 허용 catalog root만 복사한다.

1. **Info + XMP 제거:** `updateMetadata:false`; trailer Info와 catalog/page Metadata를 제거하고 전체 객체·PDF.js 양쪽에서 부재 확인.
2. **첨부 제거:** Names/EmbeddedFiles, Filespec, EmbeddedFile, catalog/page AF, FileAttachment를 복사 전에 제거. decoded attachment sentinel 0.
3. **양식·주석 선별:** AcroForm/Widget은 form 모드로, markup은 subtype별 옵션으로 제거. Link는 별도 보존. Popup/IRT/Parent의 제거 대상 역참조를 정리.
4. **orphan 없는 새 문서:** 기존 context 저장이 아니라 reachable-only 새 문서 재구축. 출력 전체 14 indirect object 전수 검사.
5. **저수준 + 고수준:** raw/decoded whole-object 검사와 PDF.js attachments/metadata/annotations/outlines/labels/preferences 검사를 함께 통과.
6. **임의 주석 평면화 미지원:** 화면과 ko/en 문구에 지원하지 않는다고 명시. Redact 주석 제거가 본문 가림 처리가 아니라는 경고 포함.
7. **미지원 범위 사전 차단:** XFA, 서명 필드, AP 누락, AP 손상, 지원 외 OC/Type3를 실행 전 preflight에서 차단.

양식 모드는 **보존/제거/평면화** 배타 선택이다. 평면화는 기존 appearance만 `updateFieldAppearances:false`로 페이지 content에 합친 다음 AcroForm/Widget을 제거한다.

## 3. annotation subtype 선별과 링크 실측

| subtype/구조 | 옵션별 처리 | 실측 |
|---|---|---|
| `/Link` URI | 항상 보존, `/Next` 제거 | PDF.js `url` 1개 |
| `/Link` 직접 Dest | 항상 보존, 새 page ref로 매핑 | PDF.js array dest 1개 |
| `/Link` 이름 Dest | 항상 보존, Names/Dests 동반 복사 | PDF.js string dest 1개 |
| `/Widget` | form 보존 때만 보존, 제거/평면화 때 제거 | 3모드 unit 통과 |
| `/FileAttachment` | 첨부 보존 때만 보존 | 제거 출력 0 |
| Text/FreeText/Line/Square/Circle/Polygon/PolyLine/Highlight/Underline/Squiggly/StrikeOut/Stamp/Caret/Ink/Popup/Redact | 주석 제거 선택 때 subtype별 삭제 | 제거 출력 0 |
| 알 수 없거나 위험한 annotation/action | 보존으로 주장하지 않고 제거 | whole-object validator 통과 |

옵션을 펼치는 즉시, 실행 버튼보다 앞에서 한국어 **“하이퍼링크는 유지됩니다”**, 영어 **“Hyperlinks are preserved”** 고지를 항상 표시한다. `pdf-finish-link-preservation`과 F4a 소유 marker를 브라우저·접근성 게이트가 확인한다.

## 4. D4 재구축 보존표

| 구조 | 판정 | 구현·검증 근거 |
|---|---|---|
| 페이지 tree/content/resources/MediaBox/CropBox/Rotate | 보존 | page ref 선할당·복사, geometry unit |
| `/Outlines` | 로컬 목적지만 보존 | 새 page ref destination, PDF.js outline 1개 |
| `/Names/Dests` | 보존 | 이름 Dest Link와 name tree 보존 |
| `/Names/EmbeddedFiles` | 첨부 옵션에 따라 보존/제거 | 제거 시 whole-object 0 |
| 구식 catalog `/Dests` | 보존 | `LegacyTarget`이 새 2쪽 ref를 가리킴 |
| `/PageLabels` | 보존 | PDF.js `["i", "A-1"]` |
| `/ViewerPreferences` | 보존 | HideToolbar true, DuplexFlipLongEdge |
| `/OCProperties`·OCG/OCMD | 지원 집합은 고정 가시성으로 평탄화 후 구조 제거 | 허용 56개 양 renderer SHA 일치; 제외 31개 차단 |
| `/StructTreeRoot`·tagged 구조 | 제거 | 구조 key 전 객체 0 |
| `/Metadata` XMP·Info | 사용자 옵션 | 제거 출력 XMP/Info 0 |
| `/AcroForm` | 보존/제거/평면화 배타 모드 | 3모드 unit·브라우저 통과 |
| `/Annots` Link | URI·직접 Dest·이름 Dest 보존 | 출력 3개·PDF.js 의미 확인 |
| `/Annots` markup/Widget/FileAttachment | 각 옵션에 따라 subtype별 처리 | whole-object·unit·브라우저 확인 |
| 지원 외 name tree/action/annotation, 지원 외 OC·Type3 | 제거 또는 실행 전 차단 | 화면 지원 제외 행·음성 대조 |

## 5. 골든 ④ — 전체 indirect-object 원출력

출력 PDF는 **1,116B**, SHA-256 `c92299811b5d12cf8d65d48de873071b27fca5514467cfe44f306c4d34de42f3`, 전체 indirect object는 **14개**다. 완전한 raw dictionary/stream 문자열, raw SHA, decoded SHA, decode error, 객체별 두 sentinel 결과의 원출력은 아래 JSON에 그대로 보존했다.

- 원출력: `/tmp/worklazy-u4-6/pdf-finish-oracle.json` → `.fixtureContracts.removalOutput.wholeIndirectObjects`
- 원출력 파일 SHA-256: `a465a182f1d5d9d58065514490212f6a31113146f7486826d3ffb2ab7e691623`
- 재현: `jq '.fixtureContracts.removalOutput.wholeIndirectObjects' /tmp/worklazy-u4-6/pdf-finish-oracle.json`

완전성 확인용 원출력 inventory:

| ref | class | type/subtype | keys | decoded bytes | raw SHA-256 | decoded SHA-256 |
|---|---|---|---|---:|---|---|
| 1 0 R | PDFPageTree | /Pages | Count,Kids,Type | 0 | `361b7949…18e` | - |
| 2 0 R | PDFCatalog | /Catalog | Dests,Names,Outlines,PageLabels,Pages,Type,ViewerPreferences | 0 | `2348d2df…699` | - |
| 3 0 R | PDFPageLeaf | /Page | Annots,Contents,MediaBox,Parent,Resources,Type | 0 | `2174aabc…091` | - |
| 4 0 R | PDFPageLeaf | /Page | Contents,MediaBox,Parent,Resources,Type | 0 | `d40ea3d4…a5c` | - |
| 5 0 R | PDFDict | /Font /Type1 | BaseFont,Subtype,Type | 0 | `81a3997f…cee` | - |
| 6 0 R | PDFRawStream | - | Filter,Length | 57 | `f6942c7a…e71` | `a94eba8e…e3f` |
| 7 0 R | PDFDict | /Annot /Link | A,Rect,Subtype,Type | 0 | `f510efb9…816` | - |
| 8 0 R | PDFDict | /Annot /Link | Dest,Rect,Subtype,Type | 0 | `4600a851…3c1` | - |
| 9 0 R | PDFDict | /Annot /Link | Dest,Rect,Subtype,Type | 0 | `c0f1f9ec…176` | - |
| 10 0 R | PDFRawStream | - | Filter,Length | 57 | `f6942c7a…e71` | `a94eba8e…e3f` |
| 11 0 R | PDFDict | /Outlines | Count,First,Last,Type | 0 | `8a737cc3…bed` | - |
| 12 0 R | PDFDict | - | Dest,Parent,Title | 0 | `486eb3ee…be9` | - |
| 13 0 R | PDFDict | - | Nums | 0 | `bb0b7460…6ad` | - |
| 14 0 R | PDFDict | - | Dests | 0 | `80d5cd71…a9b` | - |

금지 key 12종, type 5종, subtype 14종은 모든 객체에서 0이다. decoded `PDF finish embedded attachment sentinel`과 `<pdf:Keywords>remove-me</pdf:Keywords>`도 각각 0이며, PDF.js 고수준 결과는 annotation 3(Link 세 종류), attachments `null`, XMP 없음, outline 1, page labels `i/A-1`, viewer preferences 보존이다.

## 6. OC oracle과 9게이트

제품 `classifyOcgPreflight`와 제품 `rebuildPdfStructure`를 manifest 전부에 직접 적용했다. preflight 87 = 허용 **56** + 제외 **31**, 허용 56개/57페이지 전부 변환, deep OC residual 0, PDF.js·Poppler 원본/결과 RGBA SHA 일치 56/56이다. 첫 페이지 Contents를 비운 음성 mutant는 두 renderer가 모두 잡았고 제외 fixture의 변환 시도는 0이다.

| 게이트 | 실행·결과 |
|---|---|
| 골든 ④/OC oracle | `npm run test:pdf-finish-oracle` 통과; 위 전수 결과 |
| tsc | `npx tsc -b` 통과 |
| unit 전체 | `npm run test:unit` **331/331** 통과 |
| production/local-QA build | 각 **2,851 modules**, 정적 **71페이지** 통과 |
| static/ko·en·SEO·정적 표면 | `npm run test:static` 71페이지 통과; 새 route 없음, locale key 동형 |
| PDF finish | `npm run test:pdf-finish` 통과; 기존 watermark 4 content+128 image+32 text, stamp 16 coordinate+16 browser/output+8 page와 신규 ko/en 구조 흐름 |
| scoped browser | `TEST_SCOPE=pdf npm run test:browser` 통과; source 분기상 `testPdfTools`만 실행. 성공 문구가 Excel/Word도 주장하는 기존 P3는 backlog 유지 |
| legacy | `npm run fixtures:pdf-legacy-oracle` **totalDiffs=0** |
| visual | 신규 9/9 갱신 후 9/9 compare 일치; 대표 ko/en·light/dark·desktop/mobile 육안 확인 |
| a11y | F4a+finish 7상태, violation 0, F4a incomplete 0, inherited 125, external request 0; marker 누락·상태 누락·owned incomplete 음성 unit 통과 |
| rendering | 신규 대상 3회, median CLS **0.0001480365514755249 ≤ 0.1**, external request 0 |
| bundle | scoped+full 다섯 지표 통과, inventory JS 91/CSS 1, deduplicated copies 16 |
| 광고 격리 | 실행 경로 변경 없음; AppShell allowlist unit 통과, local-QA 외부 요청 0 |
| diff | `git diff --check`, `npx tsc -b` 최종 재실행 통과 |

명시적 scope 정책에 따라 별도 `test:recovery` 전체는 U4-8 뒤 1회 이월한다. production build의 기존 recovery 생성 계약과 unit은 유지했다.

## 7. 번들 5종·탐색 이력

| 지표 | 수정 전 | 1차 후보 | U4-6 최종 | 최종 상한 | 잔여 |
|---|---:|---:|---:|---:|---:|
| entry JS | 8,878B | 10,132B | **11,065B** | 20,480B | **9,415B** |
| PDF route JS | 61,923B | 69,435B | **70,335B** | 82,000B | **11,665B** |
| shared 순증 | 2,407B | 2,427B | **2,455B** | 30,720B | **28,265B** |
| app | 74,107B | **82,887B** | **84,776B** | 96,000B | **11,224B** |
| CSS | 393B | 400B | **400B** | 10,240B | **9,840B** |

최종 PDF route 절대값은 1,147,622B다. scoped shared gross 512,417B 중 509,962B는 QR route→shared 분류 이동이고 순증은 2,455B다. 이를 app에 다시 더하지 않았다. `PDFObjectCopier`는 공용 `pdfFontEmbed` 안 정확히 한 벌이다. main `pdf-lib` 118,977B와 legacy worker 219,622B 내부 별도 번들은 순감량 목표 80~120KB, 설계·연결 3~6 + 회귀·계측 2~4 = 총 5~10인일 backlog다. 상향은 이 부채를 해결하지 않고 미뤘다.

- scoped: `/tmp/worklazy-u4-6/bundle-scoped.json`, SHA-256 `ba98ca1cdf16e6d75fd820c47f49e637bc90627ed95cf279dca0d37f594b2c91`
- full: `/tmp/worklazy-u4-6/bundle-full.json`, SHA-256 `90e778c643070b51fec53290b1cdf4eb304c4e0f6faf90598274a5679c31e837`

## 8. 시각 기준선 변경 목록

아래 9장을 추가했다. 영어 320px와 공용 mobile 390px가 모두 있다.

- `pdf-finish-structure__interaction__en__dark__desktop.png`
- `pdf-finish-structure__interaction__en__dark__mobile.png`
- `pdf-finish-structure__interaction__en__light__desktop.png`
- `pdf-finish-structure__interaction__en__light__mobile-320.png`
- `pdf-finish-structure__interaction__en__light__mobile.png`
- `pdf-finish-structure__interaction__ko__dark__desktop.png`
- `pdf-finish-structure__interaction__ko__dark__mobile.png`
- `pdf-finish-structure__interaction__ko__light__desktop.png`
- `pdf-finish-structure__interaction__ko__light__mobile.png`

추적 제외 local-QA 캡처는 `/tmp/worklazy-u4-6/pdf-finish-shots/`, 접근성 원자료는 `a11y-f4a-finish.json`(SHA-256 `4b67dfbc…1ff9`), rendering 원자료는 `rendering-f4a.json`(SHA-256 `737f635e…5c2e`)에 보존했다.

## 9. 축소 불가 4항과 이월

1. **되돌림 사냥:** 정규 PDF finish가 U4-1~5의 도장 좌표·preview/download 골든, watermark 응답·렌더, 취소/재시도, 단일 표시 URL 계약을 모두 실행해 통과했다.
2. **legacy oracle:** `totalDiffs=0`.
3. **게이트 건전성:** F4a marker/target/state/incomplete 음성을 추가했고 bundle schema-v3 scoped+full과 전체 deployment inventory를 사용했다. scoped browser source의 `TEST_SCOPE=pdf`가 `testPdfTools`만 호출함을 직접 확인했다. 출력 문구 과장은 기존 P3로 별도 귀속한다.
4. **사용자 신고 경로:** 해당 없음.

U4-8 뒤 1회로 이월: full `test:browser`, new-tools, utilities, office, QR bulk/font 2종, recovery, Excel cleaner/compare 2종, full a11y, full visual, full rendering, css:orphans, legacy:manifest, standalone tool-registry-routes, 성능 12입력. 누적 13묶음과 U4-6 추가 계약은 `docs/jobs/todo/s3-pdf-finish-state/MERGE-GATE-CHECKLIST.md`에 반영했다.

## 10. 실패 이력·git 상태

- 초기 target unit은 Node strip-types의 parameter property와 시각 캡처 기대 수가 맞지 않아 실패했고, portable class와 새 9캡처 합계를 고쳐 통과했다.
- 첫 full unit은 옛 번들 상한·시각 clock 개수 기대 2건 때문에 실패했고 계약을 갱신한 뒤 **331/331** 통과했다.
- 첫 `test:pdf-finish`는 실패 고지에 `data-error-code`가 없어 fail-closed UI 단언이 실패했고 공개 오류 코드/소유 marker를 추가한 뒤 통과했다.
- 최종 추적 diff와 staged 경로를 검증한 뒤 구현 커밋 `cea060b65cd983bf3b2b3fdce698a4092e187169`을 생성했다. 사용자 파일은 작업 트리에 그대로 남겼다.

— Codx
