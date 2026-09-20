# 지시서 — S2b QR 폰트 감량 계획 v2 · Codex astra 2차 반박 (2026-09-06)
## 0. 선독
`PROJECT_RULES.md` → `AGENTS.md`(신설 「모델 역할 분담」 포함 — 이 라운드는 astra 반박: 작업 중 발생·인지될 예외 상황과 구성의 흠결까지 sol 이 감당할 수 있을 만큼 고려해 반박) → `docs/jobs/todo/qr-font-20260906.md` 전문 → `docs/jobs/todo/roadmap-completion-20260906.md` §3 S2-P·§결정 10·11 → `docs/jobs/todo/new-tools-roadmap-20260903.md` R4 절 → `docs/OFFICE_EDITOR_ASSETS.md` QR 폰트 절 → `docs/review-notes.md` 의 WOFF2/subset 기각 기록.
## 1. 성격·기준
- **반박 라운드(실험 모드)** — 저장소 파일 수정·커밋·push·`dist` 변경·저장소 npm/pip 설치 **절대 금지**. 실험은 `/tmp/worklazy-s2b-r2/` 에서만(Python venv·npm 임시 프로젝트 허용 — 저장소 밖). 시작·종료 `git status --porcelain`·파일 SHA 로 불변 증명.
- 저장소 루트 `/home/better0101/projects/worklazytools`, 기준 HEAD `main` = `f29d249d5d57c5fa7b68b8d87b84a20b8af43e7e`(`1a04f25` + `CLAUDE.md` 문서 커밋 1개, `src` 불변; `origin/main` 은 `1a04f25` — 로컬만 앞선 상태가 정상). 다르면 중단·보고.
- 동시에 다른 읽기 전용 라운드(U4 4차)가 같은 저장소를 읽는다 — 저장소 상태를 바꾸지 않는 한 무관.
## 2. 반박 대상
`qr-font-20260906.md` **「v2 확정」 절** D1~D6 (1차 보고 `/tmp/worklazy-s2b-r1/REPORT.md` 의 문안 채택 + Claude 결정). 1차 산출물(venv·wheel·서브셋 OTF·fixture·스크립트)은 재사용 가능. 항목별 [동의]/[이견] + 명령·출력. 특히:
- D4: 추적 커밋되는 `scripts/assets/.../*.otf.gz`+`coverage.json`+`provenance.json` 을 "생성 입력"으로 두고 Node vendor 가 검증·전개하는 경계가 PROJECT_RULES 「생성물 직접 수정 금지」와 정합한지, 현행 `vendor-qr-label-font.mjs` 구조에서 어떤 변경이 필요한지(diff 초안을 /tmp 에).
- D2: 3,394 목록 파일과 coverage JSON schema 초안(`snapshot`·`schema`·정렬된 코드포인트 배열)과 그 SHA — 1차와 동일 재생성 확인.
- D3: `QrBulkPanel.tsx` 현행 `downloadPdf`(:278~301·373~384) 구조에서 helper 분리·token·cleanup 계약이 성립하는 위치 제안(코드 diff 초안 /tmp).
- D5: 예외표 19행 중 sol 이 코드 위치를 고르지 못하는 행이 있으면 이견.
- **sol 관점 최종 점검**: v2 로 코딩 시 재해석 지점 잔존 여부. 없으면 "Claude–Codex 간 이견 0 · [정본화 가능]".
## 3. 판정 형식
항목별 표 | 항목 | 판정 | 근거(명령·출력) | 정본 반영 문안 | · 잔여 이견 수 · [정본화 가능]/[재왕복 필요]. 산출물 `/tmp/worklazy-s2b-r2/REPORT.md`.
## 4. 금지
저장소 변경 일체 · 계획서 편집(문안은 보고서에만) · 사용자 파일 3개 조작 · 인터넷에서 받은 도구를 저장소에 두기.
