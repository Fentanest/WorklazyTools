# 지시서 — S2b QR 폰트 감량 계획 v1 · Codex astra 1차 반박 (2026-09-06)
## 0. 선독
`PROJECT_RULES.md` → `AGENTS.md`(신설 「모델 역할 분담」 포함 — 이 라운드는 astra 반박: 작업 중 발생·인지될 예외 상황과 구성의 흠결까지 sol 이 감당할 수 있을 만큼 고려해 반박) → `docs/jobs/todo/qr-font-20260906.md` 전문 → `docs/jobs/todo/roadmap-completion-20260906.md` §3 S2-P·§결정 10·11 → `docs/jobs/todo/new-tools-roadmap-20260903.md` R4 절 → `docs/OFFICE_EDITOR_ASSETS.md` QR 폰트 절 → `docs/review-notes.md` 의 WOFF2/subset 기각 기록.
## 1. 성격·기준
- **반박 라운드(실험 모드)** — 저장소 파일 수정·커밋·push·`dist` 변경·저장소 npm/pip 설치 **절대 금지**. 실험은 `/tmp/worklazy-s2b-r1/` 에서만(Python venv·npm 임시 프로젝트 허용 — 저장소 밖). 시작·종료 `git status --porcelain`·파일 SHA 로 불변 증명.
- 저장소 루트 `/home/better0101/projects/worklazytools`, 기준 HEAD `main` = `1a04f2571109495a76b8468af95b2f4edcd862cf`. 다르면 중단·보고.
- 동시에 다른 읽기 전용 라운드(U4 4차)가 같은 저장소를 읽는다 — 저장소 상태를 바꾸지 않는 한 무관.
## 2. 반박 대상
계획서 §4 의 1~6 항 전부. 각 항목 [동의]/[이견]/[해소 불가] + **실행한 명령·출력·산출물 경로**. 특히:
- §4-1: 서브셋 OTF 실제 생성(도구 ①·② 중 가능한 것 전부) → 현행 `qrLabelPdf.ts` 로직을 `/tmp` 에서 재현해 서브셋 폰트로 PDF 생성 → `gs`(pdftoppm 없으면 gs) 렌더 픽셀을 전체 폰트 결과와 비교 → PDF.js 텍스트 추출 일치 → 크기·gzip·brotli 실측 표.
- §4-2: 문자 집합 근거를 **수치**로(예: 위키백과 한국어 표본 텍스트에서 KS X 1001 외 음절 비율 — 인터넷 접근 불가하면 저장소 fixture·로케일 JSON 문자열로 대체하고 한계 명시).
- §4-5: sol 이 만날 예외 목록과 처리 계약(코드 위치 제안 포함).
## 3. 판정 형식
항목별 표 | 항목 | 판정 | 근거(명령·출력) | 정본 반영 문안 | · 잔여 이견 수 · [정본화 가능]/[재왕복 필요]. 산출물 `/tmp/worklazy-s2b-r1/REPORT.md`.
## 4. 금지
저장소 변경 일체 · 계획서 편집(문안은 보고서에만) · 사용자 파일 3개 조작 · 인터넷에서 받은 도구를 저장소에 두기.
