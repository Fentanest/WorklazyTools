# 지시서 — U4(PDF 마무리) 계획 v11 · Codex astra 10차 반박 (2026-09-06)
## 0. 선독
`PROJECT_RULES.md` → `AGENTS.md`(신설 「모델 역할 분담」 — 이 라운드는 astra 반박: 작업 중 발생·인지될 예외 상황과 구성의 흠결까지 sol 이 감당할 수 있을 만큼 고려해 반박) → `docs/jobs/todo/pdf-finish-20260905.md` 전문(**「v11 확정」 절이 최신**) → `roadmap-completion-20260906.md` §2·§3 S3·§결정 10·11 → 자신의 3차·4차 보고 `/tmp/worklazy-u4-r3/REPORT.md`·`/tmp/worklazy-u4-r4/REPORT.md`·`/tmp/worklazy-u4-r5/REPORT.md`·`/tmp/worklazy-u4-r6/REPORT.md`·`/tmp/worklazy-u4-r7/REPORT.md`·`/tmp/worklazy-u4-r8/REPORT.md`·`/tmp/worklazy-u4-r9/REPORT.md`.
## 1. 성격·기준
- **반박 라운드(실험 모드)** — 저장소 파일 수정·커밋·push·`dist` 변경·npm 설치 절대 금지. 실험은 `/tmp/worklazy-u4-r10/`(3차·4차의 `/tmp/worklazy-u4-r3/project/`·`/tmp/worklazy-u4-r4/project/`·`/tmp/worklazy-u4-r5/`·`/tmp/worklazy-u4-r6/`·`/tmp/worklazy-u4-r7/`·`/tmp/worklazy-u4-r8/`·`/tmp/worklazy-u4-r9/`(174입력 생성기·candidate-guard.mjs·final-assertions) 재사용 가능). 시작·종료 불변 증명(3차의 `verify-unchanged.py` 방식).
- 저장소 루트 `/home/better0101/projects/worklazytools`, 기준 HEAD `main` = `f29d249d5d57c5fa7b68b8d87b84a20b8af43e7e`. **`AGENTS.md`·`CLAUDE.md` 는 워킹트리에 Claude 의 문서 변경이 있다(모델 역할 규칙 추가) — 이는 알려진 변경이며 불변 증명에서 제외하고 그 외 파일 불변을 증명한다.**
- 동시에 S2b 1차 반박(읽기 전용)이 같은 저장소를 읽는다.
## 2. 반박 대상
「v11 확정」 절 D4(OCMD 원시 값별 규칙 ①~⑤·catalog 검증·평가 순서·fixture 허용 4/제외 10 + 회귀 32). 항목별 [동의]/[이견] + 명령·출력. 특히:
- 9차 `candidate-guard.mjs` 와 v11 문안의 차이가 있으면 지적하고, v11 문안대로 174입력을 재분류(허용 N·제외 M) → **허용 전부 두 렌더러 원본/결과 RGBA SHA 동일** 재실행(`final-assertions` 방식).
- **새 입력 탐색**: v11 을 통과하면서 표시가 갈리거나 변환 후 바뀌는 사례 — OCG 가 다른 OCMD/OCG 를 참조하는 순환·`/OCGs` 배열 내 중복 ref·상속된 Resources `/Properties`(페이지 트리 상위)·Annotation `/OC`·XObject 이미지 `/OC`·패턴/셰이딩 리소스 내부 OC·같은 property 이름이 페이지와 Form 에서 다른 OCG 를 가리키는 경우. 발견 시 이견 + 제외 조건 문안.
- **HEAD 주의**: 기준 `main` = `f29d249…`, 워킹트리는 `s2b-qr-font`(sol 수정 커밋이 추가되어 HEAD 가 `93a2318` 이후일 수 있음) — 브랜치 전환 금지, pdf-editor 표면 불변만 확인.
- **sol 관점 최종 점검**: v11 로 U4-0~8 코딩 시 재해석 지점이 남는가. 없으면 "Claude–Codex 간 이견 0 · [정본화 가능]" 명시.
## 3. 판정 형식
항목별 표 · 잔여 이견 수 · [정본화 가능]/[재왕복 필요]. 잔여 0 이면 "Claude–Codex 간 이견 0" 명시. 산출물 `/tmp/worklazy-u4-r10/REPORT.md`.
## 4. 금지
저장소 변경 · 계획서 편집 · 사용자 파일 조작 · 상한 변경 제안.
