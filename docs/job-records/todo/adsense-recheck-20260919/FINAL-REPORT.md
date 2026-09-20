# adsense-recheck-20260919 최종 보고 (Claude, 2026-09-20) — 상태: 운영 반영 완료(290a11f, Pages 35480115773)

최종 통합 후보: integration/adsense-recheck-20260919 @ **290a11f** (origin/main 29fe72c의 후손, ff 가능, 17커밋; c53cadc + backlog 기록 290a11f). Astra 최종 검수: 적합(신규 차단 없음, WU2 차단 3건 해소 확인; 권고: 보고서 소속 오기 원복, backlog 후속 4항목, 스모크 메타데이터 문자열).

## 구현 완료 항목
- OCR·convert 가이드 FAQ 연결 복구(faq_19/20·OCR pathBlocks 이관, 명시 선택 목록, standard OCR 키 제거, root 보존) — Sol bc252d3
- 39건 원고: 수정 17 / 제거 20 / 미연결 video 키 삭제 2, 19건 제작 메모 원문은 docs/guide-production-notes.md — Sol 1d63027
- 검증기: App.tsx AST 라우트 정본·정확 일치·빈 선택 실패·필수 FAQ·메모 19건 fixture·고아 문단·공유 키 명시 선택 강제, 정적 검사기 세 오류 분리·자체 검증, 기대표 데이터화(+convert) — Sol 1d63027·584b7a0
- 광고 로더 결함 수정(동의 선기록+lazy 허용 경로에서 광고 미삽입) — Muse a48121a (+5줄)
- 광고 상태 전환 스모크 tests/ad-eligibility-smoke.mjs·ad-stub.mjs·test:ads — Muse 81b3fa1…97739d5
- 부산물 138개 추적 해제(evidence 42 디스크 보존·96 archive 이동), .gitignore 4줄 — Sol da3f3ba·73cdb27
- 통합 조정: package.json 개행, 광고 참조 허용목록 2줄, 공통 기록 3문서 — Sol cd53c2a·5ae29f9·3f29a4a·c53cadc

## 테스트 확인 항목(통합 후보 기준)
| 검사 | 결과 |
|---|---|
| npm run build (prebuild test:guides 49 라우트) | 통과 |
| npm run test:unit | 547 중 537 통과, 실패 10 = 기준 29fe72c와 이름 동일(기존 결함), 신규 0 |
| npm run test:static | 통과(164문서) |
| test:ads(4183) | 29행: pass 26 / not-applicable 1 / recorded 1 / unverified 1 / fail 0, 실제 외부 요청 0 |
| content-check | 39/39, OCR·convert FAQ 2경로×2언어 일치, 캡처 7 |
| 시각 | Gemini 7장 + Claude 2장 열람: 가이드·FAQ 정상, 빈 섹션·깨짐 없음 |
| Astra 검수 | WU1 적합 / WU2 1차 부적합→수정→최종 검수 적합(신규 차단 없음, WU2 차단 3건 해소 확인; 권고: 보고서 소속 오기 원복, backlog 후속 4항목, 스모크 메타데이터 문자열) |

## 운영 확인 항목
- 미반영. 운영 = a946a0b. main push 후 Pages 성공·OCR 정적 FAQ·39건 표본·제외 경로 광고 스크립트 부재 확인 예정.

## 사용자 계정에서 확인할 항목
- AdSense Auto ads 페이지 제외: /tools/pdf-editor*, /tools/hwp-editor*, /tools/document-compare*, /tools/pdf-compare*, /tools/office-editor/app/, /tools/excel-merger/xls-preserve/, /tools/video-studio*, /tools/document-redactor* (KO/EN 모두)
- 사이트 수준 Auto ads 설정과 실제 노출 표본, 모바일 overlay(S10)

## 미확인·잔여 위험
- S5: 같은 문서에서 렌더 오류가 나면 기존 광고 스크립트가 잔류(주입 재현으로 실측). 제품 처리 여부는 결정 필요.
- S9: 허용→제외 경로 이동 시 전체 새로고침으로 도구 로컬 상태 유실, 경고 없음(설계 동작, UX 선택).
- S10 실제 광고 overlay, 실제 광고 요청·노출, 심사 결과 보장 불가.
- 기존: unit 실패 10건, PdfComparePage 런타임 가이드 미연결, office-editor 랜딩 가이드 ?guide=1 한정, 데스크톱 .bottom-tabs 비스타일 노출 후보.
- 운영 설정: ~/.codex/config.toml worktree 신뢰 등록 3줄(작업 종료 후 제거 가능), worktree 4개·검수 복사본 3개 정리 대기.
