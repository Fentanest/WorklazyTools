# adsense-followup2-20260920 — 남은 3건(컴포넌트 규격 테스트 3, 옛 스타일 토큰 1, 오피스 안내를 편집기 화면에) 계획

| 항목 | 값 |
|---|---|
| 작업 ID | adsense-followup2-20260920 |
| 버전 | v0.2 (정본) — Astra 1차 반박 `task-mu94cg2g-yj0y7h` 차단 3·비차단 반영 |
| 요청 모드 | plan-and-implement (`!계획!`, 사용자 2026-09-20 "그 다음 남은 3건도 !계획!으로 진행", "오피스는 편집기 화면에 안내") |
| 계획 상태 | **운영 반영 완료**(2026-09-20, main 0523801, Pages 35485514033) |
| 구현 허가 | 있음(사용자 `!계획!` 2026-09-20). 착수는 PLAN-2 통합 후보 확정 뒤(§0 의존). push·배포는 사용자 2026-09-20 지시 "정리 푸시 배포 모두 진행"에 따라 검사·검수·판정 통과 후 통합 담당이 수행 |
| 기준 소스 | 고정 기준 **2fe293d**(adsense-followup-20260920 통합 후보, 2026-09-20). PLAN-2가 PdfComparePage에 ToolGuideWrapper를 추가해 소비자 수가 바뀌므로 그 뒤에 분기 |
| 담당 | 총괄·감사 Claude · 검토·검수 Astra(gpt-6-astra) · 구현 Sol(gpt-5.6-sol)/Muse(opencode/muse-spark-1.3-contributor-free) · 통합·배포 Sol |

## 0. 확정된 사실(2026-09-20, 통합 후보 290a11f 기준)
- `tests/unit/p1b-components.test.ts:12–17` ToolGuide 소비자 수 기대 21, 실제 23(src/features 내 `<ToolGuide` 포함 파일). PLAN-2 이후 24. `:24–52` OperationProgress 소비자 수 기대 16과 소스 정규식(`ui-accent-${accent}`, `accent: ToolAccent`, `coral: "bg-red-700"`), `:56–75` ToolCard 소스 정규식(`<Card … as={Link} … data-ui-component="tool-card" … ui-accent-${tool.accent}`, `toolIconAccentClasses[tool.accent]`, `data-accent={tool.accent}`, 7색 accent 레지스트리). 실패 메시지는 정규식 불일치·수치 불일치. 어느 쪽(제품/테스트)이 승인 상태인지 아직 미판정.
- `tests/unit/ui-legacy-isolation.test.ts:208` "reachable B3 document and Excel Cleaner surfaces emit no legacy or global.css-owned class token" 실패: 실제 누출 `src/features/excel-cleaner/ExcelCleanerPage.tsx:accent-primary`. `accent-` 접두어는 legacyDynamicPrefixes(:116).
- 오피스: `src/features/office-editor/OfficeEditorPage.tsx:29–34` 랜딩은 `?guide=1`이 아니면 `/tools/office-editor/app/`으로 즉시 이동(랜딩에 ToolGuideWrapper :81 존재). `OfficeEditorAppPage.tsx`는 격리 문서(COI·SW)이며 state idle/ready/preparing/editing/saving/error, `focusMode = editing||saving`(:337)에서 상단바 숨김. 현재 앱 페이지에 가이드 없음. 가이드 데이터 `officeEditor`(KO/EN) 존재.
- 사용자 결정: 오피스 안내는 **편집기 화면 안**에 표시. 랜딩 자동 진입은 바꾸지 않음.
- Astra 확인(2026-09-20): p1b 세 테스트 52단언 중 실패 5 — ToolGuide 소비자 21→23(추가 `DocumentRedactorFallback.tsx`, `DocumentRedactorPage.tsx`, 유입 eea9b1e), `coral: "bg-red-700"`→현재 `bg-primary`(92925e8, 승인 테마의 단일 primary), ToolCard 루트 정규식(`group` 추가), `toolIconAccentClasses`→`getToolIconTone`, `data-accent`→`data-icon-tone`(eea9b1e). OperationProgress 소비자 16은 일치. 그 외 접근성·진행률·링크·태그 계약은 유지. **별도 회부**: ToolCard 제목이 정본(ui-theme-redesign-20260907:159)의 `h3`가 아니라 `h2`(제품·테스트 모두, c5b64f6에서 회귀) — 기존 계약 이탈로 사용자 결정 대상, WU-C는 건드리지 않음.
- `accent-primary`는 global.css 정의가 아니라 **Tailwind 유효 utility**(`accent-color: var(--primary)`, tailwind.css :38·:64)로 엑셀 정리 시트 선택 checkbox(ExcelCleanerPage.tsx:231)의 선택 색을 지정한다. ui-legacy 테스트는 `accent-` 접두어를 모두 금지하므로 이름 충돌이다. 다른 B3 파일에 가려진 실패 없음.
- OfficeEditorAppPage 상태는 8종: idle / downloading / preparing / ready / opening / editing / saving / error(:18). `focusMode = editing||saving`(:337). 저장 성공·실패 모두 `editing` 유지. canvas shell 닫는 태그 :585, drag overlay :586. officeEditor 가이드의 앱 전용 `pathBlocks` 키가 `/tools/office-editor/app/`(끝 슬래시)라 Wrapper 정규화(:29, 슬래시 제거)와 불일치 → 현재 연결 안 됨. 앱 경로 `pathFaqs` 없음 → fallback으로 FAQ 8개(랜딩 선택 5개와 다름). EN 공통 안내(:1595 부근)에 실제 UI에 없는 "Close 버튼" 동작 설명 잔존.

## 1. 조건
- 승인된 테마·컴포넌트 유지. 테스트 기대값은 "현재 승인된 제품"에 맞출 때만 갱신하고, 제품이 계약을 잃은 것으로 확인되면 제품을 고친다(판정은 Claude, 근거는 Astra 검토).
- 광고 정책 불변(오피스 앱 페이지는 격리 경로로 광고 없음). 새 디자인 창작 금지: 가이드는 기존 ToolGuideWrapper 컴포넌트 그대로 사용.
- commit은 작업 브랜치, push·배포는 승인 절차 후.

## 2. 작업 단위

| WU | 내용 | 구현자 | worktree |
|---|---|---|---|
| WU-C | 컴포넌트 규격 테스트 3건 판정·수정, 엑셀 정리 `accent-primary` 누출 해소 | Sol | `work/followup2-c` / `/home/better0101/projects/wt-followup2-c` |
| WU-D | 오피스 편집기 화면에 안내 표시 | Muse (세션 신규 또는 `-s ses_f45cd39d4ffeMjz2CpUX4DjHJJ --fork`, 정본화 시 결정) | `work/followup2-d` / `/home/better0101/projects/wt-followup2-d` |

병렬 근거: WU-C(테스트 3파일·ExcelCleanerPage)와 WU-D(OfficeEditorAppPage·필요 시 오피스 전용 CSS)는 파일·런타임 전제 무겹침. 단, WU-D가 ToolGuide 소비자를 1 늘리므로(OfficeEditorAppPage) WU-C의 소비자 수 기대값은 **WU-D 반영 후 통합 단계에서 최종 확정**(WU-C는 수치 대신 "소비자 목록 명시 + 목록 길이" 방식으로 바꿔 순서 의존을 없앤다).

## 3. WU-C — Sol
### 3-1 판정 조사(먼저, 수정 전 보고)
- Astra 소견(§0)을 출발점으로 세 테스트의 실패 단언 5개를 항목별 재확인해 `docs/jobs/todo/adsense-followup2-20260920/WU-C-FINDINGS.md`에 기록(근거 파일:행·유입 커밋). 현재 테스트 통과를 승인 계약 충족으로 간주하지 않는다. ToolCard h2/h3 불일치는 기록만 하고 제품·기대값을 바꾸지 않는다(별도 회부).
### 3-2 수정
- 낡은 단언 수정: ToolGuide 소비자는 명시 목록(파일 배열, PLAN-2의 PdfComparePage와 WU-D의 OfficeEditorAppPage 포함 → 통합 시 25)과 길이로, OperationProgress 소비자 16은 유지(목록 방식으로 전환 가능), 색상 단언은 "모든 accent 공통 primary + 오류 상태색 분리"의 현재 계약으로, ToolCard 정규식은 `group` 포함 루트·`getToolIconTone(tool.id)`·`data-icon-tone` 현재 계약으로 갱신. 접근성·진행률·링크·추적·태그 최대 3개 단언은 그대로 보존. 7색 registry 단언은 유지(색 렌더링 증명은 아님을 주석).
- `accent-primary`(ExcelCleanerPage.tsx:231 checkbox): 죽은 클래스가 아니므로 제거하지 않고 **같은 선언을 보존하는 동등 표현 `[accent-color:var(--primary)]`로 치환**한다. global.css·테스트 허용목록은 변경하지 않는다. 확인: 파일 선택 후 시트 목록 checkbox의 checked/unchecked computed `accent-color`가 변경 전과 같음(preview DOM), 캡처 전후 1쌍.
### 3-3 검사·소유
- 검사: 세 테스트 파일 + ui-legacy 테스트 통과, `npm run build`, 엑셀 정리 화면 캡처(변경 시). 전체 unit은 통합에서(기대: 실패 0).
- 소유: `tests/unit/p1b-components.test.ts`, `src/features/excel-cleaner/ExcelCleanerPage.tsx`(231행 클래스 치환만), 기록 `docs/jobs/todo/adsense-followup2-20260920/WU-C-FINDINGS.md`·`WU-C-REPORT.md`. `tests/unit/ui-legacy-isolation.test.ts`·global.css는 수정 금지.

## 4. WU-D — Muse
- `OfficeEditorAppPage.tsx`: 기존 canvas shell 닫는 태그(:585) **다음, drag overlay(:586) 앞**에 형제로 `{!focusMode && <ToolGuideWrapper slug="officeEditor" />}` 추가. 비집중 상태(idle·downloading·preparing·ready·opening·error)에서 표시, editing·saving과 저장 후 editing 복귀에서는 **비렌더링**(접기 아님). 저장 상태 전이·canvas 부모 구조·ResizeObserver·COI·SW·드롭 처리는 변경하지 않는다. 재표시는 새 진입·새로고침·오류 전이에서만 발생함을 계약으로 명시.
- 데이터 최소 수정(WU-D 소유로 허용): KO/EN `officeEditor.pathBlocks` 키 `/tools/office-editor/app/` → `/tools/office-editor/app`(Wrapper·검증기 정규화와 일치, 검증기의 정확 라우트 일치 규칙에 맞음). 앱 경로 `pathFaqs["/tools/office-editor/app"]`를 랜딩 선택 5개와 같은 ID로 추가(FAQ 8개 fallback 대신 선택 표시; 검증기 비어 있지 않음 규칙 충족). EN 공통 안내의 존재하지 않는 "Close 버튼" 설명 문장은 **현재 UI에 맞는 한 문장으로 최소 수정**하고 KO 대응 문장을 대조(원문·변경 문구를 보고서에 기록). 그 외 문구 재작성 금지.
- 확인: `npm run test:guides`(pathBlocks 키·pathFaqs 규칙 통과), `node tests/office-editor-smoke.mjs` 통과(기존 단언: KO ready 드롭·문서 열기·집중 화면 topbar 숨김·랜딩→앱 인계·COI·noindex·광고/분석 스크립트 부재), preview에서 `/ko`·`/en /tools/office-editor/app/` 비집중 상태 가이드 섹션·앱 전용 블록·FAQ 5개 DOM 확인, 파일 열어 editing에서 가이드 비렌더 확인, 가이드 영역에 파일을 놓아도 기존 드롭 처리·disabled 규칙을 따르는지 확인. 캡처 KO/EN 각 ready·editing. 정적 `/tools/office-editor/app/` 템플릿은 변경하지 않으며 정적 검사 통과를 런타임 표시 증거로 쓰지 않는다.
- 소유: `src/features/office-editor/OfficeEditorAppPage.tsx`, `src/locales/ko/guides.json`·`src/locales/en/guides.json`의 `officeEditor` 키 안(pathBlocks 키·pathFaqs 추가·Close 문장 1건만), 기록 `docs/jobs/todo/adsense-followup2-20260920/WU-D-REPORT.md`. 전역 CSS·정적 생성기·랜딩 페이지 금지.

## 5. 통합 — Sol
1. PLAN-2 통합 후보(기준)에서 `integration/adsense-followup2-20260920` 생성 → WU-C ff → WU-D merge → ToolGuide 소비자 목록에 OfficeEditorAppPage 추가(통합 조정 1줄, 계약 유지).
2. 최종 검사: build → test:unit(**실패 0** 기대) → test:static → test:ads → office-editor-smoke → 시각 표본(엑셀 정리, 오피스 idle/editing KO/EN).
3. 공통 기록: CHANGELOG(오피스 편집기 화면 안내 표시, 엑셀 정리 checkbox 색 선언 표기 변경은 사용자 영향 없음이면 생략), review-notes(계약 판정 결과·ToolCard h2/h3 회부), backlog(unit 실패 10건 해소 표기, ToolCard h2/h3 결정 대기 추가).
4. Astra 검수 → Claude 판정 → 사용자 승인 → push → Pages → 운영 확인(오피스 앱 페이지는 브라우저 열람 필요: Gemini 또는 Claude).

## 6. 검사 배정
| 구분 | 검사 |
|---|---|
| WU-C | 대상 테스트 4파일, build, 엑셀 정리 캡처(변경 시) |
| WU-D | office-editor-smoke, preview DOM 확인, 캡처 4장 |
| 통합 | build, test:unit(0 실패), test:static, test:ads, 시각 표본 |
| 적용 아님 | 전 도구 회귀, 시각 회귀 전체, 성능 |

## 7. 완료 기준
소스 수정 → 관련 테스트 통과 → 통합 검사(unit 실패 0) → 배포 성공 → 운영 확인. "제품이 계약을 잃음" 판정 항목이 나오면 그 항목만 회부·별도 처리하고 나머지는 진행.

## 8. 변경 이력
- v0.1 (2026-09-20): 초안. Astra 반박은 PLAN-2 정본화 뒤 발행.
- v0.2 (2026-09-20, 정본): Astra 1차 반박 반영 — accent-primary는 Tailwind utility → `[accent-color:var(--primary)]` 동등 치환(허용목록·global.css 불변), 오피스 8상태·`!focusMode` 비렌더링·삽입 위치(:585 다음)·저장 후 재표시 문구 삭제, officeEditor 앱 pathBlocks 키 슬래시 정정·앱 pathFaqs 추가·EN Close 문장 최소 수정을 WU-D 소유로, p1b 단언별 판정 반영(소비자 목록 방식·색상·ToolCard 정규식 현재 계약), ToolCard h2/h3 정본 이탈은 별도 회부, ui-legacy 테스트 수정 금지. 착수 기준은 PLAN-2 통합 후보 SHA(확정 시 기입).
- v0.2.1 (2026-09-20, 진행 기록): 기준 SHA 2fe293d 확정(PLAN-2 통합 후보). worktree wt-followup2-c/d 생성·신뢰 등록·.codex 사본·npm ci 완료. 발행: Sol WU-C task-mu9622o4-btjwf1, Muse WU-D 신규 세션(`opencode run --dir wt-followup2-d`, fork 미사용 — 다른 worktree 세션 fork는 외부 디렉터리 권한 정지로 확인됨), 로그 /tmp/wl-followup2/d/muse-*.log. 런북 추가 문안 RUNBOOK-ADDENDUM.md 준비(통합 기록 커밋에서 반영). PLAN-2 통합 후보 2fe293d Astra 검수 task-mu95zswg-o0pyyi 병행.
- v0.2.2 (2026-09-20, 진행 기록): Sol WU-C 완료 task-mu9622o4-btjwf1 → 커밋 e21b5ff(p1b 계약 갱신: ToolGuide 소비자 명시 목록 24, 색상·ToolCard 정규식 현재 계약)·a133041(excel-cleaner checkbox `accent-primary` → `[accent-color:var(--primary)]`), 최종 SHA **a133041**. p1b+ui-legacy 14/14, build 통과, 변경 전후 computed accent-color·픽셀 캡처 동일(합성 fixture). ToolCard h2/h3 정본 이탈 회부 기록(WU-C-REPORT §별도 회부). Muse WU-D: 1차 부트스트랩 9분 정지 → 종료·재발행(02:07), 진행 감시 중.
- v0.2.3 (2026-09-20, 인계): Muse WU-D 2차 재발행(02:07)도 부트스트랩 후 세션 생성 없이 10분 정지(로그 0바이트, `created id=` 없음, 권한 질문 없음). 2회 연속 실패 → Muse 실행 종료(작업트리 변경 0·커밋 0 확인) 후 **WU-D를 Sol에게 인계**(같은 worktree wt-followup2-d, 지시서 §4 그대로, task-mu96qaaf-xuljol). Muse 정지 원인 미확인(wt-followup-b 신규 세션은 정상). 종료 명령이 자기 명령줄까지 kill해 1차 기록이 끊긴 것을 재기록.
- v0.2.4 (2026-09-20, 진행 기록): PLAN-2 최종 후보 10186df가 Astra 재검수 적합·Claude 판정 적합으로 main 반영 진행 중. PLAN-3 통합 worktree wt-followup2-integration을 **10186df** 기준으로 생성(WU-C·WU-D 브랜치의 기준 2fe293d는 그 조상). 통합 시 ToolGuide 소비자 목록에 OfficeEditorAppPage 추가(25), 런북 추가 문안(RUNBOOK-ADDENDUM.md) 반영, backlog·review-notes 정리 포함.
- v0.2.5 (2026-09-20, 진행 기록): Sol WU-D 1차 발행 task-mu96qaaf-xuljol은 전달 계층이 companion 상태 로그 경로(`state/wt-followup2-d-*/jobs/task-mu96rqig-34onhy.log`)에 EROFS로 실패해 실제 잡 미생성(worktree 변경 0, HEAD 2fe293d). 같은 옵션의 WU-C 발행은 정상이었으므로 일시적 계층 오류로 판단, 1회 재발행.
- v0.2.6 (2026-09-20, 진행 기록): Sol WU-D(인계) 완료 task-mu96whqm-gpptlk → 커밋 653b80f(OfficeEditorAppPage `{!focusMode && <ToolGuideWrapper slug="officeEditor" />}`)·8dd220c(officeEditor pathBlocks 키 `/tools/office-editor/app`, pathFaqs 5개 추가, EN Close 문장 → "Pressing 'Save and download' downloads the current document and keeps the editor open…", KO는 해당 문장 없어 변경 없음), 최종 SHA **8dd220c**. test:guides·build·office-editor-smoke(4292) 통과, ready 가이드·앱 블록·FAQ 5 / editing 비렌더 DOM·캡처 4장. Sol 통합 발행(wt-followup2-integration @10186df).
- v0.2.7 (2026-09-20, 진행 기록): Sol 통합 task-mu97cp8o-44clo6 → merge 25de50a(WU-C)·c6f5fc5(WU-D), 조정 b984a73(ToolGuide 소비자 목록 +OfficeEditorAppPage=25), 기록 0523801(CHANGELOG·review-notes·backlog·agent-dispatch-runbook +16). **최종 통합 후보 SHA 0523801**. 검사: build(test:guides 49), **test:unit 605/605 실패 0**, test:static, test:ads(4391) fail 0·allowedExternal 0, discriminate, office-editor-smoke, 시각 DOM(KO/EN ready guide·FAQ 5, editing guide 0, Excel accent 동일). Astra 검수 발행.
- v0.2.8 (2026-09-20, 판정·배포): Astra 통합 검수 task-mu982xfk-dfuszk → "main 반영 후보 적합"(통합 정합·WU-C·WU-D·증거·공통 기록 모두 비차단, 런북 문구 명확화 권고 2건 → 다음 문서 정비, S10 기존 미확인 유지). **Claude 최종 판정: 0523801 적합, 구현·검증 완료.** 사용자 지시(정리 푸시 배포 모두 진행)에 따라 Sol에게 main ff push·Pages 확인·운영 확인 발행.
- v0.2.9 (2026-09-20, 종결): Sol 배포 task-mu98axhd-qw06fd → push 10186df..0523801 ff, Pages 35485514033 성공(5m24s). 운영 확인: 메인 번들 index-BBPR9s5L.js → OfficeEditorAppPage-Df8JY-5b.js에 가이드 포함, KO/EN 오피스 앱 ready에서 가이드 section 1·FAQ 5·앱 전용 문구, 엑셀 정리 로드 정상, 하단 탭 none 유지(Claude 표본 대조 일치). **상태: 운영 반영 완료.** unit 실패 0. 잔여: ToolCard h2/h3 사용자 결정, 런북 문구 권고 2건(TODO-STATUS-AUDIT §E).
