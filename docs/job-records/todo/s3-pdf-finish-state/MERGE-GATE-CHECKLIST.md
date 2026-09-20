# Merge Gate Checklist

## 2026-09-09 통합 실행 — SCOPE-OUT

- U4 `d3a8d89d19dbb6165cacce8257838dc3dff9b084`와 원격 main `2d0ff3a8280bdd1c3149946306d0ca394244fd5c`를 `fb7abde0d40649444b877ccf4ef899bb84f46631`로 병합했다.
- TypeScript, production build, 전체 unit 496/496, static, diff-check는 통과했다.
- 고정 schema-v3 scoped/full 번들에서 app JS 증가가 100,301B로 96,000B 상한을 4,301B 초과했다. 병합 전 동일 schema-v3 93,493B 대비 병합 증분은 6,808B다.
- 예산 우선 게이트에 따라 나머지 13묶음과 규칙 19 시각 검수는 미실행 pending이다. 상한·baseline·override·multiplier를 바꾸지 않았다. 근거: `/tmp/worklazy-u4-mergegate/REPORT.md`.

U4 PDF 마무리 브랜치의 내부 작업 정본이다. `docs/jobs/` 아래에서만 유지하며 git에 추적하지 않는다. U4-8 완료 뒤 통합본에서 아래 게이트를 한 번 실행하고, 통과한 산출물만 최종 육안·배포 단계로 넘긴다.

## U4-6·U4-7 완료 상태

- [x] U4-6 reachable-only 구조 재구축, 메타데이터·첨부·주석 선택 제거, 양식 보존/제거/평면화, URI·직접 Dest·이름 Dest 링크 보존.
- [x] U4-6 fix-1 appearance BBox/Matrix 기하 보존과 첨부 Popup 관계 폐쇄.
- [x] U4-7 F4b 4 fixture×3쪽수×3 DPI×2포맷×2환경의 144셀, 별도 3파일 배치, 동일 DPI Poppler 가독성 6/6.
- [x] U4-7 제품 기본 JPEG q0.85·모바일 한계 미교정 폴백 150 DPI, 페이지별 300→200→150 하향, OPFS 우선/200MiB 메모리 결과 보유.
- [x] U4-7 fix-1 R1~R6: raw 표본 독립 peak 재집계, fail-closed 벤치 완전성, OPFS 마감 취소, Blob 할당 부분 결과, 페이지 cleanup 순서, 루트 작업문서 추적 제거.

## U4-7 fix-1 증거

- 원자료 `/tmp/worklazy-u4-7/benchmark-final/raw.json`은 덮어쓰지 않았고 SHA-256은 **`6deae09a9f03e35cd5c879d456c924caad5ece14e94c54b54c966c9beb1b2f55`**다.
- backing peak **25/144셀** 정정, 최대 desktop/photo-scan/16쪽/300DPI/PNG **461,501,557 → 585,737,224B**(+124,235,667B). used peak 변경 0, JPEG q0.85·150 DPI 결정 불변.
- peak=0, mobile=desktop 배치 복제, 배치 출력 3→2 음성 입력을 모두 실제 거부했다. worker/7경계·target 합·Cartesian 집합·배치 순서/합도 검사한다.
- OPFS `close()`/`getFile()` abort와 두 번째 Blob 할당 실패는 완료 A만 부분 결과로 보존한다. render/encode/canvas 실패는 현재 page cleanup 뒤 문서를 destroy한다.
- 전체 unit 345/345, production build 2,854 modules·71페이지, static recovery119, PDF finish/공식 oracle/PDF scoped browser/legacy diff0 통과.

## 최종 번들 잔여 예산

고정 schema-v3 baseline `/tmp/worklazy-u4-4-review5/evidence/bundle-baseline.json`, SHA-256 `4caaa9c6c48df99dd740664d7991c995ffff7e8b6deaa7a1d87e982d302c30ea`. override **{}**, multiplier **1**이며 상한은 더 올리지 않는다.

| gzip 지표 | baseline 대비 증가 | 상한 | 잔여 |
|---|---:|---:|---:|
| entry JS | 12,201B | 20,480B | **8,279B** |
| PDF route JS | 75,807B | 82,000B | **6,193B** |
| shared JS (귀속 이동 제외) | 2,413B | 30,720B | **28,307B** |
| app JS | 91,306B | 96,000B | **4,694B** |
| CSS | 400B | 10,240B | **9,840B** |

scoped와 full을 순차 독립 실행했고 둘 다 통과했다. full의 19-route 합산 -433,267B는 scoped PDF 값을 상쇄하는 근거로 쓰지 않는다. 실제 초과가 생기면 상한 추가 인상 없이 SCOPE-OUT한다.

## U4-8 뒤 통합본에서 1회 실행 — 누적 13묶음

1. 통합본 `tsc`, production build, unit 전체, `test:static`, diff-check.
2. 전체 `test:browser`, new-tools, utilities, office, QR bulk/font 2종, recovery. 기존 PDF 4모드와 `TEST_SCOPE=pdf` 실행군 확인.
3. Excel cleaner/compare 2종, xls-preserve, xls-first-load, video-hybrid 및 공용 기반 회귀.
4. PDF finish/골든 전체, legacy totalDiffs0, fixture 결정성 2회, 공식 oracle. 도장 preview↔download 16조합·keyboard48·border mutant, F4a reachable-only/전체 indirect-object raw+decoded/sentinel0·Link3종·appearance5·Popup0·OC 허용56/제외31 양 renderer SHA를 포함한다.
5. inline payload/EI, descender/Noto/회전, 0배치·1픽셀·공백·6영역·400/401타일·zero/불확실 clip·재개방·소유권·내부 구현명 비노출 경계.
6. 성능 12입력×3과 cold 경로. 실행별 heartbeat 최고점을 유지하고 128MiB 미달을 중앙값이나 진행 표시/취소 대체 계약으로 통과 처리하지 않는다.
7. 의존 exact/lock/4SHA/멱등성/음성. 버전 갱신 때 4빌드×180렌더·scalar/tail·5음성·worker/fallback 전량 갱신.
8. visual 전량: 모든 locale/theme/320px·390px·모바일 하단·시간 상한. U4-7 영향 filter와 baseline-only 실행을 제거한다.
9. a11y 전량: F2 오류4/표시실패4/reload3, F3·F4a·F4b owner/marker 상태와 incomplete 음성. 공용 incomplete 부채는 별도 유지하고 성공으로 재분류하지 않는다.
10. rendering 전량과 CLS **≤0.1** 절대 게이트. U4-7 fix-1에서는 전체 rendering/CLS를 실행하지 않았으므로 새 통과를 주장하지 않는다.
11. 최종 production schema-v3 scoped+full bundle, 실제 배포 inventory/네트워크/양방향 JS·MJS census/동일 SHA alias·내용변경·누락 음성. 5개 상한과 override/multiplier를 유지한다.
12. `css:orphans`, `legacy:manifest`, `tool-registry-routes` 전량과 20도구·locale/SEO/FAQ/정적/social/canonical/hreflang/sitemap/AdSense 격리.
13. 추적 없는 QA에서 Gemini 실제 브라우저·Claude 육안·Codx DOM 통합 검수와 배포 전 게이트. 골든①~⑦, 정정된 F4b/F5 복합 순서·다중 결과·ZIP·공유 font를 통합한 뒤 U4 전체를 한 번만 배포한다.

## 유지하는 기존 후속

- `PDFDocument.save()` 할당 실패의 부분 결과 비노출(P2), 스모크 preview 점유 포트 오인(P2), scoped browser 과장 문구(P3).
- 공용 UI inherited incomplete 125, 실기기 모바일 한계 미교정, 128MiB heartbeat 미달, 고정 PDF.js 패치 장기 유지.
- 작은 resize/24px 핸들(P3)과 main·legacy worker의 pdf-lib 중복은 각 backlog에서 별도 처리한다.

## 병합 직전 재측정 항목 (Claude 추가 2026-09-09)

fix-1 재작성에서 **main 동기화 충돌 표면 표가 빠졌다.** 값이 커밋마다 변하므로 보존이 아니라 **재측정**이 옳다. 병합 직전에 다음을 다시 잰다.

- `git ls-remote origin refs/heads/main` 으로 원격 main 실측(로컬 캐시 신뢰 금지)
- merge-base, 공통 파일 수, 파일별 충돌 hunk 수 — 원 refs/index 를 바꾸지 않는 `git merge-file -p` 파일별 모의로
- 1차 검수(2026-09-08) 시점 값은 참고용이다: main `2d0ff3a`, merge-base `5bc6854`, 공통 12파일, 충돌 `CHANGELOG.md` 1 · `docs/review-notes.md` 1 · `tests/accessibility-audit.mjs` 7 · `tests/unit/accessibility-audit.test.ts` 2 · `tests/unit/visual-config.test.ts` 1
- 텍스트 충돌 0 이어도 **의미 병합 확인 대상**: `docs/backlog.md` · `package.json` · `src/app/seo.ts` · ko/en `features.json` · `tests/unit/seo.test.ts` · visual scenarios
- 워킹트리의 `CLAUDE.md`·`PROJECT_RULES.md` 수정분은 main `2d0ff3a` 내용이며 병합으로 해소된다

## U4-8 착수 조건

- U4-7 fix-1 재검수 통과와 새 기준 HEAD/열린 계획서 충돌 게이트.
- 정본화된 F5 지시서. 확정3 legacy-organize 계약과 확정12 실행 순서 `구조 → background → 원문 → foreground → 번호/머리말/꼬리말 → 도장 → raster`를 유지한다.
- 다중 파일·부분 결과 UI, C2 fileNameSafety, C3 zipArchive, 공유 font 단일 임베드, 복합 옵션 순서와 최종 누락 감사를 F5 실제 범위로 검증한다.

main 병합·push·배포는 U4-7 fix-1 범위에서 금지한다.

## 2026-09-09 실행 재개 — Codx

사용자 지시로 기본 용량 상한을 모두 해제했다(`0f02458`, 기본5종null). 위 과거 SCOPE-OUT/상한 표는 역사 기록이며 현재 계측·무결성 검사는 유지한다. 이 세션이 U4종결/배포까지 담당한다.

- 13묶음의 실행된 증거와 소스범위 대조: `/tmp/worklazy-u4-audit3/final-gate/REPORT.md`.
- full visual ko/en 각246/246·filterall·exit0, 각3m23.67s/3m22.60s. F5이전기준선55장만harness갱신;부모도동일55불일치,51PNGbyte동일·4pixel차이0.
- 최종rootproduction build+staticPASS;107JS/MJS와1CSS의최종바이트/SHA계측일치. 실제production브라우저16경로광고분기·PDF10경로네트워크inventory대조PASS.
- heartbeat목표false·공용incomplete1973·Dolby Vision base-layer skip·실기기모바일미교정은숨기지않고backlog/검토기록유지.
- Gemini55장generic보고서는Claude검수에서반려. 추가호출실제quota429로규칙17에따라ClaudeOpus대체검수진행중. 기존추적없는QA는archive로4270에서유지. 장별픽셀판정과CodxDOM교차완료전push없음.
- 현재미완: Opus전수시각/DOM보충→최종기록/commit→main no-ffmerge→push1회/Pages→라이브사후확인. 상태`/tmp/worklazy-u4-mergegate3/STATE.json`.

## 最終 배포 전 판정 — 2026-09-09 Codx

위 이전 pending은 역사기록이다. 제품 f0a5b169, 최종 검수기록 82fa9c9b9567f0bc2e80e9c65189a2b5be4945e0에서 자동 13묶음 실행·시각/DOM 교차를 종결했다. 근거 `/tmp/worklazy-u4-audit3/final-gate4/REPORT.md`, `/tmp/worklazy-u4-mergegate4/visual-closure.json`, tracked review-notes의 「U4 배포 전 통합 검수 종결」. 기존 목표 미달/상속 incomplete/지원호스트 skip은 PASS로 바꾸지 않았다. 기본5상한null·계측무결성유지. 신규 도장공지 P2는 수리 후16환경+32실제대비+fullvisual ko/en246씩검증. Gemini80actualbrowser와Claude82+50+19actualimages, 마지막Astra23보충으로실제확인범위를완결했고검수자역할/쿼터중단/별칭을구분했다. 원격main2d0은candidate조상,공통변경경로0/충돌hunk0. 남은행위는승인된noffmerge→push1회→Pages→live사후확인.

## 사용자 라이브 신고와 후속 수리 — 2026-09-09 Codx

5caefc4의단일배포는Actions34317542767success. 사후HTTP16/BL048/PDF10경로생성·asset대조/isolated6광고0을실행했으나사용자가실제입력3건을신고해U4종결·archive와U6착수를보류한다. 실제측정교정: CI VITE_SITE_URL설정의35B차이로처음asset대조실패,동일CIenv scoped/full재계측후physical/loadedSHA일치. 초기liveCLS최대ENwatermark0.015826,모두≤0.1;프로그램파일주입뒤추가흐름CLS0.189165는별도신규발견P3/도입시점미판정이며숨기지않는다. 서비스워커block harness가COI등록undefined를만든실패와navigation중body읽기실패를보존,realSW6경로에선에러0/ads0.

사용자입력은dummyfortest에명시놓은PDF1개·PNG1개이고이사용허용이과거금지보다우선한다. 원본SHA/불변계약 `/tmp/worklazy-u4-user-bugs/authorized-inputs.json`. 로컬추적없는QA+외부요청차단에서만재현,원본추적fixture편입·원본수정·외부업로드금지.
1. 도장누락: 직접stampURL은출력도장있음. finish→stamp는enabled=false인데편집preview가보여사용자가출력포함으로인지. 사용자가번호만기본on인원인확인. 엔진소실로분류하지않음.
2. CONFIDENTIAL위치변경후끝글자만보임:끝단width1/3강제와CSS자동wrap/1줄높이불일치실제재현. Astra가watermark영역분기만수리,번호/머리글3열계약유지.
3. 한글preview□:원본7MalgunGothicsubset모두embedded/ToUnicode,Poppler정상. PDF.js thumbnail worker의FontFaceSet연결누락으로재현;ownerDocument.fonts한정adapterprobe로실제원본정상복구. Astra담당.
4. 사용자최신UI명령: 기존 '이마무리옵션포함' 기능을각탭의checkbox로옮기고그박스하나만제거. 기본체크상태(number만on)와다른설정박스유지. 불포함draft는기존preview내작은설명만,새대형박스/전역재설계없음.

이후focused/legacy/negative/실사용원본재현과한영QA시각검수→수리배포사후확인을수행한다. U4첫배포1회기록은유지하며이번추가수리는사용자명시라이브버그·개선요청의후속단위다.

## 사용자 신고 후속 수리 통합 완료·배포중 (2026-09-09 Codx)

정확지시: 4탭checkbox로포함기능이관·old include box만제거·기본값유지. UI/워터마크폭+줄바꿈/worker글꼴수리, unit506PASS/legacy44diff0/전체finishPASS/24runtime107inventory0missing/골든/lifecycle/PDFbrowser/static PASS. A11Y28 viol0/owned0/rawshared787유지/new54pixel최저15.4584,negative4+11변형PASS. visual73일치,57baseline귀속변경(55finish+2fontpreview). QA7×3 CLSmax0.00345552. production10routes236asset관찰exact/2PDF+ZIPkoenPASS. Gemini실제browser8+이미지8 및합성10(9unique)열람,SHA원도구Codx교차;Astra작성자상호검수모두PASS. 무관전체스모크는기실행최초U4검증승계. 원실패들삭제없음. 원자료 /tmp/worklazy-u4-user-bugs/integration 및각REPORT.

코드77c9ccd,release83f210406fbedae41632ed77edffe2db058cae63(원remote5caefc4),treeexact/clean확인후후속push실행. Pages/live확인전U4archive/U6착수금지유지.
