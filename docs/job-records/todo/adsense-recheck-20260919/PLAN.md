# adsense-recheck-20260919 — AdSense 재심사 전 콘텐츠·광고 통제 복구 계획

| 항목 | 값 |
|---|---|
| 작업 ID | adsense-recheck-20260919 |
| 버전 | v0.3 (정본) — 변경 이력 §11 |
| 요청 모드 | plan-and-implement (`!계획!`, 사용자 2026-09-19) |
| 계획 상태 | 정본화 완료(2026-09-20) → **구현·검증 완료, 운영 미반영**(2026-09-20, Astra 최종 검수 적합) |
| 구현 허가 | 있음 — 사용자 `!계획!`(2026-09-19)의 plan-and-implement 범위 내. push·main 반영·배포는 별도 승인 |
| 기준 소스 | origin/main `29fe72c` (작업트리 미커밋: `patch_notes.py` 로컬 수정만) |
| 운영 기준 | worklazy.net = `a946a0b` 배포본. `29fe72c` 배포(#116)는 test:static 실패로 미반영 |
| 총괄·감사 | Claude (Fable 5.1) |
| 기술 검토·검수 | Astra (`gpt-6-astra`, Codex plugin) |
| 구현 | Sol (`gpt-5.6-sol`, Codex plugin) / Muse (`opencode/muse-spark-1.3-contributor-free`, OpenCode. 연결 실패 시 `opencode-go/muse-spark-1.3-contributor`, 실제 사용 ID 기록) |
| 통합·배포 담당 | Sol 1인 |
| 감사 항목표 | docs/jobs/todo/adsense-content-audit-20260919.md (39건, 작업 목록의 기준) |
| Astra 1차 반박 | /tmp/wl-adsense/review-plan/astra-round1.md (2026-09-19, task-mu8fx9ap-crczgt) |
| Astra 2차 확인 | /tmp/wl-adsense/review-plan/astra-round2.md (2026-09-20, task-mu8ih228-22p9p6) — 조건부 가능 |

## 0. 확정된 사실 (재조사 금지)

- 배포 #116 실패 원인: `/tools/pdf-editor/ocr`이 `pdfEditor.convert` 가이드로 연결되면서, `validate-static-output.mjs`가 요구하는 OCR 질문(`pdfEditor.standard.faq_19` "PDF 전체를 검색 가능한 파일로 만들 수 있나요?")이 convert 선택 결과에 없음. convert에는 pathFaqs가 없어 전체 FAQ 8개가 출력됨. FAQPage JSON-LD 자체는 존재.
- test:guides는 CI prebuild에서 실행돼 통과함. 검사 범위 부족(고정 문자열 3개)이 문제.
- 39건 항목표: 운영 정적 HTML 노출 확인 35 / 미연결 `video` 키 2 / 격리 경로(xls-preserve) 정적 미노출·런타임 미확인 2. 세 범주를 섞어 보고하지 않음.
- `patch_notes.py`는 5ca7f44에 커밋된 추적 파일. 로컬 수정(+60/−28)은 미커밋·미실행.
- `evidence/corpus/fixtures/*`는 `tests/helpers/pdf-compare-fixtures.mjs`가 생성하는 합성 자료. `pdf-compare-smoke/golden`은 manifest가 없으면 자동 재생성함.
- 민감정보 사전 스캔(Claude, 2026-09-19): 추적 텍스트 파일에서 이메일·전화·토큰·비밀번호 패턴 미발견. 표본 PDF 2개·xlsx 2개 본문은 합성 문자열. **전수는 아님** → WU3에서 파일별 재확인.
- 하위·동적 라우트(`tools/pdf-editor/ocr`, `tools/qr-studio/bulk`, `results/:pairNumber`, `tools/office-editor/app` 등)는 `src/app/App.tsx`의 Route 선언에만 있다. `src/app/seo.ts` toolSlugByPath와 `tests/tool-registry-routes.mjs` availableToolRoutes는 도구 루트만 담는다. HWP는 `KoreanOnlyRoute`로 `/en/tools/hwp-editor`가 `/en/tools`로 이동한다.
- standard의 OCR 선택은 KO/EN 모두 `pathFaqs["/tools/pdf-editor/ocr"] = [faq_19, faq_20]`, `pathBlocks["/tools/pdf-editor/ocr"]` 1블록. root 선택 `["/tools/pdf-editor"] = [faq_0, faq_1, new_faq_0, new_faq_1]`은 유지 대상. `getFaqsForPath`·ToolGuideWrapper 모두 선택 배열이 비어 있으면 전체 FAQ로 대체한다.
- 추적 부산물은 `git ls-files evidence scratch 'patch_*.py' test-drag.html integration_status.md` 기준 **138개**. 원본 작업트리에는 추가로 untracked `patch_*.py` 4개·`scratch/*.py` 14개와 `patch_notes.py` 로컬 수정이 있다.
- PROD 빌드에서 LOCAL_QA 미설정·동의 granted면 `AnalyticsLoader`도 googletagmanager.com·wcs.pstatic.net을 로드한다. 광고 스모크는 이 통신도 사전 차단해야 한다.
- 현재 광고 로더 조건: PROD ∧ ¬LOCAL_QA ∧ consent=granted ∧ ¬ineligible(routeError|routePending) ∧ ¬격리 경로 ∧ ¬isAdFreePath(hwp-editor, document-compare, pdf-compare, pdf-editor). 광고 문서에서 isAdFreePath 경로로 SPA 이동 시 `window.location.replace(href)`로 전체 새로고침.

## 1. 사용자 조건 (변경 불가)

- 광고 전면 제외 4경로군 유지. 수익화 범위 확대 금지. 광고 제외를 이유로 본문 삭제·noindex·robots 차단 금지.
- 광고 상태 전환 테스트는 "재심사 준비 완료" 판정의 필수 항목. 플래그 단위 테스트만으로 완료 처리 금지. 실제 광고 반복 요청·자기 광고 클릭 금지. 실제 광고 노출·계정 설정은 별도 확인 항목.
- 39건은 항목별 의미 검수. "35건 삭제"·특정 단어 0건을 완료 기준으로 삼지 않음. 확인하지 않은 예제·샘플 다운로드·검증 결과를 제공한다고 쓰지 않음.
- OCR: 가이드 선택을 과거로 되돌리지 않고 현재 구조에서 FAQ·경로 연결. FAQPage 없음과 필수 질문 누락은 별개 오류로 보고.
- evidence·scratch 폴더째 삭제 금지. .gitignore 추가만으로 완료 처리 금지. 민감정보 미확인 상태의 이력 재작성 금지. 민감정보 대응·이력 재작성은 별도 승인.
- commit은 작업 브랜치에서만. push·main 반영·배포는 기존 절차(Astra 검수 → Claude 판정 → 사용자 승인 → 통합 담당 1인).

## 2. 작업 단위와 배정

병렬 근거: WU1(가이드 데이터·검증기)과 WU2(광고 로더·테스트)는 소유 파일·런타임 전제·출력 계약이 겹치지 않음. 공유 파일 package.json은 WU2 단독 소유. WU3은 WU1과 같은 worktree에서 WU1 종료 후 순차(WU1이 scratch 원문을 참조할 수 있으므로 정리는 그 뒤).

| WU | 내용 | 구현자 | 브랜치 / worktree | 포트·임시 경로 |
|---|---|---|---|---|
| WU0 | 민감정보 발견 시 분리 조치 | (WU3 중 발견 → Claude 보고 → 사용자 승인) | — | — |
| WU1 | OCR FAQ·연결 복구, 39건 의미 검수·수정, 가이드 검증기 강화 | Sol | `work/adsense-guides-20260919` / `/home/better0101/projects/wt-adsense-guides` | preview 4181, 산출물 `/tmp/wl-adsense/wu1/` |
| WU2 | 광고 상태 전환 스모크, 발견 결함 최소 수정 | Muse (신규 세션) | `work/adsense-adtest-20260919` / `/home/better0101/projects/wt-adsense-adtest` | RECOVERY_TEST_PORT 4182, 산출물 `tests/visual-artifacts/adsense-recheck/`(worktree 내부, git 제외) |
| WU3 | 저장소 부산물 분류·정리 | Sol (WU1 후, 같은 worktree) | WU1과 동일 | — |
| WU4 | 통합·최종 검사·검수·배포 확인 | Sol (통합), Astra (검수), Claude (감사·판정) | `integration/adsense-recheck-20260919` / `/home/better0101/projects/wt-adsense-integration` | preview 4183 |

기준 커밋: 두 worktree 모두 `29fe72c`에서 분기. 원본 작업트리의 untracked 파일과 `patch_notes.py` 로컬 수정은 어느 worktree에도 복사하지 않고 WU3 대상에서도 제외한다. 통합 후 Claude가 원본을 그대로 둔 채 사본을 `docs/jobs/todo/adsense-recheck-20260919/archive/`(로컬 수정본은 `archive/patch_notes.local.py`)에 만들고 출처를 기록한다(§6 8번).
각 worktree에는 PROJECT_RULES.md·AGENTS.md(추적됨)와 이 지시서·항목표 사본(docs/jobs는 git 제외이므로 수동 복사, 해시 기록)을 전달.

## 3. WU1 — Sol

### 3-1. OCR FAQ·본문·경로 연결
- 이관 대상은 KO/EN `pdfEditor.standard`의 `faq_19`, `faq_20`과 `pathBlocks["/tools/pdf-editor/ocr"]`(1블록)이다. 이 항목을 `pdfEditor.convert`로 **이동**하고 standard에서 제거한다(복제 유지 금지). KO/EN `pdfEditor.standard.pathFaqs["/tools/pdf-editor/ocr"]` 키도 convert의 OCR 선택 목록으로 이관한 뒤 standard에서 제거하여, 이동한 faq_19/faq_20을 가리키는 참조를 남기지 않는다. 그 외 FAQ ID(특히 root 선택의 `new_faq_1`)는 standard에 그대로 둔다. 추가 ID를 옮기려면 standard의 모든 `pathFaqs` 참조를 먼저 대조하고 근거를 기록한다.
- `pdfEditor.convert.pathFaqs`를 신설: `"/tools/pdf-editor/ocr"`에는 이관한 faq_19·faq_20(+ 필요 시 convert 공통 ID), `"/tools/pdf-editor/convert"`에는 convert 관련 ID의 **비어 있지 않은** 목록. KO/EN ID 집합 동일.
- 비회귀: standard의 root·merge·split 등 기존 pathFaqs 선택 결과가 변경 전과 같음을 데이터 비교(변경 전후 `getFaqsForPath` 출력 diff)로 확인해 기록.
- 정책 명문화(guideData.ts 주석 + docs/guide-production-notes.md): 선택 목록이 있는 경로는 그 목록만 출력하고, 선택 목록은 비어 있을 수 없다(검증기가 실패시킴). 없는 경로만 전체 FAQ. convert/ocr는 반드시 선택 목록을 둔다. 빈 배열 대체 동작을 코드에서 바꾸지는 않는다(두 소비자 동일 유지).
- 확인: `npm run build` 후 `dist/{ko,en}/tools/pdf-editor/{ocr,convert}/index.html`에 (a) `@type: FAQPage` JSON-LD 존재(파싱 기준) (b) 경로별 기대표의 필수 질문 존재(OCR은 faq_19 문구, convert는 3-2에서 정한 convert 전용 기대 질문) (c) 본문 FAQ 목록과 JSON-LD mainEntity 질문 집합 일치(HTML 엔티티 디코딩 후 비교). 런타임: `vite preview --port 4181 --strictPort`로 두 경로×2언어 DOM에서 같은 FAQ 질문 집합 확인(Playwright, 크롬 `/usr/bin/google-chrome`).

### 3-2. validate-static-output.mjs 오류 분리
- 현재 한 문장 오류를 세 오류로 분리: `FAQPage JSON-LD 없음` / `필수 질문 누락: <질문>` / `본문 FAQ와 JSON-LD 불일치`. 기대 질문 표는 낮추지 않음.
- 기대 질문 표를 데이터 파일 `scripts/static-faq-expectations.json`(경로 확정)로 추출해 3-4의 validate-guides와 공유. 현재 convert는 정적 FAQ 검사 대상 목록(validate-static-output.mjs의 검사 진입 배열)에 없으므로 이번에 검사 대상으로 **추가**한다. convert 선택 목록에 실제로 포함되는 전용 기대 질문을 공유 기대표에 등록하고, 기존 검사 대상과 기대 질문은 그대로 유지한다. PDF 공통 기본값(페이지 번호 질문)을 convert에 적용하지 않는다.
- 검사기 자체 검증: validate-static-output의 판정 로직을 함수로 분리(CLI 진입 guard)하고 `tests/unit/static-output-validation.test.ts`에서 HTML fixture에 (a) FAQPage 제거 (b) 필수 질문 제거 (c) 본문·JSON-LD 불일치를 각각 주입해 **해당 오류 종류**로 실패함을 확인. FAQPage 판정은 문자열 포함이 아니라 파싱한 `@type` 기준.

### 3-3. 39건 항목별 처리
- 기준: 항목표 39행. 각 행에 기록: 가이드 키 / JSON 경로 / 원문 / 연결 경로 / 판단(수정·유지·제거) / 변경 문구 / 정적 출력 확인 / 런타임 확인. 기록 파일: `docs/jobs/todo/adsense-recheck-20260919/WU1-ITEMS.md`(worktree 사본에 작성, 통합 시 원본 위치로 취합).
- 제작 지시 문단: 실제 도구 동작을 확인한 뒤 **완성된 사용자 설명**으로 바꾸거나, 사용자 가치가 없으면 제거하고 원문을 `docs/guide-production-notes.md`(신규, 저장소 문서, 미배포)에 키·경로와 함께 이동. 예제 파일·다운로드·"검증했습니다" 문구를 새로 만들지 않음. 유효한 지원 제한·안전 안내 문장은 보존.
- 고아 제목 20건: 마지막 문단의 다음 절 제목을 제거. 블록 스키마(title/paragraphs/items 문자열)로 링크를 표현할 수 없으므로 링크 구성은 하지 않음. 문단이 제목만으로 구성돼 있으면 문단 삭제.
- 미연결 `video` 키 2건: 코드·검사기·테스트에서 `"video"` 키 참조가 없음을 grep으로 확인한 뒤 KO/EN에서 키 삭제. 참조가 있으면 삭제 대신 수정하고 근거 기록.
- xls-preserve 2건: 문구 수정은 동일하게 수행. 런타임 확인은 `/ko/tools/excel-merger/xls-preserve/` 격리 문서를 preview에서 열어 가이드 블록 렌더 여부를 기록(렌더되지 않으면 "런타임 미노출 확인"으로 기록, 결함으로 만들지 않음).
- 검출 휴리스틱에 잡히지 않은 같은 유형이 같은 블록 안에 있으면 함께 처리하고 항목표에 추가 행으로 기록. 무관한 문구 재작성 금지.
- 항목 상태 어휘: `수정` / `유지` / `제거` / `미연결 삭제`(video 키) / `격리 미노출`(xls-preserve). 확인은 항목의 **가이드 문단 위치**(해당 가이드 키의 blocks 또는 pathBlocks가 렌더되는 `<main class="seo-static-fallback">` 본문과 런타임 가이드 섹션) 기준으로, HTML 엔티티 디코딩 후 판정한다. `수정`은 옛 문구 부재 + 새 문구 존재, `제거`는 그 위치에서 부재, `유지`는 기대 문구 존재, `미연결 삭제`는 JSON 키 부재, `격리 미노출`은 예외 기록. 같은 문자열이 페이지 title·메타·다른 문맥(예 EN `Resize Image`는 seo.ts의 정상 페이지 제목)에 남아 있는 것은 실패가 아니다. dist 전체 grep 0건을 기준으로 쓰지 않는다.
- 확인 스크립트(저장소에 추가하지 않음, `/tmp/wl-adsense/wu1/`): 빌드 dist의 연결 경로별 정적 본문 검사 + preview(4181)에서 같은 경로의 가이드 섹션 DOM 검사. 결과 `content-check.json`에 항목 번호·경로·언어·상태·판정 근거 저장.
- 시각 표본: 같은 스크립트에서 KO/EN `/tools/pdf-editor/ocr`, `/tools/pdf-editor/convert`와 고아 제목 제거 대표 3경로(KO `/tools/image-studio/resize`, EN `/tools/video-studio/extract-audio`, EN `/tools/pdf-editor/stamp`)의 가이드 영역 전체 페이지 캡처를 `/tmp/wl-adsense/wu1/shots/`에 저장(WU4 시각 검토 입력).

### 3-4. validate-guides.mjs 강화
요건(방법은 Sol 선택):
1. 경로별 필수 FAQ: `scripts/static-faq-expectations.json`으로 실제 `(slug, route)` 연결쌍마다 `getFaqsForPath(lang, slug, path)` 결과에 필수 질문이 포함되는지 검사. 빌드 전 단계에서 실패해야 함.
2. 라우트 정본: `src/app/App.tsx`의 Route 선언(문자열 리터럴 path, 중첩 Route 포함)에서 하위·동적 경로까지 `scripts/validate-guides.mjs`가 AST로 추출한 목록이 정본이다(`tests/tool-registry-routes.mjs`의 방식 참고). App.tsx 수정과 새 라우트 모듈 신설은 이번 소유 범위에 포함하지 않는다. `toolSlugByPath`는 slug 연결에만 쓴다. 끝 슬래시 정규화, 동적 세그먼트 `:param` 패턴 동일성 비교, 언어별 가용성(EN HWP 제외) 반영. pathFaqs·pathBlocks 키는 정본 경로와 **정확히** 일치해야 하며 접두어 일치는 허용하지 않는다(`/tools/pdf-editor/ocr-typo` 실패). 선택 배열이 비어 있으면 실패.
3. 실제 `(slug, route)` 연결쌍마다 해석된 가이드가 title·description·blocks(≥1)를 가져야 함. 모든 slug에 모든 path를 넘기는 전 조합 검사는 하지 않는다(getGuideKeyForPath의 path 우선 분기가 무관한 slug를 convert로 해석함).
4. 제작 메모 회귀: 출발점은 KO "…다."로 끝나되 "…니다."가 아닌 문단 종결형(현재 데이터에서 항목표 KO 메모 8건과 정확히 일치, 오탐 0), KO 어구 "게시 전"/"예시를 만들 때"/"설명하되", EN "^Example: (Show|Explain|Describe|Prepare)", "Do not use real", "before publishing", "Show where", "composite value", "Connect the display", "fixture", "do not promise". 이것만으로 EN 메모 11건 중 다수가 잡히지 않으므로, **이번에 제거·수정한 19건 원문 전체를 회귀 fixture로 주입**해 각각 실패함을 단위 테스트로 보장한다. negative control: 정상 사용자 주의(예 "~하지 마세요", "~않습니다", "~확인하세요"), 따옴표·숫자로 끝나는 짧은 유효 문장이 통과. 허용목록은 위치(가이드 키+JSON 경로)+문구+이유로 좁게 등록하며 광범위 면제 금지. 패턴 미검출을 의미 검수 완료로 쓰지 않는다.
5. 고아 문단 회귀: 블록·pathBlocks의 마지막 문단이 종결부호 없이 40자 미만이거나, 같은 언어 가이드의 어떤 block title과 정확히 일치하면 실패.
6. 자체 검증: `scripts/validate-guides.mjs`를 데이터 인자를 받는 순수 함수 export + CLI 진입 guard로 분리(현재는 import 시 즉시 디스크 읽기·`process.exit`). FAQ 선택 정책도 주입 데이터로 동작해야 하며(getFaqsForPath가 원본 JSON을 직접 읽으면 mutation이 반영되지 않음), `tests/unit/guides-validation.test.ts`(node --test, 기존 glob 포함)에서 (a) 현재 데이터 통과 (b) 19건 메모 fixture 각각 실패 (c) 고아 제목 주입 실패 (d) 필수 FAQ 제거 실패 (e) 경로 오타·빈 선택 배열 실패 (f) negative control 통과를 확인. mutation이 실제 판정에 반영됐음을 결과로 증명.
- `npm run test:guides` 종료 코드와 전체 출력 보존.

### 3-5. WU1 소유·금지
- 소유: `src/locales/ko/guides.json`, `src/locales/en/guides.json`, `src/i18n/guideData.ts`, `src/components/ToolGuideWrapper.tsx`(FAQ 선택 정책 변경이 꼭 필요할 때만), `scripts/validate-guides.mjs`, `scripts/validate-static-output.mjs`, `scripts/static-faq-expectations.json`(신규), `tests/unit/guides-validation.test.ts`, `tests/unit/static-output-validation.test.ts`, `docs/guide-production-notes.md`, 기록 `docs/jobs/todo/adsense-recheck-20260919/WU1-ITEMS.md`, `docs/jobs/todo/adsense-recheck-20260919/WU1-REPORT.md`. `/tmp/wl-adsense/wu1/` 아래 임시 스크립트·결과는 저장소 파일 제한 밖.
- 금지: package.json, AdSenseLoader/AppShell/adEligibility, seo.ts의 canonical·redirect, 디자인·컴포넌트 재설계, evidence·scratch 삭제(WU3 전).
- 커밋: 작업 브랜치에 의미 단위로. 마지막 커밋 SHA를 고정 제출. push 금지(통합 담당이 필요 시 수행).

## 4. WU2 — Muse

### 4-1. 테스트 설계
- 파일: `tests/ad-eligibility-smoke.mjs`(+ 필요 시 `tests/helpers/ad-stub.mjs`). package.json에 `"test:ads": "node tests/ad-eligibility-smoke.mjs"` 추가하고 파일 끝 개행 복원.
- 빌드: `npm run build`를 **VITE_LOCAL_QA 미설정**으로 수행(LOCAL_QA는 광고를 강제 비활성화하므로 검사 대상이 아님). 보고에 빌드 플래그 명시.
- 서버: `tests/recovery-server.mjs`의 `startRecoveryServer({root:"dist", port: RECOVERY_TEST_PORT})` 재사용. `server.state.fault/asset/delay`로 특정 도구 chunk의 실패·지연 주입.
- 네트워크 격리(fail-closed): `context.route("**/*")`로 로컬 서버 origin 외 모든 HTTP(S) 요청을 기본 `abort`한다. 정확한 AdSense 스크립트 URL(`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-…`)만 스텁으로 `fulfill`: `Content-Type: application/javascript`, `Access-Control-Allow-Origin: *`(crossorigin=anonymous 스크립트이므로 필수), 본문은 전역 초기화 후 `window.__wlAdStub.loads++`, `adsbygoogle.push` no-op. 분석(googletagmanager.com, wcs.pstatic.net)도 차단 대상. 격리 SW가 있는 context(video 등)도 같은 라우팅이 적용되는지 확인.
- 계수 분리: 시나리오·문서별로 `광고 요청 시도 수 / 스텁 처리 수 / 차단 수 / 실제 네트워크 허용 수`를 기록한다. 실제 네트워크 허용 수는 모든 시나리오에서 0. S2의 기대 "스텁 1"은 시도 수 1·스텁 1·실제 0을 뜻한다. 스텁 loads는 새 문서마다 초기화되므로 문서별 값과 테스트 프로세스 누적값을 모두 보존.
- 동의: `context.addInitScript`로 `localStorage.worklazy_privacy_consent`를 `granted`/`denied`/미설정으로 준비.
- 관측: `script[data-worklazy-adsense]` 개수, 스텁 로드 횟수, 전체 문서 내비게이션 횟수(`page.on("framenavigated")` 최상위), `[data-route-error]`·`.tool-route-loading` 존재, 현재 URL.

### 4-2. 시나리오 (모두 KO 기준. S2·S6·S8은 EN 표본 추가. **S2의 EN 표본은 광고 허용 경로 `/en/tools/text-merger`**로 동의 있음·정상 로드에서 script 1·스텁 1·실제 외부 허용 0. S6은 그 EN 허용 경로에서 `/en/tools/pdf-editor/merge` 또는 `/en/tools/document-compare`로 이동, S8은 해당 EN 제외 경로로 직접 진입. HWP는 KO 전용 라우트이므로 KO만 검사하고 `/en/tools/hwp-editor`→`/en/tools` 리다이렉트는 정상 동작으로 기록)
| # | 상태 | 기대 |
|---|---|---|
| S1 | 동의 없음/거부 + 허용 경로 정상(`/tools/text-merger`) | script 0, 스텁 0 |
| S2 | 동의 있음 + 허용 경로 정상 | script 1, 스텁 1, 실제 외부 요청 0 |
| S3 | 동의 있음 + 허용 경로 chunk 지연(초기 lazy 로딩): `state.asset`을 대상 도구의 실제 빌드 chunk 이름으로, `state.delay`로 지연. 시나리오마다 새 context | `.tool-route-loading` 관측 중 script 0; 로드 완료 후 script 1. 지연·fallback이 실제 관측됐음을 기록 |
| S4 | 동의 있음 + 허용 경로 직접 진입인데 chunk 실패: `state.fault="404"`(또는 disconnect), `state.remaining=Infinity`로 지속 실패(chunkRecovery의 1회 reload 후에도 실패해야 경계 도달) | 최종 문서에 `[data-route-error]` 표시, 모든 문서에서 script 0, 스텁 0. 중간 reload 횟수 기록 |
| S5 | 동의 있음 + 허용 경로 정상 로드(script 1) → **같은 URL 유지한 채** 오류 화면 전환 | 새 스텁 로드 0(총 1 유지). 기존 script 태그 잔류 여부를 **기록**(현 정책상 중단 수단 없음 → 잔여 위험). 이미 평가된 ES 모듈은 재요청되지 않으므로 서버 fault만으로는 재현되지 않는다. 시도 순서: (1) 대상 도구에 사용자 동작으로 트리거되는 지연 import가 있으면 그 chunk를 fault (2) `state.transform`으로 테스트 전용 응답 변환을 적용해 같은 URL에서 React 렌더 오류를 주입(적용 사실과 경계 도달을 증명, 실제 내부 import 재현과 구분해 기록) (3) 둘 다 불가하면 시도한 도구·동작·실패 요청·경계 미도달 이유를 기록하고 "재현 불가". 재현 불가는 pass로 계수하지 않음 |
| S6 | 동의 있음 + 허용 경로(script 1) → SPA 링크로 제외 경로(`/tools/pdf-editor/merge`, `/tools/hwp-editor`(KO만), `/tools/document-compare`) 이동 | **새 문서 커밋**(최상위 프레임 `resourceType==="document"` 내비게이션 요청 또는 CDP loaderId 변경) 초기 진입 제외 정확히 1회, 5초 안정화 후 추가 문서 교체 0. SPA pushState 이동·서버 끝 슬래시 301은 별도 기록(합산 금지). 새 문서 script 0, 스텁 추가 0 |
| S7 | S6 후 브라우저 뒤로가기 → 허용 경로 복귀 | 정책대로 script 1(재삽입은 정상), script 태그 ≤1(중복 초기화 없음), 문서 교체·SPA 이동 횟수 기록 |
| S8 | 동의 있음 + 제외·격리 경로 **언어 prefix 포함 URL**로 직접 진입: `/tools/pdf-editor`, `/tools/pdf-editor/ocr`, `/tools/hwp-editor`(KO), `/tools/document-compare`, `/tools/document-compare/results/1`(세션 없음 → 만료 안내 상태 도달 확인), `/tools/pdf-compare`, `/tools/office-editor/app/`, `/tools/excel-merger/xls-preserve/`, `/tools/video-studio`, `/tools/video-studio/trim`(SW 허용 별도 context), `/tools/document-redactor` | script 0, 스텁 0. 격리 문서는 최종 URL·isolation meta·준비/오류 상태를 함께 기록해 빈 화면의 0을 성공으로 처리하지 않음. 격리 문서의 COI 준비 reload는 S6 상한을 적용하지 않고 횟수만 기록 |
| S9 | 동의 있음 + 허용 경로에서 파일 선택(합성 파일 1개, 예: text-merger에 .txt) → S6 이동 | 새로고침으로 유실되는 상태·경고 유무를 **기록**. 이동 취소 흐름이 있으면 기록. 판정은 Claude(설계상 예상 동작 vs 결함 후보) |
| S10 | 모바일 뷰포트에서 광고 overlay와 저장·다운로드 버튼 겹침 | 스텁으로는 실제 overlay가 없어 **검증 불가** → 결과 파일에 "실제 광고 필요·미확인"으로 기록 |

- 결과: `/home/better0101/projects/wt-adsense-adtest/tests/visual-artifacts/adsense-recheck/ad-smoke-results.json`(시나리오별 관측값·요청 로그·스크린샷 경로). 저장소에는 테스트 코드만 추가.
- 테스트 자체 검증: 스텁 fulfill을 끄고 사전 차단은 유지한 상태에서 S2가 "스텁 1"에 실패하는지 1회 확인(검사기가 실제로 판별하는지). 결과 기록.

### 4-3. 결함 수정 범위
- 테스트가 드러낸 결함에 한해 `src/components/AdSenseLoader.tsx`, `src/app/adEligibility.ts`, `src/components/AppShell.tsx`의 광고 관련 줄(현 45–51, 74–79, 121)만 최소 수정. 광고 제외 경로 축소, allowlist 도입, noindex, 본문 변경 금지. 수정 시 어떤 시나리오가 실패했고 무엇이 바뀌었는지 기록.
- S5의 "기존 광고 잔류"는 이번 수정 대상이 아님. 사실만 기록.

### 4-4. WU2 소유·금지·세션
- 소유: `tests/ad-eligibility-smoke.mjs`, `tests/helpers/ad-stub.mjs`(선택), `package.json`(scripts 추가·개행), 4-3의 세 파일, 기록 `docs/jobs/todo/adsense-recheck-20260919/WU2-REPORT.md`. AppShell의 비광고 줄·라우팅을 바꿔야 하는 상황이면 중단하고 Claude에 회부(범위 재정의).
- 금지: guides.json, 검증기, seo.ts, 문서 본문, 광고 정책 확대.
- Muse 세션: 신규(이 작업의 기존 세션 없음). 실제 세션 ID·모델 ID·로그 경로(`/home/better0101/projects/wt-adsense-adtest/tests/visual-artifacts/adsense-recheck/muse-*.log`)를 WU2 기록에 남김. 후속은 그 세션 ID로 `-s`.
- 커밋: 작업 브랜치에. 마지막 SHA 고정 제출. push 금지.

## 5. WU3 — Sol (WU1 종료 후)

- 대상: `git ls-files evidence scratch 'patch_*.py' test-drag.html integration_status.md` 전체 **138개**. 경로 목록을 분류표에 그대로 싣고 전수성을 확인(임의 제외 금지). 원본 작업트리의 untracked 파일(patch_*.py 4, scratch/*.py 14)과 `patch_notes.py` 로컬 수정은 worktree A에 없으므로 WU3 대상이 아니다. 분류표에 "원본 작업트리 untracked·미처리·보존"으로 기록하고 그대로 둔다(통합 후 Claude가 archive 사본 처리).
- 분류표 `docs/jobs/todo/adsense-recheck-20260919/WU3-CLASSIFICATION.md`: 경로 / 종류 / 민감정보 확인 방법·결과 / 재생성 가능 여부 / 테스트·스크립트 사용처 / 공개 필요 / 처리 / 근거.
- 민감정보 확인: 텍스트는 이메일·전화·토큰·비밀번호·주민번호·계좌 패턴 grep. PDF는 `pdftotext` 전 페이지 + 이미지·첨부 존재 여부 기록(추출 텍스트가 비었거나 이미지·첨부가 있으면 "검사 완료"로 적지 않고 미확인). XLSX는 ZIP 전체 package(sharedStrings·sheet inlineStr·주석·docProps 작성자·관계 target)를 zip 기준으로 검사. zip은 목록 + 내부 파일 동일 기준. 검사 불가 파일은 보존·미확인으로 보고. **발견 시** 해당 파일 처리 중단·Claude에 즉시 보고, 이력 재작성·자격증명 폐기는 하지 않음(별도 승인).
- 기본 처리안(분류 결과로 조정):
  - `evidence/vite-cache/**`, `evidence/*.xlsx`, `evidence/multi.zip`, `evidence/smoke-results.json`: 재생성 가능한 캐시·테스트 산출물 → `git rm --cached`, `.gitignore`에 `evidence/` 추가.
  - `evidence/corpus/fixtures/**`: 합성 fixture. 생성기가 있으므로 추적 해제 후 `.gitignore` 포함(디스크 파일은 삭제하지 않음. Vite root에서 `/evidence/corpus/fixtures/...` fetch는 추적 여부와 무관하게 동작). 확인: 원본을 지우지 말고 **빈 격리 디렉터리** `/tmp/wl-adsense/wu3/corpus`에 `node tests/helpers/pdf-compare-fixtures.mjs /tmp/wl-adsense/wu3/corpus`를 실행해 manifest와 manifest가 참조하는 모든 PDF가 생성됨을 확인하고 원본 manifest와 비교. 생성기가 의존하는 `public/vendor/qr-label-font/.../NotoSansKR-Regular.otf`와 pdf-lib 존재를 함께 기록. 실패하면 fixture는 보존하고 이유 기록. 전체 UI 스모크 실행은 필요 없음.
  - `scratch/**`, 루트 `patch_*.py`, `test-drag.html`, `integration_status.md`: 내부 프롬프트·계획 원문·일회성 스크립트·내부 현황표 → `git rm --cached` 후 파일을 `docs/jobs/todo/adsense-recheck-20260919/archive/`(git 제외)로 이동. `.gitignore`에 `scratch/`, `/patch_*.py`, `/test-drag.html` 추가.
  - 이동·해제 전 `grep -rn` 으로 src·scripts·tests·package.json·.github 참조 없음 확인. 참조가 있으면 경로 갱신 또는 보존.
- 금지: 정식 규칙·문서(PROJECT_RULES.md, AGENTS.md, GEMINI.md, CLAUDE.md, docs/*.md) 삭제·이동, `git filter-repo`·`rebase` 등 이력 재작성, `git clean`.
- 소유: `.gitignore`(WU3 단독), 추적 해제·이동 대상 파일, `docs/jobs/todo/adsense-recheck-20260919/WU3-CLASSIFICATION.md`·`archive/`.
- 확인: 위 격리 재생성 성공, `rg -n 'evidence|scratch|patch_.*py|test-drag|integration_status' src scripts tests package.json .github` 결과와 처리의 정합(evidence는 테스트 참조가 있으므로 "참조 없음"으로 적지 않음), `git status`에 의도 밖 삭제 없음.

## 6. WU4 — 통합·검수·판정·배포 확인

1. Sol: `integration/adsense-recheck-20260919`를 WU1 브랜치 최종 SHA에서 생성, WU2 브랜치를 merge(한 방법만). 충돌 시 계약 유지, 설계 판단 필요하면 Claude에 회부.
2. 통합 후보에서 유효 결과 취합: `npm run build`(prebuild의 test:guides 포함) → `npm run test:unit` → `npm run test:static` → `npm run test:ads` → WU1 런타임 확인 스크립트 재실행(통합 dist 기준). 각 명령·종료 코드·로그 경로 기록. 개별 브랜치 통과를 통합 통과로 간주하지 않음.
3. 시각 검토(Gemini `gemini-3.1-pro-high`, agy, 읽기 전용): WU1의 캡처(`/tmp/wl-adsense/wu1/shots/`, 통합 dist에서 재캡처한 것)를 열람해 가이드 영역 깨짐·빈 섹션·잘린 문단 여부를 보고. Gemini 실패 시 Claude가 캡처를 직접 열람. 전체 시각 회귀는 하지 않음.
4. Astra 검수(`gpt-6-astra`, 추적 파일 수정·커밋·push 금지, 산출물 `/tmp/wl-adsense/review/`): 지시서 대비 누락·왜곡·미실행 검사, 39건 항목표 대비 실제 diff, OCR 정적·런타임, 광고 스모크의 판별력(4-2 자체 검증 포함), WU3 분류표의 근거. 필요한 표본만 독립 재현.
- 공통 기록(CHANGELOG.md, docs/review-notes.md, docs/backlog.md)은 통합 담당 Sol이 실제 작성자 서명을 보존해 취합. 구현자는 각자 WU 기록 파일에만 쓴다.
5. Claude 감사·판정: 원본 로그·dist·diff 대조. 차단/비차단/권고/미확인 분류.
6. 보고 "구현·검증 완료, 운영 미반영" → 사용자 승인 후 Sol이 main 반영(push). GitHub Pages 실행 성공 확인.
7. Claude: (a) worktree A의 git 제외 폴더 `docs/jobs/todo/adsense-recheck-20260919/archive/`(WU3가 추적 해제 후 이동한 96개)를 원본 저장소의 같은 상대 경로로 복사해 보존(worktree 제거 전 필수). (b) 원본 작업트리의 untracked `patch_*.py`·`scratch/*.py`와 `patch_notes.py` 로컬 수정본을 원본은 그대로 두고 같은 archive에 사본 보존(로컬 수정본은 `archive/patch_notes.local.py`), 출처·확인 결과 기록. 이후 원본 정리는 사용자 확인 후.
8. 운영 확인(Claude 또는 Astra, 읽기): `/ko,/en/tools/pdf-editor/ocr/` FAQPage+필수 질문, 39건의 항목별 상태 확인(3-3 위치 기준 스크립트를 운영 URL에 적용, 노출 경로에 한정), 운영 번들에 경로 제외 로직 존재, 제외 경로 정적 HTML에 광고 스크립트 부재. 결과를 항목표의 "운영 확인" 열에 기록.

## 7. 검사 배정

| 구분 | 검사 |
|---|---|
| WU1 이번 | test:guides, 단위 테스트(guides-validation, static-output-validation), build, test:static, OCR·39건 위치 기준 정적·런타임 확인(4181), 시각 표본 캡처 |
| WU2 이번 | build(LOCAL_QA 미설정), test:ads 전 시나리오, 자체 판별력 확인 |
| WU3 이번 | fixture 재생성, 참조 grep, git status |
| 최종 통합 | build / test:unit / test:static / test:ads / WU1 위치 기준 확인 재실행 / 대표 화면 시각 열람. 그 외 스모크는 결과 재사용 |
| 적용 아님 | 전 도구 회귀, 시각 회귀 전체, 성능 벤치, 접근성 전수 (이번 변경은 가이드 데이터·검증기·광고 로더 조건·테스트에 한정. 전역 스타일·라우팅·핵심 의존성 변경 없음) |

## 8. 완료 기준 (항목별 5단계 추적)

각 항목(OCR, 39건 각 행, 검증기 6요건, 광고 시나리오 S1–S10, 부산물 138파일 분류)에 대해:
소스 수정 완료 → 관련 테스트 통과 → 통합 후보 build/test:static 통과 → 승인된 배포 성공 → 운영본 확인.
항목 상태는 `수정`/`유지`/`제거`/`미연결 삭제`/`격리 미노출`/`적용 대상 아님`/`재현 불가`/`미확인`으로 구분해 그대로 보고한다. `유지`·`적용 대상 아님`·`재현 불가`(S5)·`미확인`(S10, 실제 광고)은 통과로 합산하지 않고, 미배포 문서·부산물 정리는 "운영 확인" 단계가 없음을 표기한다.
HEAD 반영과 운영 반영을 구분. 빌드 도구는 "CI 적용·실행 결과"로 표기. 배포 전에는 "구현·검증 완료, 운영 미반영".

## 9. 최종 보고 구조

구현 완료 항목 / 테스트 확인 항목 / 운영 확인 항목 / 사용자 계정에서 확인할 항목(AdSense Auto ads 페이지 제외 목록: 위 4경로군 + 격리 경로, 사이트 수준 자동 광고 설정, 실제 노출 표본, 모바일 overlay) / 미확인·잔여 위험(S5 기존 광고 잔류, S10, 실제 광고 요청·노출, 심사 결과 보장 불가).

## 10. 종료 조건·보고

- 각 구현자는 최종 SHA, 변경 파일 목록, 실행 명령·종료 코드·로그 경로, 미완료·재현 불가 항목을 WU 기록 파일에 남기고 종료. 지시서 밖 파일 추가 금지(새 파일은 전체 경로로 지정된 것만).
- 실패·권한 오류는 원인과 함께 중단 보고. 샌드박스·승인 설정 해제로 우회하지 않음.

## 11. 변경 이력

- v0.1 (2026-09-19): 초안.
- v0.2 (2026-09-19): Astra 1차 반박(차단 5) 반영 — 라우트 정본을 App.tsx 선언 기반으로 변경, (slug, route) 연결쌍 검사, 39건 확인을 문단 위치·상태 어휘 기준으로 변경, OCR 이관 ID를 faq_19/faq_20+pathBlocks 1블록으로 한정·root 선택 보존·빈 선택 배열 실패, 광고 스모크 외부 통신 fail-closed·계수 분리·문서 교체 계수·EN HWP 제외·video 추가·S3/S4/S5 재현 조건 구체화, WU3 138개·원본 비삭제 격리 재생성·XLSX/PDF 검사 범위, 정적 검사기 자체 검증, 대표 화면 시각 열람, 소유 파일·기록 경로 확정, §8 상태 어휘.
- v0.3 (2026-09-20, 정본): Astra 2차 조건 반영 — S2 EN 표본을 허용 경로 `/en/tools/text-merger`로 분리(R4, 차단), 로컬 수정본·untracked 보존 담당을 Claude 통합 후 처리로 통일(R5), standard의 OCR pathFaqs 키 제거 지시 복원(A1), convert는 정적 FAQ 검사에 신규 추가로 정정(A2), 라우트 추출은 AST 방식으로 확정·App.tsx 비수정·기록 파일 전체 경로(A4). 계획 상태 정본화 완료, 구현 허가 있음.
- v0.3.1 (2026-09-20, 운영 조정): WU2 임시 산출물 경로를 `/tmp/wl-adsense/wu2/`에서 worktree 내부 git 제외 폴더 `tests/visual-artifacts/adsense-recheck/`로 변경. 사유: OpenCode 비대화형 실행이 외부 디렉터리 쓰기 권한을 자동 거부함(권한 설정 해제 대신 경로 조정). WU1 worktree 사본은 v0.3 그대로 유효(WU1 무영향). Muse 로그는 `/tmp/wl-adsense/wu2/muse-*.log`에 Claude가 기록.
- v0.3.2 (2026-09-20, 운영 기록): 실행 식별자 — Sol WU1: task-mu8irzph-76utlf(착수 전 npm 캐시 EROFS로 중단, 변경 없음) → 재발행 task-mu8ixnnr-2am5fa(모델 gpt-5.6-sol, cwd /home/better0101/projects/wt-adsense-guides, 상태 디렉터리 `~/.claude/plugins/data/codex-openai-codex/state/wt-adsense-guides-9ac72720adce348c/jobs`, 조회는 `--cwd` 필요). Claude가 worktree A에 `npm ci` 완료(569 packages) 후 worktree A `.codex/config.toml` writable_roots에 `/home/better0101/.npm` 추가(전역 해제 아님). Muse WU2: OpenCode 세션 `ses_f45cd39d4ffeMjz2CpUX4DjHJJ`(신규, 모델 opencode/muse-spark-1.3-contributor-free, dir /home/better0101/projects/wt-adsense-adtest), 1턴은 외부 디렉터리 권한 거부로 상태 보고만 하고 종료 → v0.3.1 경로 조정 후 `-s` 이어쓰기 2턴 진행 중. 로그 /tmp/wl-adsense/wu2/muse-*-2.log.
- v0.3.3 (2026-09-20, 운영 기록): Sol 재발행 task-mu8ixnnr-2am5fa가 커밋 단계에서 `.git/worktrees/wt-adsense-guides` ro 마운트(index.lock EROFS)로 중단, OCR 이관 변경 4파일은 미커밋 보존. 원인: worktree 경로가 `~/.codex/config.toml` projects에 없어 worktree `.codex/config.toml` 미로드. 조치: `~/.codex/config.toml` 백업(`config.toml.bak-adsense-recheck-20260920`) 후 wt-adsense-guides·wt-adsense-adtest·wt-adsense-integration 경로 trusted 등록(전역 샌드박스 해제 아님). 3차 발행 task-mu8j7qd1-buccyt(보존 변경 이어받기·첫 커밋 후 진행). 사용자 보고 사항: 이 신뢰 등록 3줄은 작업 종료 후 제거 가능.
- v0.3.4 (2026-09-20, 운영 기록): 3차 발행 task-mu8j7qd1-buccyt도 gitdir EROFS로 31초 만에 중단(변경 보존). 프로브 task-mu8jasxh-d2nimm: worktree `.codex/config.toml`은 로드됨(~/.npm·main .git·/tmp/wl-adsense rw)이나 Codex가 cwd `.git` 파일이 가리키는 `.git/worktrees/wt-adsense-guides`만 별도 ro 마운트. 조치: 그 정확한 경로를 writable_roots에 추가 → 프로브 task-mu8je4nr-fte7f2에서 rw·`git add -n` 통과 확인. 4차 발행 task-mu8jg7go-a59zks. Muse WU2는 2턴 진행 중(tests/ad-eligibility-smoke.mjs, tests/helpers/ad-stub.mjs 생성, 캡처 19개).
- v0.3.5 (2026-09-20, 진행 기록): Sol WU1 완료 — 4차 잡 task-mu8jg7go-a59zks, 커밋 bc252d3(OCR 이관)·1d63027(검증기·39건), 39건 집계 수정 17/제거 20/미연결 삭제 2(xls-preserve 2건은 "제거"로 처리하고 격리 정적 문서 가이드 미노출을 행에 기록). test:guides·신규 단위 29/29·build·test:static·content-check(39항목, FAQ 2경로×2언어, 캡처 7장) 통과. 전체 test:unit 10건 실패는 Claude가 기준 29fe72c 원본에서 같은 7개 파일을 재실행해 **동일 10건 실패 확인(기존 결함, WU1 무관)** → 백로그(`/tmp/wl-adsense/review/baseline-unit-7files.log`). CI는 test:unit을 실행하지 않아 배포 차단 요인은 아님. Sol 관찰: PdfComparePage에 ToolGuideWrapper 없음, office-editor 랜딩이 /app으로 즉시 이동 → 두 도구는 런타임 가이드 미노출(기존, 백로그 후보). WU3 발행 task-mu8kqw1l-11vsh1(진행 중). Astra WU1 검수 task-mu8ktlsz-5ogey3(검수 복사본 /tmp/wl-adsense/review/wu1-src @1d63027).
- v0.3.6 (2026-09-20, 진행 기록): Sol WU3 완료 — task-mu8kqw1l-11vsh1, 커밋 da3f3ba(evidence 42개 추적 해제·디스크 보존)·73cdb27(내부 부산물 96개 추적 해제·archive 이동, .gitignore 4줄). Claude 감사: 계보 유지, 대상 추적 0, 분류표 138행, 미확인 PDF 4(빈 텍스트·이미지), 제품·테스트·package.json 무변경, archive 96개 byte 동일. 민감정보 확정 발견 없음. work/adsense-guides-20260919 최종 SHA 73cdb27. Muse WU2 진행 중: 커밋 a48121a(fix(ads): 구독 시 적격성 재조정 — 동의 선기록 lazy 경로에서 광고 로드), 81b3fa1(test(ads): S1–S10 스모크·test:ads). 감사 시 a48121a가 광고 범위를 넓히지 않는지(허용 경로·정상 로드 완료 후에만 삽입) 확인 필요.
- v0.3.7 (2026-09-20, 진행 기록): Astra WU1 검수 task-mu8ktlsz-5ogey3 → /tmp/wl-adsense/review/wu1-astra.md, 판정 "통합 후보 적합". 차단 없음. 권고 2: (a) 명시 선택 키(pathFaqs) 자체 삭제 시 전체 FAQ 대체로 필수 질문 검사 통과(방어 공백) (b) negative control 테스트가 unshift로 마지막 문단 위치를 검사하지 않음. 미확인: 캡처 7장에서 동의 배너가 본문·FAQ 일부를 가림(통합 시 동의 저장 상태로 재캡처). 기타 확인: OCR 이관 ID 한정·root 보존·기대표 27×2 보존·AST 49라우트·mutation 4종 실패 재현·39행 1:1·고아 20건 앞 본문 완전 보존·19원문 보존·캡처 7장 실제 열람. seo 2건은 의존 관계상 WU1 영향 가능이나 Claude 기준 재현으로 동일 실패 확인(기존). office-editor는 `?guide=1`이면 가이드 표시(Sol 관찰의 예외). 후속: Sol에게 권고 2건 반영을 같은 worktree에서 발행(WU1-후속). 통합 worktree /home/better0101/projects/wt-adsense-integration 생성(73cdb27 기준, integration/adsense-recheck-20260919).
- v0.3.8 (2026-09-20, 진행 기록): Sol WU1-후속 task-mu8lamwz-l9sk7p 완료 → 커밋 584b7a0(공유 가이드 키의 route별 명시 pathFaqs 강제, 키 삭제 mutation 테스트, negative control 마지막 문단 위치). work/adsense-guides-20260919 최종 SHA **584b7a0**. Muse WU2 완료 → 커밋 a48121a·81b3fa1·7bfcf7c·c40c2eb, work/adsense-adtest-20260919 최종 SHA **c40c2eb**, test:ads 27/27·allowedExternal 0·판별력 확인. 편차: package.json 끝 개행 미복원(통합 조정으로 처리). Claude 판정 대기 항목: S5(chunk 실패형은 설계된 복구 리로드로 같은 URL 경계 도달·잔류 없음, 순수 렌더 오류형 잔류 위험은 미확인 유지), S9(도구 로컬 상태 유실은 SPA 이탈과 동일한 설계 동작, 경고 없음은 UX 선택·전역 메모리 상태 도구의 추가 위험 후보 기록), S6-merge 비적용(사이드바 pdf-editor 루트로 대체 가능 여부 Astra 확인 중). Astra WU2 검수 task-mu8ljklz-6dqxk9(복사본 /tmp/wl-adsense/review/wu2-src @c40c2eb). Sol WU4 통합 task-mu8llyho-88d6j3(wt-adsense-integration, ff 584b7a0 + merge c40c2eb).
- v0.3.9 (2026-09-20, 진행 기록·판정): Astra WU2 검수 task-mu8ljklz-6dqxk9 → /tmp/wl-adsense/review/wu2-astra.md, 판정 "부적합". 차단 3: S5 요건 미충족을 pass 계수(1a 리로드 후 정상 복귀, 1b 별도 context 직접 진입), S6 PDF 경로군 전환을 사이드바 루트 링크로 검사 가능했는데 N/A 처리, 비적용·미확인·미충족의 27/27 합산(§8 위반). 비차단: 3개 케이스 assertNoRealNetwork 누락, 문서별 계수·SPA 이동 기록 불완전, S6-ko-hwp 행에 S7 문서 혼입(배열 미복제), 판별 모드 예외 유형 미구분, package.json 개행(통합 조정으로 이미 복원), 보고서 커밋 수 3→4. 로더 수정 a48121a는 기준 코드의 실제 결함(동의 선기록+lazy 허용 경로 → 광고 미삽입)에 대한 최소 수정·범위 확대 없음으로 확인. Astra의 독립 build/test:ads는 샌드박스 네트워크(cdn.zetaoffice.net ENOTFOUND)·listen EPERM으로 미실행 → Sol 통합 실행이 대체 근거. **Claude 판정**: WU2 수정 라운드 필요(테스트·집계·보고서만, 제품 코드 불변). Muse 세션 -s 3턴 발행. 통합 2차 task-mu8luj1d-7dj05e는 계속(허용목록 조정 승인, test:unit/static/content-check/캡처/공통 기록) → Muse 수정 후 3차 통합에서 재병합·test:ads 재실행·기록 보정만 수행. S9 Claude 판정: 도구 로컬 상태는 SPA 이탈 시에도 유실되는 설계 동작으로 결함 아님, 경고 부재는 UX 선택(백로그 기록), 전역 메모리 상태 도구의 추가 위험은 후보로 기록.
- v0.3.10 (2026-09-20, 진행 기록·판정): Sol 통합 2차 task-mu8luj1d-7dj05e 완료 → 허용목록 조정 5ae29f9, 공통 기록 3f29a4a(CHANGELOG 5줄 Codx/Muse, review-notes "Claude 판정" 6항목, backlog 8항목). 검사: test:unit 547 중 537 통과·기존 10 실패 이름 동일·신규 0, test:static 통과(164문서), test:ads 27/27·allowedExternal 0(4183), content-check 39/39·FAQ 4/4·캡처 7장(배너 없음), build는 cd53c2a 결과 재사용(테스트·문서만 변경). Claude 감사: 조정·기록 커밋에 의도 밖 파일 없음, 서명 규칙 준수, 보고서 실패표 1행 소속 표기 오기(feature-locales↔p1b-components, 결과 무영향). 시각: Claude 2장 직접 열람 + Gemini(gemini-3.1-pro-high, /tmp/wl-adsense/review/gemini-visual/gemini-out.md) 7장 — 가이드·FAQ 정상, 빈 섹션·깨짐 없음. Gemini 지적 (1) 상단 고정 검색바 본문 가림 → fullPage 캡처 산물로 판정(비차단) (2) 좌측 하단 메뉴 아이콘 노출 → `.bottom-tabs` 규칙이 @media(max-width:820px) 안에만 있고 데스크톱 숨김 없음, 기준 29fe72c·운영 a946a0b와 CSS 동일(이번 변경 무관) → 기존 UI 결함 후보로 백로그(실제 데스크톱 뷰포트 확인 필요). 통합 후보 3f29a4a는 Muse WU2 수정 병합 전 상태이므로 최종 후보 아님.
- v0.3.11 (2026-09-20, 진행 기록): Muse WU2 수정 라운드(세션 ses_f45cd39d4ffeMjz2CpUX4DjHJJ 3턴) → 커밋 97739d5(tests/ad-eligibility-smoke.mjs만). S5: recovery-server state.transform으로 QrBulkPanel chunk에 테스트 전용 렌더 오류 주입 → 정상 로드 script 1 → 플래그 후 탭 클릭 → 같은 문서·URL에서 RouteErrorBoundary 도달, 스텁 총 1, **기존 광고 태그 1개 잔류 실측**(주입 재현 명시; 제품 처리 여부는 이번 범위 밖 → 백로그·사용자 결정). S6-ko/en-pdf-root 추가(사이드바 PDF 루트 링크, 문서 교체 1·추가 0·301 별도·script 0), S6-ko-merge는 not-applicable(정확 링크 부재). 상태 버킷 pass 26 / not-applicable 1(S6-merge) / recorded 1(S9) / unverified 1(S10) / fail 0, 29행, allowedExternal 전부 0. Claude 대조: 결과 JSON과 보고 일치, 헬퍼·제품 코드 무변경. 3차 통합 task-mu8mi63v-i5a44j 발행(재병합, test:ads·discriminate·app-shell 재실행, review-notes/backlog S5·S6 보정, WU4-REPORT 오기 정정).
- v0.3.12 (2026-09-20, 진행 기록): Sol 통합 3차 task-mu8mi63v-i5a44j 완료 → merge 5d6eca9(97739d5 반영), 기록 보정 c53cadc. **최종 통합 후보 SHA c53cadc**. 재실행: test:ads(4183) fail 0·29행·allowedExternal 0·S5 잔류 태그 1, discriminate 통과, app-shell 3/3. 재사용(제품 코드 무변경 근거): build(cd53c2a)·test:unit(537/547, 기존 10)·test:static·content-check 39/39·캡처 7. Claude git 감사: 계보에 merge 2회·cherry-pick 없음, 통합 변경 파일 = 두 브랜치 변경 합 + 통합 전용 4파일(CHANGELOG, backlog, review-notes, app-shell.test.ts), 브랜치 파일 누락 0, 제품 코드 변경은 AdSenseLoader.tsx(+5)·guideData.ts(+3)·guides.json KO/EN. Astra 최종 검수 발행(복사본 /tmp/wl-adsense/review/final-src @c53cadc). 상태: 구현·검증 완료, 운영 미반영(push·main 반영은 사용자 승인 대기).
- v0.3.13 (2026-09-20, 판정): Astra 최종 검수 task-mu8mx6pm-3n9rxx → /tmp/wl-adsense/review/final-astra.md, **main 반영 후보 적합**. 신규 차단 없음. 통합 정합(merge 2·cherry-pick 0, 파일 집합 = 브랜치 합 + 통합 전용 4, 보존 diff 빈 출력), WU2 차단 3건 해소(S5 주입 단언·JSON 일치, S6 pdf-root 실제 클릭·문서 교체 1, runCase 상태 분리 fixture 7종 재현), 통합 증거 대조 일치, WU3 138행·표본 12 Git/ignore 일치(archive byte 동일은 미검증으로 보존), 공통 기록 서명·과장 없음. 권고: WU4 실패표 소속은 feature-locales가 맞음(Claude의 3차 정정 지시가 오류 → 원복 지시), 스모크 메타데이터 `reused c40c2eb build` 하드코딩, discriminate 예외 타입 미검사·assertNoRealNetwork 비도달 분기, backlog에 S9 UX·bottom-tabs 후보 누락 → Sol 문서 전용 기록 커밋 발행. **Claude 최종 판정: 통합 후보 적합, 구현·검증 완료·운영 미반영. main 반영은 사용자 승인 대기.**
- v0.3.14 (2026-09-20, 최종): Sol 기록 보정 2 task-mu8naraz-frjwxc → 커밋 290a11f(docs/backlog.md +4: S9 UX·bottom-tabs 후보·스모크 메타데이터 오기·판별/네트워크 단언 보강). WU4-REPORT 실패표 소속 feature-locales 원복. **최종 통합 후보 SHA 290a11f**(integration/adsense-recheck-20260919, origin/main 29fe72c 위 17커밋, ff 가능). 상태: 구현·검증 완료, 운영 미반영. 다음: 사용자 승인 → Sol이 main ff push → Pages 성공 확인 → 운영 검증(OCR FAQ, 39건 표본, 제외 경로 스크립트 부재, 번들 로직) → worktree 4개·검수 복사본 3개·~/.codex 신뢰 등록 3줄 정리(사용자 확인 후).
- v0.3.15 (2026-09-20, 종결): 사용자 승인 "main에 올려" → Sol 배포 잡 task-mu93v0s4-k8bm3d, `git push origin HEAD:refs/heads/main` 29fe72c..290a11f ff, Pages 실행 35480115773 성공(5m40s). 운영 확인(Sol 표 + Claude 표본 재확인 일치): OCR KO/EN FAQPage·필수 질문, 옛 메모 3건 부재, 제외 경로 3곳 광고 스크립트 부재, 운영 번들 `assets/index-B5mMaf4H.js`에 경로 제외 로직. **상태: 운영 반영 완료.** 보고: DEPLOY-REPORT.md(통합 worktree). 후속은 adsense-followup-20260920(진행 중)·adsense-followup2-20260920(검토 중).
