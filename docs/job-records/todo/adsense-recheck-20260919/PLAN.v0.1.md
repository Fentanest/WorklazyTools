# adsense-recheck-20260919 — AdSense 재심사 전 콘텐츠·광고 통제 복구 계획

| 항목 | 값 |
|---|---|
| 작업 ID | adsense-recheck-20260919 |
| 버전 | v0.1 (초안, Astra 반박 대기) |
| 요청 모드 | plan-and-implement (`!계획!`, 사용자 2026-09-19) |
| 계획 상태 | 검토 중 |
| 구현 허가 | 정본화 후 허가. 정본화 전 구현 잡 발행 금지 |
| 기준 소스 | origin/main `29fe72c` (작업트리 미커밋: `patch_notes.py` 로컬 수정만) |
| 운영 기준 | worklazy.net = `a946a0b` 배포본. `29fe72c` 배포(#116)는 test:static 실패로 미반영 |
| 총괄·감사 | Claude (Fable 5.1) |
| 기술 검토·검수 | Astra (`gpt-6-astra`, Codex plugin) |
| 구현 | Sol (`gpt-5.6-sol`, Codex plugin) / Muse (`opencode/muse-spark-1.3-contributor-free`, OpenCode. 연결 실패 시 `opencode-go/muse-spark-1.3-contributor`, 실제 사용 ID 기록) |
| 통합·배포 담당 | Sol 1인 |
| 감사 항목표 | docs/jobs/todo/adsense-content-audit-20260919.md (39건, 작업 목록의 기준) |

## 0. 확정된 사실 (재조사 금지)

- 배포 #116 실패 원인: `/tools/pdf-editor/ocr`이 `pdfEditor.convert` 가이드로 연결되면서, `validate-static-output.mjs`가 요구하는 OCR 질문(`pdfEditor.standard.faq_19` "PDF 전체를 검색 가능한 파일로 만들 수 있나요?")이 convert 선택 결과에 없음. convert에는 pathFaqs가 없어 전체 FAQ 8개가 출력됨. FAQPage JSON-LD 자체는 존재.
- test:guides는 CI prebuild에서 실행돼 통과함. 검사 범위 부족(고정 문자열 3개)이 문제.
- 39건 항목표: 운영 정적 HTML 노출 확인 35 / 미연결 `video` 키 2 / 격리 경로(xls-preserve) 정적 미노출·런타임 미확인 2. 세 범주를 섞어 보고하지 않음.
- `patch_notes.py`는 5ca7f44에 커밋된 추적 파일. 로컬 수정(+60/−28)은 미커밋·미실행.
- `evidence/corpus/fixtures/*`는 `tests/helpers/pdf-compare-fixtures.mjs`가 생성하는 합성 자료. `pdf-compare-smoke/golden`은 manifest가 없으면 자동 재생성함.
- 민감정보 사전 스캔(Claude, 2026-09-19): 추적 텍스트 파일에서 이메일·전화·토큰·비밀번호 패턴 미발견. 표본 PDF 2개·xlsx 2개 본문은 합성 문자열. **전수는 아님** → WU3에서 파일별 재확인.
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
| WU2 | 광고 상태 전환 스모크, 발견 결함 최소 수정 | Muse (신규 세션) | `work/adsense-adtest-20260919` / `/home/better0101/projects/wt-adsense-adtest` | RECOVERY_TEST_PORT 4182, 산출물 `/tmp/wl-adsense/wu2/` |
| WU3 | 저장소 부산물 분류·정리 | Sol (WU1 후, 같은 worktree) | WU1과 동일 | — |
| WU4 | 통합·최종 검사·검수·배포 확인 | Sol (통합), Astra (검수), Claude (감사·판정) | `integration/adsense-recheck-20260919` / `/home/better0101/projects/wt-adsense-integration` | preview 4183 |

기준 커밋: 두 worktree 모두 `29fe72c`에서 분기. 미커밋 `patch_notes.py` 수정은 어느 worktree에도 복사하지 않음(WU3에서 원본 위치의 로컬 수정본을 아카이브에 보존).
각 worktree에는 PROJECT_RULES.md·AGENTS.md(추적됨)와 이 지시서·항목표 사본(docs/jobs는 git 제외이므로 수동 복사, 해시 기록)을 전달.

## 3. WU1 — Sol

### 3-1. OCR FAQ·본문·경로 연결
- `pdfEditor.convert`에 `pathFaqs`를 추가: `/tools/pdf-editor/convert`, `/tools/pdf-editor/ocr` 각각의 선택 목록. OCR 경로의 선택에는 필수 질문("PDF 전체를 검색 가능한 파일로 만들 수 있나요?" / "Can I make the whole PDF searchable?")과 OCR 관련 FAQ가 포함돼야 함. 필요한 FAQ 항목은 standard에서 convert로 **이동**(복제 유지 금지). standard의 `pathFaqs["/tools/pdf-editor/ocr"]`, `pathBlocks["/tools/pdf-editor/ocr"]`처럼 이제 읽히지 않는 항목은 convert로 이관 후 standard에서 제거.
- convert 가이드의 `/tools/pdf-editor/convert` 선택 목록도 정하고 KO/EN 동일 ID 집합 확인.
- 정책 명문화(guideData.ts 주석 또는 docs/guide-production-notes.md): pathFaqs가 있는 경로는 선택 목록만, 없는 경로는 전체 FAQ. convert/ocr는 반드시 pathFaqs를 둔다.
- 확인: `npm run build` 후 `dist/{ko,en}/tools/pdf-editor/{ocr,convert}/index.html`에 (a) FAQPage JSON-LD 존재 (b) 필수 질문 존재 (c) 본문 FAQ 목록과 JSON-LD mainEntity 질문 집합 일치. 런타임: `vite preview --port 4181 --strictPort`로 두 경로×2언어 DOM에서 같은 FAQ 질문 집합 확인(Playwright, 크롬 `/usr/bin/google-chrome`).

### 3-2. validate-static-output.mjs 오류 분리
- 현재 한 문장 오류를 세 오류로 분리: `FAQPage JSON-LD 없음` / `필수 질문 누락: <질문>` / `본문 FAQ와 JSON-LD 불일치`. 기대 질문 표는 낮추지 않음.
- 기대 질문 표를 데이터 파일(예: `scripts/static-faq-expectations.json`)로 추출해 3-4의 validate-guides와 공유. 파일 이름·형식은 Sol 선택, 두 검사기가 같은 원본을 읽는 것이 요건.

### 3-3. 39건 항목별 처리
- 기준: 항목표 39행. 각 행에 기록: 가이드 키 / JSON 경로 / 원문 / 연결 경로 / 판단(수정·유지·제거) / 변경 문구 / 정적 출력 확인 / 런타임 확인. 기록 파일: `docs/jobs/todo/adsense-recheck-20260919/WU1-ITEMS.md`(worktree 사본에 작성, 통합 시 원본 위치로 취합).
- 제작 지시 문단: 실제 도구 동작을 확인한 뒤 **완성된 사용자 설명**으로 바꾸거나, 사용자 가치가 없으면 제거하고 원문을 `docs/guide-production-notes.md`(신규, 저장소 문서, 미배포)에 키·경로와 함께 이동. 예제 파일·다운로드·"검증했습니다" 문구를 새로 만들지 않음. 유효한 지원 제한·안전 안내 문장은 보존.
- 고아 제목 20건: 마지막 문단의 다음 절 제목을 제거. 블록 스키마(title/paragraphs/items 문자열)로 링크를 표현할 수 없으므로 링크 구성은 하지 않음. 문단이 제목만으로 구성돼 있으면 문단 삭제.
- 미연결 `video` 키 2건: 코드·검사기·테스트에서 `"video"` 키 참조가 없음을 grep으로 확인한 뒤 KO/EN에서 키 삭제. 참조가 있으면 삭제 대신 수정하고 근거 기록.
- xls-preserve 2건: 문구 수정은 동일하게 수행. 런타임 확인은 `/ko/tools/excel-merger/xls-preserve/` 격리 문서를 preview에서 열어 가이드 블록 렌더 여부를 기록(렌더되지 않으면 "런타임 미노출 확인"으로 기록, 결함으로 만들지 않음).
- 검출 휴리스틱에 잡히지 않은 같은 유형이 같은 블록 안에 있으면 함께 처리하고 항목표에 추가 행으로 기록. 무관한 문구 재작성 금지.
- 확인: 빌드 후 dist 전 HTML에서 39건 원문 부재 grep + 변경 문구 존재 grep(자동 스크립트, 결과 파일 보존). 런타임: 영향 경로 전체(항목표의 연결 경로 집합 × KO/EN)를 preview에서 열어 원문 부재·변경 문구 존재를 DOM으로 확인하는 Playwright 스크립트 1개(`/tmp/wl-adsense/wu1/runtime-check.json` 저장, 저장소에 추가하지 않음).

### 3-4. validate-guides.mjs 강화
요건(방법은 Sol 선택):
1. 경로별 필수 FAQ: 3-2의 기대 질문 데이터로 `getFaqsForPath(lang, slug, path)` 결과에 필수 질문이 포함되는지 검사. 빌드 전 단계에서 실패해야 함.
2. 라우트 정합: pathFaqs·pathBlocks 키가 실제 라우트 집합(`src/app/seo.ts`의 toolSlugByPath 또는 `tests/tool-registry-routes.mjs`)에 있어야 함. 오타 시 실패.
3. 모든 도구 slug × 라우트가 title·description·blocks(≥1) 있는 가이드로 해석돼야 함(키 존재만 검사하지 않음).
4. 제작 메모 회귀: KO/EN 패턴 목록(예: KO 문단 종결 "보여준다."/"설명한다."/"구분한다."/"쓰지 않는다."/"약속하지 않는다.", "게시 전", "예시를 만들 때", "설명하되"; EN "^Example: (Show|Explain|Describe)", "Do not use real", "before publishing", "Show where", "composite value", "Connect the display", "fixture"). 정상 사용자 주의("~하지 마세요", "~않습니다", "~확인하세요")가 걸리지 않도록 패턴을 문단 종결형·지시 동사 기준으로 한정하고, 예외 허용목록 메커니즘을 둔다.
5. 고아 문단 회귀: 블록·pathBlocks의 마지막 문단이 종결부호 없이 40자 미만이거나, 같은 언어 가이드의 어떤 block title과 정확히 일치하면 실패.
6. 자체 검증: 검증 로직을 데이터 인자로 호출 가능한 함수로 분리하고 `tests/unit/guides-validation.test.ts`(node --test, 기존 glob에 포함되므로 package.json 변경 불필요)에서 (a) 현재 데이터 통과 (b) 메모 주입 실패 (c) 고아 제목 주입 실패 (d) 필수 FAQ 제거 실패 (e) 경로 오타 실패 (f) 정상 주의 문장 통과를 확인.
- `npm run test:guides` 종료 코드와 전체 출력 보존.

### 3-5. WU1 소유·금지
- 소유: `src/locales/ko/guides.json`, `src/locales/en/guides.json`, `src/i18n/guideData.ts`, `src/components/ToolGuideWrapper.tsx`(FAQ 선택 정책 변경이 꼭 필요할 때만), `scripts/validate-guides.mjs`, `scripts/validate-static-output.mjs`, 신규 기대 질문 데이터 파일, `tests/unit/guides-validation.test.ts`, `docs/guide-production-notes.md`, WU1 기록 파일.
- 금지: package.json, AdSenseLoader/AppShell/adEligibility, seo.ts의 canonical·redirect, 디자인·컴포넌트 재설계, evidence·scratch 삭제(WU3 전).
- 커밋: 작업 브랜치에 의미 단위로. 마지막 커밋 SHA를 고정 제출. push 금지(통합 담당이 필요 시 수행).

## 4. WU2 — Muse

### 4-1. 테스트 설계
- 파일: `tests/ad-eligibility-smoke.mjs`(+ 필요 시 `tests/helpers/ad-stub.mjs`). package.json에 `"test:ads": "node tests/ad-eligibility-smoke.mjs"` 추가하고 파일 끝 개행 복원.
- 빌드: `npm run build`를 **VITE_LOCAL_QA 미설정**으로 수행(LOCAL_QA는 광고를 강제 비활성화하므로 검사 대상이 아님). 보고에 빌드 플래그 명시.
- 서버: `tests/recovery-server.mjs`의 `startRecoveryServer({root:"dist", port: RECOVERY_TEST_PORT})` 재사용. `server.state.fault/asset/delay`로 특정 도구 chunk의 실패·지연 주입.
- 광고 네트워크 대체: Playwright `page.route("**/pagead2.googlesyndication.com/**")`로 스텁 JS 응답(`window.__wlAdStub.loads++`, `adsbygoogle.push` no-op). `googlesyndication`·`doubleclick`·`googleadservices` 도메인으로 나가는 실제 요청이 0건임을 모든 시나리오에서 단언. 실제 광고 요청·클릭 없음.
- 동의: `context.addInitScript`로 `localStorage.worklazy_privacy_consent`를 `granted`/`denied`/미설정으로 준비.
- 관측: `script[data-worklazy-adsense]` 개수, 스텁 로드 횟수, 전체 문서 내비게이션 횟수(`page.on("framenavigated")` 최상위), `[data-route-error]`·`.tool-route-loading` 존재, 현재 URL.

### 4-2. 시나리오 (모두 KO 기준, S2·S6·S8은 EN 1회 추가)
| # | 상태 | 기대 |
|---|---|---|
| S1 | 동의 없음/거부 + 허용 경로 정상(`/tools/text-merger`) | script 0, 스텁 0 |
| S2 | 동의 있음 + 허용 경로 정상 | script 1, 스텁 1, 실제 외부 요청 0 |
| S3 | 동의 있음 + 허용 경로 chunk 지연(초기 lazy 로딩) | fallback 표시 중 script 0; 로드 완료 후 script 1 |
| S4 | 동의 있음 + 허용 경로 직접 진입인데 chunk 실패(오류 화면 직접 진입) | `[data-route-error]` 표시, script 0, 스텁 0 |
| S5 | 동의 있음 + 허용 경로 정상 로드(script 1) → **같은 URL 유지한 채** 오류 화면 전환 | 새 스텁 로드 0(총 1 유지). 기존 script 태그 잔류 여부를 **기록**(현 정책상 중단 수단 없음 → 잔여 위험 보고 항목). 전환 방법은 recovery-server 결함 주입으로 도구 내부 지연 import를 실패시키는 방식을 우선 시도, 불가하면 방법·이유 기록 후 "재현 불가"로 남김 |
| S6 | 동의 있음 + 허용 경로(script 1) → SPA 링크로 제외 경로(`/tools/pdf-editor/merge`, `/tools/hwp-editor`, `/tools/document-compare`) 이동 | 최상위 내비게이션 정확히 1회, 5초 대기 후 추가 새로고침 0, 새 문서 script 0, 스텁 추가 0 |
| S7 | S6 후 브라우저 뒤로가기 → 허용 경로 복귀 | 정책대로 script 1(재삽입은 정상), script 태그 ≤1(중복 초기화 없음), 내비게이션 횟수 기록 |
| S8 | 동의 있음 + 제외·격리 경로 직접 진입: `/tools/pdf-editor`, `/tools/pdf-editor/ocr`, `/tools/hwp-editor`, `/tools/document-compare`, `/tools/document-compare/results/1`(세션 없음), `/tools/pdf-compare`, `/tools/office-editor/app`, `/tools/excel-merger/xls-preserve`, `/tools/document-redactor` | script 0, 스텁 0 |
| S9 | 동의 있음 + 허용 경로에서 파일 선택(합성 파일 1개, 예: text-merger에 .txt) → S6 이동 | 새로고침으로 유실되는 상태·경고 유무를 **기록**. 이동 취소 흐름이 있으면 기록. 판정은 Claude(설계상 예상 동작 vs 결함 후보) |
| S10 | 모바일 뷰포트에서 광고 overlay와 저장·다운로드 버튼 겹침 | 스텁으로는 실제 overlay가 없어 **검증 불가** → 결과 파일에 "실제 광고 필요·미확인"으로 기록 |

- 결과: `/tmp/wl-adsense/wu2/ad-smoke-results.json`(시나리오별 관측값·요청 로그·스크린샷 경로). 저장소에는 테스트 코드만 추가.
- 테스트 자체 검증: 스텁 라우트를 끄고 실제 도메인 차단(`route.abort`)만 한 상태에서 S2가 "스텁 1"에 실패하는지 1회 확인(검사기가 실제로 판별하는지). 결과 기록.

### 4-3. 결함 수정 범위
- 테스트가 드러낸 결함에 한해 `src/components/AdSenseLoader.tsx`, `src/app/adEligibility.ts`, `src/components/AppShell.tsx`의 광고 관련 줄(현 45–51, 74–79, 121)만 최소 수정. 광고 제외 경로 축소, allowlist 도입, noindex, 본문 변경 금지. 수정 시 어떤 시나리오가 실패했고 무엇이 바뀌었는지 기록.
- S5의 "기존 광고 잔류"는 이번 수정 대상이 아님. 사실만 기록.

### 4-4. WU2 소유·금지·세션
- 소유: `tests/ad-eligibility-smoke.mjs`, `tests/helpers/ad-stub.mjs`(선택), `package.json`(scripts 추가·개행), 4-3의 세 파일.
- 금지: guides.json, 검증기, seo.ts, 문서 본문, 광고 정책 확대.
- Muse 세션: 신규(이 작업의 기존 세션 없음). 실제 세션 ID·모델 ID·로그 경로(`/tmp/wl-adsense/wu2/muse-*.log`)를 WU2 기록에 남김. 후속은 그 세션 ID로 `-s`.
- 커밋: 작업 브랜치에. 마지막 SHA 고정 제출. push 금지.

## 5. WU3 — Sol (WU1 종료 후)

- 대상: `git ls-files evidence scratch 'patch_*.py' test-drag.html integration_status.md` 전체(137개).
- 분류표 `docs/jobs/todo/adsense-recheck-20260919/WU3-CLASSIFICATION.md`: 경로 / 종류 / 민감정보 확인 방법·결과 / 재생성 가능 여부 / 테스트·스크립트 사용처 / 공개 필요 / 처리 / 근거.
- 민감정보 확인: 텍스트는 이메일·전화·토큰·비밀번호·주민번호·계좌 패턴 grep, PDF는 `pdftotext` 전 페이지, xlsx는 sharedStrings, zip은 목록+내부 파일 동일 기준. **발견 시** 해당 파일 처리 중단·Claude에 즉시 보고, 이력 재작성·자격증명 폐기는 하지 않음(별도 승인).
- 기본 처리안(분류 결과로 조정):
  - `evidence/vite-cache/**`, `evidence/*.xlsx`, `evidence/multi.zip`, `evidence/smoke-results.json`: 재생성 가능한 캐시·테스트 산출물 → `git rm --cached`, `.gitignore`에 `evidence/` 추가.
  - `evidence/corpus/fixtures/**`: 합성 fixture. 생성기가 있으므로 추적 해제 후 `.gitignore` 포함. 확인: `evidence/corpus`를 지운 상태에서 `node tests/helpers/pdf-compare-fixtures.mjs evidence/corpus` 실행 → manifest·PDF 재생성 확인(결과 기록). 생성기가 실패하면 fixture는 보존하고 이유 기록.
  - `scratch/**`, 루트 `patch_*.py`, `test-drag.html`, `integration_status.md`: 내부 프롬프트·계획 원문·일회성 스크립트·내부 현황표 → `git rm --cached` 후 파일을 `docs/jobs/todo/adsense-recheck-20260919/archive/`(git 제외)로 이동. 원본 `patch_notes.py`의 로컬 수정본은 `archive/patch_notes.local.py`로 별도 보존. `.gitignore`에 `scratch/`, `/patch_*.py`, `/test-drag.html` 추가.
  - 이동·해제 전 `grep -rn` 으로 src·scripts·tests·package.json·.github 참조 없음 확인. 참조가 있으면 경로 갱신 또는 보존.
- 금지: 정식 규칙·문서(PROJECT_RULES.md, AGENTS.md, GEMINI.md, CLAUDE.md, docs/*.md) 삭제·이동, `git filter-repo`·`rebase` 등 이력 재작성, `git clean`.
- 확인: 처리 후 `npm run test:pdf-compare-smoke`(존재하는 스크립트명 확인 후) 또는 fixture 생성기 실행이 성공. `git status`에 의도 밖 삭제 없음.

## 6. WU4 — 통합·검수·판정·배포 확인

1. Sol: `integration/adsense-recheck-20260919`를 WU1 브랜치 최종 SHA에서 생성, WU2 브랜치를 merge(한 방법만). 충돌 시 계약 유지, 설계 판단 필요하면 Claude에 회부.
2. 통합 후보에서 유효 결과 취합: `npm run build`(prebuild의 test:guides 포함) → `npm run test:unit` → `npm run test:static` → `npm run test:ads` → WU1 런타임 확인 스크립트 재실행(통합 dist 기준). 각 명령·종료 코드·로그 경로 기록. 개별 브랜치 통과를 통합 통과로 간주하지 않음.
3. Astra 검수(`gpt-6-astra`, 추적 파일 수정·커밋·push 금지, 산출물 `/tmp/wl-adsense/review/`): 지시서 대비 누락·왜곡·미실행 검사, 39건 항목표 대비 실제 diff, OCR 정적·런타임, 광고 스모크의 판별력(4-2 자체 검증 포함), WU3 분류표의 근거. 필요한 표본만 독립 재현.
4. Claude 감사·판정: 원본 로그·dist·diff 대조. 차단/비차단/권고/미확인 분류.
5. 보고 "구현·검증 완료, 운영 미반영" → 사용자 승인 후 Sol이 main 반영(push). GitHub Pages 실행 성공 확인.
6. 운영 확인(Claude 또는 Astra, 읽기): `/ko,/en/tools/pdf-editor/ocr/` FAQPage+필수 질문, 39건 원문 부재 표본(전 경로 자동 grep), 운영 번들에 경로 제외 로직 존재, 제외 경로 정적 HTML에 광고 스크립트 부재. 결과를 항목표의 "운영 확인" 열에 기록.

## 7. 검사 배정

| 구분 | 검사 |
|---|---|
| WU1 이번 | test:guides, 단위 테스트(guides-validation), build, test:static, OCR·39건 정적 grep, 런타임 DOM 확인(4181) |
| WU2 이번 | build(LOCAL_QA 미설정), test:ads 전 시나리오, 자체 판별력 확인 |
| WU3 이번 | fixture 재생성, 참조 grep, git status |
| 최종 통합 | build / test:unit / test:static / test:ads / WU1 런타임 확인 재실행. 그 외 스모크는 결과 재사용 |
| 적용 아님 | 전 도구 회귀, 시각 회귀 전체, 성능 벤치, 접근성 전수 (이번 변경은 가이드 데이터·검증기·광고 로더 조건·테스트에 한정. 전역 스타일·라우팅·핵심 의존성 변경 없음) |

## 8. 완료 기준 (항목별 5단계 추적)

각 항목(OCR, 39건 각 행, 검증기 6요건, 광고 시나리오 S1–S10, 부산물 137파일 분류)에 대해:
소스 수정 완료 → 관련 테스트 통과 → 통합 후보 build/test:static 통과 → 승인된 배포 성공 → 운영본 확인.
HEAD 반영과 운영 반영을 구분. 빌드 도구는 "CI 적용·실행 결과"로 표기. 배포 전에는 "구현·검증 완료, 운영 미반영".

## 9. 최종 보고 구조

구현 완료 항목 / 테스트 확인 항목 / 운영 확인 항목 / 사용자 계정에서 확인할 항목(AdSense Auto ads 페이지 제외 목록: 위 4경로군 + 격리 경로, 사이트 수준 자동 광고 설정, 실제 노출 표본, 모바일 overlay) / 미확인·잔여 위험(S5 기존 광고 잔류, S10, 실제 광고 요청·노출, 심사 결과 보장 불가).

## 10. 종료 조건·보고

- 각 구현자는 최종 SHA, 변경 파일 목록, 실행 명령·종료 코드·로그 경로, 미완료·재현 불가 항목을 WU 기록 파일에 남기고 종료. 지시서 밖 파일 추가 금지(새 파일은 전체 경로로 지정된 것만).
- 실패·권한 오류는 원인과 함께 중단 보고. 샌드박스·승인 설정 해제로 우회하지 않음.
