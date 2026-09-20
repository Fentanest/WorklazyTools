# P-QA 수정 커밋 + 시각 하네스 시계 결정성 수정

Claude → Codx, 2026-09-06. 사용자가 전달한 정본 작업지시의 실행 기록.

- 기준: ui-migration, 0663c7449f94f8d046e36c8ec16502582dd4f001. 실제 HEAD 일치.
- A: 기존 미커밋 P-QA Excel/HWP 수정 2건과 관련 기준선·QA 증거를 별도 커밋. 이전 commit 금지는 최신 사용자 지시로 무효. Claude 육안 교차 두 결함 해소 판정 수용, 수정 유지.
- B: 날짜가 바뀌면 timezone initial EN mobile이 실패하는 하네스 시계 비결정성을 수정. 제품 동작은 보존, 저장소 전체 시계 의존 조사 후 같은 원인의 다른 시나리오도 함께 고정. 필요한 기준선만 갱신하고 근거 기록. B 별도 커밋.
- 완료: A/B 해시와 포함·제외 목록, build/unit/static 및 영향 범위 스모크 실제 실행, KO/EN 셸 전체 visual 각각 175/175, 조사 발견 개수·조치, CHANGELOG/review-notes Codx 서명.
- 제외: 모든 push, 제품 동작 변경, 번들 최적화, before.docx/after.docx/naver05161fb06bc9701a23cfc09ad5773578.html 수정·커밋, p2-final 원본604장 삭제·재채집.
- 열린 계획 14문서 탐색: 상반 지시 없음. PDF 후속 10항도 config 고정 ISO + navigation 전 Date override 요구이므로 방향 일치; 해당 제품 기능 구현은 제외.

## 완료 — Codx

- A: 380764486ebffdbcc5cc065c6cad0278146f503c, 109파일.
- B: 6fc458fa064e3e59c7e6d0cfaf9b0101d73139db, 51파일.
- build/61페이지·unit195·static·Excel/HWP/utility smoke 통과. 전체 visual KO175/175(113.34초), EN175/175(134.10초); 최초 KO exit143 중단 후 단독 재실행 기록 보존.
- 현재 날짜 기본값 3도구/9시나리오/21캡처(기존 QA profile72) 고정, 날짜·연도 변경36상태·반복24비교0px.
- CHANGELOG/review-notes Codx 기록, 증거 tests/visual-artifacts/clock-fix-evidence. 원본QA604·사용자3파일 SHA-256 보존. 모든 push 미실행.
- 본 작업의 잔여 없음. PDF 후속의 시계 연결은 기존 PDF 작업 범위로 유지하며 별도 신규 backlog를 만들지 않는다.
