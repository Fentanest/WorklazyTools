# adsense-recheck-20260919 / WU1 — Astra 결과 검수

검수일: 2026-09-20. 역할은 기술 결과 검수이며 Claude의 총괄·감사·최종 판정을 대신하지 않는다. 대상은 `/tmp/wl-adsense/review/wu1-src`, 기준 `29fe72cb5a25c6d9643d69f66d713f1386a4ff4e`, 제출 HEAD `1d6302785ffb16163a501948d465f0c687683e85`이다. 아래 소스 위치는 이 worktree 기준이다.

**[비차단] WU1 범위의 통합을 막는 결함은 발견하지 않았다.** OCR 이관, 기대 질문 보존, 39건 처리, 필수 mutation 판정은 확인됐다. 선택 키 자체의 삭제를 잡지 못하는 회귀 방어 공백은 권고로 남긴다. 전체 단위 테스트 실패의 발생 시점과 가려진 화면 영역은 미확인으로 유지한다. 이 판정은 WU4 최종 통합 검사·Claude 감사·배포 승인을 대신하지 않는다.

**0. 대상·권한·증거의 동일성**

- 시작 명령 `git -C /tmp/wl-adsense/review/wu1-src status --short`: 출력 없음, 종료 0. `git rev-parse HEAD`: `1d6302785ffb16163a501948d465f0c687683e85`, 종료 0.
- `git diff --stat 29fe72c..HEAD`: 9파일, 510삽입/319삭제. 모두 PLAN §3-5 소유 범위다. ToolGuideWrapper, App.tsx, seo.ts, package.json, 광고 코드 변경 없음. `git diff --check 29fe72c..HEAD` 새 실행 종료 0.
- PROJECT_RULES.md와 `.agents/skills/worklazy-scoped-verification/SKILL.md`를 읽고 F의 결과 재사용 기준을 적용했다. 제품 수정·커밋·push·npm ci·의존성 설치 없음. 새 브라우저/빌드/전체 테스트 실행 없음.
- **[비차단] PLAN 해시 차이 설명됨.** 현재 사본 SHA-256은 `f28b576965fd788e9f5b5b26a537cce6ae86b246de3c25eca3f01288c28937d3`, 보고서의 값은 `40c69eeb25b6ec4c7b58832070d94b84eef493c4915e0f50875e5b49a360c75d`이다. 읽기 전용으로 확인한 Sol worktree의 PLAN은 보고서 값과 일치한다. 두 사본의 §3·§8·§9를 추출해 문자열 동등성을 검사했고 모두 동일했다. 차이는 WU2 산출물 경로·세션 및 v0.3.1~v0.3.4 운영 기록이다.
- 제출된 9개 변경 파일과 package.json, package-lock.json, App.tsx, seo.ts, generate-static-pages.mjs 총 14파일은 Sol worktree 현재 사본과 바이트 단위로 같았다. 검수 환경 Node v22.17.1, jsdom 29.1.1, TypeScript 5.7.3, Playwright 1.63.0; 마지막 세 패키지 버전은 Sol 환경과 같다.
- 원본 가이드 JSON 수정 시각은 00:36:52, build 완료는 00:41, static 검사기는 00:42 수정 후 test:static, guide 검사기는 00:53 수정 후 test-guides-final/new-unit-tests-final이 있다. 따라서 빌드 입력 확인에는 build/content 증거를, 최종 검사기 확인에는 final 로그와 독립 mutation을 사용했다. 로그에 실행 당시 전체 파일 해시가 들어 있지는 않으므로 이것을 암호학적 실행 증명으로 표현하지 않는다.

**1. [비차단] §3-1 OCR FAQ·경로 이관 및 비회귀**

- 실제 KO/EN diff에서 standard FAQ 삭제 ID는 정확히 `faq_19`, `faq_20`뿐이다. 두 FAQ 객체와 OCR pathBlocks 1블록은 convert에 원문 그대로 이동했다. standard의 OCR pathFaqs/pathBlocks 키는 없어졌다. 그 밖의 standard FAQ 객체와 OCR 외 pathFaqs 배열은 기준과 같다.
- 근거: `src/locales/ko/guides.json:1829`(standard new_faq_1), `:1834`(기존 선택), `:2060`(이관 FAQ), `:2077`(convert 선택), `:2090`(OCR 블록); EN 대응은 `src/locales/en/guides.json:1831`, `:1836`, `:2050`, `:2067`이다. 원본 비교는 줄 위치보다 JSON 키로 수행했다.
- **새 실행:** 기준 JSON은 `git show 29fe72c:src/locales/{ko,en}/guides.json`으로 worktree의 `node_modules/.cache/wu1-astra-mutations/`에 임시 저장했다. 현재 `getFaqsForPath`를 import하고, 기준 ID 목록에서 구성한 question/answer 배열과 현재 출력 배열을 deepEqual 비교했다. KO/EN 각각 OCR 외 10선택 일치; root `new_faq_1` 보존. 실행 종료 0.
- convert=`faq_0,faq_1,faq_2,faq_4`, OCR=`faq_19,faq_20`. 두 언어의 선택 객체가 동일하고 두 목록 모두 비어 있지 않다. `/tmp/wl-adsense/wu1/logs/pdf-faq-nonregression.log`의 두 행과 독립 결과가 일치한다.
- 정책은 `src/i18n/guideData.ts:116` 및 `docs/guide-production-notes.md:3`에 있다. 런타임의 빈 배열 fallback 동작은 바꾸지 않았다. 문서 :8에 OCR/convert 명시 선택 의무가 기록돼 있다. 관련 방어 공백은 3번 권고 참조.

**2. [비차단] §3-2 정적 FAQ 검사기·기대표·mutation**

- `scripts/validate-static-output.mjs:19`의 `assertStaticFaqHtml`은 JSON.parse 후 @type을 검사한다. FAQPage 없음(:30), 필수 질문 누락(:36), 본문/JSON-LD 불일치(:43)가 독립 오류다. @graph/배열 재귀와 @type 배열도 처리한다. 본문은 JSDOM의 `main.seo-static-fallback > section > h3` textContent를 읽으므로 HTML 엔티티가 디코딩된다. 질문 집합은 중복 제거·정렬 후 비교한다.
- :47의 main과 :454의 CLI guard로 import 시 CLI 검사가 실행되지 않는다. 기대표 적용은 :131이다. 기존 라우트 목록에는 convert가 이미 정적 생성 대상으로 있고, 새 기대표 키로 FAQ 검사까지 포함된다.
- **새 실행:** 기준 `validate-static-output.mjs`의 27개 검사 경로 배열과 기존 삼항식 기대 질문을 추출하고 각 경로×KO/EN을 새 JSON과 strictEqual 비교했다. 출력: `Legacy expectations: 27 routes x 2 languages exactly preserved; added: [ '/tools/pdf-editor/convert' ]`, 종료 0. 기존 54문구 누락·하향 없음. convert의 전용 질문은 `scripts/static-faq-expectations.json:21`의 Word/Excel 완전 복원 질문이며 페이지 번호 기본값을 쓰지 않는다.
- `tests/unit/static-output-validation.test.ts:24` 정상, :28 FAQPage 제거, :35 필수 질문 제거, :42 본문 불일치는 모두 실제 export 함수에 변형 HTML을 전달하고 해당 오류를 assert한다. 기대 결과만 따로 검사하는 테스트가 아니다.
- **새 실행:** Node ESM stdin에서 실제 함수에 네 fixture를 전달했다. JSON 질문 `A & B?`/본문 `A &amp; B?`는 PASS. @type=WebPage 안에 FAQPage 문자열을 둔 미끼는 `FAQPage JSON-LD 없음`; 양쪽 질문을 Other?로 바꾸면 `필수 질문 누락: A & B?`; 본문만 바꾸면 `본문 FAQ와 JSON-LD 불일치`. 예상 오류를 assert한 전체 재현 종료 0.
- 기존 단위 테스트 실행은 final 29/29 로그를 재사용했다. malformed 비FAQ JSON의 포괄적 검증이나 FAQ 답변 동등성은 이번 요구 범위가 아니다.

**3. [비차단] §3-4 가이드 검사기 필수 동작, [권고] 회귀 방어 보강**

- `scripts/validate-guides.mjs:66`은 TypeScript AST로 Route의 문자열 path 및 중첩을 결합한다. 실제 App.tsx 입력에 대한 **새 실행**에서 49개를 얻었고 `/tools/pdf-editor/ocr`, `/tools/qr-studio/bulk`, `/tools/document-compare/results/:pairNumber`, `/tools/office-editor/app` 모두 포함됨을 assert했다. App 선언 근거는 `src/app/App.tsx:71`, `:79`, `:86`, `:107`이다.
- :46에서 앞뒤 슬래시 정규화, :165/:174에서 정본 Set 정확 일치, :175 빈 배열 거절, :176 누락 ID 거절, :180~187에서 실제 route의 slug를 해석해 가이드 title/description/blocks≥1 검사, :190~193에서 기대표 질문을 주입 데이터의 선택 결과와 비교한다. slug 루트 연결에 쓰는 :107의 prefix는 허용된 매핑 용도이며 path 키 유효성 검사에 쓰이지 않는다. 동적 키는 App에서 얻은 `/results/:pairNumber` 패턴과 비교한다. EN HWP는 :158/:182에서 제외한다.
- :114의 `resolvedFaqs`는 인자로 받은 guides의 FAQ와 pathFaqs를 사용한다. 원본 JSON을 다시 읽어 mutation을 무시하지 않는다. :122의 export 함수, :199의 디스크 입력 main, :211 CLI guard가 분리됐다. 현재 입력의 오류 배열은 새 실행에서도 `[]`였다.
- **새 실행, 격리 JSON 복사본 mutation:** 기준 임시 사본과 같은 worktree 내 cache 디렉터리에 아래 변형 JSON을 저장한 뒤 다시 읽어 `validateGuidesData`에 주입했다. 추적 JSON은 수정하거나 되돌리지 않았다.

| 변형 | 실제 출력 | 판정 |
|---|---|---|
| EN OCR 선택을 `["faq_20"]`로 변경 | `[en] Required FAQ missing for (pdf-editor, /tools/pdf-editor/ocr): Can I make the whole PDF searchable?` | 의도한 실패 확인 |
| KO OCR pathBlocks를 `/tools/pdf-editor/ocr-typo` 키에도 주입 | `pathBlocks route is not an exact App route: /tools/pdf-editor/ocr-typo` | 접두어 오인 허용 없음 |
| 위 복사본에서 EN convert 선택을 `[]`로 변경 | `must not be empty`와 convert `Required FAQ missing` | 빈 선택 실패 확인 |
| 정상 짧은 문장 `항목 이름은 “보고서”`, `The maximum is 12`를 각 블록의 **마지막 문단**으로 배치 | `[]` | 종결형 negative control 통과 |

예상 실패 발생을 assert한 재현 프로세스 종료 0. 오류가 0이었다는 의미가 아니다.

- 메모 탐지는 :11~43의 제거 원문 19개 exact deny set과 KO/EN 패턴(:93~99)이다. 광범위 허용목록은 없다. 같은 언어의 blocks/pathBlocks title을 수집하고 마지막 문단의 짧은 미종결 또는 title 동일성을 :145~147에서 검사한다.
- `tests/unit/guides-validation.test.ts:26`의 19 하위 테스트는 매번 structuredClone→문구 삽입→실제 오류 assert를 한다. KO 원문도 EN 위치에 주입하지만 exact deny set이 언어와 무관하게 잡는다. 각 언어의 일반 휴리스틱 전체를 19건 테스트로 증명하는 것은 아니며, 원문 재유입 방지는 증명한다. :37 고아 제목, :43 필수 FAQ, :49 오타·빈 선택, :58 정상 주의 문구를 검사한다. final TAP 19개 하위 fixture 모두 ok, 전체 29/29를 재사용한다.
- **[권고, 신규 검사기 공백] 명시 선택 키의 부재는 통과한다.** 별도 복사본에서 `delete guides.en['pdfEditor.convert'].pathFaqs`를 실행하면 오류가 `[]`다. :117~118의 전체 FAQ fallback에 필수 질문이 남기 때문이다. 현재 제출물에는 필수 선택이 있으므로 현재 OCR/convert 출력 결함은 아니다. PLAN의 빈 배열 실패 요건은 충족하지만, 문서의 “두 경로는 반드시 명시 선택” 정책까지 회귀 방어하려면 키 존재 검사와 삭제 mutation을 추가하는 편이 좋다. guideData.ts 주석에도 두 경로 예외 의무를 적으면 문서와 더 명확히 일치한다.
- **[권고] negative control 테스트 :60~61은 unshift라서 짧은 문장이 마지막 문단 판정을 거치지 않는다.** 이번 독립 재현에서는 마지막 위치로 옮겨 정상 통과함을 확인했다. 제품 결함은 발견하지 않았으며 해당 테스트의 위치 보강을 권한다.

**4. [비차단] §3-3 39행 대응·의미·지원 제한 보존**

- 항목표와 WU1-ITEMS.md를 표 행으로 파싱해 39개 번호·언어·JSON 위치·연결 경로를 전부 대조했다. #2/#10은 네 문자열로 분리된 동일 메모를 `[0..3]`으로 확장한 기록이며 WU1-ITEMS.md의 추가 확인 절에 이유가 있다. 누락/중복 없음.
- JSON blocks 변경 키는 KO 7개(textMerger, textTools, work, imagePrivacy, timezone, excel, image), EN 10개(documentCompare, textTools, work, imagePrivacy, excel, audio, image, excelCleaner, pdfCompare, officeEditor)다. 실제 수정 17행, 고아 제목 제거 20행, video 키 삭제 2행과 일치한다.
- 수정 17건은 명령형 제작 지시를 사용자 동작·선택 기준·한계 설명으로 바꿨다. 확인하지 않은 예제 파일·다운로드 제공이나 검증 완료를 새로 약속하는 문구는 발견하지 않았다. 예: KO 병합의 행 순서/반복 제목 확인(`src/locales/ko/guides.json:717`), EN delete/mute와 경계 청취(:810), 수동 PDF 페이지 연결(:1532), 오피스 준비/저장본 확인(:1598). 실제 PDF 수동 연결은 `src/features/pdf-compare/PdfComparePage.tsx:98`, 준비 중 파일 선택은 `src/features/office-editor/OfficeEditorAppPage.tsx:486` 및 :509에 대응한다. 전 도구 실제 파일 처리 재검증을 했다는 뜻은 아니다.
- **새 실행:** 고아 제목 20건 각각에 대해 `before.paragraphs.slice(0,-1) === after.paragraphs`를 JSON 구조로 확인했다. 20건 모두 마지막 제목 문자열 하나만 없어졌고 그 앞 본문은 완전히 같다. 설명 문단 전체가 함께 삭제된 사례 없음. XLS 매크로·차트·외부 링크 한계, 모자이크 잔존 정보, 워터마크의 접근통제 한계, 스탬프의 암호학적 서명 아님 안내가 보존됐다. 근거 예: KO guides :756, :1011; EN guides :748, :1000, :1965, :1973.
- 미연결 `video` KO/EN 키만 삭제됐다. `src/i18n/guideData.ts:80`은 video-studio→video.page, `src/features/video-studio/VideoStudioPage.tsx:885`도 video.page를 사용한다. src/scripts/tests의 가이드 키·소비자 탐색에서 삭제 키를 읽는 연결은 발견하지 않았다. 일반 미디어 타입명 video와 혼동하지 않았다.
- `docs/guide-production-notes.md:14`~32에 19개 원문과 위치가 모두 있다. 기준 JSON에서 직접 추출한 원문을 대조했고 textTools 두 언어는 네 fragment 모두 보존됨을 확인했다. 문서의 `\\n`은 분리된 원문을 재구성한 표시다.
- **정적/런타임 표본은 content-check.json 재사용**(신규 dist/build 없음). 소스에서 새 문구를 확인하고 JSON의 oldAbsent/expectedPresent 및 예외를 대조한 표본은 다음 13행이다. 아래 true는 제출 관측값이며 새 브라우저 실행값이 아니다.

| 항목 | 확인 내용 | 정적 / 런타임 |
|---|---|---|
| #1 KO textMerger | 직접 입력/TXT 순서 설명 | 옛 문구 없음·새 문구 있음 / 동일 |
| #2 KO textTools | 문장/목록 줄바꿈 구분 | 옛 문구 없음·새 문구 있음 / 동일 |
| #6 KO excel | 병합 방식·제목 행 주의 | 옛 문구 없음·새 문구 있음 / 동일 |
| #9 EN documentCompare | 본문·표 결과 확인 | 옛 문구 없음·새 문구 있음 / 동일 |
| #14 EN audio | 삭제/음소거 길이 차이 | 옛 문구 없음·새 문구 있음 / 동일 |
| #16 EN excelCleaner | 공백 정리·0012 식별자 주의 | 옛 문구 없음·새 문구 있음 / 동일 |
| #17 EN pdfCompare | 표지 추가 시 수동 연결 | 소스·정적 수정 확인 / 가이드 미노출 |
| #18 EN officeEditor | 준비·저장 상태 확인 | 소스·정적 수정 확인 / 기본 URL 리다이렉트로 미노출 |
| #21 KO xls-preserve | 고아 제목 제거, XLS 한계 보존 | 격리 정적 가이드 없음 / 기존 본문 있음·옛 제목 없음 |
| #24 KO mosaic | 잔존 정보 주의 보존 | 본문 있음·옛 제목 없음 / 동일 |
| #29 EN xls-preserve | XLS 한계 보존 | 격리 정적 가이드 없음 / 기존 본문 있음·옛 제목 없음 |
| #38 EN watermark | 워터마크 한계 보존 | 본문 있음·옛 제목 없음 / 동일 |
| #39 EN stamp | 암호학적 서명 아님 보존 | 가이드 본문 있음·옛 제목 없음 / 동일 |

`content-check.mjs:93` 부근은 정적 main, 런타임 tool-guide 영역을 읽는다. 일반 페이지 title/meta의 동명 문자열을 실패로 세지 않는다. 검사 스크립트는 old/new 접두어 중심이고 block별 전체 문자열 스냅샷은 아니므로, 이번 소스의 20개 배열 동등성 및 17개 전체 문구 검토로 보완했다. #17/#18은 pass=true여도 런타임 새 문구 표시 성공이 아니다. JSON의 expectedPresent=null/guideRendered=false와 보고서 예외를 그대로 인정했다.

**5. [비차단/미확인] 검사 로그·산출물 및 7장 열람**

모든 로그는 `/tmp/wl-adsense/wu1/logs/` 원본을 읽었다. 아래 종료 코드는 Sol 보고값이며, TAP/완료 메시지와 대조한 범위를 구분한다. 원본 stdout 파일에 별도 shell exit-status footer는 없다.

| 로그 | 보고 종료 | 직접 읽은 결과 / 재사용 판정 |
|---|---:|---|
| pdf-faq-nonregression.log | 0 | KO/EN 각 10선택 동일; 독립 비교도 같음 |
| test-guides-final.log | 0 | `Guides validation passed: 49 App tool routes checked.`; 현재 AST 49 및 mutation으로 보완 |
| test-unit.log | 1 | tests 537 / pass 527 / fail 10; 10개 not ok와 분류 일치. 실패 결과 그대로 재사용 |
| new-unit-tests-final.log | 0 | 상위 10 + 하위 19 = tests 29 / pass 29 / fail 0, skipped/cancelled 0 |
| static-output-validation-unit.log | 0에 부합 | 이전 정적 검사기 테스트 4/4; final 로그가 최신 증거 |
| build.log | 0 | prebuild guide 통과, tsc/Vite 완료, 지역화 101페이지 생성 |
| test-static.log | 0 | 정적 검사 완료, Startup recovery 164 documents. “FAQ 164개”라는 뜻은 아님 |
| preview.log | 0(정상 종료) | 4181 기동 문구 존재. **[미확인] 정상 종료 코드와 HTTP 응답 자체는 이 로그에 없음**; 브라우저 결과는 서버가 동작한 별도 증거 |
| content-check.log / ../content-check.json | 0 | 39항목·4 FAQ 조합·7 screenshot, passed=true; 실제 배열 길이와 모든 pass 확인 |
| git-diff-check.log | 0 | 빈 파일은 성공 코드 단독 증거가 아님. 독립 `git diff --check 29fe72c..HEAD` 종료 0으로 보완 |

OCR은 두 언어 각각 2질문, convert는 각각 4질문이고 content-check.json의 body/json/runtime 정렬 배열이 일치한다. JSON generatedAt은 `2026-09-19T15:50:22.344Z`(KST 00:50:22)이다. content-check.mjs는 preview origin 외 요청을 abort하도록 되어 있다. 원본 URL·설정·가이드 새 문구가 제출 소스와 대응하므로 WU1 결과로 재사용하며, 통합 후 다른 빌드의 결과로 바꿔 적지 않는다.

**캡처 7장 모두 `view_image`로 실제 열람했다(미열람 0).** 경로는 `/tmp/wl-adsense/wu1/shots/`이다.

| 파일 | 원본 크기 | 열람 소견 |
|---|---|---|
| ko-pdf-ocr.png | 1440×2887 | OCR 가이드·2 FAQ 확인. OCR 주의 본문 일부가 동의 배너에 가림 |
| en-pdf-ocr.png | 1440×2996 | OCR 가이드·2 FAQ 확인. 같은 가림 존재 |
| ko-pdf-convert.png | 1440×2784 | convert 가이드와 전용 복원 질문 확인. FAQ 위쪽 일부 가림 |
| en-pdf-convert.png | 1440×2884 | convert 전용 질문 확인. FAQ 위쪽 일부 가림 |
| ko-image-resize.png | 1440×3212 | 크기/캔버스 설명 및 제거 후 경로 블록 확인. FAQ 부분 가림 |
| en-video-extract-audio.png | 1440×2309 | 음원 추출 본문 카드 확인. FAQ 일부 가림 |
| en-pdf-stamp.png | 1440×2565 | 전자서명 아님 안내·스탬프 FAQ 확인. 경로 블록 제목/윗부분 가림 |

보이는 가이드 카드에서 빈 카드·문자 깨짐·명백한 카드 밖 넘침은 발견하지 않았다. 다만 고정 헤더가 fullPage 이미지 중간에 찍히고 동의 배너가 본문/FAQ 일부를 덮는다. 하단에 Home/All tools/About 등의 링크가 세로로 노출된 모습도 관찰된다. **[미확인] 가려진 부분의 완전한 시각 상태와 하단 표시의 발생 시점은 이 캡처만으로 판정하지 않았다.** WU1은 관련 CSS/셸을 수정하지 않았으므로 이 모습을 신규 WU1 회귀로 귀속하지 않는다. **[권고] WU4 시각 검수에서 배너를 닫은 가이드 영역을 확인하면 좋다.** Sol의 “잘림·깨짐 없음”을 화면 전 영역에 대해 무제한 재사용하지 않는다.

**6. [비차단/미확인] 비소유 단위 테스트 실패와 런타임 관찰**

사용자 지시에 따라 전체 test:unit 및 기준 커밋 테스트를 재실행하지 않았다. 발생 시점 판정은 Claude의 별도 재현 결과로 남긴다. 단순히 변경 파일 밖에서 실패했다는 이유만으로 영향 불가라고 판정하지 않았다.

| 대상 | guides/getFaqsForPath 연결 및 WU1 영향 소견 |
|---|---|
| feature-locales 1건 | `tests/unit/feature-locales.test.ts:39`는 features.json을 읽고 :49에서 excelCompare.guide.blocks를 검사. guides.json/getFaqsForPath 연결 없음. **관측 실패에 WU1 영향 불가** |
| p1b-components 3건 | `tests/unit/p1b-components.test.ts:8`, :12, :24, :56은 TSX 소스 문자열·소비자 수·클래스 계약 검사. guides JSON이나 FAQ 함수 호출 없음. 이번 변경은 소비자/컴포넌트를 고치지 않음. **관측 실패에 WU1 영향 불가** |
| seo 2건 | `tests/unit/seo.test.ts:4`→getSeoDefinition→`src/app/seo.ts:454` getFaqsForPath→`src/i18n/guideData.ts:1`~2 guides.json. 따라서 **의존 관계상 WU1 영향 가능**이며 일괄 비소유 면제는 부적절. 다만 실제 실패는 :53 video title 불일치와 :91 document FAQ `5 !== 3`. video title은 수정 안 된 seo.ts 값, 문서 도구 5개의 faq/pathFaqs는 기준 JSON과 모두 동일하다. **이 두 관측 실패를 WU1이 만들었다는 근거는 없음**; 발생 시점은 미확인 |
| 나머지 4건 | document-generator/pdf-finish-engine/pdf-finish-modules의 extensionless utils import ERR_MODULE_NOT_FOUND 3건, ui-legacy-isolation 1건은 원본 실패 로그 확인만 수행. 기준 재현·수정은 하지 않음 |

- **[비차단] PdfComparePage 관찰은 사실.** App.tsx:81이 직접 해당 페이지를 렌더하며 `src/features/pdf-compare/PdfComparePage.tsx`에 ToolGuideWrapper/ToolGuide 연결이 없다. 변경 전후 이 파일 diff도 없다. #17은 정적 문구 수정 성공, 런타임 가이드 미노출로 유지한다.
- **[비차단] office-editor 관찰은 기본 URL에서는 사실이지만 예외가 있다.** `src/features/office-editor/OfficeEditorPage.tsx:29`~34에서 `guide=1`이 아닐 때만 `/tools/office-editor/app/`으로 replace 이동한다. :81에는 ToolGuideWrapper가 존재한다. 따라서 “런타임에서 어떤 방식으로도 볼 수 없다”는 해석은 틀리며 `?guide=1`이면 소스상 랜딩 가이드가 남는다. 해당 예외 URL을 브라우저로 새 재현하지는 않았다. #18의 기본 URL 관측 결과는 유효하다.

**7. 새 실행·재사용·이월 구분 및 종료 상태**

- 새 실행: Git 시작/종료 상태, 전체 diff 검토 및 diff-check, 기대표 27×2 동일성, standard FAQ 10×2 비회귀, AST 핵심 4경로, 현재 가이드 함수와 격리 JSON mutation, 정적 HTML 4 fixture, 39행 대응·20개 삭제 배열 보존·19원문 보존, 소스/입력 파일 비교, 실패 의존 관계 코드 확인, 원본 캡처 7장 열람.
- 재사용: Sol build, test:static, final 단위 테스트 29건, full unit 537건의 **실패 포함 결과**, content-check 정적/런타임 관측. 원본 증거는 수정하지 않았다.
- 실행하지 않음: npm ci/install, 전체 단위 테스트/전체 회귀 복제, 새 빌드·브라우저. 표본 정적 대조는 사용자 허용 선택지인 content-check.json으로 수행했다. 최초 독립 Node 비교에서 child_process의 git spawnSync가 EPERM으로 종료 1이었고 본문 검사는 시작되지 않았다. 이후 shell git show로 허용된 임시 사본을 만들고 Node는 파일을 읽는 방식으로 변경하여 비교·mutation 종료 0을 얻었다. 제품 실패로 세지 않았다.
- WU4/Claude로 이월: 전체 단위 테스트 10건의 기준 발생 시점·최종 차단 여부, 최종 통합 후보의 build/test:static 및 필요한 시각 검수. 운영 반영·실제 광고·심사 결과는 이번 WU1 검수 대상 아님. 구현·검증된 부분도 아직 운영 확인 완료로 표시하지 않는다.
- 추적 파일 수정·커밋·push·통합·배포 없음. 검수 중 만든 임시 기준 JSON 및 mutation 복사본은 정리했다. 지속 산출물은 이 보고서 한 파일이다.

종료 확인(임시 사본 정리 후):

```text
$ git -C /tmp/wl-adsense/review/wu1-src status --short
(출력 없음, exit 0)
$ git rev-parse HEAD
1d6302785ffb16163a501948d465f0c687683e85
(exit 0)
```

시작과 종료 HEAD 및 추적 파일 상태가 같다. 보고서는 worktree 밖 `/tmp/wl-adsense/review/wu1-astra.md`에만 작성했다.

WU1 통합 후보 적합 여부: 적합
