# docs/jobs/todo 작업지시서 완료 감사 (Claude 판정, 2026-09-20)

기준: main 290a11f(2026-09-20 배포). 1차 검수 Gemini(gemini-3.1-pro-high, 28건 중 22건 회신 — 묶음 1: 12건, 묶음 c: 10건; 묶음 b 8건은 헤드리스 셸 권한 거부로 2회 빈 출력) + Astra(gpt-6-astra) 대체 감사(28건, task-mu94dyu7-i6owvc) → Claude가 커밋·CHANGELOG·소스로 대조해 판정. Gemini 인용 중 커밋 `3f5509c`, 경로 `src/workers/excelMergerWorker.ts`·`tests/smoke/excel-merger.mjs`는 존재하지 않아 근거로 쓰지 않았다.

## A. 기록 자체의 미완료(확정)
- **PLAN-INDEX-20260909.md의 아카이브 링크 15개가 깨져 있다.** 인덱스는 완료 15건 원문을 `../archive/<파일>`로 옮기고 `../tracked-updates.md`에 반영안을 뭉쳤다고 적었지만, `docs/jobs/archive/`에 해당 파일과 `README.md`가 없고 `tracked-updates.md`도 없다. 완료 문서 15건은 모두 `docs/jobs/todo/`에 그대로 있다. → 이번 감사 뒤 완료 확정 문서를 실제로 archive로 이동해 링크를 살린다(git 제외 경로, 제품 무영향).
- **PLAN-INDEX가 2026-09-13에서 멈춰 있다.** 이후 U9 직접 진입(커밋 b2c499d, CHANGELOG 2026-09-14), PDF 파일명 글자 수 제한(같은 커밋), 4테마 셸 병합(19e0b8d·c5b64f6, 09-16), AdSense 재심사 보완(290a11f, 09-20)이 반영되지 않았다.

## B. 문서별 판정 (Astra 감사 task-mu94dyu7-i6owvc 대조 후 확정, 2026-09-20)
| 문서 | 문서 표기 | Claude 판정 | 근거(요약) | 처리 |
|---|---|---|---|---|
| excel-cleaner-20260903 | 구현 완료 | **완료** | dac13bb, src/features/excel-cleaner/* | archive 이동 |
| excel-compare-20260903 | 정본·구현 완료 | **완료** | 6b49dc9·da8aa18, compareEngine.ts | archive 이동 |
| excel-compare-followup-20260903 | 구현 완료 | **완료** | 6bf781c·0a7403b·8facd98 | archive 이동 |
| excel-compare-dupkey-header-20260907 | v3 정본 | **완료** | 2c338cf·ebba520·657dec8·a002c0c, headerDetection.ts | archive 이동 |
| excel-format-fidelity-20260903 | 구현 완료 | **완료** | 162207a, xlsPreserve.ts | archive 이동 |
| qr-bulk-20260904 | 구현 완료(브랜치) | **완료**(main 반영됨) | 62f9031, QrBulkPanel.tsx | archive 이동 |
| qr-font-20260906 | 정본 | **완료** | ae1feea·0198036·249e172·6173125, vendor-qr-label-font.mjs | archive 이동 |
| video-followup-20260903 | 구현·배포 완료 | **완료** | 29ba546·9c4459b, videoRouteGuidance.ts | archive 이동 |
| video-dv-guidance-20260903 | 정본·구현 완료 | **완료** | e44d456, videoStream.worker.ts | archive 이동 |
| naver-seo-landing-20260904 | 정본 | **완료** | 5f3d55b·6d08c97, generate-static-pages.mjs | archive 이동 |
| rhwp-086-upgrade-20260904 | 정본 | **완료** | d74ac42·740d797·073da56, vendor-rhwp-studio.mjs | archive 이동 |
| shadcn-migration-20260903 | 정본 | **완료** | 72632c9…1ff9187 | archive 이동 |
| p2-tool-migration-20260904 | 정본·배포 완료 | **완료** | 3588eba·1ff9187·4d0bae9 | archive 이동 |
| document-compare-granularity-20260907 | v3 정본 | **완료**(엔진 범위) | 57605f3·d69e73a·cdb4007 | archive 이동 |
| visual-review-report | 결함 보고서 | **완료**(후속 수리됨) | 0ba96ed·5e6ec7c·1ff9187 | archive 이동 |
| u9-direct-entry-20260909 | v4 정본·D3 이월 | **구현·배포 완료, 종결 증거 일부 미확인** | b2c499d(09-14), scripts/audit-direct-entry.mjs, CHANGELOG 09-14; `/probe/`·OCR 성공·최종 matrix·선정 화면 검수 이월 증거 없음 | todo 유지, §C |
| pdf-header-filename-limit-20260913 | 착수 대기 표기 | **구현·배포 완료, 한·영 선정 화면 검수 증거 미확인** | b2c499d, finish/tokens.ts·PdfFinishPanel.tsx, CHANGELOG 09-14 | 상태 표기 갱신 후 §C |
| ui-theme-redesign-20260907 | v3 정본(인덱스: 미착수) | **구현됨, 최종 게이트 미종결** | 19e0b8d·c5b64f6·f69c5fc(09-16); W5 d1dd8ef 263/266(비디오 3 실패), mint·1920·shard 계약 미충족, a11y incomplete 2,113 미판정 | todo 유지, §C |
| ui-implementation-20260914 | R3 | **구현됨, 종결 기록 미완** | 위와 동일; 72장 포함 정확 manifest 부재 | todo 유지, §C |
| ui-theme-rebaseline-procedure-20260909 | 절차 정본 | **부분**(R1/R2 원자료 연결·R3 완료 추적 없음) | ui-implementation:15 기록만 | todo 유지, §C |
| bundle-pdflib-dedup-20260909 | B0/B1 절차 정본 | **미착수**(B1 진단·B2·B3 없음) | 구현 커밋 없음 | todo 유지, §C |
| bundle-b2-supply-design-20260909 | 설계 정본 | **미착수**(control/B/D 실측 없음) | 구현 커밋 없음 | todo 유지, §C |
| new-tools-roadmap-20260903 | 정본·부분 완료 | **U0~U9 구현 완료, 문서 상태 갱신 미완** | U9 b2c499d | 상태 갱신 후 §C |
| roadmap-completion-20260906 | 정본·부분 완료 | **S0~S7 구현 완료, 문서 상태 갱신 미완** | 동일 | 상태 갱신 후 §C |
| PLAN-INDEX-20260909 | 09-13 갱신 | **현행화 필요** | 아카이브 링크 15개 깨짐, 09-14~20 미반영 | 이 문서로 갱신 절 추가 |
| adsense-recheck-20260919 / followup / followup2 | 진행 | 각 PLAN.md 이력 참조 | 290a11f 배포 완료 / 구현 중 / 정본화 | — |

## C. 미완료·미확인으로 남는 항목 (후속 문서)
- **번들 다이어트 B1/B2/B3**(bundle-pdflib-dedup, bundle-b2-supply-design): B1 worker/public 귀속 진단 → B2 단일 공급안 선택·정본화 → 구현 → B3 회귀. 코드 착수 없음. 별도 `!계획!` 필요.
- **UI v3 최종 게이트**(ui-theme-redesign, ui-implementation, rebaseline 절차): 제품은 4테마 셸로 배포됐으나 W5 시각 검수 3건(비디오 navigation timeout) 미해소, mint family·desktop-1920 viewport·VISUAL_SHARD 계약 미충족, 접근성 incomplete 2,113 노드 미판정, U9 72장 포함 manifest 부재, R1/R2 원자료 연결 없음. "구현 완료·검수 종결 아님"으로 기록. 별도 `!계획!` 필요(검수·계약 정비 중심).
- **U9 직접 진입 이월 항목**: `/probe/` 처리, OCR 성공 경로, 최종 matrix, 선정 화면 시각 검수의 종결 증거 없음(구현·배포는 완료).
- **PDF 파일명 글자 수 제한**: 한·영 선정 화면 실제 검수 이월 증거 없음(구현·배포는 완료). 문서 상단 "착수 대기" 표기 정정 필요.
- **new-tools-roadmap·roadmap-completion**: 구현은 끝났으나 U9/S7 종결과 후속(UI·번들) 상태를 문서에 반영하지 않음.
- **PLAN-INDEX**: 아카이브 링크 15개 복구(이번에 이동으로 해소), 09-14 U9·파일명 제한, 09-16 4테마 병합, 09-20 AdSense 재심사 보완 반영, 수량 재집계.
- **Gemini 검증 한계**: 22/28건 회신, 인용 중 커밋 `3f5509c`·경로 2개 부존재 → 근거로 미채택. Astra 감사(task-mu94dyu7-i6owvc, /tmp/wl-adsense/review/astra-todo-audit.md 사본은 이 폴더에 보존)로 대체 확인.

## D. 처리 계획
- 완료 확정 문서 → `docs/jobs/archive/<원 파일명>` 이동(인덱스 링크 형식과 일치), 인덱스 상단에 2026-09-20 갱신 절 추가.
- 미완료 항목 → 이 문서 §C와 `docs/backlog.md`(추적) 요약 반영은 다음 통합(adsense-followup-20260920) 기록 커밋에 포함.

## E. 후속 문서 정비 항목 (2026-09-20 추가)
- 런북(docs/agent-dispatch-runbook.md) 2026-09-20 추가 문안의 Astra 권고 2건: (1) worktree Codex 준비 절차(writable_roots·npm ci 선실행)는 **승인된 구현·설치 작업에 한정**한다고 명시(읽기 전용 검수에는 불필요) (2) Muse 부트스트랩 정지 "1회 재시도"는 원인 미확인 재시도이므로 기존 규칙("수정 가능한 원인 확인 시 재시도")과의 관계를 제한적 예외로 명시. 다음 문서 커밋에서 반영.
