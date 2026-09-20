읽기 전용 1차 검수 결과, **직하위 작업지시서 24개 중 15개는 기존 종결 판단을 유지해 보관 가능**, **9개는 미완료 또는 종결 증거 미확인**입니다. 별도로 `PLAN-INDEX`는 현행화가 필요합니다.

요청 수량과 실제 파일 수가 다릅니다. 직하위 `.md`는 26개이고, `adsense-content-audit-20260919.md`를 제외하면 **25개＝작업지시서·보고서 24개＋PLAN-INDEX 1개**입니다. 없는 문서를 만들어 28개로 맞추지 않았습니다. 인덱스에 등장하지만 이미 하위 아카이브로 이동한 U4·U6·U7·U8 문서 4개는 뒤에 별도로 정리했습니다.

**조사 기준과 제한**

- 제품 반영 기준: `290a11f94025b040d935e8a9f104241a9ca72fe7`.
- 실제 작업 공간 HEAD: `29fe72cb5a25c6d9643d69f66d713f1386a4ff4e`. 요청 기준보다 **이전 커밋**이며, `290a11f`의 조상임을 확인했습니다.
- 주요 근거 커밋 58개가 `290a11f`에 포함됨을 확인했습니다. `git log --oneline -S<식별자>`와 확장자 제한 없는 `rg` 검색으로 구현·후속 변경을 대조했습니다.
- 파일명 제한·U9·4테마의 알려진 반영 사실은 대조 자료로 사용했습니다. 배포 완료는 사용자 제공 사실이며 이번에 라이브를 재검사하지 않았습니다.
- 추적 파일 수정·커밋·push·npm 실행·보고서 저장은 하지 않았습니다.
- 아래 **확인됨**은 해당 코드·커밋·기록의 존재를 뜻합니다. 과거 검사 결과를 현재 전체 제품의 새 PASS로 바꾸지 않았습니다. **보관 가능**은 문서의 최종 유효 범위가 구현되고 기존 종결 판단을 뒤집을 근거가 발견되지 않았다는 뜻입니다.

**시작·종료 Git 기록**

시작과 종료의 `git rev-parse HEAD` 출력은 동일했습니다.

```text
29fe72cb5a25c6d9643d69f66d713f1386a4ff4e
```

시작과 종료의 `git status --short` 출력도 아래와 동일했습니다. 기존 변경을 보존했습니다.

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
```

**문서군의 우선순위**

- 신규 도구: `new-tools-roadmap` → `roadmap-completion`의 후속 결정 → U별 상세 정본. U5는 폐기됐으므로 미완료에 포함하지 않습니다.
- Excel 비교: 본체 → followup → dupkey-header v3. 후자의 중복키·머리글 계약이 같은 항목의 이전 문서보다 우선합니다.
- 문서 비교: granularity v3는 **엔진 중심 최종 범위**입니다. 결과 폭·이동 rail·ARIA 등은 UI 문서군으로 이관됐습니다.
- UI: redesign **v3 > v2 > 초안**. 실행 입력은 rebaseline 절차와 `ui-implementation-20260914.md` R3가 갱신합니다. 이후 구현 커밋은 확인되지만, 모든 완료 게이트가 자동으로 면제된 것은 아닙니다.
- 번들: `bundle-b2-supply-design`이 이전 dedup 문서의 고정 용량 상한·착수 조건을 대체합니다. B1 진단 후 실제 B2안을 정하는 순서는 유지됩니다.

아래 코드 위치는 별도 표시가 없으면 현재 체크아웃 기준입니다. 핵심 기능 파일과 UI 검증 파일은 `290a11f`와 동일함을 대조했고, 변경된 누적 문서는 필요 시 `git show 290a11f:<경로>`로 읽었습니다.

| 파일명 | 문서 자체 상태 표기 | 요구 핵심 작업 | 실제 반영 여부 — 항목별 근거 | 남은 것 |
|---|---|---|---|---|
| `excel-cleaner-20260903.md` | 구현 완료 `dac13bb` | ① 28종 정리 파이프라인·스키마 ② 수식·캐시·병합 안전 처리 ③ XLSX/CSV·보고서 ④ 취소·watchdog·UI | ① **확인됨** — `types.ts:3`, `schema.ts:28`, `engine.ts:33` (`src/features/excel-cleaner/`) ② **확인됨** — 같은 폴더 `model.ts:32`, `formulaTransform.ts:22`; `spreadsheet-core/inputAdapter.ts:188` ③ **확인됨** — `output.ts:25,105`, `src/utils/xlsxReport.ts:36` ④ **확인됨** — `excelCleanerClient.ts:18`; `000db09`·`dac13bb` | **보관 가능.** 미선택 시트·매크로·수식 재계산 등 명시 제외는 잔여 구현이 아님. |
| `excel-compare-20260903.md` | 정본; 실행 절 구현 완료 | ① 공용 입력 기반·형식별 비교 ② 위치·키·거래 대사 ③ 정규화·탐색 한도 ④ 9시트 보고서·화면 | ① **확인됨** — `6b49dc9`, `spreadsheet-core/inputAdapter.ts:110,134` ② **확인됨** — `excel-compare/compareEngine.ts:52`; `da8aa18` ③ **확인됨** — `normalization.ts:17`, `compareEngine.ts:234` ④ **확인됨** — `report.ts:6`, `ExcelComparePage.tsx:76` | **보관 가능.** 후속 두 문서의 변경을 포함해 읽어야 함. |
| `excel-compare-followup-20260903.md` | 구현 완료; X-A/B/C 커밋 명시 | ① 보고서 생성·전송·Blob 무결성 ② 파일 분배·좌우 교환 ③ 날짜·거래처 선택화 ④ 다운로드·URL 수명 | ① **확인됨** — `reportIntegrity.ts:9,38,44`; `6bf781c` ② **확인됨** — `pairFiles.ts:39,52`, `ExcelComparePage.tsx:582`; `0a7403b` ③ **확인됨** — `reconcileConfig.ts:5`, `compareEngine.ts:650`; `8facd98` ④ **확인됨** — 위 후속 커밋과 `597a92f` 보고서 수리 | **보관 가능.** OS 저장 이후 파일 상태를 앱이 보장하지 않는 한계는 유지. |
| `excel-compare-dupkey-header-20260907.md` | 제목은 초안; 하단 **v3 정본화** | ① 중복키 좌우 그룹 ② 긴 그룹 화면·보고서 분할 ③ 보수적 머리글 감지 ④ 수동 선택·검사 경쟁 상태 보존 | ① **확인됨** — `compareEngine.ts:437`, `types.ts:84`; `2c338cf`·`ebba520` ② **확인됨** — `duplicateReport.ts:35`, `ExcelComparePage.tsx:386`; 같은 커밋 ③ **확인됨** — `headerDetection.ts:14`; `657dec8` ④ **확인됨** — `pairFiles.ts:93,121,130`; 통합 `a002c0c` | **보관 가능.** BL04는 별도 수리 완료, BL01/02/03/05는 UI 후속 귀속. |
| `excel-format-fidelity-20260903.md` | 구현 완료 `162207a` | ① 위장 SpreadsheetML XLS 보존 변환 ② 파일별 값 경로 강등 ③ 입력별 theme+tint RGB 변환 ④ 일반 모드·기존 서식 보존 | ① **확인됨** — `excel-merger/xlsPreserve.ts:15` ② **확인됨** — `ExcelMergerPage.tsx:262,758,902` ③ **확인됨** — `spreadsheet-core/themeColors.ts:57,100`, `excel.worker.ts:324` ④ **확인됨** — `162207a`의 모드 분리·회귀 반영 | **보관 가능.** 미재현 복구 프롬프트·gradient/DXF 등은 제외 범위. |
| `qr-bulk-20260904.md` | 구현 완료·브랜치 push; main 미변경·검수 대기라는 과거 표기 | ① 7종 페이로드·템플릿 ② 최종 PNG 재판독 ③ 저장소·예산·취소 ④ ZIP/XLSX/라벨 PDF·직접 경로 | ① **확인됨** — `qr-studio/qrBulk.ts:78,126` ② **확인됨** — `62f9031`의 생성·재판독 구현 ③ **확인됨** — `qrBulk.ts:191`, `qrBulkStorage.ts:16,31` ④ **확인됨** — `qrLabelPdf.ts:13`, `src/utils/zipArchive.ts:45`; `62f9031`은 `1ff9187` 통합 이후 기준에 포함 | **보관 가능.** “main 미변경·검수 대기” 표기는 종결 상태로 정리 필요. |
| `qr-font-20260906.md` | 정본; v3 확정·보강 우선 | ① 빌드 타임 subset·해시 고정 ② 원문+NFC coverage ③ 전체 폰트 폴백 ④ ZIP/PDF 공용 취소·검증 | ① **확인됨** — `scripts/vendor-qr-label-font.mjs:9,18,32` ② **확인됨** — `qrLabelFont.ts:55,69` ③ **확인됨** — `qrLabelFont.ts:132`, `QrBulkPanel.tsx:353` ④ **확인됨** — `QrBulkPanel.tsx:380,393`; `0198036`·`249e172`·`6173125` | **보관 가능.** U4 전체 OTF, GS 기존 결함, PDF 추출 부채는 별도 범위. |
| `video-followup-20260903.md` | 구현·검증·push·Pages 완료 | ① 라우팅 사유 안내 ② 음향 제외 제안 ③ AAC 하이브리드·동기화 ④ 취소·안전 폴백·4K 검증 | ① **확인됨** — `videoRouteGuidance.ts:20,24` ② **확인됨** — `videoProcessingClient.ts:64`; `29ba546` ③ **확인됨** — `videoProcessingClient.ts:213`, `videoStream.worker.ts:625,645` ④ **확인됨** — `29ba546`; `docs/review-notes.md:2575` 이후 4K 출력·동기화 기록 | **보관 가능.** WebM/MKV·CRF·DV 메타데이터 보존은 제외. |
| `video-dv-guidance-20260903.md` | 정본; 실행 절 구현 완료 | ① DV profile 8 base-layer 인코딩 ② 원인·용량 안내 ③ 오디오 전환 제안 ④ 단계 로그·이벤트 병합·진행률 | ① **확인됨** — `videoStream.worker.ts:1266,1658`; `e44d456` ② **확인됨** — `videoRouteGuidance.ts`, `videoProcessingClient.ts`; `e44d456` ③ **확인됨** — `videoProcessingClient.ts:126` ④ **확인됨** — `useOperationProgress.ts:28,66`; `e44d456` | **보관 가능.** 실제 HEVC 지원 호스트·4GB 관련 과거 skip을 성공으로 바꾸면 안 됨. |
| `naver-seo-landing-20260904.md` | 정본; 후속 한·영 가치 문구 확정 | ① 루트 설명 80자 이하 ② OG 12·Twitter 5종 ③ 한·영 제목·가치 설명 ④ 중복·정확 문구 검증 | ① **확인됨** — `5f3d55b` ② **확인됨** — `scripts/generate-static-pages.mjs:187,197` ③ **확인됨** — `6d08c97` ④ **확인됨** — 위 두 커밋의 정적 검증기 변경 | **보관 가능.** `8d91b62`는 소유확인 기준 커밋이지 본 구현 근거가 아님. |
| `rhwp-086-upgrade-20260904.md` | 정본; 배포 차단 없음 판정 | ① core/editor·Studio 0.8.6 ② manifest·bytes/SHA 검증 ③ PWA·구 스냅샷 정리 ④ 편집·저장 왕복·라이선스 | ① **확인됨** — `src/config/rhwp.ts:1`; `d74ac42` ② **확인됨** — `vendor-rhwp-studio.mjs:117`, `scripts/validate-rhwp-vendor.mjs`; `d74ac42` ③ **확인됨** — 같은 생성기 `:161`, `scripts/prune-rhwp-vendor.mjs` ④ **확인됨** — `740d797`·`073da56` 및 기존 왕복 검수 기록 | **보관 가능.** 당시 공용 UI 지적은 P2/UI 후속으로 분리. |
| `shadcn-migration-20260903.md` | 정본; 초기 구현·revert·재적용 기록 병존 | ① preflight 없는 기반 ② 공용 primitive·adapter ③ 셸·공용 화면 이관 ④ 시각 하네스·P2 통합 | ① **확인됨** — `72632c9` ② **확인됨** — `932c5eb`·`4804a45` ③ **확인됨** — `7ba78b0`·`f866bed`·`0ba96ed` ④ **확인됨** — `1ff9187`·`4d0bae9` | **역사 작업으로 보관 가능.** 이후 승인된 UI v3가 shadcn/Base UI를 제거했으므로 현재 의존성 부재를 원작업 미완료로 판정하지 않음. |
| `p2-tool-migration-20260904.md` | 상단 정본; 하단 라이브 배포·검증 완료 | ① B1~B6 도구 20종 이관 ② B-shared 공용 정리 ③ legacy·orphan 정리 ④ P-QA·통합·배포 | ① **확인됨** — 문서 단계표와 `1ff9187`에 포함된 구현 이력 ② **확인됨** — `3588eba` ③ **확인됨** — `3f0cf3b`·`0663c74` ④ **확인됨** — `1ff9187`·`4d0bae9`; 문서 `:507` 이후 종결 기록 | **보관 가능.** 이후 UI 재설계가 같은 표면의 구 디자인 계약을 대체. |
| `document-compare-granularity-20260907.md` | 제목 초안; 하단 **v3 정본화** | ① 공용 문장 diff ② Python 생성기 역호출 ③ 정적 골든·동치 oracle·죽은 정의 제거 ④ HWP 실텍스트·안내 | ① **확인됨** — `documentComparison.ts:376`, `word.worker.ts:9` ② **확인됨** — `word.worker.ts:24`, `tracked_docx.py:10,686`; `5bf9a3f` ③ **확인됨** — `57605f3`·`d69e73a`, `tests/document-diff-equivalence.mjs:74` ④ **확인됨** — `cdb4007` | **보관 가능.** 결과 폭·rail·ARIA는 UI 소유이며 이 문서의 잔여가 아님. E1~E6 동치 예외 유지. |
| `visual-review-report.md` | 결함 관찰 보고서; 전체 화면 “100%” 파손 추정 | ① 스위치 충돌 ② 작업 버튼·안내문 폭 ③ 하단 가림·공용 영향 확인 | ① **확인됨** — 후속 수리 `0ba96ed` ② **확인됨** — `0ba96ed`·`5e6ec7c` ③ **확인됨** — P2 종결 `1ff9187`·`4d0bae9`의 후속 검수 기록. “전 도구 100% 파손”은 **미확인 추정**으로 유지 | **과거 조사자료로 보관 가능.** 추정 문구를 확정 사실 또는 현재 시각 PASS로 재사용하지 않음. |
| `new-tools-roadmap-20260903.md` | 정본; U2 완료·U5 드랍·후속 실행 갱신 | ① U0~U3 ② U4 ③ U6~U8 ④ U9 직접 진입·최종 감사 | ① **확인됨** — `6b49dc9`·`da8aa18`·`dac13bb`·`62f9031` ② **확인됨** — `83f2104`와 U4 closure ③ **확인됨** — `5ac8b64`·`1df3c2e`·`9fa435a` 및 각 closure ④ 구현 **확인됨** — `b2c499d`; 최종 이월 검수 회수는 **미확인** | U9의 종결 증거 연결 후 상위 로드맵 종결. “U9 미구현”으로 남겨두면 부정확. |
| `roadmap-completion-20260906.md` | 정본; 최신 기록 S6/U8 종결·S7/U9 실행 | ① S0 빈 페이지 복구 ② S1 죽은 코드 제거 ③ S2 하네스·CLS·QR 감량 ④ S3~S6 신규 도구 ⑤ S7/U9 및 후속 순서 | ① **확인됨** — `0a84578` 및 후속 복구 커밋 ② **확인됨** — `c6c8e27` ③ **확인됨** — `44d4ed7`·`6173125` ④ **확인됨** — U4/U6/U7/U8 release·closure ⑤ U9 구현 **확인됨** — `b2c499d`; U9 종결 검수·UI 최종 게이트·B1/B2는 각각 미확인/미완료 | S7 상태 갱신. 뒤에 추가된 UI·번들 작업은 각각의 최신 정본과 연결해 추적. |
| `u9-direct-entry-20260909.md` | v4 정본; D0/D1/D2 코어 고정, D3·최종 검수 이월 | ① 독립 14행·typed preset ② 비동기 작업·거부 시 URL/입력 보존 ③ 비디오 family 격리 ④ SEO/static/소셜·광역 감사 ⑤ 최종 matrix·출력·시각 검수 | ① **확인됨** — `App.tsx:64` 이후, `tests/direct-entry-contract.mjs:7` ② **확인됨** — `b2c499d`, direct-entry unit·pending/history smoke ③ **확인됨** — `videoDirectPaths.ts:1`; `b2c499d` ④ **확인됨** — `scripts/audit-direct-entry.mjs:41`, `direct-entry-contract.mjs:27`; `b2c499d` ⑤ **미확인** — 문서 말미의 `/probe/`·OCR 성공·최종 matrix/선정 시각 검수 이월을 닫는 고정 증거를 찾지 못함 | **구현·배포 반영 확인 / 지시서 종결 보류.** 기준 커밋의 `docs/review-notes.md:2779`에도 선정 화면 실제 열람 이월이 남아 있음. |
| `pdf-header-filename-limit-20260913.md` | v1 정본·U9 뒤 착수 대기; 마지막에 미착수 표기 | ① 빈 값/1~1000 parser·그래핌 축약 ② header 전용 정책 삼상태 ③ 포함 여부에 따른 생성 차단·미리보기 ④ 실제 PDF 폭맞춤 ⑤ 한·영 선정 화면 검수 | ① **확인됨** — `finish/tokens.ts:52,62` ② **확인됨** — `finish/engine.ts:173,311,464` ③ **확인됨** — `b2c499d`, `PdfFinishPanel.tsx:54` ④ **확인됨** — `finish/text.ts:165`, `engine.ts:678`; 실제 draw 크기 후속 수리 `bbe51db` ⑤ **미확인** — 기준 커밋 `docs/review-notes.md:2779`의 시각 열람 이월 해소 근거 없음 | **미착수 표기는 잘못됨.** 구현·배포 반영은 확인됐으나 최종 선정 화면 검수 증거 연결 전 보관 보류. |
| `ui-theme-rebaseline-procedure-20260909.md` | 절차 v2 정본; 실행 정본화와 구별 | ① R0 선행 종결 ② R1 실제 inventory ③ R2 시각·접근성·렌더링 ④ R3 실행 정본 확정 | ① **확인됨** — U4/U6~U9 반영 이력 ② 문서 기록 **확인됨** — `ui-implementation:15`; 원본 `R1-SNAPSHOT.json`은 **없음**, 수치 독립 확인은 미확인 ③ 7장 수리 **확인됨** — `6e477ab`·`8b06504`; 전체 완료는 **미확인** ④ R3 문서·사용자 대체 판정 기록 **확인됨** — `ui-implementation:8`; 모든 이월 게이트 종결은 미확인 | “미착수”는 현행 아님. R3에 의해 실행됐지만 원자료·incomplete 판정·전수 집합의 종결 연결이 남음. |
| `ui-theme-redesign-20260907.md` | 제목 초안; 하단 **v3 정본** | ① 4테마·FOUC·토큰 ② 자체 primitive·Sheet ③ 셸·검색·홈 ④ 문서결과 U1~U6·의존 제거 ⑤ W5 전수 시각·접근성 | ① **확인됨** — `src/theme.ts:1`, `f69c5fc` ② **확인됨** — `f47cda4`·`37dde56`, `sheet.tsx:273` ③ **확인됨** — `89c459c`·`47b1c39`, 후속 `19e0b8d`·`c5b64f6` ④ **확인됨** — `d565f23`·`17e8d95`, `WordCompareResultPage.tsx:207` ⑤ **미반영으로 보임／일부 실패** — mint 시각 family·1920 viewport·shard 계약 누락, W5 로그 3/266 실패; 아래 상세 | **미착수 아님, 구현 진행 후 최종 게이트 미완료.** 보관 불가. |
| `ui-implementation-20260914.md` | R3 갱신; R2 일부 미완·7장 수리·W0 착수까지 기록 | ① 현행 입력·AAAA 결정 반영 ② redactor 7장·러너 수리 ③ W0~W4 구현 ④ U9 72장·W5 검수 | ① 기록 **확인됨** — 문서 `:15,30`; 일부 원자료 **없음** ② **확인됨** — `6e477ab`·`8b06504` ③ **확인됨** — `f69c5fc`부터 `17e8d95`, 통합 `1ab2d52` ④ **미반영으로 보임／미확인** — 계획 337장에 대응하는 종결 manifest 없음; W5 원로그는 266개·3실패, 후속 완료 증거 미확인 | 문서를 W0 착수에서 실제 W5 실패·이월 상태로 현행화. 상위 UI v3와 함께 열어둘 것. |
| `bundle-pdflib-dedup-20260909.md` | B0/B1 조사 절차 정본; B2 미정본 | ① B0 후보 탐색 ② B1 worker/public 귀속 진단 ③ B2 단일 공급 ④ B3 oracle·캐시·worker 회귀 | ① 탐색 기록 **확인됨**, 원 `/tmp/.../candidate-es.json` **없음**으로 실측 원자료 미확인 ② **미반영으로 보임** — 일반 계측 개선 `fa0bef7`은 있으나 B1 필수 진단 묶음·전용 하네스 없음 ③ **미반영으로 보임** — `pdfFontEmbed.ts:1,10`과 `pdf.worker.ts:4`의 별도 import 유지 ④ **미확인** — B2 후보·구현이 미확정 | 최신 B2 설계 공간 기준으로 B1→후보 결정→B2/B3. 과거 shared 상한 실패를 현행 착수 차단으로 사용하지 않음. |
| `bundle-b2-supply-design-20260909.md` | 설계 공간 정본; B1 미실행·공급 구현 미착수 | ① A/B/D/N 후보·판정 규칙 ② control/B/D 실측 ③ bytes·응답성·취소·메모리·비용 비교 ④ 실제 B2 정본·공급 구현 | ① **확인됨** — 문서 `:20,38`의 설계 계약 ② **미확인** — 현재 기준 prototype 비교 산출물 없음 ③ **미확인** — 필수 7종 진단 묶음 없음; `tests/bundle-pdflib-dedup.mjs` **없음** ④ **미반영으로 보임** — 현행 별도 공급 구조 유지, 구현안 선택·종결 기록 없음 | **설계 문서 완료와 제품 작업 완료를 구분.** N 선택도 가능하지만 현재 N으로 종결한 근거는 없음. |
| `PLAN-INDEX-20260909.md` | 현재 실행 U9 진행·파일명 대기·UI 미착수; 최신 기록 09-13 | ① 문서별 상태 집계 ② 최신 정본·실행 순서 ③ 코드·종결 증거 연결 ④ 아카이브 안내 | ① **미반영으로 보임** — 09-14~17 구현 상태 미갱신 ② **부분 확인됨** — 문서군 연결 존재, UI R3 행 없음 ③ **미확인/누락** — `../evidence/plan-audit.json` **없음** ④ **미반영으로 보임** — 완료 15개 archive 링크 모두 대상 파일 **없음**; `archive/README.md`, `tracked-updates.md`도 **없음** | 아래 줄별 현행화 필요. 살아 있는 인덱스이므로 보관 대상에서 제외. |

**UI 최종 완료를 보류하는 구체적 근거**

4테마 제품 구현과 W5 완료 여부는 구분해야 합니다.

- W5 커밋 `d1dd8ef` 자체가 **263/266 성공, 비디오 3개 실패, Astra/Claude/Gemini 검토 대기**를 기록합니다. 원본 [visual-verify3.log:537](/tmp/worklazy-ui-w5-verify/visual-verify3.log:537)에서도 세 navigation timeout을 확인했습니다. 이후 해결됐다는 종결 증거는 찾지 못했습니다.
- [tests/ui-theme-fixture.mjs:5](/home/better0101/projects/worklazytools/tests/ui-theme-fixture.mjs:5)는 일반 visual profile을 coral에만 연결하고 mint를 future work로 명시합니다. `tests/unit/ui-theme-fixture.test.ts:11`도 `dark-mint` 거부를 기대합니다. 별도 bootstrap·primitive 검사의 4테마 지원은 존재하지만, **상위 정본이 요구한 시각 profile family 확장을 대신하지 않습니다.**
- [visual-regression.config.mjs:5](/home/better0101/projects/worklazytools/tests/visual-regression.config.mjs:5)의 viewport에는 desktop·mobile·mobile-320만 있고, 필수 `desktop-1920`은 없습니다. 현재 visual runner에서 `VISUAL_SHARD`도 찾지 못했습니다.
- UI R3는 U9 72장 추가와 337 manifest를 적지만, W5 로그는 266개입니다. 단순 수량 비교만으로 누락을 단정하지 않고 config/scenarios도 대조했으며, 해당 신규 직접 진입 경로의 등록을 찾지 못했습니다.
- [a11y-full2.json](/tmp/worklazy-ui-w5-verify/a11y-full2.json)은 46페이지·자동 위반 0이지만, **inherited incomplete 2,113노드**를 남깁니다. 이는 확정 결함 2,113개라는 뜻이 아닙니다. 다만 정본의 “미판정 0”을 충족했다는 증거도 아닙니다.
- 위 자료는 09-15 작업의 증거입니다. 09-16~17 후속 UI 변경까지 포함한 최종 후보 전체 PASS로 재사용할 수 없습니다.

**직하위에 없는 관련 문서 4개**

이 네 문서는 직하위에는 **없음**, 인덱스가 가리키는 아카이브에는 **있음**입니다. 요청한 28개 수량과의 차이를 설명할 가능성은 있지만, 원래 28개 목록이 없으므로 동일 집합이라고 단정하지 않습니다.

| 직하위에서 없는 파일명 | 실제 위치 | 교차 대조 결과 |
|---|---|---|
| `pdf-finish-20260905.md` | `docs/jobs/archive/u4-and-bl04-20260909/` | 번호·머리글/바닥글·워터마크·도장·평탄화·조합 처리의 release `83f2104`와 `closure-evidence/CLOSURE.json` 존재. **이미 보관됨.** |
| `u6-privacy-masking-20260909.md` | `docs/jobs/archive/u6-privacy-masking-20260913/` | 출력 검증·다중 입력/취소·전용 격리·라이브 확인의 `5ac8b64`와 closure 존재. **이미 보관됨.** |
| `u7-bulk-generation-20260909.md` | `docs/jobs/archive/u7-bulk-generation-20260913/` | DOCX 양식·행별 생성·부분 결과·보고서/ZIP의 `1df3c2e`와 closure 존재. **이미 보관됨.** |
| `u8-pdf-compare-20260909.md` | `docs/jobs/archive/u8-pdf-compare-20260913/` | 페이지 대응·픽셀/텍스트 비교·보고서·라이브 확인의 `9fa435a`와 closure 존재. **이미 보관됨.** |

**(a) 미완료 또는 미확인으로 남는 문서**

| 문서 | 남은 항목 |
|---|---|
| `bundle-pdflib-dedup-20260909.md` | B1 필수 진단, 실제 B2 선택·구현 또는 N 종결, B3 회귀. |
| `bundle-b2-supply-design-20260909.md` | 최신 기준 control/B/D 실측, 7종 판단 자료, 실제 공급안 정본화. |
| `ui-theme-redesign-20260907.md` | mint family·1920·shard·신규 profile 계약, W5 3실패 해소, incomplete 판정과 최종 검수. |
| `ui-implementation-20260914.md` | 72장 추가를 포함한 정확 manifest, 최신 후보 W5 결과, 종결 기록. |
| `ui-theme-rebaseline-procedure-20260909.md` | R1/R2 원자료 연결·이월 판정·R3 완료 상태의 추적 가능성. UI 구현을 처음부터 다시 시작할 사안은 아님. |
| `u9-direct-entry-20260909.md` | `/probe/`·OCR 성공·최종 matrix·선정 화면 검수 등 문서에 남은 이월 항목의 완료 증거. 구현·배포 반영은 확인됨. |
| `pdf-header-filename-limit-20260913.md` | 한·영 선정 화면 실제 검수 이월의 종결 증거. 구현·배포 반영은 확인됨. |
| `new-tools-roadmap-20260903.md` | U9 구현 상태 갱신 및 종결 증거 연결. |
| `roadmap-completion-20260906.md` | S7/U9 종결 연결, 후속 UI·번들 상태 갱신. |

`PLAN-INDEX`는 위 작업들과 별개로 상태·수량·링크 정비가 남습니다. 증거 미확인을 제품 미구현으로 바꾸거나, 배포 사실을 미회수 검사 통과로 바꾸면 안 됩니다.

**(b) 완료돼 오프라인 보관만 하면 되는 문서**

다음 **15개**는 최종 유효 범위의 기존 종결 판단을 유지할 수 있습니다.

1. `excel-cleaner-20260903.md`
2. `excel-compare-20260903.md`
3. `excel-compare-followup-20260903.md`
4. `excel-compare-dupkey-header-20260907.md`
5. `excel-format-fidelity-20260903.md`
6. `qr-bulk-20260904.md`
7. `qr-font-20260906.md`
8. `video-followup-20260903.md`
9. `video-dv-guidance-20260903.md`
10. `naver-seo-landing-20260904.md`
11. `rhwp-086-upgrade-20260904.md`
12. `shadcn-migration-20260903.md`
13. `p2-tool-migration-20260904.md`
14. `document-compare-granularity-20260907.md`
15. `visual-review-report.md`

현재 인덱스의 “아카이브 사본으로 묶었다”는 설명과 달리 이 15개 링크 대상은 없습니다. 실제 이동 또는 사본 보관 후 링크를 맞춰야 합니다. 이번 조사에서는 이동하지 않았습니다.

**(c) PLAN-INDEX에서 현행화가 필요한 줄**

대상: [PLAN-INDEX-20260909.md](/home/better0101/projects/worklazytools/docs/jobs/todo/PLAN-INDEX-20260909.md)

| 줄 | 필요한 현행화 |
|---|---|
| **3** | U9 “구현 진행”, 파일명 “이후 요청”, UI “후속”을 실제 상태로 교체. U9·파일명 구현/배포 반영 확인, UI W0~W5 구현 및 최종 게이트 미완료, 번들 B1/B2 잔여로 구분. |
| **5** | `../evidence/plan-audit.json` **없음**을 표시하거나 보존본 위치 복구. 해당 증거를 현재 열람 가능한 것으로 안내하지 않기. |
| **7** | 최초 19/23개는 역사 수량으로 보존. 현재 직하위 25개＝작업 문서 24＋인덱스 1이라는 별도 집계 추가. |
| **9** | 완료된 U4/U6/U7/U8을 현재 착수 순서처럼 읽히지 않게 정리. UI 실행이 이미 진행됐다는 사실 반영. |
| **13~26, 31** | 완료 15개 문서의 archive 링크가 모두 깨져 있음. 실제 보관 수행 전에는 현재 todo 위치로 연결하거나 “이동 예정” 명시. |
| **27** | 신규 도구 로드맵의 U9를 “미구현 잔여”가 아니라 “구현 반영·종결 검수 증거 확인 필요”로 갱신. |
| **29** | roadmap S7/U9 상태를 동일하게 갱신. UI·번들 후속과 제품 로드맵 자체 범위를 구분. |
| **30** | UI “미착수·구현 커밋 없음” 삭제. W0~W5·`1ab2d52`·`19e0b8d`·`c5b64f6` 반영과 미회수 W5 게이트 명시. |
| **32** | B1/B2 미완료 판단 유지. 다만 일반 계측 개선 `fa0bef7`은 존재하므로 포괄적인 “구현 커밋 없음” 대신 “B1 필수 진단·B2 공급 구현 없음”으로 정확화. |
| **34** | U9 “D3·최종검증·배포 아직” 갱신. `b2c499d` D3와 배포 반영은 확인, 남은 것은 특정 이월 검수의 종결 증거. |
| **35** | 파일명 제한 “착수 대기”를 `b2c499d` 구현·`bbe51db` 실제 그리기 수리·배포 반영으로 갱신. 선정 시각 검수 이월은 별도 표시. |
| **36** | 재기준화 “미착수” 삭제. R3 문서, `6e477ab`·`8b06504`, R1/R2 원자료·잔여 판정 연결. |
| **38~43** | 새 상세 정본 목록에 `ui-implementation-20260914.md` 추가. B2 행은 공급 미착수 상태 유지. |
| **45** | “완료15개 아카이브 사본” 설명 수정. `archive/README.md`, `tracked-updates.md`는 **없음**. `plans/reference` 안내도 실제 경로 확인 후 연결. |
| **59, 63, 65, 67, 71, 75, 79, 84** | 과거 실행·대기 기록은 역사로 보존하되, 뒤에 최신 종합 판정을 추가해 U9·파일명·UI가 계속 대기 중인 것으로 오독되지 않게 처리. |

이번 판정은 요청된 **읽기 전용 1차 검수 소견**입니다. UI의 구체적 미완료 게이트와 U9·파일명 제한의 증거 공백을 Claude의 최종 판정 입력으로 전달합니다.

Codex session ID: 01a0bc5d-9c85-7673-967f-da035525df47
Resume in Codex: codex resume 01a0bc5d-9c85-7673-967f-da035525df47
