# 지시서 — U4(PDF 마무리) 계획 v12 · Codex astra 11차 반박 (2026-09-06)
## 0. 선독
`PROJECT_RULES.md` → `AGENTS.md`(신설 「모델 역할 분담」 — 이 라운드는 astra 반박: 작업 중 발생·인지될 예외 상황과 구성의 흠결까지 sol 이 감당할 수 있을 만큼 고려해 반박) → `docs/jobs/todo/pdf-finish-20260905.md` 전문(**「v12 확정」 절이 최신**) → `roadmap-completion-20260906.md` §2·§3 S3·§결정 10·11 → 자신의 3차·4차 보고 `/tmp/worklazy-u4-r3/REPORT.md`·`/tmp/worklazy-u4-r4/REPORT.md`·`/tmp/worklazy-u4-r5/REPORT.md`·`/tmp/worklazy-u4-r6/REPORT.md`·`/tmp/worklazy-u4-r7/REPORT.md`·`/tmp/worklazy-u4-r8/REPORT.md`·`/tmp/worklazy-u4-r9/REPORT.md`·`/tmp/worklazy-u4-r10/REPORT.md`.
## 1. 성격·기준
- **반박 라운드(실험 모드)** — 저장소 파일 수정·커밋·push·`dist` 변경·npm 설치 절대 금지. 실험은 `/tmp/worklazy-u4-r11/`(3차·4차의 `/tmp/worklazy-u4-r3/project/`·`/tmp/worklazy-u4-r4/project/`·`/tmp/worklazy-u4-r5/`·`/tmp/worklazy-u4-r6/`·`/tmp/worklazy-u4-r7/`·`/tmp/worklazy-u4-r8/`·`/tmp/worklazy-u4-r9/`·`/tmp/worklazy-u4-r10/`(proposed-guard.mjs·supplement·grammar-boundaries·browser.mjs) 재사용 가능). 시작·종료 불변 증명(3차의 `verify-unchanged.py` 방식).
- 저장소 루트 `/home/better0101/projects/worklazytools`, 기준 HEAD `main` = `f29d249d5d57c5fa7b68b8d87b84a20b8af43e7e`. **`AGENTS.md`·`CLAUDE.md` 는 워킹트리에 Claude 의 문서 변경이 있다(모델 역할 규칙 추가) — 이는 알려진 변경이며 불변 증명에서 제외하고 그 외 파일 불변을 증명한다.**
- 동시에 S2b 1차 반박(읽기 전용)이 같은 저장소를 읽는다.
## 2. 반박 대상
「v12 확정」 절 D4(10차 보완 후보 채택: catalog 경계·조건 ⑦ 출구 clipping·⑧ BT 안 Do·지원 위치 한정·비페이지 OC 전부 제외·전객체 순환 탐색·Name 해독·fixture 허용 4/제외 15+회귀). 항목별 [동의]/[이견] + 명령·출력. 특히:
- v12 문안 ↔ 10차 `proposed-guard.mjs` 동치 확인(184+2+보충 입력 재분류, 허용 전부 두 렌더러 SHA 동일 재실행).
- **새 입력 탐색 한 라운드**: ExtGState 의 SMask 외 경로·Shading `/OC`·Type3 CharProcs 내부 OC·Widget AP 내 OC 조합·상속 Resources 다단·동일 Form 을 ON/OFF 두 경로에서 참조 등. **v12 제외 조건에 이미 걸리는 입력은 이견으로 세지 말고 fixture 후보로만 목록화**. 문안을 통과하면서 표시가 갈리는 입력만 이견.
- **HEAD 주의**: 기준 `main` = `f29d249…`, 워킹트리는 `s2b-qr-font`(HEAD 71a6200) — 브랜치 전환 금지, pdf-editor 표면 불변만 확인. 동시 S2b 3차 검수 잡(`/tmp/worklazy-s2b-review3`) 무관.
- **sol 관점 최종 점검**: v12 로 U4-0~8 코딩 시 재해석 지점이 남는가. 없으면 "Claude–Codex 간 이견 0 · [정본화 가능]" 명시.
## 3. 판정 형식
항목별 표 · 잔여 이견 수 · [정본화 가능]/[재왕복 필요]. 잔여 0 이면 "Claude–Codex 간 이견 0" 명시. 산출물 `/tmp/worklazy-u4-r11/REPORT.md`.
## 4. 금지
저장소 변경 · 계획서 편집 · 사용자 파일 조작 · 상한 변경 제안.
