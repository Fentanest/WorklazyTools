# adsense-followup-20260920 — 바로 고칠 5건(+백로그 테스트 2건) 계획

| 항목 | 값 |
|---|---|
| 작업 ID | adsense-followup-20260920 |
| 버전 | v0.2 (정본) — Astra 1차 반박 `task-mu93xnsc-czhu9a` 차단 3·비차단·권고 반영 |
| 요청 모드 | plan-and-implement (`!계획!`, 사용자 2026-09-20 "바로 고칠 5건을 !계획!으로 진행") |
| 계획 상태 | **운영 반영 완료**(2026-09-20, main 10186df, Pages 35483710375) |
| 구현 허가 | 있음 — 사용자 `!계획!`(2026-09-20). push·배포는 승인 절차 후 |
| 기준 소스 | 고정 기준 **290a11f**(= origin/main, 2026-09-20 배포 완료·Pages 35480115773 성공). main 반영 상태와 별개로 이 SHA에서 분기 |
| 총괄·감사 | Claude · 기술 검토·검수 Astra(gpt-6-astra) · 구현 Sol(gpt-5.6-sol)/Muse(opencode/muse-spark-1.3-contributor-free) · 통합·배포 Sol |
| 후속 계획 | 남은 3건(컴포넌트 규격 테스트 3, 옛 스타일 토큰 테스트 1, 오피스 안내를 편집기 화면에 표시)은 별도 `!계획!`(adsense-followup2) — 사용자 결정: 오피스 안내는 **편집기 화면 안**에 넣는다 |

## 0. 확정된 사실
- 기준 unit 실패 10건은 29fe72c·290a11f에서 이름 동일. 이 계획은 그중 6건(document-generator, pdf-finish-engine, pdf-finish-modules, seo 2, feature-locales 1)을 해소하고 4건(p1b-components 3, ui-legacy-isolation 1)은 후속 계획으로 남긴다.
- `.bottom-tabs`는 `src/styles/global.css`의 `@media (max-width: 820px)` 블록 안에만 규칙이 있음(현재 :904 부근). 데스크톱 1365×900 실측: 문서 끝에 display block·static으로 존재, 스크롤 끝에서 뷰포트 안에 보임(Claude, 통합 dist preview 4184).
- `src/features/pdf-compare/PdfComparePage.tsx`에 ToolGuideWrapper 없음. 가이드 데이터 `pdfCompare`(KO/EN)는 존재, `getGuideKeyForPath("pdf-compare", …)`→`pdfCompare`. 다른 페이지 패턴: `ExcelComparePage.tsx:342 <ToolGuideWrapper slug="excelCompare" />`.
- 확장자 없는 import: `src/features/document-generator/storage.ts:1 "../../lib/utils"`, `src/features/pdf-editor/finish/resultStorage.ts:1 "../../../lib/utils"`. Node `--experimental-strip-types` 테스트 러너가 해석 실패. 같은 저장소의 다른 소스는 `.ts` 확장자 import를 이미 사용(예 `src/i18n/guideData.ts`의 `./languages.ts`).
- seo 실패: (a) 영상 도구 title 기대 `'비디오 스튜디오 | 영상 자르기·이어붙이기·음원 추출'` vs 실제 `'온라인 동영상 편집 - 자르기·합치기·변환 | Worklazy Tools'`(16cda1b 승인 SEO 카피) (b) 문서 도구 정적 FAQ 개수 기대 3 vs 실제 5.
- feature-locales 실패: `features.json`의 `excelCompare.guide.blocks` 읽기 → undefined(가이드가 guides.json으로 이관됨).
- 백로그(2026-09-20): 스모크 메타데이터 `reused c40c2eb build` 하드코딩, 판별 모드 예외 타입 미검사·assertNoRealNetwork 비도달 분기. 테스트 파일만의 수정이라 이 계획의 WU-B에 포함(사용자 보고 시 명시).

## 1. 조건
- 승인된 테마·컴포넌트를 유지한다. 하단 탭 숨김은 모바일 전용 의도의 복원이며 재설계가 아니다. 광고 정책·광고 범위·noindex·canonical·오피스 자동 진입은 이 계획에서 바꾸지 않는다.
- 테스트 기대값은 "현재 승인된 제품 값"으로만 갱신하고, 제품이 어긋난 것으로 판단되는 항목은 고치지 않고 후속 계획으로 보고한다.
- commit은 작업 브랜치, push·main·배포는 통합 담당이 사용자 승인 절차 후.

## 2. 작업 단위·배정 (병렬 근거: 소유 파일·런타임 전제 무겹침)

| WU | 내용 | 구현자 | 브랜치 / worktree | 자원 |
|---|---|---|---|---|
| WU-A | 하단 탭 데스크톱 숨김, PDF 비교 가이드 연결, 확장자 없는 import 2건 | Sol | `work/followup-a-20260920` / `/home/better0101/projects/wt-followup-a` | preview 4191, 산출물 `/tmp/wl-followup/a/` |
| WU-B | seo·feature-locales 테스트 갱신, 스모크 메타데이터·판별 단언 보강 | Muse (세션 `ses_f45cd39d4ffeMjz2CpUX4DjHJJ`에서 `-s … --fork`: 같은 광고 스모크 파일 맥락 재사용, 별도 작업이므로 분기. 부모 실행 종료 확인 후) | `work/followup-b-20260920` / `/home/better0101/projects/wt-followup-b` | RECOVERY_TEST_PORT 4192, 산출물 worktree 내부 `tests/visual-artifacts/adsense-recheck/`(스모크 상수 경로) |
| 통합 | WU-A ff → WU-B merge → 최종 검사 → Astra 검수 → Claude 판정 → 사용자 승인 → push | Sol | `integration/adsense-followup-20260920` / `/home/better0101/projects/wt-followup-integration` | preview 4193 |

준비(Claude): worktree 생성·지시서 사본·`.codex/config.toml`(main .git, `.git/worktrees/<name>`, worktree, ~/.npm, /tmp/wl-followup) 사본·`~/.codex/config.toml` 신뢰 등록·`npm ci` 선실행.

## 3. WU-A — Sol
### 3-1 하단 탭
- `src/styles/global.css`: `@media (max-width: 820px)`(현재 :882) **보다 앞의 전역 영역**에 `.bottom-tabs { display: none; }`를 추가한다. 모바일 블록의 기존 `display: grid`(:911)와 3열 규칙은 유지한다(이미 명시돼 있어 추가 변경 불필요). 다른 선택자·색·간격은 바꾸지 않는다. `ExcelComparePage.tsx:535`의 경계 계산은 display:none 요소에서 0 높이를 반환하는지 확인해 기록.
- 확인: preview(4191)에서 `/ko/tools/text-merger/`를 1365×900으로 열어 스크롤 끝에서 `.bottom-tabs`의 computed display가 none, 412×839(모바일)에서 하단 탭이 보이고 3개 링크가 가로 배치임을 DOM·캡처로 기록(`/tmp/wl-followup/a/shots/`).
### 3-2 PDF 비교 가이드
- `src/features/pdf-compare/PdfComparePage.tsx`(단일 `UtilityPage`, :77)에 `ToolGuideWrapper` import를 추가하고 `<ToolGuideWrapper slug="pdfCompare" />`를 **마지막 `UtilityNotice` 다음, `UtilityPage` 내부 마지막 자식**으로 둔다(결과 조건문 :88 밖). 가이드 데이터는 수정하지 않는다.
- 확인: preview에서 `/ko`·`/en` `/tools/pdf-compare/`의 `section[data-ui-component="tool-guide"]` 존재와 가이드 내부 FAQ `details` 3개(pathFaqs 선택 faq_0·faq_1·faq_2) DOM 확인, 데스크톱 캡처 2장. 로컬 preview에서는 tests/helpers/ad-stub.mjs의 차단 라우팅을 재사용해 광고·분석 외부 요청을 막는다.
### 3-3 확장자 없는 import
- 두 파일의 import 경로에 `.ts`를 붙인다. 다른 import는 건드리지 않는다.
- 근거: tsconfig.app.json `moduleResolution: "Bundler"`·`allowImportingTsExtensions: true`, 기존 `.ts` import 사례 `src/app/seo.ts:20`, `src/features/pdf-editor/finish/engine.ts:5`. 확인: 세 테스트 파일 통과(파일 로딩 실패가 풀리면 내부 테스트가 실행되므로 총 실행 수 변화를 기록), `npm run build` 통과(설정상 허용 확인과 실제 tsc·Vite 통과를 구분해 기록).
### 3-4 WU-A 검사·소유·금지
- 검사: 위 3개 단위 테스트, `npm run build`, `npm run test:static`, 시각 확인. 전체 unit은 통합에서.
- 소유: `src/styles/global.css`(bottom-tabs 규칙만), `src/features/pdf-compare/PdfComparePage.tsx`, `src/features/document-generator/storage.ts`, `src/features/pdf-editor/finish/resultStorage.ts`, 기록 `docs/jobs/todo/adsense-followup-20260920/WU-A-REPORT.md`.
- 금지: 다른 스타일·컴포넌트·가이드 데이터·테스트 파일 수정, package.json, push.

## 4. WU-B — Muse
### 4-1 seo 테스트
- `tests/unit/seo.test.ts:53` title 단언: 영상에 한정하지 않고 **기대표 전체를 현재 승인 SEO 카피와 대조**해 불일치 문자열(Astra 확인: KO 14·EN 10 = 24개)을 갱신한다. 정확한 문자열 단언을 유지하고 제품 함수에서 기대값을 동적으로 가져오지 않는다. `:91` 이후 FAQ 개수 단언: document-compare 3→**5**, PDF 편집기 루트 2→**4**로 갱신(현재 개수 3·3·5·3·5). 다른 개수·질문/답변 비어 있지 않음·핵심 내용 단언은 유지하고, KO/EN 동수 검사는 **추가만** 한다(개수 보장 약화 금지).
### 4-2 feature-locales 테스트
- `tests/unit/feature-locales.test.ts:49–50`: 원 검사는 구조가 아니라 **내용** 검사(독립 목록의 같은 줄을 자동 연결하지 않는다는 안내, 중복 키 FAQ). 기존 features 단언은 유지하고 가이드 내용 단언만 `src/locales/{ko,en}/guides.json`의 `excelCompare`로 옮긴다: 실제 `/tools/excel-compare` 선택 FAQ(현재 `faq_5` 등)에 중복 키·독립 목록·자동 연결하지 않음 안내가 두 언어 모두 포함되는지 검사한다. `faq`는 배열이 아닌 객체임에 주의. 구조 검사(title·description·blocks≥1)는 보조로 추가.
### 4-3 스모크 백로그 2건(테스트 파일만)
- `tests/ad-eligibility-smoke.mjs`: (a) :737의 `reused c40c2eb build` 하드코딩을 제거하고 `runHead`(실행 시 `git rev-parse --short HEAD`)·`distMtime`(dist/index.html mtime)으로 **정확히 이름 붙여** 기록한다. 이것으로 빌드 커밋을 증명했다고 쓰지 않는다. (b) 판별 모드(:688–696): 기대 실패는 `AssertionError`·`code === "ERR_ASSERTION"`·정확한 스텁 기대 메시지가 모두 일치할 때만 인정. 예상 실패 여부와 별도로 네트워크 단언을 실행하고 그 실패는 판별 성공으로 흡수하지 않는다. 성공·실패 모두 4계수와 JSON 기록. (c) S5 not-reproduced 분기(:592·598, 계수는 이미 기록)에 네트워크 단언 추가. (d) `runCase`(:162) 실패 반환에도 계수 전달. (e) 산출물 경로 상수(:20 `adsense-recheck`)를 이 계획의 `tests/visual-artifacts/followup-b/`로 바꾸지 말고 **계획을 실제 경로에 맞춘다**: WU-B 산출물은 `tests/visual-artifacts/adsense-recheck/`(worktree 내부, git 제외).
- 확인: `npm run build`(VITE_LOCAL_QA 미설정) 후 `RECOVERY_TEST_PORT=4192 npm run test:ads` → 종료 후 `RECOVERY_TEST_PORT=4192 npm run test:ads -- --discriminate`를 **순차** 실행(상태 버킷 fail 0, allowedExternal 0, 메타데이터 runHead 기록).
### 4-4 WU-B 검사·소유·금지
- 검사: `node --experimental-strip-types --test tests/unit/seo.test.ts tests/unit/feature-locales.test.ts` 통과, test:ads·discriminate. 전체 unit은 통합에서.
- 소유: `tests/unit/seo.test.ts`, `tests/unit/feature-locales.test.ts`, `tests/ad-eligibility-smoke.mjs`, 기록 `docs/jobs/todo/adsense-followup-20260920/WU-B-REPORT.md`.
- 금지: 제품 코드·가이드 데이터·헬퍼(ad-stub.mjs)·package.json 수정, 기대값을 낮추는 방식의 통과, push.

## 5. 통합 — Sol
1. `integration/adsense-followup-20260920`를 WU-A 최종 SHA에서 시작, WU-B merge(한 방법).
2. 최종 검사(`&&`로 연결하지 말고 각각 실행·종료 코드 기록; unit은 예상 이월로 비정상 종료함): `npm run build` → `npm run test:unit`(전체 실행 완료 확인 후 실패 이름·단언 근거 대조. **예상 잔여는 p1b-components 3건 + ui-legacy-isolation 1건**, 추가 실패는 조사. import 실패 3건 해소로 총 실행 건수가 늘어남을 기록. "실패/4건 이월"로 기록하고 전체 통과로 표기하지 않음) → `npm run test:static` → `RECOVERY_TEST_PORT=4193 npm run test:ads`(WU-A CSS 변경이 스모크 화면에 반영되므로 재실행 필수) → 하단 탭·PDF 비교 시각 확인 재캡처(통합 dist).
3. 공통 기록: CHANGELOG(사용자 의미 변경: PC 하단 메뉴 노출 수정, PDF 비교 안내 표시), review-notes(unit 10→4 귀속 갱신), backlog(해소 항목 정리·남은 4건 후속 계획 링크). 서명 보존.
4. Astra 검수 → Claude 판정 → 사용자 승인 → push → Pages 확인 → 운영 확인(`/ko/tools/pdf-compare/` 런타임은 배포본에서 브라우저 확인 필요 → Gemini 또는 Claude 열람).

## 6. 검사 배정
| 구분 | 검사 |
|---|---|
| WU-A 이번 | 3개 단위 테스트, build, test:static, 시각 2조합(데스크톱·모바일) + PDF 비교 2언어 |
| WU-B 이번 | 2개 단위 테스트, build, test:ads, discriminate |
| 통합 | build, test:unit(실패 4건 이름 일치), test:static, test:ads, 시각 재확인 |
| 적용 아님 | 전 도구 회귀, 시각 회귀 전체, 성능 |

## 7. 완료 기준
각 항목: 소스 수정 → 관련 테스트 통과 → 필수 통합 검사 완료(unit 기존 4건 이월·신규 실패 없음) → 승인된 배포 성공 → 운영 확인. unit 실패는 10 → 4로 줄고 남은 4건은 adsense-followup2 계획으로 이월(상태 "이월"로 표기, 통과 합산 금지).

## 8. 변경 이력
- v0.1 (2026-09-20): 초안.
- v0.2 (2026-09-20, 정본): Astra 1차 반박 반영 — 하단 탭은 미디어 쿼리 앞 전역 규칙 1줄(모바일 display:grid 기존 유지), PDF 비교 삽입 위치 명시, seo 기대표 전체 24문자열 갱신·FAQ 개수 5/4 갱신(동수 검사는 추가만), feature-locales 내용 검사 보존·guides.json 이관, 스모크 메타데이터 runHead/distMtime·판별 AssertionError 판정·네트워크 단언 전 경로, 산출물 경로를 실제 상수에 맞춤, 통합 unit 검사 표현 정정, 판별 명령 순차 실행. 기준 SHA 고정 표기.
- v0.2.1 (2026-09-20, 진행 기록): 정본화 후 worktree 생성(wt-followup-a·b @290a11f), `~/.codex/config.toml`에 wt-followup-{a,b,integration} 신뢰 등록, `.codex/config.toml` 사본(gitdir 명시), npm ci 완료. 발행: Sol WU-A task-mu94bcgh-5bpg6o(cwd wt-followup-a), Muse WU-B `opencode run -s ses_f45cd39d4ffeMjz2CpUX4DjHJJ --fork`(자식 세션 ID는 종료 후 기록, 로그 /tmp/wl-followup/b/muse-*.log). PLAN-3(adsense-followup2) Astra 반박 task-mu94cg2g-yj0y7h 병행. todo 문서 감사: Gemini 1차(12건은 회신, 16건 재실행 중) + Astra 대체 감사 task-mu94dyu7-i6owvc.
- v0.2.2 (2026-09-20, 진행 기록): Sol WU-A 완료 task-mu94bcgh-5bpg6o → 커밋 0c55667(하단 탭 데스크톱 숨김)·33d529e(PDF 비교 가이드)·cb23312(.ts import), 최종 SHA **cb23312**. 관련 unit 3파일 3→61 실행·61 통과, build·test:static 통과, 데스크톱 숨김·모바일 3열·PDF 비교 KO/EN 가이드+FAQ 3 DOM·캡처 4장. Playwright 캐시 EROFS는 XDG_CACHE_HOME을 /tmp/wl-followup/a로 지정해 해결(권한 해제 아님). Muse WU-B: `-s ses_f45cd39d4ffeMjz2CpUX4DjHJJ --fork`로 만든 자식 세션 ses_f43a40867ffeUkTR4XBDMv3p1u가 부모 프로젝트 디렉터리(wt-adsense-adtest)를 물려받아 wt-followup-b를 외부 디렉터리로 판정 → external_directory 권한 질문 상태로 15분 정지(헤드리스 응답 불가) → 프로세스 종료, 자식 세션 미사용, **fork 없이 신규 세션**으로 재발행(--dir wt-followup-b). 교훈: 다른 worktree에서 만든 세션의 fork는 새 worktree에 쓸 수 없다 → 런북 반영 필요. PLAN-3(adsense-followup2) v0.2 정본화(해시 667a44d29240211f), 착수는 PLAN-2 통합 후보 확정 후. todo 문서 감사: TODO-STATUS-AUDIT-20260920.md 확정, 완료 15건 archive 이동, PLAN-INDEX 09-20 갱신 절 추가.
- v0.2.3 (2026-09-20, 진행 기록): Muse WU-B 완료(신규 세션 **ses_f43942d77ffeIbw9tlKYICsTgG**, dir wt-followup-b) → 커밋 58e4629(seo 기대표 24개·FAQ 5/4)·7697853(feature-locales guides.json 이관)·d7fb5f6(스모크 runHead/distMtime·판별 3조건·S5/runCase 계수), 최종 SHA **d7fb5f6**, tests 3파일만 변경. unit 2파일 9/9, build, test:ads(4192) fail 0·allowedExternal 0·runHead 기록, discriminate OK. 통합 worktree wt-followup-integration(cb23312 기준) 준비 완료 → Sol 통합 발행.
- v0.2.4 (2026-09-20, 진행 기록): Sol 통합 task-mu95h875-8x7izm 완료 → merge c942a37, 기록 2fe293d. **최종 통합 후보 SHA 2fe293d**. 검사: build 통과, test:unit 605 중 601 통과·실패 4 = p1b-components 3 + ui-legacy-isolation 1(이름 일치, 이월), test:static 통과, test:ads(4193) fail 0·allowedExternal 0·runHead c942a37, discriminate OK, 브라우저 DOM 4프로필 통과. 변경 파일 10 = WU-A 4 src + WU-B 3 tests + 기록 3. Astra 검수 발행. PLAN-3 기준 SHA를 2fe293d로 확정하고 worktree wt-followup2-c/d 준비.
- v0.2.5 (2026-09-20, 검수·판정): Astra 통합 검수 task-mu95zswg-o0pyyi → /tmp/wl-followup/review/astra-integration.md, 판정 "보류". 차단 1: feature-locales.test.ts:70의 KO 정규식 `/자동으로 연결|not matched automatically/`이 부정 의미를 검사하지 못함(실제 문장 "자동으로 연결한 것은 아닙니다", 긍정문에도 통과). 권고 1: review-notes:11 "기대를 낮추지 않았다"는 위 단언 대비 과장 → 기록 보정. 그 외(통합 정합·WU-A diff·SEO 24문자열 전량 일치·스모크·unit 605/601/4·static·ads·CHANGELOG 서명) 적합. **Claude 판정**: 차단 해소 필요 → Muse(WU-B 세션 ses_f43942d77ffeIbw9tlKYICsTgG)에 부정형 단언 보강 발행, 이후 Sol 통합 2차(재병합·feature-locales·unit 재실행·기록 보정) → Astra 해당 부분 재검수 → push(사용자 사전 지시).
- v0.2.6 (2026-09-20, 진행 기록): Muse 후속 커밋 **cc95a94**(feature-locales KO 단언 → `/자동으로 연결한 것은 아닙니다|not matched automatically/`, 긍정문 mutation에서 신 단언 실패·구 단언 통과 재현). WU-B 제출 고정 커밋: 58e4629·7697853·d7fb5f6·cc95a94. Sol 통합 2차 발행(재병합·feature-locales·unit 재실행·review-notes 보정).
- v0.2.7 (2026-09-20, 진행 기록): Sol 통합 2차 task-mu96ck37-tt29ct → merge 40972dc(cc95a94), 기록 보정 10186df(review-notes "Claude 판정" 표기·사실 문구). **최종 통합 후보 SHA 10186df**. feature-locales 4/4, unit 605/601/4(p1b 3·ui-legacy 1 이월), build·static·ads·시각은 제품 무변경으로 1차 결과 재사용. Astra 재검수(변경 부분 한정) 발행.
- v0.2.8 (2026-09-20, 판정·배포): Astra 재검수 task-mu96nxmo-mvm9po → 3항목 모두 [해소], "main 반영 후보 적합". **Claude 최종 판정: 10186df 적합, 구현·검증 완료.** 사용자 지시(2026-09-20 "그 후 main으로 정리 푸시 배포 모두 진행")에 따라 Sol에게 main ff push·Pages 확인·운영 확인 발행. PLAN-3 통합은 새 main(10186df) 기준으로 진행.
- v0.2.9 (2026-09-20, 종결): Sol 배포 task-mu96stad-h8nawr → `git push origin HEAD:refs/heads/main` 290a11f..10186df ff, Pages 35483710375 성공(5m36s). 운영 확인(Sol + Claude 표본): index CSS `assets/index-lfJicohn.css`에 `.bottom-tabs{display:none}` 전역 규칙, `/ko/tools/pdf-compare/` 정적 가이드 본문, 헤드리스 1365×900에서 `.bottom-tabs` display none. **상태: 운영 반영 완료.** 남은 unit 실패 4건은 adsense-followup2로 이월.
