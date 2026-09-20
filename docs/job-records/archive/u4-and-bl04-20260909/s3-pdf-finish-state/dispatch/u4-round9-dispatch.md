# 지시서 — U4(PDF 마무리) 계획 v10 · Codex astra 9차 반박 (2026-09-06)
## 0. 선독
`PROJECT_RULES.md` → `AGENTS.md`(신설 「모델 역할 분담」 — 이 라운드는 astra 반박: 작업 중 발생·인지될 예외 상황과 구성의 흠결까지 sol 이 감당할 수 있을 만큼 고려해 반박) → `docs/jobs/todo/pdf-finish-20260905.md` 전문(**「v10 확정」 절이 최신**) → `roadmap-completion-20260906.md` §2·§3 S3·§결정 10·11 → 자신의 3차·4차 보고 `/tmp/worklazy-u4-r3/REPORT.md`·`/tmp/worklazy-u4-r4/REPORT.md`·`/tmp/worklazy-u4-r5/REPORT.md`·`/tmp/worklazy-u4-r6/REPORT.md`·`/tmp/worklazy-u4-r7/REPORT.md`·`/tmp/worklazy-u4-r8/REPORT.md`.
## 1. 성격·기준
- **반박 라운드(실험 모드)** — 저장소 파일 수정·커밋·push·`dist` 변경·npm 설치 절대 금지. 실험은 `/tmp/worklazy-u4-r9/`(3차·4차의 `/tmp/worklazy-u4-r3/project/`·`/tmp/worklazy-u4-r4/project/`·`/tmp/worklazy-u4-r5/`·`/tmp/worklazy-u4-r6/`·`/tmp/worklazy-u4-r7/`·`/tmp/worklazy-u4-r8/` 복제본·OCG fixture 10종(usage-viewstate-off 포함)·classifyPage·preflight 재사용 가능). 시작·종료 불변 증명(3차의 `verify-unchanged.py` 방식).
- 저장소 루트 `/home/better0101/projects/worklazytools`, 기준 HEAD `main` = `f29d249d5d57c5fa7b68b8d87b84a20b8af43e7e`. **`AGENTS.md`·`CLAUDE.md` 는 워킹트리에 Claude 의 문서 변경이 있다(모델 역할 규칙 추가) — 이는 알려진 변경이며 불변 증명에서 제외하고 그 외 파일 불변을 증명한다.**
- 동시에 S2b 1차 반박(읽기 전용)이 같은 저장소를 읽는다.
## 2. 반박 대상
「v10 확정」 절 D4. 항목별 [동의]/[이견] + 명령·출력. 특히:
- 8차 preflight 에 지원 제외 조건(OCG `/Usage` 키 존재 · `/Intent`≠`/View` · `/D /AS` · `/OCProperties /Configs` · 기존 VE/중첩/폼 내부) 추가 → fixture 10종 **허용 4 · 제외 6** 분류 일치, 허용 4 는 **Poppler·PDF.js 두 렌더러 RGBA SHA 원본 동일**.
- **새 반례 탐색(핵심)**: `/D` 의 BaseState·ON·OFF 만 평가하고 위 조건을 통과하는 입력에서 두 렌더러가 갈리거나 변환 후 픽셀이 바뀌는 사례 — OCMD `/OCGs` 배열 + `/P`(`/AllOn`·`/AnyOff`·`/AllOff`) · `/BaseState /OFF` + `/ON` 배열 · OCG 가 `/ON` 과 `/OFF` 양쪽에 있는 모순 · `/D` 없는 `/OCProperties` · Form XObject `/OC` 가 OCMD 인 경우 등. 발견하면 이견 + 제외 조건 문안 제안(OCMD `/P` 를 `/AnyOn` 이외면 제외로 넣을지 판정 요청).
- **HEAD 주의**: 기준 `main` = `f29d249…`, 워킹트리는 `s2b-qr-font` 체크아웃 상태 — 브랜치 전환 금지, pdf-editor 표면 불변만 확인. 동시 S2b 검수 잡이 `/tmp/worklazy-s2b-review` 에서 돈다(무관).
- **sol 관점 최종 점검**: v10 으로 U4-0~8 코딩 시 재해석 지점이 남는가. 없으면 "Claude–Codex 간 이견 0 · [정본화 가능]" 명시.
## 3. 판정 형식
항목별 표 · 잔여 이견 수 · [정본화 가능]/[재왕복 필요]. 잔여 0 이면 "Claude–Codex 간 이견 0" 명시. 산출물 `/tmp/worklazy-u4-r9/REPORT.md`.
## 4. 금지
저장소 변경 · 계획서 편집 · 사용자 파일 조작 · 상한 변경 제안.
