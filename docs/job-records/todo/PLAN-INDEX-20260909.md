# PLAN-INDEX — 2026-09-09

**현재 실행:** U4·BL04·U6·U7·U8 완료/배포·사후 확인 종결. U9 직접 진입 구현 진행. 이후 사용자 추가 요청인 파일명 숫자 설정→UI 재기준화→UI v3→B1/실제 B2 재왕복. 아래 최초 감사의 수량·기준 커밋은 당시 기록이며 최신 실행 절이 현재 판정이다.

**최초 감사 판정 기준:** `d9c79b7a16f5b99fa7cddfde741b8d10f08f07d0` / s3-pdf-finish. Git 커밋 reachability+현행 코드 대조, 상세 명령/출력은 [plan-audit.json](../evidence/plan-audit.json). 완료=해당 문서 최종 유효 범위의 구현/자료 종결이며, 이번에 live 배포를 재확인했다는 뜻은 아니다. 문서 정본 상태와 구현 상태를 분리했다.

**최초 감사 당시 수량:** 요청의 기존19개 = 완료15·부분3·미착수1. 현행23개 = 완료15·부분4·미착수4. 20260909 신규4개를 별도 포함(파일 작성일/선행 정본화 묶음에 근거한 대응, 역사적19개 manifest는 제공되지 않음). 새 상세4건은 하단에 별도 연결하며 분모에 섞지 않는다. 모든 산출은 /tmp, 원 todo는 이동/수정하지 않았다.

**우선:** 번들 상한 해제, U7/U8 지금 상세 정본화, 구현순서 U4종결→U6→U7→U8→U9 유지. UI는 U4종결→재기준화, BL04는 C1 별도 선행수리. B1/B2/B3 용량정리는 제품 정본 작업 뒤 맨 마지막. 이 목록은 구현/push/배포 지시가 아니다.

| 문서 | 판정 | git·코드 근거 | 다음 행동 |
|---|---|---|---|
| [excel-cleaner-20260903.md](../archive/excel-cleaner-20260903.md) | 완료 | 000db09·dac13bb; `src/features/excel-cleaner/engine.ts:33`; `src/app/App.tsx:55` | U0.1/U2 구현 종결. 아카이브 |
| [excel-compare-followup-20260903.md](../archive/excel-compare-followup-20260903.md) | 완료 | 6bf781c·0a7403b·8facd98; `src/features/excel-compare/excelCompareClient.ts:2`; `src/features/excel-compare/ExcelComparePage.tsx:30` | X-A/B/C 종결. 후속 XML/보고서 수리는597a92f에 포함. 아카이브 |
| [excel-format-fidelity-20260903.md](../archive/excel-format-fidelity-20260903.md) | 완료 | 162207a; `src/features/excel-merger/excel.worker.ts:11`; `src/features/excel-merger/xlsPreserve.ts:17` | 위장 XLS/테마 보존 구현 종결. 아카이브 |
| [qr-bulk-20260904.md](../archive/qr-bulk-20260904.md) | 완료 | 62f9031; `src/app/App.tsx:87`; `src/features/qr-studio/QrBulkPanel.tsx:222` | U3 구현 종결. 취소 시 결과 폐기는 기존 계약. 아카이브 |
| [video-followup-20260903.md](../archive/video-followup-20260903.md) | 완료 | 29ba546; `src/features/video-studio/videoProcessingClient.ts:109`; `src/features/video-studio/videoRouteGuidance.ts:5` | V-A/V-B route guidance·hybrid 구현 종결. backlog WebM/CRF 등은 제외 유지. 아카이브 |
| [naver-seo-landing-20260904.md](../archive/naver-seo-landing-20260904.md) | 완료 | 5f3d55b·6d08c97; `scripts/generate-static-pages.mjs:157`; `scripts/validate-static-output.mjs:126` | 루트 메타+후속 가치 문구 구현 종결. 기준8d91b62는 구현 증거 아님. 아카이브 |
| [p2-tool-migration-20260904.md](../archive/p2-tool-migration-20260904.md) | 완료 | 3588eba·1ff9187·4d0bae9; `src/features/excel-cleaner/ExcelCleanerPage.tsx:8`; `src/features/pdf-editor/PdfEditorPage.tsx:8` | P2 B1~B6·shared·최종 QA 통합. 기존 후속 UI 부채는 신규 UI 계획 소유. 아카이브 |
| [qr-font-20260906.md](../archive/qr-font-20260906.md) | 완료 | ae1feea·0198036·249e172·6173125; `scripts/vendor-qr-label-font.mjs:9`; `src/features/qr-studio/qrLabelFont.ts:6` | 빌드타임 subset·coverage·fallback·취소 종결. PDF 추출/GS 기존 부채 별도. 아카이브 |
| [rhwp-086-upgrade-20260904.md](../archive/rhwp-086-upgrade-20260904.md) | 완료 | d74ac42·740d797·073da56; `package.json:62`; `scripts/vendor-rhwp-studio.mjs:18` | 0.8.6 고정 의존/벤더 입력 도입·통합. 아카이브 |
| [shadcn-migration-20260903.md](../archive/shadcn-migration-20260903.md) | 완료 | 72632c9·932c5eb·4804a45·7ba78b0·f866bed·0ba96ed·1ff9187; `src/components/ui.tsx:15`; `src/components/ui/switch.tsx:24` | revert 뒤 reapply·교정·P2 최종 통합 기준 종결. 초기415e35b만으로 완료 판정하지 않음. 아카이브 |
| [video-dv-guidance-20260903.md](../archive/video-dv-guidance-20260903.md) | 완료 | e44d456; `src/features/video-studio/videoStream.worker.ts:47`; `src/hooks/useOperationProgress.ts:21` | W-A~D 구현 완료. 실제 HEVC 지원호스트/4GB의 과거 skip 한계는 기록 보존. 아카이브 |
| [document-compare-granularity-20260907.md](../archive/document-compare-granularity-20260907.md) | 완료 | 57605f3·d69e73a·cdb4007; `src/features/word-compare/word.worker.ts:9`; `src/features/document-compare/documentComparison.ts:376` | 최종 정본은 엔진만. UI 폭/rail/ARIA는 UI 재설계로 이관, 본 문서 잔여 아님. 아카이브 |
| [excel-compare-dupkey-header-20260907.md](../archive/excel-compare-dupkey-header-20260907.md) | 완료 | 2c338cf·ebba520·657dec8·a002c0c; `src/features/excel-compare/headerDetection.ts:14`; `src/features/excel-compare/ExcelComparePage.tsx:356` | 중복키·머리글 구현 종결. 기존 BL04는 별도 수리 정본, BL01/02/03/05는 UI backlog. 아카이브 |
| [excel-compare-20260903.md](../archive/excel-compare-20260903.md) | 완료 | 6b49dc9·da8aa18; `src/features/excel-compare/compareEngine.ts:52`; `src/app/App.tsx:54` | U0/U1 구현 종결. 중복 문서 재착수 금지. 아카이브 |
| [new-tools-roadmap-20260903.md](new-tools-roadmap-20260903.md) | 부분 완료 | da8aa18·dac13bb·62f9031·d3a8d89; `src/app/App.tsx:55` | U0~U4·U6·U7·U8 종결, U5 폐기. U9 잔여. 최신 상세 순서 링크 유지 |
| [pdf-finish-20260905.md](../archive/u4-and-bl04-20260909/pdf-finish-20260905.md) | 완료 | 3dbef33·be20fdd·d3a8d89·d9c79b7; `src/features/pdf-editor/finish/engine.ts:104`; `src/features/pdf-editor/PdfFinishPanel.tsx:265` | `83f2104` / Pages `34321552862`와 한영 live 확인으로 종결·아카이브. 기존 부채 별도 |
| [roadmap-completion-20260906.md](roadmap-completion-20260906.md) | 부분 완료 | 0a84578·c6c8e27·44d4ed7·6173125·d3a8d89; `src/app/App.tsx:61`; `src/features/word-compare/word.worker.ts:9` | S0~S6/U8 종결. S7/U9 잔여, 용량정리 마지막 |
| [ui-theme-redesign-20260907.md](ui-theme-redesign-20260907.md) | 미착수 | 구현 커밋 없음/기존 구조; `src/components/ui.tsx:142`; `src/app/toolRegistry.ts:37` | 디자인 정본 v3는 유지, 구현은 U4 종결→기준 재설정 후. 문서비교 이관 UI 포함 |
| [visual-review-report.md](../archive/visual-review-report.md) | 완료 | 0ba96ed·5e6ec7c·1ff9187; `src/components/ui.tsx:17`; `src/components/ui/switch.tsx:24` | 과거 감사자료로 종결/아카이브. 보고의 “모든 화면100%파손” 추측은 확정 사실로 승격 금지; 현재 시각PASS 재실행 주장은 아님 |
| [bundle-pdflib-dedup-20260909.md](bundle-pdflib-dedup-20260909.md) | 부분 완료 | 구현 커밋 없음/기존 구조; `src/utils/pdfFontEmbed.ts:1`; `src/features/pdf-editor/pdf.worker.ts:4` | B0 탐색 존재, B1 미실행·B2 미구현. 새 B2 설계공간 문서 우선, 용량정리 마지막 |
| [u6-privacy-masking-20260909.md](../archive/u6-privacy-masking-20260913/u6-privacy-masking-20260909.md) | 완료 | `5ac8b647`; Pages `34706393538` 성공 | P0~P3·UI·통합·한영 live 종결, 아카이브 |
| [u9-direct-entry-20260909.md](u9-direct-entry-20260909.md) | 진행 중 | 9fa435a 기준gate PASS·actual23도구; `/tmp/worklazy-u9-core/GATE.json` | D0·typed preset/비동기 보존·비디오격리 구현. 기존U4 URL 보존, 최종검증·배포 아직 |
| [pdf-header-filename-limit-20260913.md](pdf-header-filename-limit-20260913.md) | 정본·착수 대기 | 사용자 비긴급 추가 요청, Claude 초안/Astra 2회 검토 확정 문구 반영 | U9 배포·라이브 뒤, UI 재기준화 전. 숫자 이상일 때 그래핌 단위 축약·파일명 셀 폭 맞춤 |
| [ui-theme-rebaseline-procedure-20260909.md](ui-theme-rebaseline-procedure-20260909.md) | 미착수 | 구현 커밋 없음/기존 구조; `src/components/ui.tsx:142`; `src/app/toolRegistry.ts:38` | 절차 정본화 완료와 실행은 별개. U4 배포/사후 확인 후 R0~R3 수행; 지금 기준을 바꾸지 않음 |

| 새 상세 정본 | 현재 구현 상태 | 다음 행동 |
|---|---|---|
| [U7](../archive/u7-bulk-generation-20260913/u7-bulk-generation-20260909.md) | 완료·배포 | 1df3c2e / Pages 34713794908 성공, 라이브 확인 종결 |
| [U8](../archive/u8-pdf-compare-20260913/u8-pdf-compare-20260909.md) | 완료·배포 | 9fa435a / Pages34719374659 성공, live9자산 및 비교/XLSX재열기 종결 |
| [B2 설계 공간](bundle-b2-supply-design-20260909.md) | 공급 구현 미착수, B1 진단 없음 | 마지막 다이어트 단계에서 B1→실제 B2안 재왕복 |
| [BL04](../archive/u4-and-bl04-20260909/bl04-xls-error-type-20260909.md) | 완료·배포 | `7e69597` 통합 수리, U4 release `83f2104`에 포함·검증 |

완료15개 원문은 [오프라인 아카이브](../archive/README.md)에 사본으로 묶었다. 추적 CHANGELOG/backlog/review-notes 반영안은 [tracked-updates.md](../tracked-updates.md). 잔여만 정리한 실행 목록은 같은 plans 디렉터리의 해당 문서명 사본이며 원계약은 reference/에 보존한다.

**열린계획 충돌 정리:** U7/U8 상세 시점은 이번 지시 우선; 이전 U6/GATES 문서의 고정 용량 수치·새 도구 상세 금지는 역사 기록으로만 읽는다. U4 완료 출력·QR폰트·기존 DOCX/Excel oracle은 불변. UI의 U1~U6 표기는 문서결과 UI 6항으로 신규 도구 U6와 구분한다. B2 원문보다 새 설계공간 문서의 상한해제/맨마지막 실행 규칙이 우선한다.

## 2026-09-20 갱신 (Claude) — 이 절이 위 상태표보다 우선

- 완료 15건 원문을 이번에 실제로 `../archive/<원 파일명>`으로 이동했다(이전 "사본으로 묶었다" 기록은 실제 파일이 없었음). `tracked-updates.md`는 존재하지 않는다.
- 2026-09-14 b2c499d: U9 직접 진입 D3 통합·PDF 머리글/바닥글 파일명 글자 수 제한 배포(CHANGELOG 09-14). 두 문서의 "진행 중/착수 대기" 표기는 구현 완료로 읽고, 남은 것은 이월 검수 증거(§C of TODO-STATUS-AUDIT-20260920.md).
- 2026-09-16 19e0b8d·c5b64f6: 4테마 셸 main 병합(ui-theme-redesign v3 구현). W5 최종 게이트(263/266, mint·1920·shard, a11y incomplete)는 미종결.
- 2026-09-18~20: AdSense 재심사 보완(adsense-recheck-20260919) 290a11f 배포·운영 확인 완료. 후속 adsense-followup-20260920(5건) 구현 중, adsense-followup2-20260920(3건) 정본화.
- 번들 B1/B2/B3(bundle-pdflib-dedup, bundle-b2-supply-design)는 미착수 유지.
- 상세 판정: [TODO-STATUS-AUDIT-20260920.md](TODO-STATUS-AUDIT-20260920.md).

## 실행 추적 — 2026-09-09 Codx

사용자가 모든 정본 작업 수행과 이 세션의 U4 인계를 명시했다. 위 문서 정본화 당시의 구현 금지는 현재 실행 지시로 대체되며 선행 순서·기술 계약은 유지한다. BL04는 `6781137` 구현을 `7e69597`로 통합했고 실제 오류/literal·캐시·legacy oracle과 사용자 업로드 8경로 검증을 마쳤다. U4는 `0f02458`에서 병합 게이트를 회수 중이며 아직 main push·배포 전이다. 기본 상한은 5개 `null`로 해제했고 계측·inventory 검사는 보존한다. 상세 실행 상태 `/tmp/worklazy-u4-mergegate3/STATE.json`. U6 이후는 미착수이며 read-only 준비도 조사만 했다.

실행 갱신: 제품 f0a5b169·검수기록 82fa9c9b9567f0bc2e80e9c65189a2b5be4945e0에서 U4 자동 게이트와 실제 시각/DOM 검수를 종결. 아직 live배포 전이며 `/tmp/worklazy-u4-mergegate4/STATE.json`이 최신 실행 상태다. BL04도 이번 단일 U4 배포에 포함.

## 최신 실행 판정 — U4·BL04 종결 (2026-09-09 Codx)

이 실행기록이 위 d9 당시 상태표보다 우선한다. 최초배포5caefc4/34317542767 성공 및 사용자후속수리77c9ccd→release83f210406fbedae41632ed77edffe2db058cae63/Pages34321552862 성공. 한영live4옵션출력·stamp단독제외·자산SHA58관찰,PDF10route236자산관찰/2PDF+ZIP/HTTP14/한글previewQA동일을확인했다. U4와BL04는 **완료·아카이브**로이동. 정본결과 `../archive/u4-and-bl04-20260909/closure-evidence/CLOSURE.json`,코드기록CHANGELOG/판정review-notes/살아있는부채backlog. 기준상한해제·실기기한계·heartbeat미달·상속a11y부채는종결로없어진것아님.

다음 착수는U6 P0만. U7→U8→U9→UI재기준화→UIv3구현→B1/실제B2재왕복 순서유지. U6 P0통과전P1금지·품질/새네트워크0/계수실증등상세기술게이트유지.

## 추가 사용자 요청 — PDF 파일명 축약 설정 (비긴급)

2026-09-09: 머리글·바닥글에 넣는 파일명을 자동 말줄임에 맡기지 않고 숫자로 축약 기준을 입력받아, 지정 글자 수 이상일 때 줄이는 옵션을 요청했다. 진행 중 작업 사이의 PDF 관련 후속으로 편성한다. 상세 요청은 `docs/backlog.md`의 「머리글·바닥글 파일명 축약 길이 직접 지정」 참조. 이 기록은 새 정본이나 구현 완료 판정이 아니며 U4/BL04 종결 및 U6 재왕복 대기 상태는 유지한다. 앞서 요청한 U6의 Claude 검토 대행에 대한 답변으로 해석하지 않는다. — Codx

2026-09-13 조사 갱신: Gemini의 현행 파일명/미리보기/출력 경로 읽기와 root 국소대조는 `/tmp/worklazy-pdf-filename-reading/REPORT.md`, `ROOT-NOTES.md`에 보존했다. 현행은 출력 폭 말줄임과 CSS 미리보기 줄바꿈이 다르며 `captureTokenValues`만 바꾸면 두 경로에 적용된다는 제안은 불충분하다. 사용자 조건은 숫자 **이상(>=)** 이다. 미정 기본값·출력길이·배치폭 충돌·문자단위를 확정된 계약으로 취급하지 않는다. 이 조사는 새 정본/구현 완료가 아니다.

후속 확정: [파일명 숫자 설정 v1](pdf-header-filename-limit-20260913.md)을 Claude actual 초안·수정과 Astra 원5쟁점 검토/확정문구 반영으로 정본화했다. 빈 값=문자축약없음, N이상=앞N−1그래핌+말줄임, 폭부족=해당파일명셀 글자축소라는 작업가정을 기록했다. 이 기록은 앞선 미정 상태를 대체하지만 제품 구현 완료가 아니다. U9 라이브 종결 뒤 UI 재기준화 전에 실행하며 U4 archive를 다시 열지 않는다. 선호 질문의 미응답을 허락 대기로 바꾸지 않는다.

## 최신 실행 판정 — U6 진행 (2026-09-13 Codx)

U4·BL04의 종결/배포 상태는 유지한다. U6 v4의 P0 가능성 검증과 P1 핵심 구현·독립검수가 완료되었고, P2 UI의 실제 출력·DPR·취소 검증 뒤 이전 ZIP 보존/한도 실패시 배치중단의 국소수정을 마감 중이다. P3 worker CSP는 임시사본 실증을 마쳤으며 제품 등록·전용문서/SW/BFCache·최종통합·시각검수·배포는 아직이다. 현재 제품 사본 /tmp/worklazy-u6-impl, 기준 fa0bef7; 상세 실행 정본은 u6-privacy-masking-20260909.md 마지막 기록을 따른다. U7 이후는 선행 완료 전 미착수이며 PDF 파일명 축약 옵션 요청도 대기 유지한다.

## 최신 실행 판정 — U6 종결·U7 착수 (2026-09-13 Codx)

이 기록이 위 과거 상태표와 U6 진행 기록보다 우선한다. U6 `5ac8b6473d1786691fff7a83c5fde126f16e6af1` / Pages `34706393538` SUCCESS 및 한영 live 자산각19 SHA·PNG처리/재열기·입력후HTTP0 확인으로 완료·아카이브. [종결근거](../archive/u6-privacy-masking-20260913/closure-evidence/CLOSURE.json). U7-0은 원정본 기준 d9c79b7의 reachability와 대상차이를 확인하며 시작한다. U6가 바꾼 C3 Reader와 등록·정적생성기 교집합은 현행계약으로 대조; U7 이전 UI/다이어트 동시 구현 없음. 사용자 원유지보수 파일은 제외·보존. U7-0 통과 전 제품 연결 없음. 파일명 축약 숫자 입력 요청은 대기 유지.

## 최신 실행 판정 — U7 종결·U8-0 착수 (2026-09-13 Codx)

U7 release `1df3c2e50edeb010272d82f15f279c1355f9f8ab` / Pages `34713794908` 성공. 실제 CI artifact와 live 자산6종 bytes/SHA 일치 및 합성 DOCX 다운로드·재개방, 외부HTTP0·페이지오류0 확인으로 종결·아카이브. [종결 증거](../archive/u7-bulk-generation-20260913/closure-evidence/CLOSURE.json). 다음 U8-0은 이 release를 실행 기준으로 원정본 d9c79b7 reachability·대상 차이·열린 계획 충돌을 기록하고 진행한다. U8-0 수용 전 제품 연결은 하지 않는다. U7 범위 지정 visual의 기존 U6 기준선7장 부재(exit1)는 UI 재기준화 backlog 소유로 남기며 새 U7 6장은 차이0이다. PDF 파일명 축약 숫자 옵션 대기 요청과 U9→UI 재기준화→UI v3→용량 정리 순서를 유지한다.


## 최신 실행 판정 — U8 종결·U9 실행 게이트 (2026-09-13 Codx)

U8 release9fa435ae6be5c92b05f9032479d1f7298899b76b / Pages34719374659 success, 실제CIartifact와live9자산 bytes/SHA일치 및 합성PDF비교/XLSX재열기·외부HTTP0/pageerror0로종결. [증거](../archive/u8-pdf-compare-20260913/closure-evidence/CLOSURE.json). 다음U9는현행23도구/기준차이/열린계획을실제재대조한뒤typed직접진입을연결한다. 기존U6기준선7부재는UI재기준화, PDF파일명숫자요청은별도후속으로유지한다.
