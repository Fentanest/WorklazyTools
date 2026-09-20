# 지시서 — U4(PDF 마무리) 계획 v9 · Codex astra 8차 반박 (2026-09-06)
## 0. 선독
`PROJECT_RULES.md` → `AGENTS.md`(신설 「모델 역할 분담」 — 이 라운드는 astra 반박: 작업 중 발생·인지될 예외 상황과 구성의 흠결까지 sol 이 감당할 수 있을 만큼 고려해 반박) → `docs/jobs/todo/pdf-finish-20260905.md` 전문(**「v9 확정」 절이 최신**) → `roadmap-completion-20260906.md` §2·§3 S3·§결정 10·11 → 자신의 3차·4차 보고 `/tmp/worklazy-u4-r3/REPORT.md`·`/tmp/worklazy-u4-r4/REPORT.md`·`/tmp/worklazy-u4-r5/REPORT.md`·`/tmp/worklazy-u4-r6/REPORT.md`·`/tmp/worklazy-u4-r7/REPORT.md`.
## 1. 성격·기준
- **반박 라운드(실험 모드)** — 저장소 파일 수정·커밋·push·`dist` 변경·npm 설치 절대 금지. 실험은 `/tmp/worklazy-u4-r8/`(3차·4차의 `/tmp/worklazy-u4-r3/project/`·`/tmp/worklazy-u4-r4/project/`·`/tmp/worklazy-u4-r5/`·`/tmp/worklazy-u4-r6/`·`/tmp/worklazy-u4-r7/` 복제본·계측 플러그인·OCG fixture 9종(incoming-path 포함)·classifyPage·OPFS probe 재사용 가능). 시작·종료 불변 증명(3차의 `verify-unchanged.py` 방식).
- 저장소 루트 `/home/better0101/projects/worklazytools`, 기준 HEAD `main` = `f29d249d5d57c5fa7b68b8d87b84a20b8af43e7e`. **`AGENTS.md`·`CLAUDE.md` 는 워킹트리에 Claude 의 문서 변경이 있다(모델 역할 규칙 추가) — 이는 알려진 변경이며 불변 증명에서 제외하고 그 외 파일 불변을 증명한다.**
- 동시에 S2b 1차 반박(읽기 전용)이 같은 저장소를 읽는다.
## 2. 반박 대상
「v9 확정」 절 D3·D4. 항목별 [동의]/[이견] + 명령·출력. 특히:
- **D4**: 7차 `classifyPage` 에 조건 ⑥(논리적 Contents 전체 순회, OFF 블록 진입 직전 열린 path 없음 — `m/l/c/v/y/h/re` 이후 painting/`n`/`W n` 종결 여부, stream 경계 초기화 금지, 외곽 q/Q wrapper 는 무관) 을 추가해 fixture 9종(`on`·`xobject-off`·`xobject-on`·`balanced-state`·`lexical-decoy`·`state-leak`·`path-leak`·5차 `ocg-off-original`·7차 `incoming-path`)이 **허용 4 · 제외 5** 로 분류되는지. 허용 4 는 RGBA SHA 동일 재확인. **조건 ①~⑥ 을 모두 통과하면서 Poppler/PDF.js 픽셀이 바뀌는 새 반례**를 적극 탐색(text state·clip·색 상태·Form 내부 등) — 있으면 이견으로.
- **D3**: OPFS `createWritable/write/close` 실패 주입 루프에서 "B 실패 → A 만 등록·C 미시작·메모리 전환 0·안내" 가 v9 문안대로 결정되는지 7차 probe 재실행.
- **HEAD 주의**: 기준 `main` = `f29d249…`. **동시에 sol 의 S2b 구현 잡이 끝났다면 워킹트리가 `s2b-qr-font` 브랜치일 수 있다** — 그 경우 `git rev-parse main` 으로 main 만 대조하고, QR 표면 변경은 이견·불변 실패로 세지 않는다(pdf-editor 표면 불변만 확인). 번들 baseline 은 1a04f25 유지. `AGENTS.md` 변경은 Claude 것(또는 S2b 첫 커밋으로 이미 반영).
- **sol 관점 최종 점검**: v9 로 U4-0~8 코딩 시 재해석 지점이 남는가. 없으면 "Claude–Codex 간 이견 0 · [정본화 가능]" 명시.
## 3. 판정 형식
항목별 표 · 잔여 이견 수 · [정본화 가능]/[재왕복 필요]. 잔여 0 이면 "Claude–Codex 간 이견 0" 명시. 산출물 `/tmp/worklazy-u4-r8/REPORT.md`.
## 4. 금지
저장소 변경 · 계획서 편집 · 사용자 파일 조작 · 상한 변경 제안.
