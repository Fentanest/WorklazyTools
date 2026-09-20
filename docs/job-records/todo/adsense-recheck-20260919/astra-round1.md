# Astra 계획 기술 검토 — round 1

대상 PLAN v0.1 SHA256 `92cf5045daeee7b8d1383a4311fdde6d11a252156258a6ff2927fb69a49ec7ce`, 기준 HEAD `29fe72cb5a25c6d9643d69f66d713f1386a4ff4e`. 총괄·감사 판정이 아닌 기술 검토다. 제품·추적 문서 수정, 커밋, push, 빌드, 제품 브라우저 실행은 하지 않았다. F(worklazy-scoped-verification), B(vercel-react-best-practices: 관련 상태·이벤트)만 참조했다. 정본화 전 착수에는 아래 차단 쟁점 보완이 필요하다.

## 시작 상태

명령: `git -C /home/better0101/projects/worklazytools status --short`, `git -C /home/better0101/projects/worklazytools rev-parse HEAD`

```text
 M patch_notes.py
?? patch_getfaqs.py
?? patch_guidekey.py
?? patch_pdf_faqs.py
?? patch_toolguide.py
?? scratch/fix_doc_compare_faq.py
?? scratch/fix_excel_compare.py
?? scratch/fix_guides.py
?? scratch/fix_guides2.py
?? scratch/patch_ad_eligibility.py
?? scratch/patch_appshell.py
?? scratch/patch_package.py
?? scratch/patch_validate_guides.py
?? scratch/patch_validate_guides2.py
?? scratch/refactor_guide_key.py
?? scratch/refactor_static_pages.py
?? scratch/remove_fallback.py
?? scratch/write_validate_guides.py
29fe72cb5a25c6d9643d69f66d713f1386a4ff4e
```

## 1. [차단] 라우트 정합 검사의 후보 원본 두 개 모두 하위 라우트 정본이 아니다

`src/app/seo.ts:419`의 toolSlugByPath는 도구 루트 매핑이다. `tests/tool-registry-routes.mjs:37` availableToolRoutes도 registry의 최상위 도구 경로만 추출한다. 현재 guides.json pathFaqs/pathBlocks를 Python으로 모아 seo 매핑과 대조하면 KO/EN 각각 고유 키 36개 중 24개가 매핑에 없다. `/tools/pdf-editor/ocr`, `/tools/qr-studio/bulk`, `/tools/document-compare/results/:pairNumber`, `/tools/office-editor/app/` 등이 전부 정상 경로인데 탈락한다. 접두어 일치만 허용하면 `/tools/pdf-editor/ocr-typo`도 통과하여 오타 검출 요건을 잃는다.

실제 하위·동적 경로는 `src/app/App.tsx:59,71,79,85` 이후 Route에 있다. 정합 검사는 이 선언까지 포함하는 목록을 사용해야 한다. 끝 슬래시 정규화와 동적 패턴을 정의하고, 언어별 가용성(EN hwp 제외)을 유지한다. '모든 도구 slug × 라우트'는 전 조합이 아니라 실제 `(slug, route)` 연결쌍으로 명시해야 한다. 모든 slug에 모든 path를 넘기면 getGuideKeyForPath의 path 우선 분기가 무관한 slug까지 PDF convert로 해석한다.

## 2. [차단] 39건 원문을 dist 전체에서 0건으로 만드는 검사는 계약과 충돌한다

§3-3은 판단에 '유지'를 허용하면서 모든 원문 부재를 요구한다. 제거된 고아 문단의 문자열이 정상 제목/메타데이터로 남을 수도 있다. 실제 #39 `Resize Image`는 `src/app/seo.ts:405`의 정상 페이지 title/application name이며, 고아 문단을 삭제해도 dist 전체 grep은 실패한다. HTML entity(`&quot;`, `&amp;`) 때문에 원문 그대로 grep하면 존재하는 문구를 부재로 오판할 수도 있다.

삭제는 해당 guide key/JSON 경로 및 연결 페이지의 해당 가이드 문단에서 부재를 검사한다. 수정은 그 위치에서 옛 문구 부재와 새 문구 존재, 유지는 기대 문구 존재, 미연결 video 삭제는 JSON 키 부재, 격리 xls 미노출은 해당 예외로 기록한다. 본문 DOM과 JSON-LD는 파싱·문자 디코딩 후 비교한다. §3-1의 '(b) 필수 질문'도 OCR 필수 질문을 convert까지 강제하는지 모호하므로 경로별 기대표에 따른다고 명시한다.

## 3. [비차단, 계약 보완 필요] OCR 이관은 가능하나 옮길 FAQ ID를 좁혀야 한다

현재 `guideData.ts:104` getGuideKeyForPath는 convert/ocr 모두 pdfEditor.convert. `App.tsx:71` OCR도 mode=convert, `PdfEditorPage.tsx:144` PdfGuide는 그 mode에서 convert slug를 ToolGuideWrapper에 전달한다. 정적 생성기는 `generate-static-pages.mjs:122` 같은 guide key를 사용하고 blocks+해당 pathBlocks를 합친다. FAQ는 seo.ts:444 withFaq → getFaqsForPath. 따라서 두 **정적 경로**에서 선택은 현재 구조와 맞는다. OCR pathBlocks를 옮기면 convert 기본 블록 뒤 OCR 전용 블록이 이어지며 convert 경로에는 붙지 않는다.

KO/EN 모두 standard OCR 선택은 `faq_19`, `faq_20`이고 convert에 같은 ID가 없어 충돌 없이 이관 가능하다. root PDF 선택은 `faq_0, faq_1, new_faq_0, new_faq_1`이다. 'OCR 관련 FAQ'를 넓게 해석해 `new_faq_1`(이미지 변환과 OCR은 같은 기능인가요?)도 standard에서 제거하면 root 선택이 깨진다. `src/locales/ko/guides.json:1836–1858` 참조. 이관은 최소 faq_19/20으로 명시하거나, 추가 ID를 옮길 때 모든 기존 pathFaqs 참조를 먼저 대조한다. 기본 경로 FAQ를 무작정 삭제하면 안 된다. root/merge 등 기존 standard 선택의 비회귀를 단위 검사 또는 데이터 비교에 포함한다.

`getFaqsForPath`와 ToolGuideWrapper 모두 선택이 빈 배열이면 전체 FAQ로 fallback한다. 새 정책 'pathFaqs 있는 경로는 선택 목록만'과는 다르다. '선택 목록은 반드시 비어 있지 않음'을 검사하거나 빈 배열의 의미를 두 소비자에서 동일하게 정해야 한다. 동적 FAQ는 양쪽 모두 패턴 대응, blocks는 런타임이 동적 패턴을 지원하지만 정적 생성기는 exact lookup뿐이다(`ToolGuideWrapper.tsx:57`, `generate-static-pages.mjs:124`). OCR/convert는 exact path여서 당장 불일치 없으며, 모든 동적 경로의 정적/런타임 일치까지 일반화하지 않는다.

## 4. [비차단] 메모·고아 패턴 표본은 현재 오탐보다 누락이 더 크다

읽기 전용 Python 검사: 두 guides.json의 모든 blocks/pathBlocks paragraphs를 순회했다. KO 패턴은 `(보여준다|설명한다|구분한다|쓰지 않는다|약속하지 않는다)\.$` 또는 `게시 전|예시를 만들 때|설명하되`; EN은 계획의 7패턴을 OR했다.

- KO 좁은 패턴 4건: textMerger/work/imagePrivacy/video. 모두 항목표 메모다.
- KO `다.` 종결이면서 `니다.`가 아닌 넓은 규칙은 8건. 현재 항목표 KO 메모 8건과 일치한다. 현재 데이터에서 정상 문장 오탐은 발견하지 못했다. 이 사실이 미래 문장까지 안전하다는 뜻은 아니다.
- EN 제시 패턴 4건: work/imagePrivacy/image/officeEditor. 기존 메모 11건의 상당수가 안 잡힌다. `Example: Prepare`, 실제 사용자 예문으로 시작했다가 뒤에서 제작 지시를 하는 문단 등이다.
- 마지막 문단이 40자 미만이고 `[.!?。！？]`로 끝나지 않거나 언어 내 어느 블록 title과 동일하다는 규칙: KO 8건, EN 12건. 현재 20개 고아 항목과 일치하며 추가 오탐은 없다. 문단 마지막 전체문자열을 검사했고 title과 items는 문단으로 취급하지 않았다.

판정: 패턴 예시는 허용 가능한 출발점이나 '19건 메모의 회귀 방지'를 보장하지 않는다. 수정 대상 원문을 회귀 fixture로 주입해 실제 제거한 유형이 다시 통과하지 않는지 표본 보강한다. 정상 주의, 짧은 유효 문장/따옴표로 끝나는 문장 등을 negative-control로 둔다. 허용목록은 위치+문구+이유를 좁혀 두어 광범위 면제를 막는다. 패턴 미검출을 의미 검수 완료로 쓰지 않는다.

## 5. [비차단] .mjs 로직을 .test.ts에서 가져오는 구성은 현재 실행 구조와 호환된다

Node `v22.17.1`; package.json:39는 `node --test --experimental-strip-types tests/unit/*.test.ts`. 기존 `tests/unit/accessibility-audit.test.ts:4`도 .mjs의 named exports를 가져온다. tsconfig.app.json:25는 src만 포함하여 tests의 JS declaration 부재가 제품 tsc 빌드 오류로 직접 연결되지 않는다.

다만 현재 validate-guides.mjs는 import 즉시 디스크 읽기·검사·process.exit를 실행한다. 함수 export와 CLI 진입 guard를 분리해야 한다(기존 `tests/accessibility-audit.mjs:913` 참고). 주입 데이터를 받는 함수 안에서 기존 getFaqsForPath가 원본 JSON을 계속 읽으면 FAQ 제거 mutation이 검사되지 않는다. 선택 함수에도 주입 데이터를 전달하거나 같은 선택 정책을 순수 함수로 공유하고 mutation이 실제 결과에 반영되는 자체 검사를 둔다. 공유 파일을 신설하면 §10의 전체경로 지정 제한과 충돌하지 않도록 먼저 허용 경로를 적는다. 기존 validate-guides.mjs 안의 export로 끝내는 방식은 소유 범위 내 가능하다.

## 6. [차단] 광고 차단은 pagead 스텁 외 모든 외부 통신의 fail-closed 처리와 구분된 계수가 필요하다

`AdSenseLoader.tsx:25–32`는 crossorigin=anonymous 외부 script를 head에 삽입한다. 라우팅 스텁으로 대체할 수 있으나 JS Content-Type과 `Access-Control-Allow-Origin: *` 등 CORS 성공 응답을 제공해야 한다. 스텁은 전역을 먼저 초기화하고 loads를 증가시켜야 한다. 브라우저 재현은 본 검토에서 실행하지 않았으므로 최종 성공은 S2가 증명해야 한다.

§4-1의 pagead2 한 도메인 fulfill만으로는 나머지 실제 광고 도메인 통신을 막지 못한다. 나간 뒤 0건 assertion을 하는 것은 사전 차단이 아니다. 더구나 LOCAL_QA 미설정+consent granted이면 `AnalyticsLoader.tsx:42–61`이 Google/Naver 추적도 켠다(googletagmanager.com, pstatic.net 등). 공통 규칙의 광고·분석 추적 없는 로컬 검수 조건에 맞추려면 테스트에서 요청을 사전 차단해야 한다.

context.route 등으로 모든 외부 HTTP(S)를 기본 차단하고, 정확한 광고 script URL만 스텁 fulfill, 로컬 서버 자산은 허용한다. SW 처리 경로도 점검한다. '광고 요청 시도 수 / 스텁 처리 수 / 차단 수 / 실제 네트워크 허용 수'를 구분한다. S2에서 page.on(request) 광고 URL 0개를 요구하면 스텁 요청 자체 때문에 실패한다. 실제 네트워크 허용 수는 모든 시나리오 0이어야 한다. S2 역검증에서도 스텁을 끌 때 사전 차단을 유지한다.

## 7. [차단] S6 내비게이션 계수와 EN HWP 시나리오가 현재 코드 동작과 맞지 않는다

`AppShell.tsx:75`는 SPA 이동 완료 후 location.replace를 한다. Playwright 최상위 `framenavigated`는 same-document 이동도 관측한다. 설치된 `node_modules/playwright-core/lib/coreBundle.js`의 Page.navigatedWithinDocument 처리 경로도 확인했다. SPA pushState+replace를 단순 합산하면 2가 될 수 있어 '정확히 1회'의 문서 교체 증거가 아니다. 새 문서 초기화 토큰/최상위 document request 또는 CDP loaderId 변경으로 새 문서 커밋을 세고, SPA 이동 이벤트 수는 별도 기록한다. 서버 301 끝 슬래시 보정도 분리한다. 스텁 loads는 새 문서마다 초기화되므로 문서별 값+테스트 프로세스 누적값을 보존해야 한다.

`App.tsx:84,155` HWP는 KoreanOnlyRoute여서 /en/tools/hwp-editor는 /en/tools로 이동한다. 그 목적지는 ad-free가 아니므로 S6/S8에서 EN HWP까지 광고 0개를 요구하면 정상 동작을 실패시키거나 제외 정책을 잘못 확대하는 수정으로 이어진다. EN 추가 1회는 존재하는 PDF/document-compare/격리 경로로 지정하고 HWP는 KO만 검사한다. EN HWP의 리다이렉트 정책 변경은 이번 범위 밖이다.

## 8. [비차단·미확인] S3/S4는 서버 기능상 가능, S5는 같은 URL 요건을 지키는 재현 경로가 아직 없다

`tests/recovery-server.mjs:8–28`: state.asset substring, .js suffix, remaining>0이면 remaining을 소진하고 delay를 적용한다. fault='' + delay로 S3 가능, fault='404' 또는 disconnect로 S4 가능. asset 기본값은 AudioStudioPage-이므로 실제 선택 도구 빌드 chunk명으로 지정한다. 초기 lazy를 보려면 시나리오별 새 context/module cache와 상태 초기화가 필요하다.

`chunkRecovery.ts:10–25`가 vite:preloadError에 1회 reload한다. S4는 remaining=Infinity 등 지속 실패로 새 문서까지 실패시켜야 한다. remaining=1은 복구가 성공할 수 있다. 지연/fallback이 실제 관측됐는지, 실패 후 오류 화면까지 도달했는지, 모든 문서에서 광고 삽입이 없었는지 기록한다.

S5: 정상 로드 뒤 동일 JS URL에 서버 fault를 설정해도 이미 평가한 ES 모듈은 재요청하지 않는다. text-merger에 뒤늦은 import는 rg 검색에서 없었다. 다른 도구의 내부 비동기 import 실패도 catch로 사용자 오류 처리되면 React RouteErrorBoundary로 전파되지 않는다. 단순 Promise reject/window error도 동일한 경계 재현이 아니다. 이 방식만으로 S5를 구현할 수 있다고 확정하면 안 된다.

계획이 이미 허용한 '시도한 도구·사용자 동작·실패 요청·왜 경계에 도달하지 못했는지 기록 후 재현 불가'는 타당하다. 대안으로 recovery server의 state.transform을 이용한 테스트 전용 응답 변환으로 동일 URL의 React 렌더 오류를 주입할 수 있는지 검토 가능하지만, 이는 실제 내부 import 경로 재현과 구분하고 정확한 변환 적용/오류 경계 도달을 증명해야 한다. 변환 구현 자체를 필수로 확대할 필요는 없다. S5 미재현은 pass로 계수하지 않으며 §8 완료 상태에도 반영한다.

## 9. [비차단, 누락 보완] 격리 문서 S8 기대 0은 타당하나 video가 목록에서 빠졌다

`generate-static-pages.mjs:45–55,205–243` office-app/xls-preserve는 별도 localized HTML과 isolation meta/SW를 만든다. `AppShell.tsx:412` 이하의 경계는 일반 문서에서 접근 시 해당 /ko 또는 /en 경로(끝 슬래시 포함)로 replace하며, 이미 isolation meta가 있으면 그 강제 교체를 하지 않는다. Office/XLS 자체 COI 준비로 추가 reload가 생길 수 있으므로 S6의 횟수 상한을 S8에 전용하지 않는다. 직접 진입은 localized URL을 사용한다(무언어 office-app 생성은 현재 목록에 없음).

video는 `generate-static-pages.mjs:167`, `AppShell.tsx` VideoIsolationBoundary가 isolation 문서/SW controller/crossOriginIsolated를 확인하고 필요시 reload한다. 광고 로더 조건은 active 또는 isolationDocument일 때 제외된다. S8 표에 video-studio가 없으므로 최소 루트+하위 한 경로를 추가한다. 서비스워커가 필요한 비디오는 일반 광고 테스트의 'serviceWorkers:block'을 그대로 사용하면 준비되지 않으므로 컨텍스트를 분리한다. 광고 0뿐 아니라 실제 목표 URL·문서 meta·오류/준비 상태를 함께 남겨 빈 화면의 0을 성공으로 처리하지 않는다.

redactor는 generate-static-pages.mjs:292의 CSP+meta 문서로 서비스되며 AppShell:83의 문서 mismatch replace가 있다. 결과세션 없는 document-compare/results/1은 `WordCompareResultPage.tsx:74`의 document-expired-result 상태가 기대값이다. recovery 서버는 없는 정적 파일에 404.html(404 status)을 주므로 이 경로는 SPA 부트스트랩 후 만료 안내까지 확인해야 한다. 모두 script/stub=0 기대 자체는 적절하다.

## 10. [비차단] WU1/WU2 파일 소유는 분리되며, 통합 확인은 필요하다

WU1 데이터/검증기/선택 컴포넌트, WU2 광고 컴포넌트/테스트/package.json은 현재 선언 범위상 겹치지 않는다. 광고 readiness는 routePending/routeError를 사용하고 가이드의 독립 GuideErrorBoundary는 그 플래그를 바꾸지 않는다. 두 구현이 서로 미완료 파일을 가져올 이유는 없다. 통합 시 가이드 노출과 광고 테스트를 같은 dist에서 확인한다는 계획은 적절하다.

단, WU2의 WU 기록 파일 전체경로가 없고 §10은 전체경로가 지정된 새 파일만 허용한다. WU3 .gitignore 및 WU4 공통 CHANGELOG/review-notes/backlog 소유도 명시하면 소유권 문의를 줄일 수 있다. 이미 허용한 임시 스크립트는 §10의 저장소 새 파일 제한 밖임을 구분한다. 계획에는 인접 프로젝트 worktree 경로를 쓰지만 실제 구현 세션 쓰기 권한은 각 실행 환경에서 확인해야 한다. 이번 검수는 지정 /tmp 외 쓰기를 하지 않았다.

## 11. [차단: 보존 절차] WU3 원본 삭제 실험과 민감정보 검사 공백을 보완해야 한다

'폴더째 삭제 금지'와 'evidence/corpus를 지운 상태'는 문장상 충돌한다. 새 빈 /tmp fixture 출력 디렉터리 또는 별도 clean checkout에서 생성하고 비교한다. 원본을 지워 생성 성공을 시험하지 않는다. WU3은 새 worktree에서 실행하므로 원래 작업트리의 untracked patch/scratch가 자동으로 복사·보존되지는 않는다. 원본 작업트리의 파일을 없애지 않고 읽기 사본을 archive에 보존하며 출처를 기록한다.

`git ls-files evidence scratch 'patch_*.py' test-drag.html integration_status.md | wc -l` 실제 결과 **138**. §5/§8의 137개는 수정하고 경로 목록으로 전수성을 확인한다(하나를 임의 제외하지 않는다).

XLSX sharedStrings만 보는 것은 inlineStr, 숫자 셀, 주석, 작성자 속성, 관계 target을 놓친다. XLSX가 ZIP이므로 'zip 내부 동일 기준'을 XLSX 전체 package에 적용한다고 명시한다. PDF는 텍스트 추출이 비어 있거나 이미지/첨부가 있으면 검사완료라고 적지 않는다. 검사 불가능 파일은 보존·미확인으로 보고한다. 본 검토는 민감정보 전수 검사 자체를 다시 수행하지 않았고 확정된 합성자료 판단도 재논의하지 않았다.

## 12. [비차단] evidence 추적 해제는 기존 PDF 테스트 경로와 양립한다

참조 탐색: `rg -n 'evidence|scratch|patch_.*py|test-drag|integration_status' tests scripts package.json .github src` 및 JSON/YAML 별도 검색. 현재 src/scripts/tests/package/.github에서 scratch/patch/test-drag/integration_status를 런타임 입력으로 사용하는 참조는 찾지 못했다. evidence에는 실제 테스트 참조가 있으므로 '참조 없음'으로 기록하면 안 된다.

`tests/pdf-compare-smoke.mjs:2–10`, golden:3–8은 cwd를 root로 Vite createServer({root,configFile:false}) 실행하고 /evidence/corpus/fixtures를 fetch한다. Git 추적 여부와 .gitignore는 서버 파일 읽기에 영향을 주지 않으므로 디스크에 남으면 현재 실행 가능하다. 새 checkout에서는 manifest 부재 시 fixtures 생성기를 자동 호출한다. `tests/helpers/pdf-compare-fixtures.mjs:9`가 고정 vendor OTF와 node_modules 패키지에 의존하므로 그 파일 존재도 확인해야 한다. manifest만 있고 일부 PDF가 없으면 자동생성이 생략되므로 clean 재생성 검사에서는 manifest까지 새로 만들어진 상태여야 한다.

package.json에 test:pdf-compare-smoke는 없다. 필요하면 `node tests/pdf-compare-smoke.mjs`를 쓰며, 전체 UI 스모크로 확대할 필요는 없다. 생성기 단독 실행을 선택하는 경우에는 생성 manifest/모든 참조 PDF 존재 및 Vite root URL로 읽을 수 있다는 근거를 함께 남긴다. 전수 fixture 삭제/경로 이동이 아니라 추적 해제만 할 때 테스트 소스 수정은 필요하지 않다.

## 13. [비차단, 검증 누락 보완] 정적 검사기 자체 판별력과 시각 표본·완료 상태

새 정적 검사기의 세 오류를 분리하는데 unit 요건은 validate-guides만 대상으로 한다. HTML fixture에서 FAQPage 제거, 필수 질문 제거, 본문-JSONLD 불일치 각각을 주입해 올바른 오류로 실패함을 확인해야 한다. 'FAQPage 없음' 판정은 다른 JSON-LD 블록에 FAQ 문자열이 남아 있더라도 파싱한 @type 기준이어야 한다. 테스트 코드를 추가할 위치는 소유 범위에 먼저 명시하거나 /tmp 자체검증으로 기록한다.

39건 문구 변경과 FAQ 이관은 실제 화면에 영향을 준다. OCR/convert KO/EN의 긴 가이드·FAQ 및 고아문단 삭제 영향의 대표 화면에 한정한 실제 시각 열람을 배정한다. 전체 시각 회귀/전 도구 기능검사는 필요하지 않다. 현재 최종 build/unit/static/ads/변경 가이드 DOM 검사는 범위에 적절하며, WU2 수정으로 AppShell의 비광고 줄·라우팅을 넓혀야 할 때만 해당 범위를 다시 정한다.

§8의 모든 항목 '소스 수정→테스트 통과→배포→운영' 단일 사슬은 유지 항목, 재현 불가 S5, 실제 광고 필요 S10, 미배포 문서/부산물과 맞지 않는다. 수정/유지/제거·적용대상 아님·검증불가 상태를 구별하고, S5/S10은 사용자 확정 조건에 따라 미확인/잔여 위험으로 남길 수 있지만 이를 테스트 통과나 모든 항목 운영확인 완료로 표기하지 않는다. 39행의 운영 전 경로 검사는 실제 노출 경로에만 적용한다.

## 차단 쟁점 요약

1. 실제 하위/동적/언어별 라우트를 포함한 검사 정본 및 정규화 계약 확정.
2. 39건 검증을 유지·수정·제거·미노출 및 가이드 문단 위치별로 변경.
3. 광고·분석 외부 통신의 사전 차단과 시도/스텁/실제 송신 계수 분리.
4. S6의 문서 교체 계수 수정, EN HWP 제외 정책과 테스트 기대 충돌 해소.
5. WU3 원본 삭제 실험 제거, XLSX/PDF 확인 공백과 실제 138개 보존 처리 확정.

그 외 지적은 현재 구조에서 해결 가능한 국소 구현/검증 보완이며 새 제품 설계·전 기능 회귀를 요구하지 않는다. 이 검토는 구현 허가나 Claude 최종 판정을 대체하지 않는다.

## 계획에 반영할 구체 수정 문구 제안

- §3-1: '이관 기본 ID는 KO/EN standard.faq_19/faq_20이다. 추가 FAQ 이동 전 기존 모든 pathFaqs 참조를 확인하며 root의 new_faq_1 등을 파손하지 않는다. OCR/convert 각각의 비어 있지 않은 선택 목록과 언어별 동일 ID를 검사한다. 필수 질문은 경로별 기대표를 따른다.'
- §3-4(2–3): 'App.tsx의 실제 Route 선언에서 하위·동적 경로까지 추출/대조한다. toolSlugByPath는 slug 연결에만 쓴다. 끝 슬래시를 정규화하며 EN HWP는 제외한다. 실제 slug-route 연결쌍의 가이드 해석과 path key 오타를 검사한다.'
- §3-3: '원문/변경문구 확인은 항목의 가이드 문단 위치를 기준으로 디코딩 후 판정한다. 유지/삭제/수정/미연결/격리 미노출을 구분하며 동일 문자열의 정상 제목·다른 문맥 존재를 실패로 보지 않는다.'
- §4-1: '로컬 외 HTTP(S)는 사전 차단하고 정확한 AdSense script 요청만 CORS 가능한 스텁으로 fulfill한다. Google/Naver 분석도 차단한다. 광고 요청 시도·스텁 처리·차단·실제 허용 수를 별도 기록하며 실제 허용 수는 0이다. 격리 SW가 있는 context의 네트워크도 별도로 확인한다.'
- S6: 'SPA 이동과 새 문서 커밋을 분리하여, 초기 진입 제외 문서 교체 1회 및 안정화 후 추가 교체 0회를 확인한다. 문서별 stub loads와 프로세스 누적값을 모두 기록한다. EN 표본은 PDF 또는 document-compare로 하고 HWP는 KO만 검사한다.'
- S8: 'video-studio 루트와 하위 1개를 포함하고 격리 meta/목표 URL/준비 상태를 확인한다. 언어별 실제 지원 경로에 한정한다.'
- §5: '138개 추적 파일을 경로 목록으로 확정한다. corpus 원본은 삭제하지 않고 빈 격리 출력에 재생성한다. XLSX 전체 ZIP package와 PDF 추출불가/이미지/첨부 여부까지 기록하며 미확인 파일은 보존한다. 원래 작업트리 미커밋/untracked 자료는 원본 위치를 유지하며 archive에 사본 보존한다.'
- §7–8: '정적 검사기 세 오류 자체검증과 변경 화면 대표 시각 열람을 추가한다. 유지/적용대상 아님/재현 불가/미확인 항목은 통과로 합산하지 않고 단계별 상태를 그대로 보고한다.'

## 조건 관련 참고

§0 확정 사실과 §1 사용자 조건을 재논의하지 않았다. S5 잔류, S10 실제 overlay, 계정 설정 및 실제 광고 노출은 계획에서 정한 미확인/잔여 위험으로 구분하는 전제를 유지한다.

## 종료 상태

명령: `git -C /home/better0101/projects/worklazytools status --short`, `git -C /home/better0101/projects/worklazytools rev-parse HEAD`

```text
 M patch_notes.py
?? patch_getfaqs.py
?? patch_guidekey.py
?? patch_pdf_faqs.py
?? patch_toolguide.py
?? scratch/fix_doc_compare_faq.py
?? scratch/fix_excel_compare.py
?? scratch/fix_guides.py
?? scratch/fix_guides2.py
?? scratch/patch_ad_eligibility.py
?? scratch/patch_appshell.py
?? scratch/patch_package.py
?? scratch/patch_validate_guides.py
?? scratch/patch_validate_guides2.py
?? scratch/refactor_guide_key.py
?? scratch/refactor_static_pages.py
?? scratch/remove_fallback.py
?? scratch/write_validate_guides.py
29fe72cb5a25c6d9643d69f66d713f1386a4ff4e
```

시작/종료 status 및 HEAD 일치: True. 본 에이전트의 유일한 산출물은 이 /tmp 보고서다. 새 실행은 코드 읽기·참조 검색·인메모리 JSON 패턴/라우트 집계뿐이며 제품 빌드/브라우저 검사 결과를 통과로 주장하지 않는다.
